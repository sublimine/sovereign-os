# Recovery peer review

Read current engine coordination, candidate reuse, acceptance checkpoints, source/plan invalidation, consumer snapshots and provider close exit-observation code. Tests use real Store/Authority/Registry/Broker/WorkerService/Engine and SQLite reopen; inference is simulated. Faults are synchronous injected exceptions at explicit ledger publication boundaries, not claims of a real OS process crash.

Initial results: `tests/factory/recovery-peer-review.test.mjs` **2 passed, 1 failed**.

- RPR01 FAIL: candidate created and recorded in worker-production, then interruption before ledger REVIEW_PENDING transition. Node lacks artifactId; restart consults only node.artifactId, ignores durable worker-production checkpoint and invokes producer again (four total producer calls instead of two). Already committed file remains real on disk. Root notified and owns engine remediation.
- RPR02 PASS: registry accepted candidate before ledger ACCEPTED transition. Restart reuses existing accepted artifact, performs current snapshot guard, and completes without another model call or write.
- RPR03 PASS: plan invalidation after mission COMPLETED propagates to final artifact. Reopen does not redeliver as complete, clears finalArtifactId and does not silently repeat file effects.

Proposed RPR01 fix: publish/recover the exact producer checkpoint before creating another run. Validate same mission/node/run, candidate payload hash, criteria, exact material inputRefs and requiredEffects. Do not recover arbitrary candidates from other attempts or weaken ambiguity checks. A worker-production candidate record is available; the still-smaller crash window immediately after registry.create and before worker-production update also needs consideration. Never blindly rerun a durable effect merely because its node publication lagged.

Provider.close now waits for observed process exit and reports CLEANUP_UNCONFIRMED if escalation does not produce an exit event, retaining temporary state. No new transport test is claimed in this review; existing provider tests cover that separate boundary.

## Root remediation and rerun

The coordinator now resolves the interrupted producer's exact worker-production checkpoint, with a same-run candidate lookup for the narrower artifact/create-to-checkpoint gap. Recovery retains the prior producer ID; version, mission, node, criteria and current exact inputs must match, and ambiguous candidates require direction. Existing writes are not re-proposed.

Observed rerun: RPR01, RPR02 and RPR03 all PASS. These remain fault-injection/reopen tests, not an assertion of a full OS-level crash experiment.
