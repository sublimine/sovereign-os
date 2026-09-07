# Root-Cause Correction y Retraction

## Trigger

CLAIM_REFUTED, CLAIM_RETRACTED, provenance broken, calculation error, corrupt
dataset, source compromise, model/code bug o semantic state invalid.

## Algoritmo

1. Freeze claim and all actions not yet effected.
2. Traverse reverse dependencies until first independently invalid node(s).
3. Do not select the last visible paragraph as root unless it created error.
4. Create RetractionRecord with cause/evidence/old version.
5. Query forward transitive closure, chunked and idempotent.
6. Mark descendants NEEDS_REVALIDATION; decisions become REVIEW_REQUIRED.
7. Recompute only from last valid ancestors with current schemas.
8. Apply independent verification policy at original materiality.
9. Create replacement versions; never overwrite.
10. Notify every registered consumer and reconcile acknowledgements.
11. Ω7 seals propagation closure; Ω3 samples; Ω24 learns if systemic.

## Liveness

Each propagation job has cursor/checkpoint. Duplicate events are harmless.
Missing consumer creates BLOCKER; timeout escalates Ω2, never closes itself.

