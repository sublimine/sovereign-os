# Independent adversarial review of the new factory core

Status at first reproduction: **9 failing regressions, 6 passing controls**. This is a bounded API-level review, not a certification of the whole system, model quality or external integrations. No withdrawn prototype was inspected or reused. The reviewer did not modify the root core modules.

Remediation retest: root's first fixes passed all 16 tests then present (AC01–AC10 and six controls). A subsequent independent variant, **AC11**, still reproduced a late write from an ordinary function returning a Promise; it is recorded below rather than treating native-async detection as a complete repair. The suite now contains 17 tests. Closure requires a further retest after the root's follow-up fix.

## Baseline and reproducibility

Reviewed completely: `factory/lib/contracts.mjs`, `store.mjs`, `authority.mjs`, `artifacts.mjs`; integration uses the new `factory/tools/broker.mjs`. SHA256 at the first failing run:

| File | SHA256 |
| --- | --- |
| contracts.mjs | `e37824c46239f6a2bdc3a240445bc641d63e51b874ffb9707cf713259ea5cafe` |
| store.mjs | `2c47657a10a3f3c09ab6277cf62aeeb42ccaf4b0bb089679ebeed823b21d3893` |
| authority.mjs | `969e2d7a6acb9ad9bec9666473a645cc8f059c5de26d948032a7491f178db516` |
| artifacts.mjs | `c344a1ba67b9ac41c770769da2017afd6048f9ef24b824708cb827e6b67b1d74` |

Run with the bundled Node 24:

```text
/home/cardeex/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/factory/adversarial-core.test.mjs
```

First run on 2026-09-09: 15 tests, 6 pass, 9 fail, approximately 0.68 seconds. The negative assertions are intentionally regressions expressing the required invariant, not tests adjusted to bless the observed defect. Every failing test produced the undesired API result, rather than merely searching for an absent reason-code string.

HTTP uses injected DNS/transport fixtures. Source content still passes through actual broker authority verification, receipt signing, `ingestSource`, SQLite and registry APIs. Inference completion records are explicitly synthetic adapter fixtures; no live inference occurred and no model behavior is evaluated. The file-effect integration creates, reads and checks a real temporary file; signatures, CAS and operation replay are real. Tests do not deliberately alter the database, record heads or signing key. Two low-level robustness probes intentionally pass JavaScript callback/array shapes to their public API, distinguished below from JSON-model-reachable behavior.

## Findings

### AC01 / AC02 — Existing source is confused with observed source

Severity: material context/provenance gap.

Baseline locations: `artifacts.mjs` `validateClaims` line 43 and call at line 80; `review` source-evidence branch line 112; `sourceReference` line 35.

Reproduction: fetch a source through the broker and admit its signed receipt. Register a producer whose `context.sourceIds` is empty. Its claim cites the source's valid hash and exact passage. `create` accepts it. Separately, a reviewer with the target artifact but an empty source context can cite the same unseen source to accept the target.

Cause: source existence, same mission, admission status, hash and quote are checked, but the responsible run's actual source context is not. A registry lookup is not evidence that this producer/reviewer observed the source. The two tests fail because the expected rejection never occurs.

Proposed invariant: direct source citation requires a hash/version-bound observation in the relevant run context. An acquired source can be shared across authorized runs, but it becomes observable only when the control plane actually delivers it. A later registry insert must not retroactively amend a completed inference's context. Claims based on an accepted upstream artifact may cite that declared artifact basis rather than pretend to have read its raw sources.

Additional regression AC10, added during remediation: an artifact contains a sourced factual claim and its producer did receive the raw source. A reviewer receives only the candidate and quotes the candidate itself as proof. ACCEPT must still fail because its factual support was not delivered to the reviewer. The valid test helper was correspondingly strengthened to supply all directly referenced source IDs as an explicit dispatcher observation fixture; no negative requirement was weakened.

### AC03 / AC06 — Acceptance channel launders invalid or provisional external proof

Severity: material foundation-acceptance gap.

Baseline location: `artifacts.mjs` `review`, artifact-evidence branch lines 113–117.

Reproduction: create and accept a foundation, invalidate it through the public registry API, then include it in a separate reviewer's artifact context. The reviewer uses its exact body/hash as proof for accepting another target. Acceptance succeeds. A second case uses a never-accepted provisional artifact instead; that also succeeds.

Cause: the cited artifact must exist, match mission/hash/quote and appear in context, but its eligibility is not checked. The target's `inputRefs` are checked, yet review evidence is a separate unguarded consumption channel.

Proposed invariant: distinguish **inspection of the target** from **external evidence supporting acceptance**. The target candidate may be quoted during its own review; requiring it to be already ACCEPTED would create a bootstrap cycle. External proof used for ACCEPT must be usable for its stated purpose, not provisional, invalidated, expired or based on invalid dependencies. RETURN may identify defective material as the object of diagnosis without granting it accepted evidentiary status.

### AC04 / AC05 — Review evidence vanishes from the dependency graph after acceptance

Severity: material retraction and stale-acceptance gap.

Baseline locations: `artifacts.mjs` `assertUsable` lines 133–147; `retractSource` lines 149–155; `invalidate` lines 158–171.

Reproduction A: a target has no direct claim/source dependency, but its acceptance check uses a real, observed source. Retract that source. The target remains usable. Reproduction B: acceptance relies on an accepted external artifact. Invalidate that proof artifact. Again, the target remains usable.

Cause: direct claim sources and production `inputRefs` drive invalidation and eligibility, but evidence that justified the review does not. The review result is stored, yet it is not a live foundation checked before downstream use. This is not fixed solely by checking the evidence once during review: it can become invalid later.

