# Stage-specific effect evidence

## Observed failure

The first live multi-product portfolio qualification (`4eCcdU4U`, runtime
`9b5fba01`) did not pass. Its decision-model reviewer returned UNKNOWN for
`req.model.artifact-only`: the producer's assertion that it made no file writes
or executions was not independent evidence of that historical stage obligation.
The content review otherwise passed. The engine correctly withheld acceptance,
but automatically creating another producer could not repair missing control-plane
observations. The qualification was deliberately terminated, preserving its
cancelled state, first rejected candidate, later attempt and measured usage.

The independent review is `review:83e4a2f0-0d57-4745-a5c4-76c81e5801de` of
`artifact:c247f2f8-2a3b-4e2f-b6fe-c5052608f892`. The original harness/request/oracle
remain unchanged. No stronger result is retrospectively assigned to that run.

Two implementation issues caused the gap. A standalone reviewer with no prior
workspace operations did not automatically receive the runtime inventory. And a
mission-wide current inventory is the wrong dependency for a past stage: later
authorized file creation would stale that earlier proof. Relabeling the stage
restriction as `runtime.no_file_writes` would prohibit the entire requested final
software delivery, not fix the evidence.

## Implemented contract

Every nonplanning reviewer now captures authenticated operational observations,
including an empty inventory when no effect occurred. `node-effect-inventory`
separately covers each exposed product node and all its recorded producer/reviewer
attempts. It includes failed, PREPARED and uncertain intents, not merely successful
receipts. The mapping uses both exact node ID and actual producer/reviewer mode;
a node whose name begins `review:` cannot impersonate another stage's reviewer.

The independent reviewer receives node inventories for the candidate and all its
exposed prerequisite artifacts. Each observation is individually keyed by node,
signed, versioned and bound to the actual reviewer exposure. Later effects of a
different node do not stale a stage-specific statement. An effect from any new or
earlier attempt of the *same* node does stale it. Missing/foreign artifact exposure
is rejected. Repeated captures with identical data do not duplicate observations.

Mission-wide current inventory behavior is unchanged. So are the deterministic
mission-wide absence controls, signed effect receipts, independent rereads and
execution/snapshot guards. A node inventory is not current file bytes, evidence of
semantic test correctness, a future no-effects promise or host-wide surveillance.
Planning continues to receive no prospective absence-of-effects certificate.

## Verification

Targeted integration uses simulated models with actual Store/broker/file effects:
accept a pure prerequisite using scoped operational evidence, create the final
file in its dependent stage, independently reread it, accept the final product and
re-enter without another inference. This specifically proves that the original
prerequisite does not become unusable merely because the downstream file exists.
Additional cases cover same-node invalidation, different-node stability, multiple
exposed scopes, foreign missions and `review:` name collisions. The 80-case
worker/runtime/learning-service regression passed before the final name-collision
hardening; the four focused tests passed afterward. A fresh full cut and live
multi-product rerun remain required; these tests do not certify the live result.
