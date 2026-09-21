# Trusted tool broker

New control-plane implementation, built from the reconstruction contracts. No worker receives the Store, Authority object or signing key. The model may propose a tool call; only the control plane calls `ToolBroker.execute` and produces an authenticated receipt from observed results. Descriptions, model text and test plans cannot mint receipts.

## Contract

`new ToolBroker({store,authority,workspaceRoot,...options})`

`registerWorkspace(missionId)` creates a dedicated child and returns `{missionId,path,resource}`. Existing registered workspaces are checked, not silently replaced. An existing but unregistered directory is not adopted. Registration is a trusted control-plane action, not a model tool.

`execute({missionId,principalId,lease,operationId,tool,args,signal?})` returns `authority.seal('tool.receipt', {id,missionId,principalId,tool,argsHash,status,result,startedAt,completedAt})` for known success or known failure. Status is `SUCCEEDED` or `FAILED`; a failed result contains a bounded error code, not raw exception content or credentials. Invalid arguments, invalid authority and ambiguous interrupted effects reject before returning a new receipt.

Tools and exact lease actions:

| Tool | Args | Resource | Result |
| --- | --- | --- | --- |
| `source.fetch` | `{url}` | `public-web` | `content`, `sha256`, `bytes`, `finalUrl`, `retrievedAt`, `status`, `mediaType`, minimal `headers` |
| `source.search` | `{query,limit:1..10}` | `public-web` | observed native search, unverified candidate URLs, provider counters and confirmed process closure; never admitted factual evidence |
| `workspace.list` | `{path:'.'}` or relative directory | `workspace:<missionId>` | sorted immediate entries and metadata |
| `workspace.read` | `{path}` | same | content, SHA256 and bytes |
| `workspace.write` | `{path,content,expectedHash:null|string}` | same | before/after SHA256 and bytes |
| `execution.run` | `{argv:string[],cwd:relativeDirectory}` | same | actual exit/output, input manifest and isolation/cleanup receipt; `FAILED/CAPABILITY` if no trusted runner is configured |

Workspace classification defaults to `INTERNAL`; source retrieval is `PUBLIC`. Set `workspaceClassification` only from trusted configuration. A lease for a different principal, mission, action or exact resource is insufficient. Replays also require current authority: an expired/revoked lease cannot retrieve a prior receipt's content through the broker.

Public-source authority is rechecked synchronously at the final asynchronous
handoff, before a successful receipt is sealed. Revocation or expiry while the
response is pending produces a failed receipt without its content. This prevents
release of the response, not an HTTP request that was already sent. Search also
polls revocation during its client lifetime; fetch cancellation/deadline aborts
the HTTP request. A replacement valid lease cannot turn a recorded failed
operation into another acquisition under the same operation ID. Actual HTTPS
before/after qualification: `sovereign-revocation-live-VZ1EgdJF` (failure retained)
and `sovereign-revocation-live-j47TLs0z` (all checks pass), under
a private, installation-local workspace; the latter performed exactly one GET, returned
no source content after revocation, and replayed its identical failure receipt.

There is no unrestricted host shell, publication, network package installer, arbitrary request-header injection or unrestricted filesystem tool. Commands, including interpreters, can execute only inside the configured disposable sandbox. A fetched page is untrusted source evidence, not a factual truth verdict. HTTP 404 is still a successfully observed HTTP response and remains status 404 in the result; it is never relabeled a successful factual source.

## Bounded proposal batches

The producer may propose `action=batch`, an empty outer `tool`, and `argsJson`
encoding `[{tool,args},...]`. The entire list is validated before any operation:
the exact node/mission tool intersection, ordinary argument checks, duplicate
requests, same-path write dependencies and remaining total operation budget.
Every member's shape and authority is validated before inspecting relationships
with later members, so malformed suffixes yield typed errors with zero effects.
Each operation still receives its own fresh authority lease and durable receipt.
Execution is ordered, not an atomic transaction or parallel filesystem mutation.
The first failed operation stops the suffix; successful prefix operations remain
committed and their exact observations remain in context. Cancellation is checked
between operations. Interrupted production is not blindly replayed.

