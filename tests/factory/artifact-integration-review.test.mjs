// Adversarial cross-module tests: real Store/Authority/Broker/WorkerService,
// explicitly simulated inference and injected HTTP transport. No external network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {ToolBroker} from '../../factory/tools/broker.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';

const intent='Acquire the exact fixture and evaluate its support.';
const final={action:'final',tool:'',argsJson:'',body:'Acquired fixture product.',claims:[],method:'observed-final',reason:'Only the acquired version is reported.'};
const baseNode={id:'probe',purpose:'probe-purpose',roleIds:['sigma_01'],reviewerRoleIds:['sigma_02'],instructions:'Acquire fixture then report.',outputKind:'analysis',criteria:[{id:'support',text:'Provide exact observed support.'}],requiredEffects:[],tools:['source.fetch']};
const proposal=(tool,args)=>({action:'tool',tool,argsJson:JSON.stringify(args),body:'',claims:[],method:'scoped-acquisition',reason:'Acquire required observation.'});
function fixture(t,{evidenceKind='tool',write=false,onReview=()=>{},reviewDecision='ACCEPT'}={}) {
  const dir=mkdtempSync(join(tmpdir(),'artifact-integration-review-'));
  const store=new Store(':memory:'),authority=new Authority(store),registry=new ArtifactRegistry(store,authority);
  const broker=new ToolBroker({store,authority,workspaceRoot:join(dir,'jobs'),lookup:async()=>[{address:'8.8.8.8',family:4}],transport:async()=>({remoteAddress:'8.8.8.8',statusCode:200,headers:{'content-type':'text/plain'},body:Buffer.from('Exact supporting fixture.')})});
  const workspace=broker.registerWorkspace('mission');
  store.put('mission','mission',{intent,intentHash:sha256(intent),policy:{allowedTools:['source.fetch','workspace.read','workspace.write'],model:'gpt-6-astra',reasoningEffort:'ultra'}},{expectedVersion:0});
  let sequence=0;
  const providerFactory=()=>({async generate(request){
    const number=++sequence,exposure=JSON.parse(request.input);let value;
    if(number===1)value=write?proposal('workspace.write',{path:'result.txt',content:'reviewed bytes',expectedHash:null}):proposal('source.fetch',{url:'https://example.com/fixture'});
    else if(number===2) {
      value=structuredClone(final);
      if(evidenceKind==='source') {const source=exposure.sources[0];value.claims=[{id:'fact',text:source.raw,kind:'fact',sources:[{sourceId:source.id,hash:source.hash,quote:source.raw}],basis:[],qualifiers:[],validUntil:null}];}
    } else {
      const candidate=exposure.artifacts[0];let evidence;
      if(evidenceKind==='source') {const source=exposure.sources[0];evidence={kind:'source',id:source.id,hash:source.hash,quote:source.raw};}
      else {const observation=exposure.toolObservations.find(o=>write?o.tool==='workspace.read'&&o.relation==='OWN_ACTION':o.tool==='source.fetch');assert.ok(observation);evidence={kind:'tool',id:observation.id,hash:observation.hash,quote:observation.quoteText};}
      onReview({workspace,store,registry,exposure});
      value={artifactHash:candidate.hash,purpose:candidate.payload.purpose,decision:reviewDecision,checks:[{criterionId:'support',verdict:reviewDecision==='ACCEPT'?'PASS':'UNKNOWN',evidence:[evidence],reason:'Exact fixture observation; current support status must be considered.'}],findings:[],uncertainty:'Synthetic review; not model quality.'};
    }
    assert.equal(await request.validate(value),true);
    return {value,receipt:{status:'completed',simulation:true,threadId:`fixture-thread-${number}`,turnId:`fixture-turn-${number}`,contextHash:sha256(JSON.stringify({instructions:request.instructions,input:request.input,schema:request.schema,model:request.model,reasoningEffort:request.reasoningEffort}))}};
  },async close(){}});
  const workers=new WorkerService({store,authority,registry,broker,providerFactory});
  const node=write?{...baseNode,tools:['workspace.write','workspace.read'],requiredEffects:[{type:'file',path:'result.txt',command:'',expectedExit:null}]}:baseNode;
  const produce=async()=>{const run=workers.createRun({missionId:'mission',nodeId:node.id,mode:'producer',purpose:node.purpose,roleIds:node.roleIds});return workers.produce({missionId:'mission',node,runId:run.id});};
  const review=artifact=>workers.review({artifact,reviewerRoleIds:node.reviewerRoleIds,missionIntent:intent});
  t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
  return {store,registry,workers,produce,review,node,workspace};
}

