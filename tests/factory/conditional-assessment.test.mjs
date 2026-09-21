import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {ToolBroker} from '../../factory/tools/broker.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {ConditionalAssessmentService} from '../../factory/lib/conditional-assessment.mjs';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {registerInputCopyRun,materializeInputCopy,inputCopyEvidence} from '../../factory/lib/input-copy.mjs';
import {nativeSelectionReviewCases} from '../../reconstruction/verification/native-selection-review-cases.mjs';

const criteria=[{id:'selection',text:'Assess whether the supplied object is the requested one under the declared fixture condition.'},
  {id:'fidelity',text:'Assess byte preservation independently of whether the selection was correct.'}];
function fixture(t,respond=null){
  const directory=mkdtempSync(join(tmpdir(),'conditional-assessment-')),store=new Store(':memory:'),authority=new Authority(store);
  const registry=new ArtifactRegistry(store,authority),broker=new ToolBroker({store,authority,workspaceRoot:directory});
  const intent='Preserve the supplied literal BETA object. A prior PASS is not proof of the right selection.';
  store.put('mission','mission',{intent,intentHash:sha256(intent),status:'RUNNING',policy:{allowedTools:['workspace.read'],
    model:'gpt-6-astra',reasoningEffort:'ultra',cardEncoding:'compact-json-v1',contextEncoding:'source-text-v1'}},{expectedVersion:0});
  let number=0,calls=0,closed=0;const exposures=[];
  const run=(nodeId,artifacts=[],mode='producer')=>{
    const r=registry.registerRun({missionId:'mission',nodeId,mode,context:{purpose:'literal',artifactIds:artifacts,sourceIds:[],instructionsHash:sha256('fixture'),producerConversationIncluded:false}});
    registry.attachInference(r.id,{status:'completed',simulation:true,threadId:'fixture-'+(++number),turnId:'fixture'});return r;
  };
  const create=(nodeId,parents=[])=>registry.create({missionId:'mission',nodeId,producerRunId:run(nodeId,parents.map(a=>a.id)).id,
    kind:'answer',purpose:'literal',body:'BETA 0042\r\n🧭 é',inputRefs:parents.map(a=>({artifactId:a.id,hash:a.payloadHash,purpose:'literal'})),
    criteria:[{id:'original-obligation',text:'Original operative obligation remains unchanged.'}]});
  const parent=create('prior'),reviewer=run('review:prior',[parent.id],'reviewer');
  registry.review({artifactId:parent.id,reviewerRunId:reviewer.id,result:{artifactHash:parent.payloadHash,purpose:'literal',decision:'ACCEPT',
    checks:[{criterionId:'original-obligation',verdict:'PASS',reason:'SIMULATED fixture checkpoint.',evidence:[{kind:'artifact',id:parent.id,hash:parent.payloadHash,quote:parent.payload.body}]}],findings:[],uncertainty:''}});
  const candidate=create('literal',[parent]);
  const valid=(exposure,verdict='PASS')=>{
    const task=JSON.parse(exposure.task),artifact=exposure.artifacts.find(a=>a.id===task.candidateId);
    const provenance=exposure.runtimeObservations.find(o=>o.kind==='artifact-dependency-inferences'&&JSON.parse(o.quoteText).detail.artifactId===candidate.id);
    return {artifactHash:artifact.hash,checks:task.assessmentCriteria.map(c=>({criterionId:c.id,verdict,reason:'Simulated unit-test judgment; no model expertise claimed.',
      evidence:[{kind:'artifact',id:artifact.id,hash:artifact.hash,quote:artifact.payload.body},
        {kind:'runtime',id:provenance.id,hash:provenance.hash,quote:'SIMULATED'}]})),uncertainty:'Conditional diagnostic only.'};
  };
  const providerFactory=()=>({async generate(request){
    calls++;const exposure=readSourceContextView(request.input);exposures.push(exposure);
    const value=await (respond?respond({request,exposure,store,registry,candidate,parent,valid}):valid(exposure));
    await request.validate(value);
    return {value,receipt:{status:'completed',simulation:true,threadId:'diagnostic-'+calls,turnId:'fixture',
      model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
  },async close(){closed++;}});
  const workers=new WorkerService({store,authority,registry,broker,providerFactory}),service=new ConditionalAssessmentService(workers);
  const prepare=()=>service.prepare({artifactId:candidate.id,reviewerRoleIds:['omega_22'],criteria});
  t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
  return {store,registry,workers,service,candidate,parent,prepare,exposures,get calls(){return calls;},get closed(){return closed;}};
}

test('SIMULATED conditional assessment executes full scoped worker without changing material acceptance, mission or original criteria',async t=>{
  const f=fixture(t,({request,exposure,store,valid})=>{
    const task=JSON.parse(exposure.task),actor=store.list('run').find(r=>r.data.expectedRequestHash===inferenceRequestHash(request));
    const config=store.get('worker-config',actor.id).data;
    assert.deepEqual(config.roleIds,['omega_22']);assert(request.instructions.includes(config.instructions));
    assert(request.instructions.includes('CONDITIONAL_DIAGNOSTIC'));assert.equal(task.operationalAcceptance,false);
    assert(!Object.hasOwn(request.schema.properties,'decision'));assert.equal(request.model,'gpt-6-astra');assert.equal(request.reasoningEffort,'ultra');
    assert.equal(store.get('conditional-assessment',actor.id).data.status,'DISPATCHED');return valid(exposure);
  });
  const before={mission:f.store.get('mission','mission'),artifact:f.store.get('artifact',f.candidate.id),reviews:f.store.list('review')};
  const contract=f.prepare(),result=await f.service.execute(contract.runId);
  assert.equal(result.kind,'CONDITIONAL_DIAGNOSTIC');assert.equal(result.operationalAcceptance,false);assert.equal(result.simulation,true);
  assert.deepEqual(f.store.get('mission','mission'),before.mission);assert.deepEqual(f.store.get('artifact',f.candidate.id),before.artifact);
  assert.deepEqual(f.store.list('review'),before.reviews);assert.equal(f.store.list('effect').length,0);
  assert.deepEqual(contract.criteria,criteria);assert.equal(contract.originalCriteriaHash,sha256(f.candidate.payload.criteria));
  assert.equal(f.calls,1);assert.equal(f.closed,1);assert.deepEqual(f.service.result(contract.runId),result);
  const journal=f.store.verifyJournal();assert.deepEqual(await f.service.execute(contract.runId),result);
  assert.deepEqual(f.store.verifyJournal(),journal);assert.equal(f.calls,1,'Completed reentry does not infer again');
});
test('conditional wire schema constrains only the target hash, leaving reasons and observed citation fields expressible',async t=>{
  const schemas=[];
  for(let attempt=0;attempt<2;attempt++){
    const f=fixture(t,({request,exposure,valid})=>{
      // Inspect the serialized provider boundary, not only our post-generation
      // shape validator. The latter cannot detect an unsatisfiable wire schema.
      const schema=JSON.parse(JSON.stringify(request.schema)),fields=schema.properties;
      schemas.push(structuredClone(schema));
      const checks=fields.checks.items.properties;
      assert.deepEqual(fields.artifactHash,{type:'string',enum:[f.candidate.payloadHash]});
      assert.deepEqual(fields.uncertainty,{type:'string'});
      assert.deepEqual(checks.reason,{type:'string'});
      for(const key of ['id','hash','quote'])assert.deepEqual(checks.evidence.items.properties[key],{type:'string'},key);
      assert.deepEqual(checks.criterionId.enum,criteria.map(c=>c.id));
      assert.deepEqual(checks.verdict.enum,['PASS','FAIL','UNKNOWN']);
      assert.deepEqual(checks.evidence.items.properties.kind.enum,['artifact','runtime']);
      const value=valid(exposure);
      function allowed(v,s){
        if(s.enum)assert(s.enum.includes(v),'A valid observed answer must be permitted by the provider schema');
        if(s.type==='object')for(const [key,child]of Object.entries(s.properties))allowed(v[key],child);
        if(s.type==='array')for(const item of v)allowed(item,s.items);
      }
      allowed(value,schema);return value;
    });
    const contract=f.prepare();await f.service.execute(contract.runId);
  }
  assert.notDeepEqual(schemas[0].properties.artifactHash.enum,schemas[1].properties.artifactHash.enum,
    'Independent candidates need independent target bindings');
});
test('diagnostic identity cannot be reused for a material ACCEPT or any tool lease',async t=>{
  const f=fixture(t),contract=f.prepare(),result=await f.service.execute(contract.runId),before=f.store.verifyJournal();
  assert.throws(()=>f.registry.review({artifactId:f.candidate.id,reviewerRunId:contract.runId,
    result:{artifactHash:f.candidate.payloadHash,purpose:'literal',decision:'ACCEPT',checks:result.result.checks,findings:[],uncertainty:''}}),{code:'ASSESSMENT_ONLY'});
  assert.throws(()=>f.workers.lease(contract.runId,'workspace.read'),{code:'ASSESSMENT_ONLY'});
  assert.deepEqual(f.store.verifyJournal(),before);assert.equal(f.store.get('artifact',f.candidate.id).data.status,'CANDIDATE');
});
for(const verdict of ['FAIL','UNKNOWN'])test(`conditional ${verdict} is a preserved diagnostic, never a returned operational product`,async t=>{
  const f=fixture(t,({exposure,valid})=>valid(exposure,verdict)),contract=f.prepare(),result=await f.service.execute(contract.runId);
  assert(result.result.checks.every(c=>c.verdict===verdict));assert.equal(f.store.get('artifact',f.candidate.id).data.status,'CANDIDATE');
  assert.equal(f.store.get('conditional-assessment',contract.runId).data.status,'ASSESSED');
});
test('invalid citation is retained with completed receipt, rejected and not automatically retried',async t=>{
  const f=fixture(t,({exposure,valid})=>{const v=valid(exposure);v.checks[0].evidence[0].quote='NOT PRESENT';return v;});
  const contract=f.prepare();await assert.rejects(f.service.execute(contract.runId),{code:'ASSESSMENT_EVIDENCE'});
  const state=f.store.get('conditional-assessment',contract.runId).data;
  assert.equal(state.status,'REJECTED');assert.equal(state.rejectedOutput.checks[0].evidence[0].quote,'NOT PRESENT');assert(state.receiptHash);
  assert(f.store.get('run',contract.runId).data.inferenceReceipt);assert.equal(f.store.list('conditional-result').length,0);
  await assert.rejects(f.service.execute(contract.runId),{code:'ASSESSMENT_STATE'});assert.equal(f.calls,1);
});
for(const mutation of ['decision','missing-check','duplicate-check','empty-proof'])test(`malformed diagnostic ${mutation} cannot produce a signed result`,async t=>{
  const f=fixture(t,({exposure,valid})=>{
    const v=valid(exposure);if(mutation==='decision')v.decision='ACCEPT';if(mutation==='missing-check')v.checks.pop();
    if(mutation==='duplicate-check')v.checks[1]=structuredClone(v.checks[0]);if(mutation==='empty-proof')v.checks[0].evidence=[];return v;
  }),contract=f.prepare();
  await assert.rejects(f.service.execute(contract.runId));assert.equal(f.store.list('conditional-result').length,0);
  assert.equal(f.store.get('conditional-assessment',contract.runId).data.status,'INFERENCE_FAILED');
  assert(f.store.get('run',contract.runId).data.expectedRequestHash);
  await assert.rejects(f.service.execute(contract.runId),{code:'ASSESSMENT_STATE'});assert.equal(f.calls,1);
});
test('transport failure consumes dispatch boundary and preserves pending identity without replay',async t=>{
  const f=fixture(t,()=>{throw Object.assign(Error('Fixture transport failure'),{code:'RATE_LIMIT'});}),contract=f.prepare();
  await assert.rejects(f.service.execute(contract.runId),{code:'RATE_LIMIT'});
  assert.equal(f.store.get('conditional-assessment',contract.runId).data.code,'RATE_LIMIT');
  assert(f.store.get('run',contract.runId).data.expectedRequestHash);assert.equal(f.closed,1);
  await assert.rejects(f.service.execute(contract.runId),{code:'ASSESSMENT_STATE'});assert.equal(f.calls,1);
});
test('revocation during inference rejects even when the output only cites candidate bytes',async t=>{
  const f=fixture(t,({exposure,store,parent,valid})=>{
    const r=store.get('artifact',parent.id);store.put('artifact',parent.id,{...r.data,status:'INVALIDATED'},{expectedVersion:r.version});
    const v=valid(exposure);v.checks.forEach(c=>c.evidence=c.evidence.filter(e=>e.kind==='artifact'));return v;
  }),contract=f.prepare();await assert.rejects(f.service.execute(contract.runId),{code:'ASSESSMENT_SCOPE'});
  assert.equal(f.store.get('conditional-assessment',contract.runId).data.status,'REJECTED');assert.equal(f.store.list('conditional-result').length,0);
});
test('policy drift and effectful target are rejected before any inference',async t=>{
  const f=fixture(t),contract=f.prepare(),mission=f.store.get('mission','mission');
  f.store.put('mission','mission',{...mission.data,policy:{...mission.data.policy,allowedTools:[]}},{expectedVersion:mission.version});
  await assert.rejects(f.service.execute(contract.runId),{code:'ASSESSMENT_SCOPE'});assert.equal(f.calls,0);
  const a=f.store.get('artifact',f.candidate.id),payload={...a.data.payload,requiredEffects:[{type:'file',path:'x',command:'',expectedExit:null}]};
  f.store.put('artifact',f.candidate.id,{...a.data,payload,payloadHash:sha256(payload)},{expectedVersion:a.version});
  assert.throws(()=>f.prepare(),{code:'ASSESSMENT_SCOPE'});assert.equal(f.calls,0);
});
test('concurrent execute cannot dispatch the same diagnostic twice',async t=>{
  let release,entered;const start=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;});
  const f=fixture(t,async({exposure,valid})=>{entered();await gate;return valid(exposure);}),contract=f.prepare();
  const first=f.service.execute(contract.runId);await start;
  await assert.rejects(f.service.execute(contract.runId),{code:'ASSESSMENT_STATE'});release();await first;assert.equal(f.calls,1);
});
test('aborted dispatch is terminal for this diagnostic identity, not a successful no-op',async t=>{
  const f=fixture(t),contract=f.prepare(),controller=new AbortController();controller.abort();
  await assert.rejects(f.service.execute(contract.runId,{signal:controller.signal}),{code:'CANCELLED'});
  assert.equal(f.calls,0);assert.equal(f.store.get('conditional-assessment',contract.runId).data.status,'INFERENCE_FAILED');
  await assert.rejects(f.service.execute(contract.runId),{code:'ASSESSMENT_STATE'});
});

