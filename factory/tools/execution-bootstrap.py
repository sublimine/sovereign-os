"""Trusted pre-exec gate, mounted read-only inside the official Codex sandbox.

This file does not interpret model instructions. It verifies the supplied snapshot
and sandbox, waits for the controller to verify kernel cgroup limits, then execs
the requested argv with a clean environment. The manager owns exit accounting.
"""
import errno
import ctypes
import hashlib
import json
import os
import resource
import selectors
import subprocess
import sys


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


with open(sys.argv[1], encoding="utf-8") as source:
    config = json.load(source)
status = {}
with open("/proc/self/status", encoding="ascii") as source:
    for line in source:
        key, _, value = line.partition(":")
        status[key] = value.strip()
require(status.get("NoNewPrivs") == "1", "NoNewPrivs not enforced")
require(status.get("Seccomp") == "2", "Seccomp filter not active")
require(int(status.get("CapEff", "1"), 16) == 0, "Effective capabilities remain")
namespaces = {name: os.readlink("/proc/self/ns/" + name) for name in config["hostNamespaces"]}
require(all(namespaces[name] != outer for name, outer in config["hostNamespaces"].items()),
        "Sandbox namespace is shared with controller")
try:
    with open(config["outsideCanary"], "rb"):
        raise RuntimeError("Outside canary is readable")
except OSError as error:
    require(error.errno in (errno.ENOENT, errno.ENOTDIR, errno.EACCES, errno.EPERM),
            "Unexpected outside-canary error")
for entry in config["manifest"]:
    path = os.path.join(config["job"], entry["path"])
    require(not os.path.islink(path), "Snapshot contains a symbolic link")
    if entry["type"] == "directory":
        require(os.path.isdir(path), "Snapshot directory is missing")
    else:
        with open(path, "rb") as source:
            content = source.read(config["maxFileBytes"] + 1)
        require(len(content) == entry["bytes"] and hashlib.sha256(content).hexdigest() == entry["sha256"],
                "Snapshot bytes changed")
resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
resource.setrlimit(resource.RLIMIT_NOFILE, (128, 128))
resource.setrlimit(resource.RLIMIT_FSIZE, (config["scratchFileBytes"], config["scratchFileBytes"]))
print(json.dumps({"kind": "sovereign.execution.ready.v1", "nonce": config["nonce"],
                  "snapshotHash": config["snapshotHash"], "namespaces": namespaces,
                  "noNewPrivileges": True, "effectiveCapabilities": "0", "seccomp": True}), flush=True)
require(sys.stdin.readline(256) == "GO " + config["nonce"] + "\n", "Execution gate not released")
os.chdir(os.path.join(config["job"], config["cwd"]))
os.umask(0o077)
null = os.open("/dev/null", os.O_RDONLY)
os.dup2(null, 0)
if null != 0:
    os.close(null)
for descriptor in os.listdir("/proc/self/fd"):
    if int(descriptor) > 2:
        try:
            os.close(int(descriptor))
        except OSError as error:
            if error.errno != errno.EBADF:
                raise
environment = {"PATH": config["runtimePath"], "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8",
               "TMPDIR": config["temporaryDirectory"], "PYTHONDONTWRITEBYTECODE": "1"}
# Node/libuv may classify socket-backed systemd/Node stdio as network handles.
# The sandbox deliberately denies socket operations. Give the program ordinary
# anonymous pipes and relay bytes with write(2), without relaxing network policy.
# A child must not inspect or modify this trusted supervisor through proc/ptrace.
libc = ctypes.CDLL(None, use_errno=True)
require(libc.prctl(4, 0, 0, 0, 0) == 0, "Cannot protect supervisor memory")  # PR_SET_DUMPABLE
child = subprocess.Popen(config["argv"], stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, env=environment, close_fds=True)
# Popen has received the child's exec result before returning. READY/GO only
# established permission to try; emit this separate frame before relaying any
# untrusted program bytes. An OSError above must never become a program exit.
print(json.dumps({"kind": "sovereign.execution.started.v1", "nonce": config["nonce"],
                  "snapshotHash": config["snapshotHash"], "pid": child.pid}), flush=True)
with selectors.DefaultSelector() as selector:
    selector.register(child.stdout, selectors.EVENT_READ, 1)
    selector.register(child.stderr, selectors.EVENT_READ, 2)
    while selector.get_map():
        for event, _ in selector.select():
            content = os.read(event.fileobj.fileno(), 16384)
            if not content:
                selector.unregister(event.fileobj)
                event.fileobj.close()
            else:
                remaining = memoryview(content)
                while remaining:
                    written = os.write(event.data, remaining)
                    remaining = remaining[written:]
code = child.wait()
sys.exit(code if code >= 0 else 128 - code)
