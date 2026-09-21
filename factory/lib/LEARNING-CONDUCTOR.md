# Bounded learning conductor

`LearningConductor` connects observed worker failures to a single diagnosed
candidate, the existing exact-prefix paired evaluator and separately authorized
promotion. This is orchestration of experiments, not proof of intelligence gains.
The catalog, mission acceptance criteria and global AGENTS.md are never rewritten.

Worker configurations that record `learningDisposition` distinguish an excluded
scope, an actual resolver lookup with no matching overlay, and a frozen selected
overlay. The exclusions are the existing worker boundary, not newly granted
eligibility. `missionReport.learning` exposes those original decisions alongside
current registered-scope count and this mission's cycles, without starting work.
Older configurations retain `NOT_RECORDED`; missing history is not reconstructed
from today's policy. A registered scope is not an accredited evaluator or an
automatic learning loop, and a frozen worker overlay is not today's active pointer.

## Why these boundaries exist

An observed failure comes before its proposed remedy. A proposal is not evidence
of improvement. The evaluator is independent of the proposal and keeps frozen
answers/holdouts outside its input. An accepted experiment remains inactive unless
promotion is separately authorized. All these states persist, including skipped,
rejected, interrupted and stale attempts.

The conductor selects only registered exact role/purpose/mode/profile/context/
review-format scopes. It cannot infer a trustworthy oracle for an arbitrary task.
Without a frozen dataset and executable evaluator, the correct state is
unconfigured, not an automatically fabricated measure of quality. The caller must
register the domain's cases explicitly: `LearningService.registerBaseline()` is
restricted to `evaluation-only`, while an activatable overlay must go through
`LearningService.registerDomain()` with externally configured provenance.

For a CLI-executable frozen domain, `learn-register --file MANIFEST` reuses
`LearningService.registerDomain` after a structural in-memory preflight. It
requires a compatible registered oracle, measured-improvement policy, a required
training case and a holdout. An activatable domain additionally needs signed
per-case provenance under an external policy; signature/source trust is checked
in the destination Store, not by the preflight. Runtime use also requires the
configured policy ID to equal the ID frozen for that domain; equivalent keys
under another policy identity do not qualify. Registration does not
observe/propose/evaluate/promote, and idempotent reentry cannot reset active
instructions. [Registration contract](LEARNING-DOMAIN-REGISTRATION.md).

When evaluation is invoked, the service authorizes each frozen case/variant in
durable state after a provenance recheck and before the external callback. It
rechecks after return and through the synchronous `beforeComplete` gate at
evaluation completion; this orders authorization and revocation but does not
make a provider call physically atomic. Promotion and rollback recheck on both
sides of their pointer change. A historical record does not reaccredit a source,
expected value or model improvement.

## Automatic capture and explicit bounded execution

At the end of a FactoryEngine run, if any learning scopes are registered, the
engine records matching observed rejected outputs, rejected review encodings and
independent RETURN or UNKNOWN reviews. UNKNOWN remains uncertainty, not an invented
FAIL verdict. This step makes **zero model calls** and does not change
the mission outcome. A capture failure is reported as `learning.observation.failed`.
Re-reading status/report never starts a cycle.

```js
const opportunities = engine.learningConductor.observeMission(missionId);
for (const opportunity of opportunities.cycles.slice(0, 1)) {
  await engine.learningConductor.advance(opportunity.id, {
    runCase: trustedDomainEvaluator.runCase.bind(trustedDomainEvaluator),
    signal,
    autoPromote: false,
  });
}
```

This call performs at most one proposal inference and one frozen paired evaluation
(`2 * caseCount` calls with SubscriptionCaseEvaluator). It does not recursively
create more candidates, change datasets, purchase credits or invoke a paid API.
An enclosing scheduler can invoke it under a predeclared experiment budget. The
default mission queue does not silently allocate such a budget. The proposal uses
the existing official Codex subscription provider, Astra/ultra/scoped-v1, and the
complete Ω24 diagnostic facet. It receives only its scoped old instructions and
the exact observed rejection records, not the evaluator, expected answers, Store
or signing material. Context is bounded to 256 KiB; overflow is explicit, not
silent evidence truncation. It may return `skip`.

Each rejection now includes an authenticated diagnostic projection: the last
worker exposure committed **before that rejection**, receipt IDs/hashes, actual
actors, tools, statuses, timestamps and relevant result hashes. Later observations
are not backdated into that exposure. Relation is derived from the verified actor,
not a label in model output. This projection deliberately excludes file bodies;
it can diagnose actor/receipt confusion, not certify source entailment or current
file correctness. Historical instruction-prefix metadata is supplied so an old
failure is not automatically attributed to the current version.

New actor-boundary rejections also preserve a bounded, allowlisted diagnostic of
the exact criterion/evidence IDs and expected/observed actors. The same diagnostic
is supplied to the existing review repair loop. It neither changes the verdict
rules nor adds tool calls. Old historical records without this information are
not retroactively rewritten, and their missing context may still justify `skip`.

Artifact-citation diagnoses also check the rejected quotation against the exact
version-one payload admitted before the rejection. The capsule records historical
binding and literal substring match, without supplying replacement quotations or
new artifact bodies. `true` does not mean entailment; `null` is an unestablished
binding, not a fabricated match. A real planning review in `Ikayye8G` contained
13 artifact quotations, two partly paraphrased and therefore invalid. Read-only
replay reports those exact two failures and preserves the later repaired review.
No learning proposal or measured benefit is implied by that diagnostic.