for(const index of [0,1])test(`SIMULATED integration: native diagnostic ${index} receives complete immutable request, origin and simulated-prerequisite provenance`,async t=>{
  // Reuse authored fixtures for transport regression only, not a new real trial
  // or a fresh holdout; no historical XrlCqq database is opened or modified.
  const fixture=nativeSelectionReviewCases[index],directory=mkdtempSync(join(tmpdir(),'native-conditional-'));
  const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspace')});
  t.after(()=>{engine.close();rmSync(directory,{recursive:true,force:true});});let count=0;
  engine.workers.providerFactory=()=>({async generate(request){
    count++;const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);
    assert.equal(exposure.missionIntent,fixture.request);let value;
    if(count===1)value=structuredClone(fixture.plan);
    else if(count===2){const a=exposure.artifacts.find(a=>a.id===task.candidateId);
      value={artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',
        reason:'SIMULATED prior plan acceptance for transport regression only.',evidence:[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body}]})),findings:[],uncertainty:''};
    }else{
      assert.equal(count,3,'No model copy, duplicate review or replay');assert.equal(task.kind,'CONDITIONAL_DIAGNOSTIC');
      assert(!Object.hasOwn(task,'expected'));assert(!request.input.includes(fixture.oracleReason));
      const a=exposure.artifacts.find(a=>a.id===task.candidateId),origin=exposure.runtimeObservations.find(o=>o.kind==='artifact-input-copy');
      const inference=exposure.runtimeObservations.find(o=>o.kind==='artifact-dependency-inferences'&&JSON.parse(o.quoteText).detail.artifactId===a.id);
      assert.equal(JSON.parse(origin.quoteText).detail.artifactId,a.id);
      assert(JSON.parse(inference.quoteText).detail.dependencies.every(d=>d.producer.origin==='SIMULATED'&&d.reviewer.origin==='SIMULATED'));
      value={artifactHash:a.hash,checks:task.assessmentCriteria.map(c=>({criterionId:c.id,verdict:c.id==='selection'?fixture.expected.selectionVerdict:'PASS',
        reason:'Simulated expected verdict tests separate diagnostic storage, not model discrimination.',evidence:[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body},
          {kind:'runtime',id:origin.id,hash:origin.hash,quote:'"artifactId":'+JSON.stringify(a.id)},
          {kind:'runtime',id:inference.id,hash:inference.hash,quote:'SIMULATED'}]})),uncertainty:'No operational acceptance.'};
    }
    await request.validate(value);return {value,receipt:{status:'completed',simulation:true,threadId:'native-conditional-'+count,turnId:'fixture',
      contextHash:inferenceRequestHash(request),model:request.model,reasoningEffort:request.reasoningEffort}};
  },async close(){}});
  const mission=engine.create(fixture.request,{entryMode:'planned',allowedTools:[],contextEncoding:'source-text-v1',cardEncoding:'compact-json-v1',
    producerContext:'node-contract-v1',maxPlanAttempts:1,maxNodeAttempts:1});
  const ownerId='test:conditional-plan';engine.ledger.acquireEngine({ownerId});
  try{await engine.plan(mission);}catch(error){assert.fail(JSON.stringify({code:error.code,progress:engine.store.get('planning-progress',mission.id)?.data}));}
  finally{engine.ledger.releaseEngine(ownerId);}
  const node=engine.store.get('plan',mission.id).data.plan.nodes[0],producer=registerInputCopyRun(engine.registry,mission.id,node);
  const candidate=materializeInputCopy(engine.registry,producer.id),native=inputCopyEvidence(engine.registry,candidate.id);
  const material=()=>canonical(['artifact','review','input-copy-origin','mission','plan','node','effect'].map(type=>[type,engine.store.list(type)]));
  const before=material(),service=new ConditionalAssessmentService(engine.workers);
  const contract=service.prepare({artifactId:candidate.id,reviewerRoleIds:['omega_22'],criteria});
  const result=await service.execute(contract.runId);
  assert.equal(result.result.checks[0].verdict,fixture.expected.selectionVerdict);assert.equal(result.result.checks[1].verdict,'PASS');
  assert.equal(result.operationalAcceptance,false);assert.equal(material(),before);assert.deepEqual(inputCopyEvidence(engine.registry,candidate.id),native);
  assert.equal(count,3);assert.equal(engine.store.list('review').length,1,'Only the simulated prior plan was operationally reviewed in this fixture');
  await service.execute(contract.runId);assert.equal(count,3);assert.equal(material(),before);
});
