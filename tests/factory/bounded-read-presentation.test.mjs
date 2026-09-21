import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {runBoundedReadEntry} from '../../factory/lib/bounded-read-entry.mjs';
import {boundedReadContractHash,boundedReadNode,BOUNDED_READ_CRITERIA} from '../../factory/lib/bounded-read-spec.mjs';
import {makeBoundedReadBinding} from '../../factory/lib/bounded-read-contract.mjs';
import {WORKER_SCHEMA} from '../../factory/lib/workers.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {inferenceRequestHash,instructionProfile} from '../../factory/providers/instruction-profiles.mjs';
import {NATIVE_READ_TOOL_BINDING} from '../../factory/providers/native-read-policy.mjs';
import {missionInferenceBudget} from '../../factory/lib/mission-inference-budget.mjs';
import {prepareMissionInputWorkspace} from '../../factory/lib/mission-input-workspace.mjs';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
const presentation='separate-evidence-v1',entryMode='bounded-read-response-v1';
const fixed={id:'mission:fixed-presentation',intent:'Return exactly 30.',intentHash:sha256('Return exactly 30.'),policy:{entryMode,allowedTools:['workspace.read']}};
test('presentation: unselected contract, binding, node and shared schema match frozen 34f1053b exactly',()=>{
  assert.equal(boundedReadContractHash(fixed),'65540e472dd106592eb3df1bd6f01035b1ad98a2a53332668d397090ac3a3a3a');
  assert.equal(sha256(boundedReadNode(fixed)),'2732c5a47f92850c0dac3d0ab7385de7705b39dcc3777bc0e304ba020eaa8cbe');
  assert.equal(sha256(makeBoundedReadBinding(fixed)),'0248fe9f7ba93d36d3bf95902300fc7e6c2a9713c8b0db0cd45dcf2f3b7266dc');
  assert.equal(sha256(WORKER_SCHEMA),'84c33498b7c7bb82fbc36c724e66df360993ea176306427108ddece2995755c7');
});
test('presentation: selected node changes presentation, not criteria, limits or authority',()=>{
  const m={...fixed,policy:{...fixed.policy,boundedReadPresentation:presentation}},old=boundedReadNode(fixed),next=boundedReadNode(m);
  assert.notEqual(boundedReadContractHash(m),boundedReadContractHash(fixed));
  assert.deepEqual({...next,instructions:null},{...old,instructions:null});
  assert.doesNotMatch(next.instructions,/cite actual input observations faithfully in body/);
  assert.match(next.instructions,/separate-evidence-v1/);assert.match(next.instructions,/If the original request requires citations/);
  assert.equal(makeBoundedReadBinding(m).entryContractHash,boundedReadContractHash(m));
});
function environment(t){const dir=fs.mkdtempSync(join(tmpdir(),'sovereign-presentation-')),
  options={databasePath:join(dir,'state.sqlite'),workspaceRoot:join(dir,'jobs')},e=new FactoryEngine(options);
  t.after(()=>{e.close();fs.rmSync(dir,{recursive:true,force:true});});return {e,options};}