Proposed invariant: persist typed **acceptance dependencies** bound to evidence source/artifact hash, purpose and review. Enforce their current eligibility in `assertUsable`; propagate source and artifact invalidation through them. Keep production dependencies separate so the graph does not claim the producer consumed evidence only the reviewer saw. Avoid adding a self-dependency when the reviewer inspects the target itself. Preserve unrelated branches and historical reviews.

### AC07 — HTTP error metadata is lost at source admission

Severity: evidence-context loss; not a forged signature or proof of a false semantic claim.

Baseline location: `artifacts.mjs` source-record construction lines 30–33.

Reproduction: `source.fetch` actually returns a fixture HTTP 404 response. Its tool execution correctly succeeds as an observation and retains `result.status = 404`. `ingestSource` records `status = ADMITTED` but discards HTTP status. The test expects a separate `httpStatus` retaining 404 and observes undefined.

Proposed invariant: preserve HTTP transport status separately from source admission/epistemic state. A 404 body can be useful evidence, so blanket rejection is not necessary; it must not appear as an unlabelled ordinary representation. Preserve final URL and media type as well. The broker's previously mismatched `urlFinal` field was independently corrected to `finalUrl` in broker/tests/README before this review, matching the registry contract.

### AC08 — Rejected async transaction continues and writes after rollback

Severity: control-plane API robustness/atomicity; not currently a JSON model input exploit.

Baseline location: `store.mjs` `transact` line 44.

Reproduction: call `transact(async () => { await Promise.resolve(); store.put(...) })`. The API throws `ASYNC_TRANSACTION`, but the callback was already invoked. Its queued continuation commits a record outside the rejected transaction. The test observes that actual record after one event-loop turn.

Proposed invariant: reject known async callbacks **before invoking them**, and retain a transaction-scope invalidation guard for asynchronous continuations if promises/thenables can escape an ordinary callback. Document that callbacks are trusted synchronous control-plane code. A post-invocation Promise check cannot unschedule already-created work. The test is a minimum regression for the native async-function case, not proof that all possible scheduled side effects are confined.

Follow-up AC11 after root's native-async rejection: an ordinary `() => Promise.resolve().then(() => store.put(...))` callback still schedules and commits the late write after `ASYNC_TRANSACTION`. Isolated retest failed with an actual `late-promise` record. This is the same causal mechanism through another valid JavaScript callback shape, not a new model-facing authority escalation. Suggested remedy: a transaction-local async-context scope whose closed/rejected state is checked before writes; returning a promise cannot retain permission to write after scope exit. Nested scope behavior needs coverage too.

### AC09 — Sparse array check can silently drop a hole and named property

Severity: canonical representation integrity/robustness; not representable directly as a JSON array received from a model.

Baseline location: `contracts.mjs` `canonical`, array branch line 42.

Reproduction: create an array with `length = 1`, no index zero and an enumerable `extra` property. `Object.keys(array).length === array.length` passes, but `map` skips the hole and serialization becomes `[]`. The supposedly acyclic JSON-only canonicalizer silently loses the supplied shape/content.

Proposed invariant: require every own index from zero to length-minus-one and reject all additional own keys; do not use key count as a proxy for density. Decide explicitly how symbol/non-enumerable/accessor properties are handled. Canonicalization must reject unsupported JavaScript shapes, not normalize them into another valid value unnoticed.

## Passing controls at the first run

- Mutating source receipt content/hash without the signing key fails signature verification; a receipt body without authority cannot be ingested.
- Review must cover every frozen criterion exactly once; a material finding prevents ACCEPT and the candidate remains unaccepted.
- Same producer/reviewer thread is rejected; a provisional target cannot be accepted directly.
- Retraction already propagates correctly through direct factual claim sources and declared production inputs, while an unrelated accepted branch remains usable.
- Expired claim validity prevents use; stale Store CAS cannot overwrite the current record.
- A real broker file-write receipt binds to the actual producer run. Another run cannot claim it; replay returns the identical receipt without repeating or replacing the file, and changed arguments under the same operation ID are rejected.

These controls are useful but do not compensate for the alternate review-evidence path in AC03–AC06.

## Required integration boundaries and remaining scope

The core objects are trusted control-plane APIs, not safe interfaces to hand directly to a model. `Authority.issue`/`seal`, `registerRun`, `attachInference` and deterministic-origin creation must be invoked only from authenticated orchestration/adapter paths. Synthetic inference receipts in these tests do not establish provider authenticity. No claim is made that the registry alone recognizes every factual assertion hidden in arbitrary prose or semantically proves that a quote entails a claim; that requires the separately evaluated review method and mission-level coverage controls.

The planned multi-inference producer run must retain **all** actual thread/context versions, not just its latest thread. A reviewer cannot reuse any producer thread, and newly delivered sources must be recorded for the inference that observed them. This is a forward integration invariant, not a currently executed multi-turn provider test.

No external network or native HTTP interoperability was tested here. The source fixture tests validate broker-to-registry metadata/integrity flow. No production deployment, complete recovery protocol, semantic claim-recall benchmark, model-quality evaluation or universal security guarantee is established.

## Remediation status

Findings and first failing tests were sent to the root implementer before changes. The root owns fixes to `factory/lib/*`; this reviewer owns only the new adversarial test and this report, plus the explicitly requested `finalUrl` adjustment to its broker files. Re-run and record the result after fixes; the baseline above remains the historical reproduction rather than being overwritten by a later passing outcome.
