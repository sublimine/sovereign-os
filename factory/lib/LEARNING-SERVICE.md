# Evaluated instruction integration

This optional service connects the existing `LearningRegistry` to actual worker compilation. It is not autonomous training and does not infer a dataset, metrics or evaluator accreditation. Nothing edits the repository's or user's global `AGENTS.md`. An operational overlay must be registered as an attested domain; bare baselines are restricted to `evaluation-only` experimentation.

This file documents the source tree, not an assertion about any installed wrapper
or service. The protocol-12 provenance and protocol-14 activation/dispatch paths
need a separately qualified release before they can be described as deployed.

## API

```js
const learning = new LearningService({store, authority, exportRoot: dedicatedNewDirectory, provenancePolicy});
const domain = learning.registerDomain({
  domainId: 'bounded-purpose-v1',
  roleId: 'sigma_01',
  scope: {roleIds: ['sigma_01'], purpose: 'bounded-purpose', mode: 'producer'},
  datasetSpec,
  provenance, // signed case bindings; policy stays outside this object
});
const candidate = learning.propose({roleId: domain.policyId, parentHash: domain.baseline.hash, instructions: proposedOverlay, rationale, authorRunId});
await learning.evaluate(candidate.candidateId, {runCase: trustedEvaluator});
learning.promote(candidate.candidateId, {lease, principalId});
const workers = new WorkerService({...dependencies, learningInstructionsResolver: learning.resolver()});
```

`provenancePolicy` is trusted host configuration with the closed
`sovereign.learning-provenance-policy.v1` schema. It is neither accepted from
the domain manifest nor persisted as the domain's trust root; the frozen domain
only records its `policyId`. Every process that registers or uses an attested
domain needs the applicable policy configuration. At runtime, the configured
`policyId` must equal the ID frozen in both domain and provenance record; the
same key material presented under another policy identity fails closed.

`propose`, evaluation and an evaluator's positive verdict do not deploy a version. Promotion still requires the core registry's exact mission, principal, `instructions.promote` action, domain policy resource, nonregression policy and parent CAS. In addition, a non-baseline activation needs a service-issued immutable `learning-activation` dossier bound to the candidate, parent, evaluated prefix, dataset, scope, target set, completed evaluation and current provenance. The registry refuses a raw promotion without that dossier. Rollback requires `instructions.rollback`; reverting to the original baseline disables the overlay for newly created workers.

`registerBaseline()` remains for explicit `datasetSpec.policy.activation: 'evaluation-only'` experiments. It rejects an activatable dataset rather than offering an SDK bypass around provenance. The low-level `LearningRegistry` is storage machinery, not the operational worker route; it refuses a non-baseline pointer transition without the service dossier and by itself does not create the domain, compilation or resolver records required for runtime application. This is not a defense against a hostile same-user database owner, which is outside the Store threat model.

The scope is the exact purpose, producer/reviewer mode and set of role facets. It is not tied to a mission or node ID. Direct `resolve` rejects incompatible scopes. The optional integration `resolver()` first verifies frozen compilation integrity, then returns no overlay for unrelated scopes, leaving those workers on their unchanged baseline. It does not suppress integrity failures. Independently evaluated overlays are not silently combined. Broader legitimate scope needs another suitable evaluation design. No universal generalization is claimed.

Runtime application additionally requires an exact `{model, reasoningEffort}`
pair present in the frozen evaluated dataset. Worker creation supplies that pair
as the resolver's third argument; an omitted or unevaluated target returns no
overlay. Direct `resolve` remains instruction-version inspection, not execution
authorization. A worker that froze a promoted prefix also freezes its execution
target and rejects a later model/effort change before provider dispatch. New
workers on other models keep their baseline. Old candidates/datasets are not
rewritten and no cross-model generalization is inferred from matching role names.

## Exact compilation and evaluation binding

