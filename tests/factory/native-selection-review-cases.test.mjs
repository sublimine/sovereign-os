import test from 'node:test';import assert from 'node:assert/strict';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {normalizeInputCopyPlan,selectInputCopy} from '../../factory/lib/input-copy-contract.mjs';
import {normalizeFinalCoverage} from '../../factory/lib/final-coverage.mjs';
import {validatePlan} from '../../factory/lib/plans.mjs';
import {assertPlanRoleExecution} from '../../factory/lib/role-execution.mjs';
import {independentlySelectedBody} from '../../reconstruction/verification/native-input-trial-acceptance.mjs';
import {nativeSelectionReviewCases as cases,judgeNativeSelectionReview} from '../../reconstruction/verification/native-selection-review-cases.mjs';

test('selection-review fixtures differ only in native selector within each pair; all are structurally valid',()=>{
  assert.equal(cases.length,4);assert.deepEqual(cases.map(c=>c.expected.decision),['ACCEPT','RETURN','RETURN','ACCEPT']);
  for(const [a,b]of [[cases[0],cases[1]],[cases[2],cases[3]]]){
    assert.equal(a.request,b.request);assert.equal(a.expected.body,b.expected.body);
    const omit=p=>{const v=structuredClone(p);delete v.nodes[0].execution;return v;};
    assert.equal(canonical(omit(a.plan)),canonical(omit(b.plan)));assert.notDeepEqual(a.plan.nodes[0].execution,b.plan.nodes[0].execution);
  }
  for(const c of cases){
    const p=normalizeFinalCoverage(normalizeInputCopyPlan(c.plan).plan).plan;
    assert.doesNotThrow(()=>validatePlan(p,c.request,{allowedTools:[]}));assert.doesNotThrow(()=>assertPlanRoleExecution(p));
    const selected=selectInputCopy(c.request,p.nodes[0].execution).body;
    assert.equal(independentlySelectedBody(c.request,p.nodes[0].execution),selected);
    assert.equal(selected===c.expected.body,c.expected.decision==='ACCEPT');
    assert.equal(sha256(c.expected.body),c.expected.bodySha256);assert.equal(Buffer.byteLength(c.expected.body),c.expected.bodyUtf8Bytes);
    assert.ok(c.request.includes(c.expected.body));assert.ok(c.request.includes(selected));
    assert.ok(!c.request.includes(c.oracleReason));assert.equal(Object.hasOwn(c.plan,'expected'),false);
    assert.equal(p.nodes[0].criteria.length,8);assert.equal(p.nodes[0].roleIds.length,0);assert.equal(p.nodes[0].tools.length,0);
  }
});
test('selection negatives retain the same Unicode/escape fidelity challenges, not just a missing substring',()=>{
  const bodies=cases.map(c=>selectInputCopy(c.request,c.plan.nodes[0].execution).body);
  for(const body of bodies){assert.ok(body.includes('e\u0301'));assert.notEqual(body,body.normalize('NFC'));}
  assert.ok(bodies[0].includes('\r\n'));assert.ok(bodies[1].includes('\r\n'));
  for(const body of bodies.slice(2)){assert.ok(body.includes('\\n\\u0301'));assert.ok(body.includes('\n  clave='));assert.ok(body.endsWith('\t'));}
});
test('selection oracle separates semantic selection from native fidelity; blanket returns and blanket accepts fail',()=>{
  const pass=(r,c)=>Object.values(judgeNativeSelectionReview(r,c)).every(v=>v===true);
  for(const c of cases){const r={decision:c.expected.decision,checks:[{criterionId:'input-copy-selection',verdict:c.expected.selectionVerdict},{criterionId:'input-copy-fidelity',verdict:'PASS'}]};
    assert.equal(pass(r,c),true);assert.equal(pass({...r,decision:r.decision==='ACCEPT'?'RETURN':'ACCEPT'},c),false);
    assert.equal(pass({...r,checks:r.checks.map(x=>({...x,verdict:'FAIL'}))},c),false);
    assert.equal(pass({...r,checks:[...r.checks,r.checks[0]]},c),false);
    assert.equal(pass({...r,checks:[]},c),false);assert.equal(pass(null,c),false);
  }
});