Two real qualification runs from the same old TOOL_ACTOR rejection did return
`SKIPPED`: first with only the rejection, then with authenticated historical actor
metadata. They consumed 23,509 and 26,410 observed total tokens respectively.
Neither dispatched comparison calls or promoted an overlay. These results test
the real diagnosis/skip/no-replay path, not the full real proposal/evaluation path
or a positive model improvement. Their original mission journal remained intact.

CLI commands separate `learn-list` and `learn-evaluators` (read only),
`learn-observe MISSION` (zero-inference capture), `learn-propose CYCLE` (one
proposal, never evaluation or promotion) and `learn-evaluate CYCLE` (comparison
of a saved proposal, never another proposal or automatic promotion). The latter
uses `engine.learningEvaluation`, a closed executable registry. It refuses
OBSERVED/PROPOSING without mutation, preserves incompatible PROPOSED experiments,
and reconciles EVALUATING without replaying uncertain inferences. Terminal
reentry is read-only. No CLI option loads arbitrary evaluator code or simulation.

The first registered contract `exact-json-value-v1` requires `exactMatch`,
direction `higher`, threshold `1` in every case. It compares the complete returned
JSON value to frozen `case.expected` canonically, ignoring only object key order.
Types, array order, extra fields, whitespace and Unicode in values remain exact.
The transport validator checks JSON data only; it never accesses the hidden
answer or uses correctness feedback to repair the response. The frozen schema
still goes to the provider unchanged as a generation constraint, but this oracle
does not perform general JSON Schema validation. The owner must justify expected
values, schema compatibility, holdouts and representative coverage. Executable
equality is not independent semantic accreditation or demonstrated real learning.
Custom trusted SDK evaluators remain supported without being CLI-executable.

## Evaluation-only domains

The SDK accepts the optional frozen dataset restriction
`policy.activation: 'evaluation-only'`. With it, a bounded reviewer scope may
retain `boundedReadReview: 'bounded-read-response-v1'`, its selected
`producerBatch`, and its `inferenceBudgetHash`. These are scope bindings, not
permission to apply an overlay or to treat a replayed file receipt as a new read.
Unknown controller/producer/documentary scope extensions remain rejected.
Without that restriction the previous scope grammar is unchanged.

Comparisons retain their measured results. A passing conductor cycle ends as
`EVALUATED_ONLY` with `LEARNING_EVALUATION_ONLY`, never `READY_FOR_PROMOTION`;
`autoPromote: true` cannot override the dataset. Failed comparisons remain
`REJECTED`. Reconciliation after a committed evaluation preserves that distinction
without another inference. Registry and service promotion/rollback are blocked,
and the execution resolver/export cannot supply an active overlay. Worker
exclusions remain unchanged. A policy change needs a new frozen domain/evaluation,
not a retrospective edit to this dataset or a reinterpretation of its result.

This permits qualification work using the complete current reviewer scope. It
does not configure a domain, accredit an oracle, prove model improvement, or
activate learning in the ordinary queue. Known retrospective requests are not
holdouts. Older strict dataset readers reject the new policy key before paired
evaluation or promotion; do not assume they understand the new terminal label.

## Authority and recovery

Default result after a successful comparison is `READY_FOR_PROMOTION`. Use
`conductor.promote(id, {lease, principalId})`, or explicitly set `autoPromote:true`
with a valid preauthorized exact-role lease during `advance`. The existing service
rechecks scope, parent CAS, nonregression, dataset and bound request receipts at
commit. Promotion and cycle advancement are one SQLite transaction. Missing or
revoked promotion authority leaves the fully evaluated candidate inactive. Existing
workers keep their frozen instructions. Rollback remains the service's separately
authorized operation; a historical PROMOTED event is not current-active status.

An exclusive live-PID owner prevents concurrent diagnosis/evaluation; a merely
slow process is not evicted by elapsed time. Re-entry after a committed proposal
does not regenerate it. A signed completed proposal recovers the small window
before candidate registration. A completed exact-prefix evaluation recovers the
window before the cycle's status checkpoint. A process lost during an inference
or incomplete comparison stays `INTERRUPTED`; the conductor does not invent its
result or blindly repeat paid work. Manual reconciliation is still required for
that unknown boundary. This is not a claim of universal crash recovery.

## Evidence limits

`advance` and `LearningService.evaluate` now forward `{signal}` as the second
argument to the trusted case callback. Pass it on to
`SubscriptionCaseEvaluator.runCase(request, {signal})`. Cancellation is checked
before dispatch, reaches the subscription provider and prevents later cases and
promotion. Custom callbacks must honor that signal themselves; the conductor
cannot force arbitrary callback code to stop. Native case attempts are journaled
before provider creation. Completed signed inference and usage survive a later
cancellation or oracle failure, without being counted as a graded or accepted
comparison. Unknown outcomes are not zero-cost calls or permission to replay.

The default tests use explicitly simulated providers and deterministic numeric
fixtures. They verify ownership, private evaluation inputs, no replay, stage
ordering, rejection, authorization, promotion and rollback. They are not a model
improvement benchmark. An existing six-real-inference learning experiment rejected
a non-improving candidate; it remains preserved. No production instructions have
been promoted on the strength of these conductor tests.
