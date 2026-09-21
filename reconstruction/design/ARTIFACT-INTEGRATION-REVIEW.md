# Artifact integration adversarial review

## Scope and evidence

Read the complete current `factory/lib/artifacts.mjs`, `factory/lib/workers.mjs`, `factory/lib/plans.mjs`, and `TOOL-OBSERVATION-CONTRACT.md`. The first combined read was truncated; the missing regions were reread in bounded ranges before conclusions. This was a cross-module review of the newly constructed factory, not the withdrawn prototype. The reviewer previously implemented part of the registry, so this is adversarial testing, not an organizationally independent audit certification.

Baseline SHA-256 before remediation:

| File | SHA-256 |
| --- | --- |
| artifacts.mjs | a4d4d4d10208b4752c6b51ce57cf589cb75d86a6a5dc8540619bcc1e5d874c3a |
| plans.mjs | 6ac2e1ef2744ec295e54a1d1d835d66583a181b2db16f5f73f71752a75eae9e7 |
| workers.mjs | f98509876fc2d35c6693b60af6633e9c677184f5a84e147998778f101516775a |
| TOOL-OBSERVATION-CONTRACT.md | f3a1027b992149d1692cd23fc1852d2eb412c38a1d83039c9fb18e012c300622 |

## Confirmed defect: source retraction bypass through tool-kind evidence

`WorkerService.review` legitimately delivers producer acquisition receipts. The reviewer could cite their exact canonical result with `kind:'tool'`, including fetched raw content. `ArtifactRegistry.toolReference` checked durable operation authenticity but not the corresponding source's current admission. `retractSource` searched claim sources and source-kind review dependencies only. `assertUsable` likewise treated tool-kind fetch evidence solely as an authentic historical operation.

This created two concrete acceptance failures, reproduced through real WorkerService/Registry/Broker/Authority/SQLite integration without modifying database records:

1. AIR01: accept with an exact fetch receipt quote, then retract that acquired source. The artifact remained accepted and consumable. A successful past acquisition was incorrectly kept as current material support.
2. AIR02: retract before the review. Because the producer had no structured source claims, the reviewer received the historical fetch receipt and accepted it anyway.

The baseline test run was **2 failed, 2 passed**. Root authorized a scoped fix in artifacts.mjs after receiving the reproductions.

## Remediation

`toolReference(evidence,run,{requireAdmittedSources:true})` now resolves a cited source.fetch receipt to `source:${receipt.id}` and checks same mission, ADMITTED status, receipt identity/hash, content hash and raw-byte hash. ACCEPT enables this control; `assertUsable` repeats it on historical tool review dependencies. `retractSource` now also finds exact receipt-ID/hash review dependencies and invalidates their production/review descendants through the existing graph.

RETURN/UNKNOWN may still use an authentic withdrawn receipt diagnostically: history is retained, not rewritten as if the acquisition never happened. A payload's uncited acquisition receipt is not automatically interpreted as a factual assertion. Material tool-kind citations are conservatively linked to source admissibility; source authenticity alone still does not establish truth or semantic entailment.

## Final discriminating tests

`tests/factory/artifact-integration-review.test.mjs`: **5/5 pass** after the fix.

| Test | Discriminating outcome |
| --- | --- |
| AIR01 | Tool-kind source retraction invalidates both accepted producer product and accepted downstream child. |
| AIR02 | Retracted-before-review source cannot regain admissibility through its successful historical receipt. |
| AIR03 | Existing direct source-kind evidence keeps its invalidation behavior. |
| AIR04 | Real file mutation during simulated reviewer inference is caught by Worker's synchronous consumption guard. No successful workspace validation is recorded. |
| AIR05 | Withdrawn receipt remains diagnostic evidence for RETURN; returned product cannot be consumed. |

The original 25 adversarial-core cases also passed in the intermediate combined run. HTTP transport and model inference are explicit fixtures, while filesystem operations, source ingestion, signing, persistence, worker dispatch, evidence checks and invalidation are real implementation paths. No live model, live network, accredited test runner, general semantic correctness, or hostile-host-administrator isolation is claimed.

## Additional boundaries checked

Required file effects are unioned through artifact input lineage and compared against frozen planned effects by PlanLedger.assertProduct. Acceptance requires cited independent reads; required execution remains blocked without an accredited runner. Worker snapshot validation checks actual bytes synchronously before acceptance and must be repeated at subsequent points of use. Historical receipt verification does not continuously watch external files or websites.

Unstructured prose can still claim more than its structured sources logically entail; no exact-substring algorithm proves meaning. That remains an explicit independent-review obligation, not a guarantee inferred from these tests. The catalog's existence likewise is not evidence that every method has executed.
