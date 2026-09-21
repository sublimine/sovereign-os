import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {id} from '../../factory/lib/contracts.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {conditionalSelectionCases as cases} from '../../reconstruction/verification/conditional-selection-cases.mjs';
import {runConditionalSelectionCaseDurably} from './conditional-selection-harness-durable.mjs';
const runtimeRoot=resolve(fileURLToPath(new URL('../..',import.meta.url)));
function fixture(t){const directory=fs.mkdtempSync(join(tmpdir(),'conditional-harness-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return directory;}
function provider(c,{mutate,fail,onInput}={}){return ()=>({async generate(input){
  onInput?.();if(fail)throw Object.assign(Error('Simulated provider failure'),{code:fail});
  const exposure=readSourceContextView(input.input),task=JSON.parse(exposure.task),a=exposure.artifacts.find(a=>a.id===task.candidateId);
  assert.equal(exposure.missionIntent,c.request);assert(!Object.hasOwn(task,'expected'));assert(!Object.hasOwn(input.schema.properties,'decision'));
  const proof=exposure.runtimeObservations.find(o=>o.kind==='artifact-input-copy');
  let value={artifactHash:a.hash,checks:task.assessmentCriteria.map(k=>({criterionId:k.id,verdict:c.expected[k.id],
    reason:'SIMULATED expected judgment for harness regression, not actual model capability.',
    evidence:[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body},{kind:'runtime',id:proof.id,hash:proof.hash,quote:'"artifactId":'+JSON.stringify(a.id)}]})),uncertainty:'Diagnostic only.'};
  if(mutate)value=mutate(value);await input.validate(value);
  return {value,receipt:{status:'completed',simulation:true,threadId:id('test-conditional'),turnId:'fixture',
    contextHash:inferenceRequestHash(input),model:input.model,reasoningEffort:input.reasoningEffort}};
},async close(){}});}
for(const c of cases)test(`SIMULATED harness ${c.id}: separate selection ${c.expected.selection}, faithful source, no operational acceptance or replay`,async t=>{
  const directory=fixture(t);let count=0;
  const result=await runConditionalSelectionCaseDurably({runtimeRoot,directory,fixture:c,assessmentSimulation:true,assessmentProviderFactory:provider(c,{onInput:()=>count++})});
  assert.equal(result.passed,true,JSON.stringify(result));assert.equal(count,1);assert.equal(result.metrics.integrity,'NOT_ATTESTED');
  assert.equal(result.publicProjection.telemetryProjected,false);assert.equal(result.durableTestAssessment.assessments,1);
  assert.equal(result.durableTestAssessment.simulatedCompleted,3);assert.equal(result.durableTestAssessment.liveCompleted,0);
  const reentry=JSON.parse(fs.readFileSync(join(directory,'reentry.json')));assert.equal(reentry.noReplay,true);assert.equal(reentry.beforeMaterialHash,reentry.afterMaterialHash);
  assert.equal(result.assessment.operationalAcceptance,false);assert(fs.existsSync(join(directory,'response-2.json')));
});
test('wrong substantive diagnostic is retained as failure without a second vote or acceptance',async t=>{
  const result=await runConditionalSelectionCaseDurably({runtimeRoot,directory:fixture(t),fixture:cases[1],assessmentSimulation:true,
    assessmentProviderFactory:provider(cases[1],{mutate:r=>({...r,checks:r.checks.map(c=>({...c,verdict:'PASS'}))})})});
  assert.equal(result.passed,false);assert.equal(result.fatal,null);assert.equal(result.checks.selection,false);
  assert.equal(result.checks.noOperationalAcceptance,true);assert.equal(result.checks.noReplay,true);
});
test('invalid citation is saved with raw response and receipt before validation failure',async t=>{
  const directory=fixture(t),result=await runConditionalSelectionCaseDurably({runtimeRoot,directory,fixture:cases[0],assessmentSimulation:true,
    assessmentProviderFactory:provider(cases[0],{mutate:r=>({...r,checks:r.checks.map(c=>({...c,evidence:c.evidence.map(e=>({...e,quote:'UNOBSERVED'}))}))})})});
  assert.equal(result.passed,false);assert.equal(result.fatal.code,'ASSESSMENT_EVIDENCE');assert.equal(result.assessmentCalls,1);
  const raw=JSON.parse(fs.readFileSync(join(directory,'response-2.json')));assert.equal(raw.value.checks[0].evidence[0].quote,'UNOBSERVED');assert.equal(raw.receipt.simulation,true);
});
test('quota is fatal, retains candidate and does not create a diagnostic result',async t=>{
  const directory=fixture(t),result=await runConditionalSelectionCaseDurably({runtimeRoot,directory,fixture:cases[0],assessmentSimulation:true,assessmentProviderFactory:provider(cases[0],{fail:'QUOTA'})});
  assert.equal(result.fatal.code,'QUOTA');assert.equal(result.assessmentCalls,1);assert(result.candidateId);
  assert.equal(fs.existsSync(join(directory,'assessment-result.json')),false);
});
test('frozen failure precedes provider construction and cannot create a candidate',async t=>{
  let calls=0;const result=await runConditionalSelectionCaseDurably({runtimeRoot,directory:fixture(t),fixture:cases[0],frozen:()=>false,
    assessmentProviderFactory:()=>{calls++;throw Error('Must not dispatch');}});
  assert.equal(calls,0);assert.equal(result.passed,false);assert.equal(result.candidateId,null);
});