Default batch cap: four operations; total producer tool cap: twelve, unchanged
by batching. Without an explicit versioned option, `execution.run` and
`source.search` remain non-batchable: observations precede the separate command
proposal, and discovered URLs precede source selection. Tests still require the
independent reviewer.
Independent source fetches, reads, lists and disjoint writes can share one model
proposal. Successful write content is hash-bound to the individual batch member,
so a later model call can see the exact committed text without inventing a read.

New missions may explicitly select `producerBatch: 'read-test-v1'` (CLI
`--producer-batch read-test-v1`). An execution-containing batch then permits
only reads/listings followed by exactly one final `execution.run`, whose argv
and cwd must match a frozen required execution obligation. No source operation,
write, second execution, future result substitution or authority expansion is
allowed in that batch. Do not select this grouping when interpreting a read
must determine whether or how to execute. The existing four-member and twelve
total-operation caps are unchanged. All receipts are observed by the next
producer inference; final acceptance still requires the separate reviewer.
The default preset does not select it, and it cannot alter an existing mission.
Learned overlays are disabled for the new scope until independently qualified.
This extends sequential batch validation, not atomicity or automatic checkpoint
resume. A crash keeps durable prefix effects and requires normal reconciliation;
uncertain commands block inheritance/replay. See
`reconstruction/design/PRODUCER-READ-TEST-BATCH.md` for evidence and limitations.

A real paired three-file qualification accepted both variants with identical
hashes and independent rereads: nine versus four completed inferences, 78,136
versus 37,684 observed total tokens. Evidence:
a private installation-local summary file.
One supplied node, not autonomous planning or a general performance guarantee.
The previous interrupted/rejected run remains under `sovereign-batch-live-HgHG9uq2`.

Successful producer directory listings used by a candidate are independently
repeated before review. Acceptance must cite the new listing, and point-of-use
checks compare its membership with current state. A historical producer list
cannot certify that no additional file exists now. Listings cover immediate
entries in the explicitly listed directories, not an unseen recursive tree.

## Idempotency and crash behavior

Store record type `effect` uses stable `operationId`, bound to mission, principal, tool and canonical args hash. `PREPARED` is durable before dispatch; `DISPATCHED` precedes the attempt. Successful or failed receipts are persisted as `SUCCEEDED`/`FAILED`; identical replays return the same receipt without repeating the operation. Changed bindings reject. Concurrent duplicate calls on one broker share the in-flight promise.

A restarted/other broker encountering `DISPATCHED` moves it to `UNCERTAIN` and raises `EFFECT_UNCERTAIN`. It does not guess whether a write or request occurred, automatically retry, or sign a fictitious failure. The exclusive engine has execution-specific reconciliation using durable job identity and verified termination; see [native execution](EXECUTION.md). An observed ordinary workspace write whose durable receipt commit fails remains unreplayable pending reconciliation. `PREPARED` without dispatch can safely resume under current authority.

This is not a distributed exactly-once guarantee against arbitrary external systems. Receipts describe historical observations, not the current state of a later-edited file or a remote source. Authority signatures attest the trusted broker record, not the truth of external assertions.

## Filesystem boundary

The trusted workspace root and every ancestor are checked as real directories. Worker paths are normalized relative paths with no traversal, backslashes, symlinks or root escapes. Files must be regular, non-hardlinked, and bounded; reads use `O_NOFOLLOW` and descriptor identity checks. Writes compare the expected SHA256 (`null` means absent), use an exclusive temporary file, fsync, atomic rename and directory fsync. Store transactions serialize broker-mediated write admission/CAS. Parent directories are created only in the mission workspace after quota checks.

Defaults: 1 MiB per file, 32 MiB retained workspace bytes, 2,000 entries, path/tree depth 32. Text writes must round-trip as UTF-8. Atomic replacement can temporarily require one extra bounded file. These are configurable tool resource limits, not an architectural agent count or a quality waiver.

The boundary addresses model-controlled paths and links. It does not claim to withstand a malicious host administrator concurrently replacing directory trees, bypassing filesystem permissions or modifying the trusted SQLite/signing environment. Portable Node path checks are not an OS sandbox or descriptor-relative `openat2` confinement. Workers must not receive general host execution while relying on this boundary.