`compileLearningPrefix` is used by workers and the evaluator service. It contains the full catalog cards, the promoted/candidate overlay if any, and the common control instructions. `composeLearningRequest` adds the variable task instructions and serializes the schema consistently. The original baseline uses the unmodified shared prefix; later comparisons use the actual parent overlay, not always the original baseline.

Each frozen case's `input` must contain:

```js
{taskInstructions, input, schema, model, reasoningEffort}
```

`input` is the **complete provider input string**, including relevant observed data, not a shortcut that pretends to reproduce another context. The external trusted `runCase` receives the core evaluation request plus `effectivePrefix`, `effectiveInstructions`, `effectiveRequest`, and:

```js
executionContext = {prefixHash, requestHash, scopeHash}
```

It must actually execute/measure the effective request and return the original `LearningRegistry` observation/receipt contract. Put that exact `executionContext` in `observations.actual.executionContext`. The signed receipt's `observationsHash` binds it to the observation. The service checks the binding and records the exact completed evaluation record hash before allowing resolution or promotion. A raw registry operation alone does not satisfy this service-level binding or create an attested runtime domain.

Signatures authenticate the trusted evaluator boundary; a callback possessing a signer can still lie. An independently accredited evaluator and suitable frozen cases remain substantive obligations. Default tests use an explicitly deterministic numeric fixture, not real model training or a claim of model improvement.

### Durable dispatch ordering for an attested evaluation

For every frozen case and both `baseline`/`candidate` variants, the service first
builds an immutable dispatch authorization containing the evaluation/candidate,
case and case hash, variant, instruction hash, effective request hash, prefix
hash and scope hash. It revalidates the frozen compilation and provenance, then
stores that authorization in the same Store transaction. Only after that commit
does it invoke the evaluator callback. This is authorization to make an external
call, **not** physical atomicity with a provider.

After the callback returns, the service revalidates again in a transaction before
marking the authorization `RETURNED`. The core evaluation completion transaction
then calls the synchronous `beforeComplete` gate; that gate performs another
compilation/provenance recheck in the same transaction as the completed
evaluation record. It never awaits an external operation there. A final
revalidation gates the reusable evaluated-prefix binding, so a callback result
is not reusable merely because it was authorized before an await.

A revocation committed before dispatch authorization blocks the callback. One
committed afterwards has a durable order after that authorization and does not
rewrite history, but the post-callback, completion, prefix, resolution,
promotion and export gates can still reject further use. Historical authorization
or evaluation records are evidence of sequence, not new accreditation of the
dataset, source or expected value.

## Activation and live dispatch custody

The service issues `sovereign.learning-activation.v1` only after it has checked
the exact evaluated prefix and completed evaluation. `LearningRegistry.promote()`
or a non-baseline rollback then writes `activeActivationId` with the pointer and
emits a separate `sovereign.learning-activation-binding.v1` record after that
CAS. The binding contains the committed `learning-role` version and hash. It is
therefore impossible to reinterpret a pre-CAS dossier as authorization for a
different active pointer, or reuse an activation ID when a historical version is
reactivated.

At `createRun`, the worker freezes the exact active prefix plus
role/hash/version/scope, activation dossier reference and post-CAS binding
reference in `worker-config`. When an overlay is selected it also writes a
signed immutable `sovereign.learning-worker-origin.v1` binding to that initial
`run@1` and `worker-config@1`. A later configuration head cannot erase the fact
that this run is learned: any missing, changed or emptied configuration fails
closed both before its first request and after earlier completions. It is also
not a perpetual permit: immediately before dispatch the worker
requires the same active binding, source custody, scope and target to remain
valid. A rollback to baseline blocks the old run with `LEARNING_REVOKED`; a
later promotion or reactivation blocks it with `LEARNING_SUPERSEDED`. A caller
must create a new run for a new overlay rather than silently changing the
historical run's bytes.

