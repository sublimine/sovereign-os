import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {compactCatalogReview} from '../../factory/lib/review-codec.mjs';

const tool=(name,args)=>({action:'tool',tool:name,argsJson:JSON.stringify(args),body:'',claims:[],method:'fixture-observation',reason:''});
const batch=operations=>({action:'batch',tool:'',argsJson:JSON.stringify(operations),body:'',claims:[],method:'fixture-observation-batch',reason:''});
const final=()=>({action:'final',tool:'',argsJson:'',body:'result.txt contains the reviewed fixture bytes.',claims:[],method:'fixture-delivery',reason:''});

function materialPlan(intent){
  return {requirements:[{id:'r1',text:intent,requestQuote:intent,criteria:[{id:'result',text:intent}]}],nodes:[{
    id:'deliver',title:'deliver',purpose:'deliver',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],requirementIds:['r1'],dependencies:[],
    method:{id:'bounded-material-fixture',rationale:'Create the requested file, observe its bytes and directory membership, then submit it for independent review.',
      alternatives:['Return an unobserved prose claim about a file']},instructions:intent,outputKind:'delivery',criteria:[{id:'result',text:intent}],
    tools:['workspace.write','workspace.read','workspace.list'],requiredEffects:[{type:'file',path:'result.txt',command:'',expectedExit:null}],specialist:null
  }],finalNodeId:'deliver',routingRationale:'A material delivery requires planned producer effects and an independent current-state reviewer.'};
}

function acceptedReview(exposure,task){
  const artifact=exposure.artifacts.find(item=>item.id===task.candidateId);
  assert.ok(artifact,'Reviewer receives the exact candidate');
  const evidence=[{kind:'artifact',id:artifact.id,hash:artifact.hash,quote:artifact.payload.body},
    ...exposure.toolObservations.filter(observation=>observation.relation==='OWN_ACTION'&&observation.status==='SUCCEEDED'
      &&['workspace.read','workspace.list'].includes(observation.tool))
      .map(observation=>({kind:'tool',id:observation.id,hash:observation.hash,quote:observation.quoteText}))];
  return {artifactHash:artifact.hash,purpose:artifact.payload.purpose,decision:'ACCEPT',
    checks:task.criteria.map(criterion=>({criterionId:criterion.id,verdict:'PASS',evidence,
      reason:'SIMULATED independent reviewer fixture cites its own current workspace observations.'})),findings:[],
    uncertainty:'SIMULATED semantic judgment; brokered filesystem observations and durable custody are real.'};
}

function providerFactory(counter){
  return ()=>({
    async generate(request){
      counter.calls++;
      const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);
      const type=Object.hasOwn(request.schema.properties,'plan')?'planning-control':Object.hasOwn(request.schema.properties,'requirements')?'plan'
        :Object.hasOwn(request.schema.properties,'artifactHash')?'review':'produce';
      let value;
      if(type==='planning-control')value=task.inspectedRoleContracts
        ?{action:'plan',roleIds:[],reason:'',plan:materialPlan(task.originalRequest)}
        :{action:'inspect',roleIds:['omega_02','omega_03'],reason:'Read the complete producer and independent reviewer contracts before committing the material plan.',plan:null};
      else if(type==='plan')value=materialPlan(task.originalRequest);
      else if(type==='review')value=compactCatalogReview(acceptedReview(exposure,task),task.observedEvidenceCatalog);
      else if(task.step===0)value=tool('workspace.write',{path:'result.txt',content:'accepted fixture bytes',expectedHash:null});
      else if(task.step===1)value=batch([{tool:'workspace.list',args:{path:'.'}},{tool:'workspace.read',args:{path:'result.txt'}}]);
      else value=final();
      assert.equal(await request.validate(value),true);
      return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:`validation-only-fixture-${counter.calls}`,
        turnId:`validation-only-turn-${counter.calls}`,model:request.model,reasoningEffort:request.reasoningEffort,
        contextHash:inferenceRequestHash(request)}};
    },
    async close(){return {processExitObserved:true};}
  });
}

const nonEngineRecords=store=>store.db.prepare("SELECT type,id,version,hash,json,created_at FROM records WHERE type<>'engine' ORDER BY type,id,version").all();

