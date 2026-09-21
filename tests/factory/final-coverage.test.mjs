import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFinalCoverage} from '../../factory/lib/final-coverage.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';

const criterion = (id, text = 'Preserve exact requested bytes.', evaluation) => ({id, text, ...(evaluation ? {evaluation} : {})});
function proposal({criteria = [criterion('local')], requirements} = {}) {
  return {requirements: requirements ?? [{id: 'r1', criteria: [criterion('bytes')]}],
    nodes: [{id: 'upstream', criteria: [criterion('upstream')]}, {id: 'final', criteria,
      requiredEffects: [{type: 'file', path: 'result.txt', command: '', expectedExit: null}]}], finalNodeId: 'final'};
}
test('exact final normalization preserves obligations and proposal, maps aliases before review', () => {
  const input = proposal({criteria: [criterion('local'), criterion('again'), criterion('extra', 'Independently test boundary cases.')]});
  const original = structuredClone(input), {plan, audit} = normalizeFinalCoverage(input);
  assert.deepEqual(input, original);
  assert.deepEqual(plan.requirements, input.requirements);
  assert.deepEqual(plan.nodes[0], input.nodes[0]);
  assert.deepEqual(plan.nodes[1].requiredEffects, input.nodes[1].requiredEffects);
  assert.deepEqual(plan.nodes[1].criteria, [criterion('req.r1.bytes'), criterion('extra', 'Independently test boundary cases.')]);
  assert.equal(audit.legacyFinalCriterionCount, 4); assert.equal(audit.criteriaAfter, 2);
  assert.deepEqual(audit.aliases.map(a => [a.from, a.to]), [['local', 'req.r1.bytes'], ['again', 'req.r1.bytes']]);
  assert.equal(audit.proposedPlanHash, sha256(input)); assert.equal(audit.normalizedPlanHash, sha256(plan));
  assert.deepEqual(normalizeFinalCoverage(plan).plan, plan, 'Idempotent, not increasingly lossy');
});
test('normalization is exact: differences in spaces, case, text and evaluator survive', () => {
  const variants = [criterion('space', 'Preserve exact requested bytes. '), criterion('case', 'preserve exact requested bytes.'),
    criterion('weaker', 'Preserve most requested bytes.'), criterion('control', undefined, 'runtime.independent_review')];
  const {plan, audit} = normalizeFinalCoverage(proposal({criteria: variants}));
  assert.deepEqual(plan.nodes[1].criteria, [...variants, criterion('req.r1.bytes')]);
  assert.deepEqual(audit.aliases, []); assert.equal(audit.criteriaAfter, 5);
});
test('absent and explicit content evaluators are the same established contract', () => {
  const {plan} = normalizeFinalCoverage(proposal({criteria: [criterion('local', undefined, 'content')]}));
  assert.deepEqual(plan.nodes[1].criteria, [criterion('req.r1.bytes')]);
});
test('qualified criteria cannot be weakened or change evaluator even with a correct alias', () => {
  for (const changed of [criterion('req.r1.bytes', 'Anything passes.'), criterion('req.r1.bytes', undefined, 'runtime.independent_review')]) {
    assert.throws(() => normalizeFinalCoverage(proposal({criteria: [criterion('local'), changed]})), {code: 'MANDATE_DRIFT'});
  }
});
test('an already qualified criterion does not incur another check', () => {
  const {plan, audit} = normalizeFinalCoverage(proposal({criteria: [criterion('req.r1.bytes'), criterion('alias')]}));
  assert.deepEqual(plan.nodes[1].criteria, [criterion('req.r1.bytes')]);
  assert.equal(audit.legacyFinalCriterionCount, 2); assert.equal(audit.criteriaAfter, 1);
});
test('equal text in distinct requirements keeps distinct qualified checks and ambiguous local obligations', () => {
  const input = proposal({requirements: [{id: 'r1', criteria: [criterion('bytes')]}, {id: 'r2', criteria: [criterion('bytes')]}]});
  const {plan, audit} = normalizeFinalCoverage(input);
  assert.deepEqual(plan.nodes[1].criteria, [criterion('local'), criterion('req.r1.bytes'), criterion('req.r2.bytes')]);
  assert.deepEqual(audit.aliases, []); assert.equal(audit.requiredCriterionCount, 2);
});
test('dotted requirement/criterion collisions are rejected, including identical text', () => {
  const input = proposal({requirements: [{id: 'a.b', criteria: [criterion('c')]}, {id: 'a', criteria: [criterion('b.c')]}]});
  assert.throws(() => normalizeFinalCoverage(input), {code: 'PLAN_COVERAGE_ID'});
});
test('malformed duplicate IDs cannot be hidden by normalization', () => {
  assert.throws(() => normalizeFinalCoverage(proposal({criteria: [criterion('same'), criterion('same')]})), {code: 'SCHEMA'});
});
test('equal node-only criteria remain intact without a unique requirement match', () => {
  const extra = [criterion('one', 'Additional acceptance.'), criterion('two', 'Additional acceptance.')];
  const {plan, audit} = normalizeFinalCoverage(proposal({criteria: extra}));
  assert.deepEqual(plan.nodes[1].criteria, [...extra, criterion('req.r1.bytes')]);
  assert.deepEqual(audit.aliases, []);
});
test('empty final-local proposal expands all exact requirement identities and evaluators before review',()=>{
  const requirements=[{id:'one',criteria:[criterion('same'),criterion('independence','Review is independent.','runtime.independent_review')]},
    {id:'two',criteria:[criterion('same')]}];
  const input=proposal({criteria:[],requirements}),original=structuredClone(input);
  const {plan,audit}=normalizeFinalCoverage(input);
  assert.deepEqual(input,original);
  assert.deepEqual(plan.nodes[1].criteria,[criterion('req.one.same'),criterion('req.one.independence','Review is independent.','runtime.independent_review'),criterion('req.two.same')]);
  assert.equal(audit.criteriaBefore,0);assert.equal(audit.criteriaAfter,3);
  assert.deepEqual(audit.added,['req.one.same','req.one.independence','req.two.same']);
  assert.deepEqual(normalizeFinalCoverage(plan).plan,plan);
  assert.deepEqual(plan.nodes[0],input.nodes[0]);assert.deepEqual(plan.requirements,input.requirements);
  assert.deepEqual(plan.nodes[1].requiredEffects,input.nodes[1].requiredEffects);
  assert.throws(()=>normalizeFinalCoverage(proposal({criteria:[],requirements:[]})),{code:'SCHEMA'});
});
