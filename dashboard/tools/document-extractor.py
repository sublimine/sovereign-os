#!/usr/bin/python3
"""Fixed, sandbox-only parser for Sublimine Document Extraction V2.

This program is never called with a user-controlled command or vault path.
DocumentExtractionRunner mounts exactly one input at /input/document and one
writable output directory at /output.  It emits no text to stdout; its only
successful products are /output/derived.txt and /output/result.json.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import zipfile

RESULT_SCHEMA = "sublimine.document-extractor-result.v1"
PROBE_SCHEMA = "sublimine.document-extractor-probe.v1"
REVISION = 1
MAX_DERIVED_BYTES = 512 * 1024
MAX_PDF_PAGES = 150
MAX_DOCX_ENTRIES = 400
MAX_DOCX_EXPANDED_BYTES = 16 * 1024 * 1024
MAX_DOCX_RATIO = 100
WORD_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
MAX_PROBE_PROC_BYTES = 128 * 1024
MAX_PROBE_NETWORK_BYTES = 16 * 1024
EPHEMERAL_FILESYSTEMS = frozenset({"tmpfs", "proc", "devtmpfs", "devpts"})
FIXED_PARSER_EXECUTABLES = ("/usr/bin/pdfinfo", "/usr/bin/pdftotext")


class ExtractionError(Exception):
    """An input or environment condition that must never yield partial text."""


def fail(message: str) -> None:
    # Diagnostics intentionally stay bounded and never interpolate document
    # content, original names, or host paths.
    print(message[:240], file=sys.stderr)
    raise ExtractionError(message)


def write_json(path: Path, value: dict) -> None:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    if len(encoded) > 64 * 1024:
        fail("El recibo del extractor excede el límite.")
    path.write_bytes(encoded)


def checked_utf8(data: bytes) -> str:
    if not data or len(data) > MAX_DERIVED_BYTES:
        fail("El texto derivado excede el límite o está vacío.")
    try:
        text = data.decode("utf-8", "strict")
    except UnicodeDecodeError:
        fail("El texto derivado no es UTF-8 válido.")
    if "\x00" in text or not text.strip():
        fail("El texto derivado no es admisible.")
    return text


def write_derived(output_dir: Path, kind: str, text: str, observations: dict) -> None:
    data = text.encode("utf-8")
    checked_utf8(data)
    derived_path = output_dir / "derived.txt"
    derived_path.write_bytes(data)
    write_json(output_dir / "result.json", {
        "schema": RESULT_SCHEMA,
        "revision": REVISION,
        "state": "EXTRACTED",
        "kind": kind,
        "derived": {"sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)},
        "observations": observations,
    })


def bounded_system_text(path: str, maximum_bytes: int) -> str:
    """Read small, fixed kernel metadata without surfacing its contents."""
    try:
        value = Path(path).read_bytes()
    except OSError:
        fail("El sandbox documental no permitió inspeccionar su política.")
    if len(value) < 1 or len(value) > maximum_bytes:
        fail("La política observable del sandbox no es admisible.")
    try:
        return value.decode("utf-8", "strict")
    except UnicodeDecodeError:
        fail("La política observable del sandbox no es UTF-8 válida.")


def mount_records() -> list[dict]:
    """Parse only the fixed fields we need from /proc/self/mountinfo.

    This is a policy check, not a host inventory: no mount source or metadata
    leaves this process, and all diagnostics below are fixed strings.
    """
    records = []
    for line in bounded_system_text("/proc/self/mountinfo", MAX_PROBE_PROC_BYTES).splitlines():
        fields = line.split(" ")
        try:
            separator = fields.index("-")
        except ValueError:
            fail("La política de mounts del sandbox no es válida.")
        if separator < 6 or len(fields) <= separator + 2:
            fail("La política de mounts del sandbox no es válida.")
        # The sandbox's fixed mount targets contain no escaped whitespace.  We
        # still decode the standard mountinfo escapes before comparing them.
        target = (fields[4]
            .replace("\\040", " ")
            .replace("\\011", "\t")
            .replace("\\012", "\n")
            .replace("\\134", "\\"))
        options = frozenset(fields[5].split(","))
        filesystem = fields[separator + 1]
        if not target.startswith("/") or not filesystem:
            fail("La política de mounts del sandbox no es válida.")
        records.append({"target": target, "options": options, "filesystem": filesystem})
    if not records:
        fail("La política de mounts del sandbox no está disponible.")
    return records


def one_mount(records: list[dict], target: str) -> dict:
    matching = [record for record in records if record["target"] == target]
    if len(matching) != 1:
        fail("La política de mounts del sandbox no acreditó el aislamiento.")
    return matching[0]


def writable_mount(record: dict) -> bool:
    return "rw" in record["options"] and "ro" not in record["options"]


def path_absent(path: str) -> bool:
    # lexists catches a dangling symlink too; a hidden host tree is not an
    # acceptable substitute for an absent host tree.
    return not os.path.lexists(path)


def assert_mount_policy() -> None:
    """Require the exact writable-boundary shape of the bwrap invocation.

    The test intentionally does not try a write outside /output: attempting
    one could mutate a host filesystem if the policy were broken.  Instead it
    accepts only an /output writable bridge; every other writable mount must
    be an ephemeral kernel filesystem (tmpfs/proc/dev).  The root and /tmp
    must themselves be tmpfs, so scratch writes cannot become durable state.
    """
    records = mount_records()
    root = one_mount(records, "/")
    temporary = one_mount(records, "/tmp")
    output = one_mount(records, "/output")
    if root["filesystem"] != "tmpfs" or not writable_mount(root):
        fail("El root del sandbox documental no es efímero.")
    if temporary["filesystem"] != "tmpfs" or not writable_mount(temporary):
        fail("El temporal del sandbox documental no es efímero.")
    if not writable_mount(output):
        fail("La única salida documental no es escribible.")
    for target in ("/usr", "/bin", "/lib", "/lib64", "/tool/document-extractor.py"):
        record = one_mount(records, target)
        if "ro" not in record["options"] or "rw" in record["options"]:
            fail("Una dependencia documental no está montada en solo lectura.")
    for record in records:
        if writable_mount(record) and record["target"] != "/output" and record["filesystem"] not in EPHEMERAL_FILESYSTEMS:
            fail("El sandbox documental expuso una escritura persistente no permitida.")
    for forbidden in ("/home", "/root", "/run", "/etc", "/var", "/input"):
        if not path_absent(forbidden):
            fail("El sandbox documental expuso un árbol de host no permitido.")


def assert_private_network_namespace() -> None:
    """Check a local, observable private-net policy without dialing outward."""
    try:
        current_namespace = os.readlink("/proc/self/ns/net")
        init_namespace = os.readlink("/proc/1/ns/net")
    except OSError:
        fail("El sandbox documental no expuso su namespace de red.")
    namespace_id = current_namespace[5:-1] if current_namespace.startswith("net:[") and current_namespace.endswith("]") else ""
    if not namespace_id.isdigit() or current_namespace != init_namespace:
        fail("El sandbox documental no acreditó un namespace de red coherente.")

    interfaces = set()
    lines = bounded_system_text("/proc/net/dev", MAX_PROBE_NETWORK_BYTES).splitlines()
    if len(lines) < 3:
        fail("El namespace de red documental no es verificable.")
    for line in lines[2:]:
        if not line.strip():
            continue
        if ":" not in line:
            fail("El namespace de red documental no es verificable.")
        interface = line.split(":", 1)[0].strip()
        if not interface:
            fail("El namespace de red documental no es verificable.")
        interfaces.add(interface)
    if interfaces != {"lo"}:
        fail("El namespace de red documental no está aislado.")

    route_lines = bounded_system_text("/proc/net/route", MAX_PROBE_NETWORK_BYTES).splitlines()
    if not route_lines or any(line.strip() for line in route_lines[1:]):
        fail("El namespace de red documental no está aislado.")


def assert_fixed_parser_dependencies() -> None:
    """Prove that the fixed parser surface can start before any document exists."""
    for executable in FIXED_PARSER_EXECUTABLES:
        try:
            info = os.lstat(executable)
        except OSError:
            fail("La dependencia documental fija no está disponible.")
        if not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode) or not (info.st_mode & 0o111):
            fail("La dependencia documental fija no es ejecutable.")
        try:
            completed = subprocess.run(
                [executable, "-v"],
                check=False,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                cwd="/tmp",
                env={"PATH": "/usr/bin:/bin", "LANG": "C", "LC_ALL": "C"},
                timeout=2,
            )
        except (OSError, subprocess.TimeoutExpired):
            fail("La dependencia documental fija no pudo iniciar.")
        if completed.returncode != 0:
            fail("La dependencia documental fija no pasó su verificación.")
    try:
        import defusedxml
        from defusedxml import ElementTree as hardened_element_tree
        package_file = getattr(defusedxml, "__file__", "")
        parser_file = getattr(hardened_element_tree, "__file__", "")
        expected_package = os.environ.get("SUBLIMINE_DEFUSEDXML_INIT", "")
        expected_parser = os.environ.get("SUBLIMINE_DEFUSEDXML_ELEMENT_TREE", "")
        if (not isinstance(package_file, str) or not isinstance(parser_file, str)
                or not isinstance(expected_package, str) or not isinstance(expected_parser, str)
                or not expected_package.startswith("/usr/") or not expected_parser.startswith("/usr/")
                or os.path.realpath(package_file) != expected_package
                or os.path.realpath(parser_file) != expected_parser
                or not callable(getattr(hardened_element_tree, "fromstring", None))):
            fail("El parser XML endurecido no está disponible.")
        # A fixed, inert literal proves the module loaded and is callable; no
        # document bytes, filenames or vault paths are parsed by this probe.
        if hardened_element_tree.fromstring(b"<sublimine-probe/>").tag != "sublimine-probe":
            fail("El parser XML endurecido no pasó su verificación.")
    except ExtractionError:
        raise
    except Exception:
        fail("El parser XML endurecido no está disponible.")


def parse_pdf(input_path: Path, output_dir: Path) -> None:
    # Poppler is deliberately addressed by fixed system paths.  The parent
    # toolchain lock hashes them and bwrap exposes only /usr, not the project.
    pdfinfo = subprocess.run(
        ["/usr/bin/pdfinfo", str(input_path)],
        check=False, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        timeout=10,
    )
    if pdfinfo.returncode != 0:
        fail("El PDF no es legible o está cifrado.")
    info = pdfinfo.stdout.decode("utf-8", "replace")
    values = {}
    for line in info.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            values[key.strip()] = value.strip()
    if values.get("Encrypted", "").lower().startswith("yes"):
        fail("Los PDF cifrados no se admiten.")
    try:
        pages = int(values.get("Pages", "0"))
    except ValueError:
        fail("El PDF no declaró un número de páginas válido.")
    if pages < 1 or pages > MAX_PDF_PAGES:
        fail("El PDF excede el límite de páginas.")
    derived_path = output_dir / "derived.txt"
    converted = subprocess.run(
        ["/usr/bin/pdftotext", "-enc", "UTF-8", "-nopgbrk", str(input_path), str(derived_path)],
        check=False, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        timeout=10,
    )
    if converted.returncode != 0 or not derived_path.is_file():
        fail("No se pudo extraer una capa de texto PDF.")
    text = checked_utf8(derived_path.read_bytes())
    write_derived(output_dir, "PDF", text, {"pages": pages, "textLayer": "PRESENT"})


def safe_zip_name(name: str) -> bool:
    return bool(name) and not name.startswith(("/", "\\")) and "\\" not in name and ".." not in Path(name).parts


def parse_docx(input_path: Path, output_dir: Path) -> None:
    try:
        from defusedxml import ElementTree as ET
    except Exception:
        fail("El parser XML endurecido no está disponible.")
    try:
        with zipfile.ZipFile(input_path, "r") as archive:
            infos = archive.infolist()
            if not infos or len(infos) > MAX_DOCX_ENTRIES:
                fail("El DOCX excede el límite de entradas ZIP.")
            names = [info.filename for info in infos]
            if len(set(names)) != len(names) or any(not safe_zip_name(name) for name in names):
                fail("El DOCX contiene rutas ZIP no válidas.")
            forbidden = (
                "word/vbaproject.bin", "word/embeddings/", "word/activeX/", "word/macros/",
                "customXml/", "docProps/", "word/glossary/",
            )
            normalized_names = [name.lower() for name in names]
            if any(name == "word/vbaproject.bin" or any(name.startswith(prefix.lower()) for prefix in forbidden[1:]) for name in normalized_names):
                fail("El DOCX contiene macros, OLE u objetos no admitidos.")
            total_expanded = 0
            for info in infos:
                if info.is_dir():
                    continue
                if info.file_size < 0 or info.compress_size < 0:
                    fail("El DOCX declaró tamaños ZIP inválidos.")
                if info.file_size and (not info.compress_size or info.file_size / info.compress_size > MAX_DOCX_RATIO):
                    fail("El DOCX excede el ratio de compresión permitido.")
                total_expanded += info.file_size
                if total_expanded > MAX_DOCX_EXPANDED_BYTES:
                    fail("El DOCX excede el límite descomprimido.")
            if "word/document.xml" not in names:
                fail("El DOCX no contiene word/document.xml.")
            for name in names:
                if not name.lower().endswith(".rels"):
                    continue
                data = archive.read(name)
                if b"<!DOCTYPE" in data.upper() or b"<!ENTITY" in data.upper():
                    fail("El DOCX contiene XML no permitido.")
                try:
                    relationships = ET.fromstring(data)
                except Exception:
                    fail("El DOCX contiene relaciones XML inválidas.")
                for relation in relationships:
                    if relation.attrib.get("TargetMode") == "External":
                        fail("El DOCX contiene una relación externa.")
            document = archive.read("word/document.xml")
    except ExtractionError:
        raise
    except (OSError, zipfile.BadZipFile, RuntimeError):
        fail("El DOCX no es un contenedor OOXML válido.")
    if b"<!DOCTYPE" in document.upper() or b"<!ENTITY" in document.upper():
        fail("El DOCX contiene XML no permitido.")
    try:
        root = ET.fromstring(document)
    except Exception:
        fail("El cuerpo XML del DOCX no es válido.")
    body = root.find(WORD_NS + "body")
    if body is None:
        fail("El DOCX no contiene un cuerpo legible.")
    for element in root.iter():
        local_name = str(element.tag).rsplit("}", 1)[-1].lower()
        if local_name in {"object", "oleobject", "altchunk", "embeddedobject"}:
            fail("El DOCX contiene un objeto no admitido.")
    paragraphs = []
    for paragraph in body.findall(".//" + WORD_NS + "p"):
        pieces = []
        for text_node in paragraph.findall(".//" + WORD_NS + "t"):
            if text_node.text:
                pieces.append(text_node.text)
        line = "".join(pieces).strip()
        if line:
            paragraphs.append(line)
    text = "\n".join(paragraphs)
    checked_utf8(text.encode("utf-8"))
    write_derived(output_dir, "DOCX", text, {
        "entries": len(infos),
        "expandedBytes": total_expanded,
        "bodyParts": 1,
    })


def probe(output_dir: Path) -> None:
    # The prior probe inferred isolation from a failed connection to a public
    # address.  That was not evidence: an offline or firewalled host could
    # produce the same failure.  These checks use only local kernel metadata
    # and fixed parser self-tests.  They fail closed without probing host files
    # or attempting a write outside the declared output bridge.
    assert_mount_policy()
    assert_private_network_namespace()
    assert_fixed_parser_dependencies()
    write_json(output_dir / "probe.json", {
        "schema": PROBE_SCHEMA,
        "revision": REVISION,
        "state": "QUALIFIED",
        "assertions": {
            "network": "UNAVAILABLE",
            "home": "UNAVAILABLE",
            "outsideWrite": "DENIED",
        },
    })


def main() -> int:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--mode", choices=("probe", "extract"), required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--input")
    parser.add_argument("--kind", choices=("PDF", "DOCX"))
    args = parser.parse_args()
    output_dir = Path(args.output)
    if not output_dir.is_dir():
        fail("La salida del extractor no está disponible.")
    if args.mode == "probe":
        if args.input is not None or args.kind is not None:
            fail("El probe documental no acepta entrada.")
        probe(output_dir)
        return 0
    if not args.input or not args.kind:
        fail("La extracción documental requiere tipo y entrada.")
    input_path = Path(args.input)
    if not input_path.is_file():
        fail("La entrada documental no está disponible.")
    if args.kind == "PDF":
        parse_pdf(input_path, output_dir)
    else:
        parse_docx(input_path, output_dir)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ExtractionError:
        raise SystemExit(2)
    except Exception:
        # Never turn parser internals or document-derived text into a portal
        # diagnostic.  The parent reports only a typed failure state.
        print("El extractor documental encontró un fallo no admitido.", file=sys.stderr)
        raise SystemExit(3)