test('AIR01: retracting an acquired source also invalidates acceptance quoting its fetch receipt',async t=>{
  const s=fixture(t),a=await s.produce();
  assert.equal((await s.review(a)).status,'ACCEPTED');
  const scoped=(mode,artifactIds)=>{
    const run=s.registry.registerRun({missionId:'mission',nodeId:`child-${mode}`,mode,context:{purpose:'child-purpose',artifactIds,sourceIds:[],instructionsHash:sha256('fixture'),producerConversationIncluded:false}});
    s.registry.attachInference(run.id,{status:'completed',simulation:true,threadId:`child-${mode}-thread`,turnId:'turn'});return run;
  };
  const childRun=scoped('producer',[a.id]);
  const child=s.registry.create({missionId:'mission',nodeId:childRun.nodeId,producerRunId:childRun.id,kind:'analysis',purpose:'child-purpose',body:'Dependent conclusion.',inputRefs:[{artifactId:a.id,hash:a.payloadHash,purpose:a.payload.purpose}],criteria:[{id:'child',text:'Use accepted foundation.'}]});
  const reviewer=scoped('reviewer',[child.id]);
  s.registry.review({artifactId:child.id,reviewerRunId:reviewer.id,result:{artifactHash:child.payloadHash,purpose:child.payload.purpose,decision:'ACCEPT',checks:[{criterionId:'child',verdict:'PASS',evidence:[{kind:'artifact',id:child.id,hash:child.payloadHash,quote:child.payload.body}],reason:'Synthetic dependency control.'}],findings:[],uncertainty:''}});
  const source=s.store.list('source')[0].data;
  const affected=s.registry.retractSource(source.id,'Publisher withdrew the acquired evidence.');
  assert.ok(affected.includes(a.id),'Tool-kind raw source proof must retain source retraction lineage');
  assert.ok(affected.includes(child.id),'Receipt-backed source invalidation must propagate to downstream products');
  assert.throws(()=>s.registry.assertUsable(a.id,{missionId:'mission',purpose:s.node.purpose}));
});

test('AIR02: a source already retracted cannot be laundered through its historical successful fetch receipt',async t=>{
  const s=fixture(t),a=await s.produce(),source=s.store.list('source')[0].data;
  s.registry.retractSource(source.id,'Acquisition support was withdrawn before review.');
  await assert.rejects(s.review(a),'Successful historical acquisition is not currently admissible source support');
  assert.notEqual(s.store.get('artifact',a.id).data.status,'ACCEPTED');
});

test('AIR03 control: direct source evidence retains transitive invalidation',async t=>{
  const s=fixture(t,{evidenceKind:'source'}),a=await s.produce();
  assert.equal((await s.review(a)).status,'ACCEPTED');
  const source=s.store.list('source')[0].data;
  assert.ok(s.registry.retractSource(source.id,'Direct source withdrawal.').includes(a.id));
  assert.throws(()=>s.registry.assertUsable(a.id,{missionId:'mission',purpose:s.node.purpose}),{code:'UNACCEPTED_INPUT'});
});

test('AIR04 control: bytes changed during reviewer inference fail the synchronous consumption guard',async t=>{
  const s=fixture(t,{write:true,onReview:({workspace})=>writeFileSync(join(workspace.path,'result.txt'),'changed after observed read')}),a=await s.produce();
  await assert.rejects(s.review(a),{code:'WORKSPACE_CHANGED'});
  assert.equal(s.store.get('artifact',a.id).data.status,'CANDIDATE');
  assert.equal(s.store.list('workspace-validation').length,0);
});

test('AIR05 control: a withdrawn fetch remains historical diagnostic evidence for RETURN, not acceptance',async t=>{
  const s=fixture(t,{reviewDecision:'RETURN'}),a=await s.produce();
  s.registry.retractSource(s.store.list('source')[0].id,'Withdrawn support.');
  const returned=await s.review(a);
  assert.equal(returned.status,'RETURNED');
  assert.equal(returned.reviewDependencies.length,0);
  assert.throws(()=>s.registry.assertUsable(a.id,{missionId:'mission',purpose:s.node.purpose}),{code:'UNACCEPTED_INPUT'});
});