for(const invalid of [{boundedReadPresentation:'unknown',entryMode},{boundedReadPresentation:presentation},
  {boundedReadPresentation:presentation,entryMode:'planned'}])test('presentation: invalid selection has no material work '+JSON.stringify(invalid),t=>{
  const {e}=environment(t),before=e.store.verifyJournal();assert.throws(()=>e.create('Original request',invalid),{code:'POLICY'});
  assert.deepEqual(e.store.verifyJournal(),before);assert.equal(e.store.list('mission').length,0);
});
test('presentation: floor9 is transactional and old mission policies stay unselected',t=>{
  const {e}=environment(t),old=e.create('Old request',{entryMode}),before=e.store.verifyJournal(),put=e.store.put.bind(e.store);
  e.store.put=(type,...args)=>{if(type==='mission')throw Object.assign(Error('Fixture write failure'),{code:'SYNTHETIC'});return put(type,...args);};
  assert.throws(()=>e.create('New request',{entryMode,boundedReadPresentation:presentation}),{code:'SYNTHETIC'});
  e.store.put=put;assert.deepEqual(e.store.verifyJournal(),before);assert.equal(e.store.db.prepare('PRAGMA user_version').get().user_version,6);
  e.create('New request',{entryMode,boundedReadPresentation:presentation});assert.equal(e.store.db.prepare('PRAGMA user_version').get().user_version,9);
  assert.equal(e.store.get('mission',old.id).data.policy.boundedReadPresentation,undefined);
});
async function exercise(t,{native=true,read=true,selected=true,omitOwnProof=false,intent=null}={}){
  const {e,options}=environment(t),requests=[],body=read?'{"sum":30}':'Órbita e\u0301 🚀',input=read?'13\n17\n':'UNREAD_CANARY_2876',calls={producer:0,reviewer:0};
  e.workers.maxReviewRepairs=0;
  const mission=e.create(intent??(read?'Read only input.txt. Return exactly JSON {"sum":30} from its two supplied integers. No other fields or explanation.':'Do not read any file even if attached. Return exactly Órbita e\u0301 🚀.'),
    {entryMode,instructionProfile:'scoped-v1',allowedTools:['workspace.read'],inputs:[{path:'input.txt',content:input}],
      ...(selected?{boundedReadPresentation:presentation}:{}),...(native?{nativeReadTransport:'native-read-v1'}:{}),
      inferenceBudget:{mode:'mission-calls-v1',maxCalls:native?(read?3:2):(read?3:2)}});
  const factory=useNative=>()=>({async generate(request){
    const context=readSourceContextView(request.input),task=JSON.parse(context.task),reviewer=!!task.candidateId,number=requests.length;requests.push({request,context,task});
    const threadId='presentation-sim-'+number,turnId='sim-turn';let value,transcript;
    if(reviewer){calls.reviewer++;const a=context.artifacts.find(x=>x.id===task.candidateId),evidence=[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body}];
      if(!omitOwnProof)evidence.push(...context.toolObservations.filter(o=>o.relation==='OWN_ACTION').map(o=>({kind:'tool',id:o.id,hash:o.hash,quote:o.quoteText})));
      value={artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',evidence,
        reason:'SIM public verification: supplied 13 plus 17 equals 30; exact requested output is retained separately. This fixture is not a live semantic judgment.'})),findings:[],uncertainty:'SIM'};
    }else{calls.producer++;
      if(useNative){const s=request.nativeSession;s.bind({threadId,turnId});if(read){const callId='read-once',p=await s.prepare({threadId,turnId,callId,
        namespace:NATIVE_READ_TOOL_BINDING.namespace,tool:NATIVE_READ_TOOL_BINDING.name,arguments:{path:'input.txt'},signal:request.signal}),json=p.frames.at(-1).event.responseJson;
        s.dispatch({callId,responseHash:sha256(json)});s.ack({threadId,turnId,callId,responseJson:json});}}
      value=!useNative&&read&&!context.toolObservations.length?{action:'tool',tool:'workspace.read',argsJson:'{"path":"input.txt"}',body:'',claims:[],method:'Read supplied integers',reason:''}
        :{action:'final',tool:'',argsJson:'',body,claims:[],method:'Add supplied integers or preserve requested literal',reason:''};
    }
    await request.validate(value);if(useNative)transcript=request.nativeSession.finish({threadId,turnId,outputJson:canonical(value)});
    const receipt={kind:'inference',simulation:true,status:'completed',threadId,turnId,contextHash:inferenceRequestHash(request),
      ...(useNative?{toolPolicy:'native-read-v1',nativeTranscript:{schema:transcript.schema,head:transcript.head,callbackCount:read?1:0},
        instructionProfile:{id:'native-read-v1',hash:instructionProfile('native-read-v1').hash}}:{})};
    if(useNative)request.nativeSession.retainOutcome({value,receipt});return {value,receipt,...(transcript?{nativeTranscript:transcript}:{})};
  },async close(){return {processExitObserved:true};}});
  e.workers.providerFactory=factory(false);e.workers.nativeProviderFactory=factory(true);
  // Input preparation is engine-owned and must occur before the isolated entry.
  prepareMissionInputWorkspace(e.broker,mission.id);
  const run=()=>runBoundedReadEntry(e,e.store.get('mission',mission.id).data);
  return {e,options,mission,requests,calls,body,input,run};
}
for(const native of [false,true])for(const read of [false,true])test('presentation: exact body, full separate judge and scoped reads '+JSON.stringify({native,read}),async t=>{
  const f=await exercise(t,{native,read}),a=await f.run();assert.equal(a.status,'ACCEPTED');assert.equal(a.payload.body,f.body);assert.deepEqual(a.payload.criteria,BOUNDED_READ_CRITERIA);
  assert.equal(f.calls.reviewer,1);assert.equal(f.e.store.list('effect').length,read?2:0);
  for(const {request,task,context}of f.requests){assert.equal(context.missionIntent,f.mission.intent);
    if(!read)assert.ok(!canonical({instructions:request.instructions,input:request.input,schema:request.schema}).includes(f.input));
    if(!task.candidateId){assert.equal(request.schema.properties.claims.maxItems,0);assert.doesNotMatch(request.schema.properties.claims.description,/put the complete public premises and correctness argument in body/);
      assert.match(request.schema.properties.body.description,/separate-evidence-v1/);assert.doesNotMatch(request.instructions,/cite actual input observations faithfully in body/);
      assert.doesNotMatch(request.instructions,/toolReceipts: describe them faithfully in body/);
    }else{assert.match(request.schema.description,/separate-evidence-v1/);assert.equal(task.criteria.length,3);assert.equal(task.runtimeCriteria.length,4);
      assert.equal(context.toolObservations.filter(o=>o.relation==='OWN_ACTION').length,read?1:0);assert.match(request.instructions,/MODE: reviewer/i);}
  }
  const review=f.e.store.get('review',a.reviews[0]).data;assert.ok(review.result.checks.some(c=>c.reason.includes('SIM public verification')));
  const count=f.requests.length,budget=missionInferenceBudget(f.e.registry,f.mission.id);assert.equal((await f.run()).id,a.id);assert.equal(f.requests.length,count);
  assert.deepEqual(missionInferenceBudget(f.e.registry,f.mission.id),budget);
});
test('presentation: separate evidence never waives the actual own post-candidate input citation',async t=>{
  const f=await exercise(t,{omitOwnProof:true});assert.equal(await f.run(),null);assert.equal(f.e.store.list('review').length,0);
  assert.equal(f.e.store.get('bounded-read-entry',f.mission.id).data.disposition.code,'MISSING_INPUT_PROOF');
});
test('presentation: old native contract still runs after a different mission upgrades the same database',async t=>{
  const f=await exercise(t,{selected:false});f.e.create('A new separate request',{entryMode,boundedReadPresentation:presentation});
  assert.equal((await f.run()).status,'ACCEPTED');assert.equal(f.requests[0].request.schema.properties.claims.maxItems,undefined);
  assert.match(f.requests[0].request.schema.properties.claims.description,/put the complete public premises and correctness argument in body/);
});
for(const change of ['remove','replace','downgrade'])test('presentation: immutable selection or required floor cannot change '+change,async t=>{
  const f=await exercise(t),s=f.e.store,m=s.get('mission',f.mission.id);
  if(change==='downgrade')s.db.exec('PRAGMA user_version=8');else{const policy={...m.data.policy};if(change==='remove')delete policy.boundedReadPresentation;else policy.boundedReadPresentation='unknown';s.put('mission',m.id,{...m.data,policy},{expectedVersion:m.version});}
  await assert.rejects(f.run(),{code:'BOUNDED_READ_BINDING'});assert.equal(f.requests.length,0);assert.equal(s.list('effect').length,0);
});
