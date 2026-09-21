import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {Store} from '../../factory/lib/store.mjs';import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';import {sha256} from '../../factory/lib/contracts.mjs';
import {producerResponseContract,retainProducerProposal,recordProducerCleanup,PRODUCER_RESPONSE_RETENTION,PRODUCER_CLEANUP_PROTOCOL} from '../../factory/lib/producer-response.mjs';
import {PRODUCER_TOOL_ACCOUNTING,initializeProducerToolBudget,producerToolBudget,chargeProducerTool} from '../../factory/lib/producer-tool-budget.mjs';
import {READ_TEST_CURSOR_MODE,producerBatchPolicy} from '../../factory/lib/producer-batch.mjs';
import {readProducerBatchCursor,prepareProducerBatchCursor,observeProducerBatchReceipt} from '../../factory/lib/producer-batch-cursor.mjs';
import {ToolBroker} from '../../factory/tools/broker.mjs';
const read=path=>({tool:'workspace.read',args:{path}});
const batch=operations=>({action:'batch',tool:'',argsJson:JSON.stringify(operations),body:'',claims:[],method:'fixture',reason:''});
const one=operation=>({...batch([]),action:'tool',tool:operation.tool,argsJson:JSON.stringify(operation.args)});
const final=()=>({...batch([]),action:'final',argsJson:'',body:'Public fixture final'});
const protocol=s=>s.store.db.prepare('PRAGMA user_version').get().user_version;
// Trusted low-level SIM fixture: actual SQLite, receipt retention and closure;
// no role-compiler, provider, broker or public cursor-mode activation claim.
function setup(t,{limits={maxSteps:5,maxToolOperations:5,maxBatchOperations:3},initialize=true}={}){
  const directory=fs.mkdtempSync(join(tmpdir(),'producer-tool-budget-')),path=join(directory,'state.sqlite');
  const s={store:new Store(path),path,limits,directory};s.registry=new ArtifactRegistry(s.store,new Authority(s.store));
  s.mission={id:'mission-fixture',intent:'Bounded durable tool accounting.',intentHash:sha256('Bounded durable tool accounting.'),
    policy:{producerBatch:READ_TEST_CURSOR_MODE,allowedTools:['workspace.list','workspace.read','workspace.write','execution.run']}};
  s.node={id:'deliver',purpose:'fixture',tools:s.mission.policy.allowedTools,criteria:[{id:'result',text:'Preserve original results.'}],requiredEffects:[]};
  s.store.put('mission',s.mission.id,s.mission,{expectedVersion:0});
  s.run=s.registry.registerRun({missionId:s.mission.id,nodeId:s.node.id,mode:'producer',context:{purpose:s.node.purpose,artifactIds:[],sourceIds:[],instructionsHash:sha256('fixture instructions'),producerConversationIncluded:false}});
  s.store.put('worker-config',s.run.id,{instructions:'fixture instructions',prefixHash:sha256('fixture instructions'),compilationScope:{producerBatch:READ_TEST_CURSOR_MODE}},{expectedVersion:0});
  s.origin=()=>s.store.put('worker-production',s.run.id,{status:'running',step:0,responseRetention:PRODUCER_RESPONSE_RETENTION,
    cleanupProtocol:PRODUCER_CLEANUP_PROTOCOL,contractHash:producerResponseContract({missionId:s.mission.id,node:s.node,inputRefs:[]}),
    toolAccounting:PRODUCER_TOOL_ACCOUNTING,executionLimits:limits},{expectedVersion:0});
  if(initialize)s.store.transact(()=>{s.origin();initializeProducerToolBudget(s.registry,s.run.id);});
  s.propose=(value,{step=0,remainingToolOperations=limits.maxToolOperations,documentary=null,finish=true}={})=>{
    const request={instructions:'fixture instructions',input:JSON.stringify({missionIntent:s.mission.intent,
      task:JSON.stringify({node:s.node,inputRefs:[],step,remainingToolOperations,feedback:[],corrections:[]})}),schema:{type:'object'},model:'SIM',reasoningEffort:'high'};
    const requestHash=s.registry.recordInferenceRequest(s.run.id,request);
    if(!finish)return requestHash;
    const receipt={kind:'inference',simulation:true,status:'completed',threadId:'sim-thread-'+step,turnId:'sim-turn-'+step,model:'SIM',reasoningEffort:'high',contextHash:requestHash};
    retainProducerProposal(s.registry,{runId:s.run.id,step,requestHash,value,receipt,documentary});
    recordProducerCleanup(s.registry,{runId:s.run.id,requestHash,confirmed:true,result:{processExitObserved:null}});return requestHash;
  };
  s.charge=index=>chargeProducerTool(s.registry,{runId:s.run.id,index});s.budget=()=>producerToolBudget(s.registry,s.run.id);
  s.reopen=()=>{s.store.close();s.store=new Store(path);s.registry=new ArtifactRegistry(s.store,new Authority(s.store));};
  t.after(()=>{s.store.close();fs.rmSync(directory,{recursive:true,force:true});});return s;
}
test('Cursor mode is a distinct explicit opt-in, never a legacy rewrite',()=>assert.equal(producerBatchPolicy(READ_TEST_CURSOR_MODE),READ_TEST_CURSOR_MODE));
test('Budget creation is atomic with original producer and protocol floor 4',t=>{
  const s=setup(t,{initialize:false}),before=s.store.verifyJournal();assert.equal(protocol(s),2);
  assert.throws(()=>s.store.transact(()=>{s.origin();initializeProducerToolBudget(s.registry,s.run.id);assert.equal(protocol(s),4);throw Error('cut');}),/cut/);
  assert.equal(protocol(s),2);assert.equal(s.store.get('worker-production',s.run.id),null);assert.equal(s.store.get('producer-tool-budget',s.run.id),null);assert.deepEqual(s.store.verifyJournal(),before);
  s.store.transact(()=>{s.origin();initializeProducerToolBudget(s.registry,s.run.id);});assert.equal(s.budget().used,0);assert.equal(protocol(s),4);
});
test('Exact batch charges once per attempted member across process reopen; observations/effects are not invented',t=>{
  const s=setup(t);s.propose(batch([read('a'),read('b'),read('c')]));const first=s.charge(0);
  assert.equal(first.alreadyCharged,false);assert.equal(s.budget().used,1);assert.equal(s.budget().remaining,4);
  const before=s.store.verifyJournal();assert.deepEqual(s.charge(0),{record:first.record,alreadyCharged:true});assert.deepEqual(s.store.verifyJournal(),before);
  s.reopen();assert.equal(s.budget().used,1);assert.equal(s.charge(0).alreadyCharged,true);s.charge(1);s.charge(2);
  assert.equal(s.budget().used,3);assert.equal(s.budget().remaining,2);assert.equal(s.store.list('effect').length,0);assert.equal(s.store.get('run',s.run.id).data.toolObservations,undefined);
  s.store.verifyJournal();
});
test('Sequential single tools preserve exact old IDs and cannot reset remaining allowance',t=>{
  const s=setup(t);s.propose(one({tool:'workspace.write',args:{path:'a',content:'a'}}));s.charge(0);
  s.propose(batch([read('a'),read('b')]),{step:1,remainingToolOperations:4});s.charge(0);s.charge(1);
  const records=s.store.list('producer-tool-charge').sort((a,b)=>a.data.ordinal-b.data.ordinal);
  assert.deepEqual(records.map(r=>r.id),[s.run.id+':step:0',s.run.id+':step:1:batch:0',s.run.id+':step:1:batch:1']);
  assert.deepEqual(records.map(r=>r.data.ordinal),[1,2,3]);assert.equal(s.budget().remaining,2);
  s.propose(one(read('c')),{step:2,remainingToolOperations:5});assert.throws(()=>s.charge(0),{code:'PRODUCER_TOOL_BUDGET_INTEGRITY'});assert.equal(s.budget().used,3);
});
test('Complete batch must fit before first charge, not just the first member',t=>{
  const s=setup(t,{limits:{maxSteps:5,maxToolOperations:2,maxBatchOperations:3}});s.propose(batch([read('a'),read('b'),read('c')]));
  const before=s.store.verifyJournal();assert.throws(()=>s.charge(0),{code:'WORKER_LIMIT'});assert.equal(s.budget().used,0);assert.deepEqual(s.store.verifyJournal(),before);
});
test('Suffix is not charged before its prefix and a rollback does not leave phantom consumption',t=>{
  const s=setup(t);s.propose(batch([read('a'),read('b')]));const before=s.store.verifyJournal();
  assert.throws(()=>s.charge(1),{code:'PRODUCER_TOOL_BUDGET_INTEGRITY'});assert.deepEqual(s.store.verifyJournal(),before);
  assert.throws(()=>s.store.transact(()=>{s.charge(0);throw Error('cut');}),/cut/);assert.equal(s.budget().used,0);assert.deepEqual(s.store.verifyJournal(),before);
});
for(const [name,value,options]of [
  ['final answer',final(),{}],['document navigation',batch([read('a')]),{documentary:{fixture:true}}],
  ['out-of-scope tool',one({tool:'source.search',args:{query:'x'}}),{}],['too large batch',batch([read('a'),read('b'),read('c'),read('d')]),{}],
  ['exhausted step',one(read('a')),{step:5}],['false exposed allowance',one(read('a')),{remainingToolOperations:6}]
])test('Refuse tool charge for '+name,t=>{
  const s=setup(t);s.propose(value,options);const before=s.store.verifyJournal();assert.throws(()=>s.charge(0),{code:'PRODUCER_TOOL_BUDGET_INTEGRITY'});
  assert.equal(s.budget().used,0);assert.deepEqual(s.store.verifyJournal(),before);
});
test('Pending next request never reuses the older batch or adds another charge',t=>{
  const s=setup(t);s.propose(batch([read('a'),read('b')]));s.charge(0);s.propose(one(read('c')),{step:1,finish:false});
  const before=s.store.verifyJournal();assert.throws(()=>s.charge(1),{code:'CLEANUP_UNCONFIRMED'});assert.equal(s.budget().used,1);assert.deepEqual(s.store.verifyJournal(),before);
});
for(const [name,type,alter]of [
  ['limit','worker-production',d=>d.executionLimits.maxToolOperations++],
  ['marker','worker-production',d=>delete d.toolAccounting],
  ['configuration','worker-config',d=>{d.instructions+=' changed';d.prefixHash=sha256(d.instructions);}],
  ['budget','producer-tool-budget',d=>d.limits.maxToolOperations++],
  ['charge ordinal','producer-tool-charge',d=>d.ordinal++],['charge run binding','producer-tool-charge',d=>d.runId='foreign'],
  ['charge args','producer-tool-charge',d=>d.argsHash=sha256({path:'other'})],
  ['closure','producer-cleanup',d=>d.status='UNCONFIRMED'],['proposal','worker-proposal',d=>d.value.argsJson='[]']
])test('Reversioned '+name+' cannot rewrite durable accounting',t=>{
  const s=setup(t);s.propose(batch([read('a'),read('b')]));s.charge(0);
  const r=s.store.list(type)[0];alter(r.data);s.store.put(r.type,r.id,r.data,{expectedVersion:r.version});
  s.store.verifyJournal();assert.throws(()=>s.budget(),{code:'PRODUCER_TOOL_BUDGET_INTEGRITY'});assert.throws(()=>s.charge(1),{code:'PRODUCER_TOOL_BUDGET_INTEGRITY'});
});
function cursorSetup(t,operations=[{tool:'workspace.list',args:{path:'.'}},read('a')]){
  const s=setup(t),authority=s.registry.authority;
  const broker=new ToolBroker({store:s.store,authority,workspaceRoot:join(s.directory,'workspaces')});
  const workspace=broker.registerWorkspace(s.mission.id);fs.writeFileSync(join(workspace.path??workspace,'a'),'exact fixture bytes');
  s.propose(batch(operations));s.cursor=()=>readProducerBatchCursor(s.registry,s.run.id);
  s.prepare=()=>prepareProducerBatchCursor(s.registry,s.run.id);
  s.execute=index=>{const operation=operations[index],lease=authority.issue({missionId:s.mission.id,principalId:s.run.id,actions:[operation.tool],
    resources:['workspace:'+s.mission.id],classification:'INTERNAL',expiresAt:new Date(Date.now()+60000).toISOString()});
    return broker.execute({missionId:s.mission.id,principalId:s.run.id,lease,operationId:s.run.id+':step:0:batch:'+index,...operation});};
  s.observe=(index,signedReceipt)=>observeProducerBatchReceipt(s.registry,{runId:s.run.id,index,signedReceipt});return s;
}
test('Cursor declaration precedes effects and exact observation/advance is atomic and idempotent',async t=>{
  const s=cursorSetup(t);assert.equal(s.cursor(),null);const initial=s.prepare(),journal=s.store.verifyJournal();
  assert.equal(initial.status,'ACTIVE');assert.equal(initial.nextIndex,0);assert.deepEqual(s.prepare(),initial);assert.deepEqual(s.store.verifyJournal(),journal);
  s.charge(0);const receipt=await s.execute(0),before=s.store.verifyJournal();
  assert.throws(()=>s.store.transact(()=>{s.observe(0,receipt);throw Error('cut');}),/cut/);
  assert.deepEqual(s.store.verifyJournal(),before);assert.equal(s.cursor().nextIndex,0);assert.equal(s.store.get('run',s.run.id).data.toolObservations,undefined);
  const first=s.observe(0,receipt),after=s.store.verifyJournal();assert.equal(first.nextIndex,1);assert.equal(first.status,'ACTIVE');
  assert.deepEqual(s.observe(0,receipt),first);assert.deepEqual(s.store.verifyJournal(),after);
  s.charge(1);s.observe(1,await s.execute(1));assert.equal(s.cursor().status,'COMPLETED');assert.equal(s.cursor().nextIndex,2);
  assert.equal(s.budget().used,2);assert.equal(s.store.list('effect').length,2);s.store.verifyJournal();
});
test('A failed first receipt stops the cursor and never charges or observes its suffix',async t=>{
  const s=cursorSetup(t,[read('missing'),read('a')]);s.prepare();s.charge(0);const signed=await s.execute(0);assert.equal(signed.data.status,'FAILED');
  s.observe(0,signed);assert.equal(s.cursor().status,'FAILED');assert.equal(s.cursor().nextIndex,1);assert.equal(s.budget().used,1);
  assert.equal(s.store.list('effect').length,1);assert.throws(()=>s.observe(1,signed),{code:'PRODUCER_BATCH_INTEGRITY'});
  assert.throws(()=>s.charge(1),{code:'PRODUCER_TOOL_BUDGET_INTEGRITY'});assert.equal(s.budget().used,1);
});
for(const [name,change]of [
  ['cancelled mission',s=>{const r=s.store.get('mission',s.mission.id);r.data.status='CANCELLED';s.store.put(r.type,r.id,r.data,{expectedVersion:r.version});}],
  ['invalidated node',s=>s.store.put('node',s.mission.id+':'+s.node.id,{status:'INVALIDATED',spec:s.node},{expectedVersion:0})],
  ['changed cursor head',s=>{const r=s.store.list('producer-batch-cursor')[0];r.data.nextIndex=1;s.store.put(r.type,r.id,r.data,{expectedVersion:r.version});}],
  ['unrelated observation',async s=>{const signed=await s.execute(0);s.registry.recordToolObservation(s.run.id,signed);}],
  ['changed non-tool context',s=>{const run=s.store.get('run',s.run.id).data;s.registry.updateContext(s.run.id,{...run.context,instructionsHash:sha256('different')});}]
])test('Cursor fails closed after '+name,async t=>{
  const s=cursorSetup(t);s.prepare();await change(s);const before=s.store.verifyJournal();
  assert.throws(()=>s.cursor(),{code:'PRODUCER_BATCH_INTEGRITY'});assert.deepEqual(s.store.verifyJournal(),before);
});
test('Cursor cannot be declared after a first charge, or advanced with an uncharged receipt',async t=>{
  const s=cursorSetup(t);s.charge(0);assert.throws(()=>s.prepare(),{code:'PRODUCER_BATCH_INTEGRITY'});assert.equal(s.cursor(),null);
  const other=cursorSetup(t);other.prepare();const signed=await other.execute(0);
  assert.throws(()=>other.observe(0,signed),{code:'PRODUCER_BATCH_INTEGRITY'});assert.equal(other.cursor().nextIndex,0);
  assert.equal(other.store.get('run',other.run.id).data.toolObservations,undefined);
});
