import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {id} from '../../factory/lib/contracts.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {compactCatalogReview} from '../../factory/lib/review-codec.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {nativeSelectionReviewCases as cases} from '../../reconstruction/verification/native-selection-review-cases.mjs';
import {runNativeSelectionCaseDurably} from './native-selection-review-harness-durable.mjs';
const runtimeRoot=resolve(fileURLToPath(new URL('../..',import.meta.url)));
function setup(t){const directory=fs.mkdtempSync(join(tmpdir(),'selection-harness-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return directory;}
function provider(c,{mutate,fail,onInput}={}){return ()=>({async generate(input){
  onInput?.(input);if(fail)throw Object.assign(Error('Simulated provider failure'),{code:fail});
  const exposure=readSourceContextView(input.input),task=JSON.parse(exposure.task),a=exposure.artifacts.find(a=>a.id===task.candidateId),proof=exposure.runtimeObservations.find(o=>o.kind==='artifact-input-copy');
  assert.equal(exposure.missionIntent,c.request);assert.ok(proof);assert.ok(!input.input.includes(c.oracleReason));
  const wrong=c.expected.decision==='RETURN';
  let value={artifactHash:a.hash,purpose:a.payload.purpose,decision:c.expected.decision,
    checks:task.criteria.map(v=>({criterionId:v.id,verdict:wrong&&['req.literal.object','input-copy-selection'].includes(v.id)?'FAIL':'PASS',
      reason:'SIMULATED exact-case oracle for harness/controller testing only; not a real model judgment.',
      evidence:[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body},{kind:'runtime',id:proof.id,hash:proof.hash,quote:'"artifactId":'+JSON.stringify(a.id)}]})),
    findings:wrong?[{severity:'material',description:'Simulated wrong section, despite exact source fidelity.',recovery:'Diagnose the selector before proposing a different plan; do not recopy this selection.'}]:[],uncertainty:'SIMULATED test provider.'};
  if(mutate)value=mutate(value);
  value=compactCatalogReview(value,task.observedEvidenceCatalog);
  assert.equal(await input.validate(value),true);
  return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:id('simulated-product-test'),turnId:'test',
    contextHash:inferenceRequestHash(input),model:input.model,reasoningEffort:input.reasoningEffort}};
},async close(){}});}

for(const c of cases)test(`selection-review harness preserves ${c.id} expected ${c.expected.decision}, native proof and no replay`,async t=>{
  const directory=setup(t);let calls=0;
  const result=await runNativeSelectionCaseDurably({runtimeRoot,directory,fixture:c,reviewSimulation:true,
    reviewProviderFactory:provider(c,{onInput:()=>calls++})});
  assert.equal(result.passed,true,JSON.stringify({checks:result.checks,fatal:result.fatal,reentry:JSON.parse(fs.readFileSync(join(directory,'reentry.json')))}));assert.equal(calls,1);assert.equal(result.metrics.simulatedCompleted,3);
  assert.equal(result.metrics.liveCompleted,0);assert.equal(result.productReceipt.simulation,true);
  assert.equal(result.publicProjection.metricsIntegrity,'NOT_ATTESTED');assert.equal(result.publicProjection.reviewsProjected,0,
    'The test-private durable audit must not reopen the public report boundary');
  const reentry=JSON.parse(fs.readFileSync(join(directory,'reentry.json')));assert.equal(reentry.noReplay,true);
  assert.equal(reentry.beforeMaterialHash,reentry.afterMaterialHash);
  assert.equal(fs.readdirSync(directory).filter(n=>/^request-/.test(n)).length,3);
  const response=JSON.parse(fs.readFileSync(join(directory,'response-2.json')));assert.equal(response.value.decision,c.expected.decision);
});
test('incorrect but committed product verdict remains failed, without a second vote',async t=>{
  const c=cases[1],directory=setup(t);let calls=0;
  const result=await runNativeSelectionCaseDurably({runtimeRoot,directory,fixture:c,reviewSimulation:true,reviewProviderFactory:provider(c,{onInput:()=>calls++,
    mutate:r=>({...r,decision:'ACCEPT',checks:r.checks.map(x=>({...x,verdict:'PASS'})),findings:[]})})});
  assert.equal(calls,1);assert.equal(result.passed,false);assert.equal(result.fatal,null);assert.equal(result.status,'COMPLETED');
  assert.equal(result.checks.decision,false);assert.equal(result.checks.selection,false);assert.equal(result.checks.fidelity,true);
  assert.equal(result.checks.noReplay,true);
});
test('invalid evidence is retained before validation and stops the diagnostic, not counted as a correct rejection',async t=>{
  const c=cases[1],directory=setup(t);let calls=0;
  const result=await runNativeSelectionCaseDurably({runtimeRoot,directory,fixture:c,reviewSimulation:true,reviewProviderFactory:provider(c,{onInput:()=>calls++,
    mutate:r=>({...r,checks:r.checks.map(x=>({...x,evidence:x.evidence.map(e=>({...e,quote:'THIS PASSAGE WAS NEVER OBSERVED'}))}))})})});
  assert.equal(calls,1);assert.equal(result.passed,false);assert.ok(result.fatal);assert.equal(result.review,null);
  assert.equal(result.checks.decision,false);assert.equal(result.checks.noReplay,false);
  assert.ok(fs.readFileSync(join(directory,'response-2.json'),'utf8').includes('THIS PASSAGE WAS NEVER OBSERVED'));
});
test('quota keeps the original candidate and stops without consuming a second review call',async t=>{
  const c=cases[0],directory=setup(t);let calls=0;
  const result=await runNativeSelectionCaseDurably({runtimeRoot,directory,fixture:c,reviewSimulation:true,reviewProviderFactory:provider(c,{onInput:()=>calls++,fail:'QUOTA'})});
  assert.equal(calls,1);assert.equal(result.status,'WAITING_QUOTA');assert.equal(result.fatal.code,'QUOTA');assert.equal(result.passed,false);
  assert.equal(fs.existsSync(join(directory,'response-2.json')),false);assert.ok(result.candidateId);assert.equal(result.checks.noReplay,false);
});
test('frozen boundary fails before any external provider construction',async t=>{
  const c=cases[0],directory=setup(t);let factories=0;
  const result=await runNativeSelectionCaseDurably({runtimeRoot,directory,fixture:c,frozen:()=>false,reviewSimulation:true,
    reviewProviderFactory:()=>{factories++;throw Error('Must not be constructed');}});
  assert.equal(factories,0);assert.equal(result.passed,false);assert.equal(result.fatal.code,'EXPERIMENT_BOUNDARY');
});