For an overlay dispatch, the worker retains the exact `inference-request` and,
in the same Store transaction, writes a signed
`sovereign.learning-dispatch-authorization.v1` before provider entry. That
record binds the activation/binding, frozen worker configuration, pending run,
request record/hash, scope, prefix and exact target by immutable record
references. The generic Registry API rejects a learned request unless the exact
WorkerService created an opaque, process-local preparation handoff; it likewise
rejects a receipt unless that same worker hands off the exact returned receipt.
At receipt acceptance it revalidates the live frozen overlay again, consumes the
authorization exactly once, and records a signed
`sovereign.learning-dispatch-completion.v1` linked to the authorization, pending
run, request, configuration and receipt hash. This first active use raises the
Store to protocol 14. A source retraction, modified dossier/binding, target
mismatch or pointer change therefore fails closed before a new request, before
provider entry, or before a returned response can enter run history.

There is one deliberately narrow recovery path for an outer retention rollback
that happens after receipt attachment: the live worker may retain the exact
public value, exact receipt and opaque receipt handoff in process, and retry
only the same logical route and request. It does not call the provider again.
Concurrent exact retries converge on the subsequently verified durable
producer/planning result; each contender still rechecks the caller validator,
current source/binding/target custody and the exact route before returning it.
A different input or route, an unconfirmed provider close, a retraction, or a
changed configuration fails closed instead of replaying the cached value. This
is a crash-safe refusal boundary, not a claim of physical exactly-once delivery:
the recovery cache is intentionally unavailable after restart and cannot be
rebuilt from a request hash.

The handoff demonstrates the trusted in-process route, not a cryptographic
attestation from a remote provider. It is intentionally lost on process restart:
an outstanding learned request must be reconciled with independently verifiable
provider evidence rather than completed from a request hash. The Registry and
Worker must be composed by the trusted host before either is exposed: the
one-time dispatch-control installation is a bootstrap boundary, not a
standalone hostile-SDK authorization API. A learned run snapshots the trusted
provider factory selected at its creation; ordinary workers remain configurable.
A same-user actor that can directly mutate the Store or use its Authority, or
that owns this trusted bootstrap/provider composition, is inside the trusted
computing base; these source-tree guards do not claim to defend that owner.

Baseline rollback is deliberately a narrow removal path: it preserves authority,
baseline identity and append-only journal ordering but does not require the
outgoing overlay's provenance to remain valid. Re-activating a non-baseline hash
is an activation again and requires fresh compilation/provenance checks and a
new dossier/binding.

Only current promoted versions resolve; inactive candidates and the baseline do
not create overlays. With no resolver, the worker uses the ordinary prefix and
never consults learned candidates.

## Derived export

`exportActive({roleId, expectedVersion, lease, principalId})` requires `instructions.export` for `role:<roleId>` under the dataset mission. Exporting is separately authorized from promotion. The optional export root must be a new dedicated absolute directory; an existing unowned directory is rejected even when empty. Ownership is bound to an authenticated marker and Store record.

Each version writes a new exclusive, fsynced `<instruction-hash>-<active-version>/AGENTS.md`, then advances a Store CAS pointer. Existing files are never overwritten. A modified prior export is rejected. The file identifies its instruction and prefix hashes and contains the derived approved prefix. It is an export, not automatic installation into another project.

This is not an atomic transaction across SQLite and the filesystem. A crash after writing but before committing can leave an orphan directory; a retry fails for reconciliation instead of overwriting or pretending the export was committed. The dedicated directory excludes untrusted workers but does not claim protection from a hostile same-user administrator. Original files and earlier approved exports remain untouched.

## Attested provenance and separate domains

For an activatable domain, `provenance` must use
`sovereign.learning-provenance.v1` and bind every frozen case, normalized scope,
dataset and evaluator. Each case carries one or more references to an admitted
source with its hash and literal passage; the manifest also carries a review
method, limitations, and exactly one Ed25519 `labeler` and one `reviewer`
attestation. The configured policy rejects an untrusted role/key and reuse of
the same public key under different identities.

