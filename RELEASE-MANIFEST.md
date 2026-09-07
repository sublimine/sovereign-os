# Release Manifest — Ω Architecture 2.0.0

**Status:** D2_DETERMINISTIC_TESTED  
**Date:** 2026-08-14  
**Scope:** institutional architecture, production charters, reference enforcement,
machine contracts and deterministic evaluations. Provider adapters and durable
production services remain outside this design release.

## Included

- Constitution, 17 numbered architecture documents and v2 Definition of Done.
- 24 conceptual specifications, 24 overlays and 24 production system charters.
- Signed-hash production kernel and charter catalog.
- 28 JSON Schema contracts including lease, context, gate, state, release certification and 24-way output.
- 30 artifact types, 47 events and runtime TypeScript ports.
- 24×24 relationship matrix and 24×19 action matrix.
- 24 machine state paths, 24 gate sets and 192 effective role FMEA rows.
- Six diagrams and seven simulations represented by 98 validated events.
- 576 effective eval cases: 16 common + 8 role-specific per Ω.
- Reference enforcement for prompt hashes, leases, authority, blind context,
  epistemic ceilings, gates and transitive retraction.
- Ten-pass v2 adversarial audit with correction ledger and explicit validation debt.
- Final integrity gate for encoding, JSON, schema IDs, version links and metric reconciliation.

## Validation command

~~~powershell
npm.cmd test
~~~

## Known boundaries

This is not a running production platform and does not claim D3 model evidence,
D4 shadow assurance, D5 calibration or external independent certification.
Provider adapters, persistence, sandbox, cryptographic anchors and lower
departments must be implemented against the ports. These are `VALIDATION_DEBT`,
not permission to describe unexecuted behavior as proven.