test('REAL filesystem / SIMULATED model: fresh validation-only reentry rolls back snapshot leases and refuses fallback after post-close drift',async t=>{
  const root=mkdtempSync(join(tmpdir(),'sovereign-validation-only-reentry-')),
    databasePath=join(root,'state.sqlite'),workspaceRoot=join(root,'workspaces'),counter={calls:0};
  let first=null,second=null,firstClosed=false;
  t.after(()=>{
    try{second?.close();}catch{}
    try{if(!firstClosed)first?.close();}catch{}
    rmSync(root,{recursive:true,force:true});
  });

  first=new FactoryEngine({databasePath,workspaceRoot});
  first.workers.providerFactory=providerFactory(counter);
  const mission=first.create('Create result.txt with the exact fixture bytes and independently verify both its bytes and directory membership.',
    {preset:'adaptive-v3',model:'gpt-5.6-terra',reasoningEffort:'high',allowedTools:['workspace.write','workspace.read','workspace.list']});
  assert.equal(mission.policy.entryMode,'planned','The adversary exercises the signed planned route permitted to validation-only B');
  const completed=await first.run(mission.id);
  assert.equal(completed.mission.status,'COMPLETED',JSON.stringify(completed.mission.pending));
  assert.equal(counter.calls,7,'contract inspection, plan, plan review, write, bounded list/read, final and independent review');
  const workspace=first.broker.workspace(mission.id),finalArtifact=first.store.get('artifact',completed.mission.finalArtifactId).data,
    review=first.store.get('review',finalArtifact.reviews.at(-1)).data;
  const before={journal:first.store.verifyJournal(),records:nonEngineRecords(first.store),mission:first.store.get('mission',mission.id),
    artifact:first.store.get('artifact',completed.mission.finalArtifactId),effects:first.store.list('effect'),leases:first.store.list('lease').length,
    validations:first.store.list('workspace-validation').length,calls:counter.calls};
  const firstStore=first.store,firstLedger=first.ledger,firstBroker=first.broker;

  // This is deliberately after A is closed: B observes an external post-delivery
  // change, rather than a mutation made by a still-live first engine instance.
  first.close();firstClosed=true;
  const tampered='tampered after A close';
  assert.equal(Buffer.byteLength(tampered),Buffer.byteLength('accepted fixture bytes'),'Adversary preserves listing metadata so the failure follows a successfully leased listing');
  writeFileSync(join(workspace,'result.txt'),tampered);

  second=new FactoryEngine({databasePath,workspaceRoot});
  assert.notEqual(second,first);assert.notEqual(second.store,firstStore);assert.notEqual(second.ledger,firstLedger);assert.notEqual(second.broker,firstBroker);
  assert.deepEqual(second.store.verifyJournal(),before.journal,'Opening B itself is read-only');

  const trace={forbidden:[],workspaceReads:[]};
  const forbidden=surface=>{
    trace.forbidden.push(surface);
    throw Object.assign(Error(`validation-only reentry invoked forbidden ${surface}`),{code:'REENTRY_FORBIDDEN'});
  };
  const workspaceTool=second.broker.workspaceTool.bind(second.broker);
  for(const name of ['execute','fetchSource','searchSource','runExecution','reconcileExecutions','registerWorkspace','executionSnapshot'])
    second.broker[name]=()=>forbidden(`broker.${name}`);
  second.broker.workspaceTool=(reentryMissionId,name,args,signal)=>{
    if(reentryMissionId!==mission.id||!['workspace.read','workspace.list'].includes(name))return forbidden(`broker.workspaceTool:${name}`);
    trace.workspaceReads.push({name,path:args?.path??null});
    return workspaceTool(reentryMissionId,name,args,signal);
  };
  second.workers.providerFactory=()=>forbidden('workers.providerFactory');
  second.workers.nativeProviderFactory=()=>forbidden('workers.nativeProviderFactory');
  for(const name of ['infer','produce','review','recoverFinal'])second.workers[name]=async()=>forbidden(`workers.${name}`);
  second.ledger.recover=()=>forbidden('ledger.recover');
  second.registry.invalidate=()=>forbidden('registry.invalidate');
  second.setStatus=()=>forbidden('engine.setStatus');
  second.learningConductor.observeMission=()=>forbidden('learning.observeMission');

  await assert.rejects(second.run(mission.id,{validationOnly:true}),{code:'WORKSPACE_CHANGED'});

  // The list succeeds before the changed file is read. Both provisional leases
  // nevertheless belong to the failed Store transaction and must disappear.
  assert.deepEqual(trace.workspaceReads,[{name:'workspace.list',path:'.'},{name:'workspace.read',path:'result.txt'}]);
  assert.deepEqual(trace.forbidden,[],'A failed reentry must not fall through into provider, broker recovery, invalidation, status or learning paths');
  assert.equal(counter.calls,before.calls,'B must not buy or invoke a model turn');
  assert.equal(second.store.list('lease').length,before.leases,'No provisional workspace lease survives the failed snapshot');
  assert.equal(second.store.list('workspace-validation').length,before.validations,'No successful or partial validation record survives');
  assert.deepEqual(nonEngineRecords(second.store),before.records,'No mission, artifact, effect, status, lease or validation material changed');
  assert.deepEqual(second.store.get('mission',mission.id),before.mission,'Completed status remains untouched instead of becoming a recovery state');
  assert.deepEqual(second.store.get('artifact',completed.mission.finalArtifactId),before.artifact,'The accepted artifact is not invalidated by validation-only observation');
  assert.deepEqual(second.store.list('effect'),before.effects,'No broker effect or reconciliation record was created');

  // Engine ownership is the only unavoidable durable delta: acquire and release.
  // In particular, there is no workspace.validation.failed event in this mode.
  const after=second.store.verifyJournal(),delta=second.store.events({after:before.journal.events,limit:10});
  assert.equal(after.events,before.journal.events+2);assert.equal(delta.length,2);
  assert.deepEqual(delta.map(event=>event.kind),['record.committed','record.committed']);
  assert.deepEqual(delta.map(event=>event.data.type),['engine','engine']);
  assert.equal(delta[1].data.parentHash,delta[0].data.hash);
  assert.equal(delta.some(event=>event.kind==='workspace.validation.failed'),false);
  assert.equal(second.store.get('engine','exclusive').data.ownerId,null,'B releases its coordination lease even when validation rejects');
  assert.equal(review.reviewerRunId.length>0,true,'Fixture used an actual independently-created reviewer identity');
});