Those signatures establish custody and review under that configured policy. They
do **not** establish that an expected value is factually true, that two humans
acted independently, that the sources are sufficient, or that the holdout is
representative. They are distinct from the evaluator receipt signature described
above. A source retraction or changed/missing passage invalidates future runtime
use rather than silently treating the overlay as absent.

An `evaluation-only` domain may omit provenance, or retain it for its own record,
but never becomes activatable merely because it has signatures.

`registerDomain({domainId, roleId, scope, datasetSpec, provenance})` returns
`{policyId, domainId, roleId, baseline}`. It keeps the actual catalog role while
giving each evaluated scope its own immutable policy. Pass `policyId` in the
existing operations' `roleId` argument and grant exactly `role:<policyId>`;
an old role-level or another domain's grant does not authorize it. A domain that
carries provenance verifies its Ed25519 labeler/reviewer signatures plus admitted
source hashes/passages under the separately configured `provenancePolicy`, then
opts into execution protocol 12 atomically. It repeats that verification before
evaluation, promotion, resolution and export, so a source retraction blocks
future use without altering history. Old baseline IDs are not rewritten and do
not obtain retrospective accreditation. For the same catalog role, two domains
may share a target only when their canonical scopes differ; the same scope plus
an overlapping model/effort target is rejected, and resolver ambiguity fails
closed.

A v1 domain without provenance retains historical rows but requires an
execution-protocol-11 Store to compile. Once a Store has been elevated to 12,
there is no downgrade or automatic conversion of v1 history into attested v2
data; deployment needs an explicit compatibility/migration decision.

Promotion and non-baseline rollback run their compilation/provenance checks both
before and after their durable pointer change inside the same Store transaction.
The post-check makes a same-transaction control-plane change fail atomically
with that pointer change; it still does not make an external provider callback
part of a database transaction. Baseline rollback is intentionally the narrow
exception described above so emergency removal remains possible after evidence
retraction.

The worker still receives the actual catalog role in its evaluated prefix, not
an internal policy key. The selected domain and policy are recorded with the
frozen instruction version. Exported domain AGENTS files also identify actual
role, policy/domain, dataset, complete evaluated scope and model targets. Their
existing instruction hash already binds the policy; equal text in two policies
does not collide. Earlier untagged exports retain their exact historical body
on idempotent re-read, with no retroactive metadata insertion or file rewrite.

## Inactive evaluation of current reviewer contracts

`datasetSpec.policy.activation: 'evaluation-only'` can retain exactly one of
`boundedReadReview: 'bounded-read-response-v1'` or
`sourcedResponseReview: 'sourced-response-v1'` in a reviewer scope, together with
its original optional `producerBatch` and `inferenceBudgetHash`. Do not remove
those fields or merge different budget hashes merely because prefixes match.
Unknown, combined or producer-controller contracts are not admitted. Omitting
`evaluation-only` does not turn these into deployable scopes.

Such a candidate may be measured with complete frozen requests but never
resolve to an operational overlay, promote, roll back into deployment or export
as approved. The conductor records a passing comparison as `EVALUATED_ONLY`, not
promotion readiness. Worker exclusions and instruction bytes are unchanged.
Supporting this data shape does not accredit the evaluator or prove improvement;
construction-only fixtures and known historical cases are not model holdouts.

## Verification

`node --test tests/factory/learning-service.test.mjs` compares full instruction bytes and request hashes between evaluated baseline/candidate requests and actual WorkerService dispatch through a simulated provider; checks version freezing, scope refusal, authority/CAS, unsafe export ownership, immutable activation/binding receipts, durable pre-provider dispatch authorization, source retraction, baseline rollback, supersession and dossier corruption. `tests/factory/learning-provenance.test.mjs` separately covers closed bindings, dual-key policy checks and source retraction. Models are not called by default.

These are source-tree regression tests, not a qualification of an installed
package, human review process, factual dataset or model improvement.
