import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {compactCatalogReview,compactReviewEvidence} from '../../factory/lib/review-codec.mjs';
import {inputFileReviewContract,INPUT_FILE_REVIEW} from '../../factory/lib/input-file-review.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
const intent='Read the input, then independently read and check the same original version. No output file is required.';
const read=path=>({tool:'workspace.read',args:{path}});
const node={id:'audit',purpose:'input-audit',roleIds:['omega_02'],reviewerRoleIds:['omega_22'],instructions:intent,
  outputKind:'delivery',tools:['workspace.read','workspace.write'],requiredEffects:[],criteria:[{id:'input',text:intent}]};
async function setup(t,{encoding='expanded-json',documentary=false,operations=[read('input.txt')],cite=true,beforeCall=()=>{},onReview=()=>{}}={}){
  const directory=fs.mkdtempSync(join(tmpdir(),'sovereign-input-review-'));
  const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspace')});
  engine.workers.maxReviewRepairs=0;
  const mission=engine.create(intent,{entryMode:'planned',allowedTools:node.tools,reviewEncoding:encoding,
    ...(documentary?{documentContext:'literal-windows-v1'}:{})});
  const workspace=engine.broker.registerWorkspace(mission.id).path;fs.writeFileSync(join(workspace,'input.txt'),'13\n');
  fs.writeFileSync(join(workspace,'other.txt'),'17\n');
  const state={engine,mission,workspace,calls:0,reviewCalls:0,exposure:null,task:null,closed:false};
  t.after(()=>{if(!state.closed)engine.close();fs.rmSync(directory,{recursive:true,force:true});});
  engine.workers.providerFactory=()=>({async generate(request){
    const index=state.calls++,exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);
    await beforeCall({...state,index,exposure,task});let value;
    if(task.candidateId){
      state.reviewCalls++;state.exposure=exposure;state.task=task;
      const artifacts=exposure.artifacts??exposure.artifactViews.filter(v=>v.kind==='FULL_ARTIFACT').map(v=>v.artifact);
      const observations=exposure.toolObservations??exposure.toolObservationViews.filter(v=>v.kind==='FULL_TOOL_OBSERVATION').map(v=>v.observation);
      state.observations=observations;
      const a=artifacts.find(a=>a.id===task.candidateId);
      const evidence=[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body},...(cite?observations
        .filter(o=>o.relation==='OWN_ACTION'&&o.status==='SUCCEEDED'&&o.tool==='workspace.read')
        .map(o=>({kind:'tool',id:o.id,hash:o.hash,quote:o.quoteText})):[])];
      const result={artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',evidence,
        reason:'SIM controller test, not a semantic quality claim.'})),findings:[],uncertainty:'Simulated test'};
      if(documentary){
        // Documentary catalog entries identify the exact current exposure.
        const catalog=exposure.documentEvidenceCatalog;
        assert.ok(catalog,'Actual documentary evidence catalog must be exposed');
        for(const check of result.checks)check.evidence=check.evidence.map(e=>{
          const entry=catalog.find(item=>item.id===e.id&&item.kind===(e.kind==='artifact'?'artifact-body':'tool-observation'));
          assert.ok(entry,'Evidence must be in the current documentary catalog');
          return {sourceKey:entry.sourceKey,quote:e.quote,usage:e.kind};
        });
        value={action:'review',tool:'',argsJson:'',method:'own-evidence',result};
      }else value=encoding==='evidence-catalog-v1'?compactCatalogReview(result,task.observedEvidenceCatalog)
        :encoding==='evidence-refs-v1'?compactReviewEvidence(result):result;
      await onReview({...state,index,exposure,task});
    }else{
      const operation=operations[task.step];
      value=operation?{action:'tool',tool:operation.tool,argsJson:JSON.stringify(operation.args),body:'',claims:[],method:'operation-'+task.step,reason:''}
        :{action:'final',tool:'',argsJson:'',body:'Observed input, pending independent acceptance.',claims:[],method:'report-original',reason:''};
    }
    await request.validate(value);
    return {value,receipt:{kind:'inference',status:'completed',simulation:true,threadId:'sim-input-'+index,turnId:'sim',
      model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
  },async close(){return {processExitObserved:true};}});
  state.newProducer=()=>engine.workers.createRun({missionId:mission.id,nodeId:node.id,mode:'producer',purpose:node.purpose,roleIds:node.roleIds});
  state.produce=async producer=>{state.producer=producer??state.newProducer();state.candidate=await engine.workers.produce({missionId:mission.id,node,runId:state.producer.id});return state.candidate;};
  state.review=()=>engine.workers.review({artifact:state.candidate,reviewerRoleIds:node.reviewerRoleIds,missionIntent:intent});
  return state;
}
for(const encoding of ['expanded-json','evidence-catalog-v1','evidence-refs-v1'])test('Input-only review acquires and cites its own exact file: '+encoding,async t=>{
  const s=await setup(t,{encoding});await s.produce();const accepted=await s.review();
  assert.equal(accepted.status,'ACCEPTED');assert.equal(s.calls,3);assert.deepEqual(accepted.payload.requiredEffects,[]);
  const own=s.exposure.toolObservations.filter(o=>o.relation==='OWN_ACTION');assert.equal(own.length,1);assert.equal(own[0].result.content,'13\n');
  assert.equal(s.task.inputReadContract.inputs.length,1);assert.equal(s.task.inputReadContract.inputs[0].sha256,own[0].result.sha256);
  const review=s.engine.store.get('review',accepted.reviews.at(-1)).data,run=s.engine.store.get('run',review.reviewerRunId).data;
  assert.equal(run.inputReviewProtocol,INPUT_FILE_REVIEW);assert.equal(s.engine.store.db.prepare('PRAGMA user_version').get().user_version,15);
  assert.ok(s.engine.registry.committedSequence('effect',own[0].id,1)>s.engine.registry.committedSequence('artifact',accepted.id,1));
  assert.equal(s.engine.store.list('effect').filter(e=>e.data.tool==='workspace.write').length,0);
  assert.equal(s.engine.registry.assertUsable(accepted.id,{missionId:s.mission.id,purpose:node.purpose}).id,accepted.id);
});
test('A permissive judge cannot accept without citing its own available input read',async t=>{
  const s=await setup(t,{cite:false});await s.produce();await assert.rejects(s.review(),{code:'MISSING_INPUT_PROOF'});
  assert.equal(s.reviewCalls,1);assert.equal(s.engine.store.get('artifact',s.candidate.id).data.status,'CANDIDATE');
  assert.equal(s.exposure.toolObservations.filter(o=>o.relation==='OWN_ACTION').length,1);
});
test('Changed original bytes are blocked before spending a reviewer inference',async t=>{
  const s=await setup(t);await s.produce();fs.writeFileSync(join(s.workspace,'input.txt'),'99\n');
  await assert.rejects(s.review(),{code:'WORKSPACE_CHANGED'});assert.equal(s.reviewCalls,0);assert.equal(s.calls,2);
  assert.equal(s.engine.store.list('review').length,0);assert.equal(s.engine.store.list('effect').length,2);
});
test('Missing original file is blocked before reviewer inference, without manufacturing a read',async t=>{
  const s=await setup(t);await s.produce();fs.renameSync(join(s.workspace,'input.txt'),join(s.workspace,'moved.txt'));
  await assert.rejects(s.review(),{code:'WORKSPACE_CHANGED'});assert.equal(s.reviewCalls,0);
  assert.equal(s.engine.store.list('effect').filter(e=>e.data.state==='FAILED').length,1);
});
test('Changing bytes during reviewer inference fails the synchronous acceptance check',async t=>{
  const s=await setup(t,{onReview:({workspace})=>fs.writeFileSync(join(workspace,'input.txt'),'99\n')});await s.produce();
  await assert.rejects(s.review(),{code:'WORKSPACE_CHANGED'});assert.equal(s.reviewCalls,1);
  assert.equal(s.engine.store.get('artifact',s.candidate.id).data.status,'CANDIDATE');
});
test('Repeated same-version input reads need one independent read, not repeated work',async t=>{
  const s=await setup(t,{operations:[read('input.txt'),read('input.txt')]});await s.produce();await s.review();
  assert.equal(s.task.inputReadContract.inputs.length,1);assert.equal(s.task.inputReadContract.inputs[0].observations.length,2);
  assert.equal(s.exposure.toolObservations.filter(o=>o.relation==='OWN_ACTION').length,1);
});
test('Two input paths require two independent reads without directory listing',async t=>{
  const s=await setup(t,{operations:[read('input.txt'),read('other.txt')]});await s.produce();await s.review();
  assert.deepEqual(s.task.inputReadContract.inputs.map(i=>i.path),['input.txt','other.txt']);
  assert.equal(s.exposure.toolObservations.filter(o=>o.relation==='OWN_ACTION').length,2);
  assert.equal(s.engine.store.list('effect').filter(e=>e.data.tool==='workspace.list').length,0);
});
test('Conflicting direct read versions do not silently pick the latest',async t=>{
  const s=await setup(t,{operations:[read('input.txt'),read('input.txt')],beforeCall:({index,workspace})=>{
    if(index===1)fs.writeFileSync(join(workspace,'input.txt'),'99\n');
  }});await s.produce();const before=s.engine.store.verifyJournal();
  await assert.rejects(s.review(),{code:'INPUT_REVIEW_AMBIGUOUS'});assert.equal(s.reviewCalls,0);
  assert.deepEqual(s.engine.store.verifyJournal(),before);
});
test('A deliberate output write is checked as output, not forced back to its old input bytes',async t=>{
  const s=await setup(t,{operations:[read('input.txt'),{tool:'workspace.write',args:{path:'input.txt',content:'edited\n',expectedHash:sha256('13\n')}}]});
  await s.produce();assert.equal((await s.review()).status,'ACCEPTED');
  assert.equal(s.task.inputReadContract,undefined);assert.equal(s.exposure.toolObservations.find(o=>o.relation==='OWN_ACTION').result.content,'edited\n');
});
test('Post-candidate producer observations cannot rewrite its frozen input contract',async t=>{
  const s=await setup(t);await s.produce();await s.engine.workers.tool(s.producer.id,'workspace.read',{path:'other.txt'},s.producer.id+':later');
  await s.review();assert.deepEqual(s.task.inputReadContract.inputs.map(i=>i.path),['input.txt']);
});
test('Recovery observation from a prior producer still requires a current own reviewer read',async t=>{
  const s=await setup(t,{operations:[]}),prior=s.newProducer();
  await s.engine.workers.tool(prior.id,'workspace.read',{path:'input.txt'},prior.id+':read');
  const replacement=s.newProducer();s.engine.workers.inheritProductionObservations(prior.id,replacement.id);
  await s.produce(replacement);assert.deepEqual(s.candidate.payload.toolReceipts,[]);await s.review();
  assert.equal(s.task.inputReadContract.inputs[0].observations[0].principalId,prior.id);
  assert.equal(s.exposure.toolObservations.filter(o=>o.relation==='OWN_ACTION').length,1);
});
test('A completed reviewer policy cannot be removed or changed at a later head',async t=>{
  const s=await setup(t);await s.produce();const accepted=await s.review();
  const review=s.engine.store.get('review',accepted.reviews.at(-1)).data,run=s.engine.store.get('run',review.reviewerRunId);
  const data={...run.data};delete data.inputReviewProtocol;s.engine.store.put('run',run.id,data,{expectedVersion:run.version});
  assert.throws(()=>inputFileReviewContract(s.engine.registry,data,accepted),{code:'INPUT_REVIEW_INTEGRITY'});
  assert.throws(()=>s.engine.registry.assertUsable(accepted.id,{missionId:s.mission.id,purpose:node.purpose}),{code:'INPUT_REVIEW_INTEGRITY'});
});
test('Reopening preserves the exact review and detects a later input change without inference',async t=>{
  const s=await setup(t);await s.produce();const accepted=await s.review();
  const review=s.engine.store.get('review',accepted.reviews.at(-1)).data,path=s.engine.store.db.location();
  const original=s.engine.store.get('run',review.reviewerRunId,1),count=s.calls;s.engine.close();s.closed=true;
  const reopened=new FactoryEngine({databasePath:path,workspaceRoot:join(s.workspace,'..')});
  try{
    assert.deepEqual(reopened.store.get('run',review.reviewerRunId,1),original);
    reopened.workers.verifyWorkspaceSnapshot(accepted,{runId:review.reviewerRunId});
    fs.writeFileSync(join(s.workspace,'input.txt'),'changed later\n');
    assert.throws(()=>reopened.workers.verifyWorkspaceSnapshot(accepted,{runId:review.reviewerRunId}),{code:'WORKSPACE_CHANGED'});
    assert.equal(s.calls,count);assert.equal(reopened.store.list('review').length,1);
  }finally{reopened.close();}
});
test('Documentary review also needs its own file read and exact catalog citation',async t=>{
  const s=await setup(t,{documentary:true});await s.produce();assert.equal((await s.review()).status,'ACCEPTED');
  assert.equal(s.task.inputReadContract.inputs.length,1);assert.equal(s.observations.filter(o=>o.relation==='OWN_ACTION').length,1);
  const review=s.engine.store.list('review')[0].data;assert.ok(review.documentary);
});
test('Documentary acceptance cannot omit its independently acquired file proof',async t=>{
  const s=await setup(t,{documentary:true,cite:false});await s.produce();
  await assert.rejects(s.review(),{code:'MISSING_INPUT_PROOF'});assert.equal(s.reviewCalls,1);
});