## Public-web boundary

The broker parses URLs before use, rejects credentials, local/special names, non-HTTP(S), nonstandard ports and HTTPS-to-HTTP redirects. It resolves and validates **every DNS answer**, rejects mixed public/private answers, and revalidates each redirect. IPv4/IPv6 comparisons are numeric CIDR checks, not a private-address regex. IPv6 is restricted conservatively to ordinary global-unicast space with special-purpose exclusions; mapped/NAT64/6to4 and private/link-local/multicast/documentation space are excluded. Known Azure platform metadata IP is explicitly excluded too. Some globally reachable special-purpose services are deliberately denied. The basis is the [IANA IPv4 special-purpose registry](https://www.iana.org/assignments/iana-ipv4-special-registry/) and [IANA IPv6 special-purpose registry](https://www.iana.org/assignments/iana-ipv6-special-registry/), checked 2026-09-09; registry updates require code review rather than remote policy execution.

The default transport connects directly to the validated numeric address, retains the original HTTP Host and TLS SNI, checks the connected peer and keeps TLS certificate validation enabled. It uses a fresh direct Node HTTP(S) request rather than global fetch/proxy/cookie state; no caller headers, auth headers, ambient cookie jar or proxy agent are passed. See [Node HTTP request options](https://nodejs.org/docs/latest-v24.x/api/http.html#httprequesturl-options-callback) and [Node HTTPS request options](https://nodejs.org/api/https.html#httpsrequestoptions-callback).

Default limits: 15-second whole-operation deadline including DNS and redirects; four redirects; 2 MiB aggregate response bytes; 16 KiB response headers. Each connection uses the remaining byte allowance. Responses must be uncompressed, lossless UTF-8 text (text media types, JSON or XML). PDFs/binary formats, non-UTF8 encodings and compression fail explicitly instead of producing lossy evidence. Headers retained are only content-type, ETag, Last-Modified and Date. Failed/cancelled DNS promises cannot later dispatch a request.

## Verification and limitations

`node --test tests/factory/broker.test.mjs` uses real temporary files, real Store/Authority signatures and injected DNS/transport fixtures. It verifies actual write/CAS effects, no overwrite after mismatch or replay, link/traversal exclusion, quota prevention, public-address edge cases, redirects, peer mismatch, byte/encoding caps, cancellation/revocation before connection and crash ambiguity without repeated effects. Default tests do not contact external networks. Injected `lookup`/`transport` functions are trusted testing seams, never worker-controlled arguments; fake transports do not certify the native networking stack. Separate [execution tests](EXECUTION.md) exercise the native VPS isolation and broker integration.
# Descubrimiento público

`source.search` acepta `{query,limit}` (1–2.000 caracteres, 1–10 candidatos).
Necesita capacidad explícita de misión/nodo, lease vigente para `public-web` y
proveedor dedicado configurado. No es batcheable ni recibe el historial de la
misión. El cliente oficial usa la suscripción ChatGPT, sin fallback a API de pago.
Las consultas no deben contener secretos o fragmentos privados; esta instrucción
y la minimización de contexto no son un clasificador perfecto de información.

Un resultado `UNVERIFIED_DISCOVERY_CANDIDATE` es sólo una URL sugerida después de
una búsqueda observada. No crea una fuente, no acredita independencia y no puede
respaldar por sí solo una afirmación factual. `source.fetch` debe adquirir los
bytes y el revisor debe contrastarlos. La clasificación PUBLIC de la operación
no concede permiso para exfiltrar contenido privado en una consulta o una URL.

El broker verifica autorización antes y después, comprueba revocación cada
100 ms durante la búsqueda, impone un plazo y espera el cierre del cliente.
Cuota/autenticación/capacidad interrumpen el método como problemas operativos,
no como evidencia para inventar otra respuesta. Un cierre incierto permanece
incierto y no se repite automáticamente. El informe incluye por separado estas
llamadas y suma sus contadores observados al consumo del proveedor.
