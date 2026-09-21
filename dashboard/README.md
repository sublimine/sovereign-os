# Sublimine Console

Sublimine Console is the local operational interface for the installed
Sublimine Factory runtime. It is intentionally a control surface, not a
second orchestrator: execution remains in the verified `sovereign` CLI while
the console owns project isolation, a local context plane and a small
allowlisted bridge.

## What it shows

- Factory service health, provider readiness, model inventory, isolation mode
  and local transport scope.
- Persistent mission queue, mission plan, node routing, assigned roles,
  transition history and explicit operator controls.
- Full role cards from the runtime catalog: purpose, activation, contracts,
  methods, limits, recovery and prohibited actions.
- Evidence projections: sources, provenance, reviews, effects, report
  snapshot, raw JSON and download of the exact public report.
- Learning registration and safe counters without exposing private evaluator
  inputs or pretending that registration proves production safety.
- A mission form with routing, model, reasoning, capacity limits,
  UTF-8 attachments and recovery controls that are checked before the CLI is
  called.

## Project spaces and durable context

Each project is a physical private space below the console state root. Its
directory contains a separate Obsidian-compatible vault, conversations,
Graphify output root, mission journal and Factory `--state-dir`; the global
index retains metadata only. Browser input never becomes a filesystem path.

Memory is a canonical event ledger with three checks: event schema and project
identity, a hash chain, and an HMAC-sealed head whose key is outside all
project directories. A ledger transplant from another project or a coherent
rehash without that local key is blocked. This is local tamper evidence, not
an external signature or a claim that the Unix account is a hostile-tenant
boundary.

Project admissions are journalled before the Factory receives a mandate. The
journal freezes the exact rendered mandate hash, policy snapshot, context-pack
hash, selected memory IDs, integrity head and attachment manifest hash. Its
state moves from `PREPARED` to `FACTORY_ACCEPTED` to `LINKED`, allowing a
repeated request ID to reconcile or return the same mission instead of making
a second submission.

Context selection is deterministic and bounded: relevant canonical events are
prioritized, durable decision/evidence events remain eligible, and the final
pack fits its explicit byte budget. Memory embedded in a pack is labelled
untrusted observation, never executable instruction or permission.

The browser voice control is opt-in dictation. It produces reviewable text;
the server retains no raw microphone audio. Individual conversation entries
can also be read aloud with the browser's own speech synthesis; that output is
not a realtime voice transport and it is never sent to the Factory. The system
page exposes only provider model/effort combinations it can verify. At
admission it resolves an exact supported target and freezes it in the mission:
an explicit model/effort remains explicit, a model without effort receives the
provider-declared default, and an inherited project policy receives the
Factory's declared default. Planning, production and review roles receive that
frozen mission target. Dedicated public-source discovery and bounded learning
control-plane facilities declare their own target separately, so the console
does not present a fictional per-role execution receipt.

No external agent framework participates in this control plane or memory path.

The budget panel deliberately displays only declared limits and attested
receipts. When the runtime has not projected a cost or quality value, it says
NOT_ATTESTED; it never estimates a number to make a dashboard look more
complete.

## Local security boundary

The console listens only on 127.0.0.1:4177. It has no public network
listener, no CORS policy, no direct browser access to SQLite and no generic
shell endpoint. It only permits these factory operations:

- read-only: doctor, service-status, queue, learn-status, roles, status,
  report;
- explicit user actions: submit, pause, continue, cancel, and the tightly
  validated retry-review.

Mutation requests require a local session token, same-origin browser headers,
validated identifiers and an audit record in
~/.local/state/sovereign-console/console-audit.ndjson. The loopback boundary
assumes the browser and factory are used by the same trusted OS account. It is
not a multi-user authentication system, so do not tunnel or publish this port.
The console permits `microphone=(self)` only for explicit browser dictation;
raw audio is neither uploaded nor stored.

## Run and verify

For a one-off local run:

    NODE_BIN="${NODE_BIN:-node}" "$NODE_BIN" dashboard/server.mjs

Then open http://127.0.0.1:4177.

The user service uses the exact Node 24 runtime and can be inspected with:

    systemctl --user status sovereign-console.service
    curl --fail http://127.0.0.1:4177/healthz

To install it from any checkout location, copy
`dashboard/systemd/sovereign-console.service` to
`~/.config/systemd/user/sovereign-console.service`, then copy
`dashboard/systemd/console.env.example` to
`~/.config/sublimine/console.env`. Set `SUBLIMINE_REPOSITORY_DIR` to the
absolute path of this checkout, plus the Node and Factory executable paths.
The unit starts the server by its configured repository path and uses `%h` as
its working directory; it does not assume a workstation-specific checkout
layout. Reload the user manager before enabling it:

    systemctl --user daemon-reload
    systemctl --user enable --now sovereign-console.service

## Validation

    NODE_BIN="${NODE_BIN:-node}"
    "$NODE_BIN" --check dashboard/project-spaces.mjs
    "$NODE_BIN" --check dashboard/project-runtime-supervisor.mjs
    "$NODE_BIN" --check dashboard/server.mjs
    "$NODE_BIN" --test dashboard/test/project-spaces.test.mjs dashboard/test/project-runtime-supervisor.test.mjs dashboard/test/server.test.mjs

The regression suite covers static serving, CSP, local session checks,
project-isolation boundaries, cross-project ledger transplants, rehashed local
memory, HMAC anchoring, context budgeting, sealed mission admission,
idempotent replay, allowlisted command arguments and the local-only listener
restriction.
