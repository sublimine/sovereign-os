import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {compactCatalogReview} from '../../factory/lib/review-codec.mjs';
import {getRole} from '../../factory/catalog/index.mjs';
import {planningInspectionBudget} from '../../factory/lib/planning-inspection-budget.mjs';
import {readPlanningInspectionMessage} from '../../factory/lib/planning-inspection-response.mjs';
import {ADAPTIVE_V3_ROUTE_RECORD_TYPE,assertAdaptiveV3MissionRoute} from '../../factory/lib/adaptive-v3-route-contract.mjs';
import {ADAPTIVE_V3_DIRECT_CERTIFICATION_TYPE,ADAPTIVE_V3_DIRECT_ENTRY_NODE,ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE,
  ADAPTIVE_V3_DIRECT_ORIGIN_TYPE} from '../../factory/lib/adaptive-v3-deterministic-entry.mjs';
import {missionReport} from '../../factory/lib/report.mjs';

const options={preset:'adaptive-v3',model:'gpt-6-terra',reasoningEffort:'high',allowedTools:[]};

function planFor(intent,{material=false,revision=false}={}){
  const tools=material?['workspace.write','workspace.read','workspace.list']:[];
  const requiredEffects=material?[{type:'file',path:'result.txt',command:'',expectedExit:null}]:[];
  const method=revision?{id:'independent-reconstruction',rationale:'Reconstruct the bounded result from the immutable request after the recorded material finding showed that the earlier direct synthesis omitted a term.',
    alternatives:['Rejected unenumerated synthesis']}:{id:'evidence-bounded-delivery',rationale:'Produce the requested bounded answer only after an independently accepted plan.',
    alternatives:['Return an unreviewed direct answer']};
  const instructions=revision?`${intent} Recompute every original term explicitly before constructing the final bounded result.`:intent;
  return {requirements:[{id:'r1',text:intent,requestQuote:intent,criteria:[{id:'result',text:intent}]}],nodes:[{
    id:'deliver',title:'deliver',purpose:'deliver',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],requirementIds:['r1'],dependencies:[],
    method,instructions,outputKind:'delivery',criteria:[{id:'result',text:intent}],tools,requiredEffects,specialist:null
  }],finalNodeId:'deliver',routingRationale:'This request concerns a current external fact, so it requires the planned evidence path rather than deterministic closed materialization.'};
}

function reviewed(exposure,task,{fail=false}={}){
  const artifact=exposure.artifacts.find(item=>item.id===task.candidateId);
  assert.ok(artifact,'An independent reviewer receives its exact candidate as a bounded artifact');
  const evidence=[{kind:'artifact',id:artifact.id,hash:artifact.hash,quote:artifact.payload.body},
    ...exposure.toolObservations.filter(observation=>observation.relation==='OWN_ACTION'&&observation.status==='SUCCEEDED'
      &&['workspace.read','workspace.list','execution.run'].includes(observation.tool))
      .map(observation=>({kind:'tool',id:observation.id,hash:observation.hash,quote:observation.quoteText}))];
  const verdict={artifactHash:artifact.hash,purpose:artifact.payload.purpose,decision:fail?'RETURN':'ACCEPT',
    checks:task.criteria.map(criterion=>({criterionId:criterion.id,verdict:fail?'FAIL':'PASS',
      evidence,
      reason:fail?'SIMULATED material finding: the candidate omitted a required original term.':'SIMULATED independent acceptance of the exact bounded candidate.'})),
    findings:fail?[{severity:'material',description:'The bounded candidate omitted a required original term.',recovery:'Reconstruct every original term explicitly before final synthesis.'}]:[],
    uncertainty:'SIMULATED model judgment; SQLite, route, plan, lifecycle and evidence boundaries are real.'};
  return compactCatalogReview(verdict,task.observedEvidenceCatalog);
}

function fixture(t,{material=false,recover=false}={}){
  const root=mkdtempSync(join(tmpdir(),'sovereign-adaptive-v3-planned-e2e-'));
  let engine,calls=0;const captures=[];
  const open=({denyInference=false}={})=>{
    engine=new FactoryEngine({databasePath:join(root,'state.sqlite'),workspaceRoot:join(root,'workspaces')});
    engine.workers.providerFactory=()=>({
      async generate(request){
        if(denyInference)throw Error('A completed planned mission must validate durable evidence, not infer again');
        calls++;
        const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);
        const type=request.schema.properties.plan?'planning-control':request.schema.properties.artifactHash?'review':'produce';
        captures.push({type,task,exposure});
        let value;
        if(type==='planning-control'){
          if(!task.inspectedRoleContracts)value={action:'inspect',roleIds:['omega_02','omega_03'],
            reason:'Read the complete producer and independent reviewer contracts before committing a factual delivery plan.',plan:null};
          else {
            assert.deepEqual(task.inspectedRoleContracts.cards,['omega_02','omega_03'].map(getRole));
            value={action:'plan',roleIds:[],reason:'',plan:planFor(task.originalRequest,{material,revision:recover&&Boolean(task.previousPlan)})};
          }
        } else if(type==='review') {
          const candidate=exposure.artifacts.find(item=>item.id===task.candidateId);
          value=reviewed(exposure,task,{fail:recover&&task.purpose==='deliver'&&candidate?.payload.body==='9'});
        }
        else if(material&&task.step===0)value={action:'tool',tool:'workspace.write',argsJson:JSON.stringify({path:'result.txt',content:'13',expectedHash:null}),
          body:'',claims:[],method:'write-exact-fixture',reason:''};
        else if(material&&task.step===1)value={action:'batch',tool:'',argsJson:JSON.stringify([
          {tool:'workspace.list',args:{path:'.'}},{tool:'workspace.read',args:{path:'result.txt'}}
        ]),body:'',claims:[],method:'independent-observation-ready',reason:''};
        else value={action:'final',tool:'',argsJson:'',body:material?'result.txt contains exactly 13.':recover?(task.node.instructions.includes('Recompute every original term explicitly')?'13':'9'):'The requested current fact remains deliberately unasserted in this SIM-only fixture; the test proves workflow custody, not factual truth.',
          claims:[],method:'bounded-simulated-delivery',reason:'Return only the candidate for independent review.'};
        assert.equal(await request.validate(value),true);
        return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:`sim-v3-planned-${calls}`,turnId:`sim-v3-planned-turn-${calls}`,
          model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
      },
      async close(){return {processExitObserved:true};}
    });
  };
  open();
  t.after(()=>{engine.close();rmSync(root,{recursive:true,force:true});});
  return {root,get engine(){return engine;},get calls(){return calls;},captures,reopen(options){engine.close();open(options);}};
}

test('adaptive-v3 planned route preserves its signed selection through inspected planning, independent acceptance and no-inference reentry',async t=>{
  const f=fixture(t),intent='¿Cuál es la capital actual de Francia?';
  const mission=f.engine.create(intent,options),route=assertAdaptiveV3MissionRoute(f.engine.store,f.engine.authority,mission.id);
  assert.equal(route.decision.selectedEntryMode,'planned');assert.equal(mission.policy.entryMode,'planned');
  assert.equal(route.routeRecord.type,ADAPTIVE_V3_ROUTE_RECORD_TYPE);assert.equal(route.routeRecord.version,1);
  assert.equal(f.engine.store.get(ADAPTIVE_V3_DIRECT_ORIGIN_TYPE,mission.id),null);
  assert.equal(f.engine.store.list(ADAPTIVE_V3_DIRECT_CERTIFICATION_TYPE).length,0);

  const completed=await f.engine.run(mission.id);
  assert.equal(completed.mission.status,'COMPLETED',JSON.stringify(completed.mission.pending));
  assert.equal(f.calls,5,'inspect + inspected plan + independent plan review + producer + independent product review');
  assert.deepEqual(f.captures.map(call=>call.type),['planning-control','planning-control','review','produce','review']);
  assert.equal(f.engine.store.get('plan',mission.id)?.data.acceptedPlanArtifactId!==undefined,true);
  const planningRun=f.engine.store.list('run').find(run=>run.data.nodeId==='planning');
  assert.ok(planningRun);assert.equal(f.engine.store.list('planning-inspection-response').length,2);
  assert.equal(f.engine.store.list('planning-inspection-step').length,1);
  assert.equal(planningInspectionBudget(f.engine.registry,mission.id).reserved,2);
  assert.equal(readPlanningInspectionMessage(f.engine.registry,planningRun.id).coverage.complete,true);
  const planArtifact=f.engine.store.get('artifact',f.engine.store.get('plan',mission.id).data.acceptedPlanArtifactId).data;
  const finalArtifact=f.engine.store.get('artifact',completed.mission.finalArtifactId).data;
  assert.equal(planArtifact.status,'ACCEPTED');assert.equal(finalArtifact.status,'ACCEPTED');
  assert.notEqual(planArtifact.payload.producerRunId,finalArtifact.payload.producerRunId);
  assert.equal(planArtifact.reviews.length,1);assert.equal(finalArtifact.reviews.length,1);
  for(const artifact of [planArtifact,finalArtifact]){
    const review=f.engine.store.get('review',artifact.reviews[0]).data;
    assert.notEqual(review.reviewerRunId,artifact.payload.producerRunId);
    assert.equal(f.engine.store.get('run',review.reviewerRunId).data.nodeId,`review:${artifact.payload.nodeId}`);
  }
  assert.equal(f.engine.store.get(ADAPTIVE_V3_DIRECT_ORIGIN_TYPE,mission.id),null);
  assert.equal(f.engine.store.list(ADAPTIVE_V3_DIRECT_CERTIFICATION_TYPE).length,0);
  assert.equal(finalArtifact.deterministicCertification,undefined);
  assert.equal(f.engine.store.list('run').filter(run=>run.data.missionId===mission.id&&run.data.nodeId===ADAPTIVE_V3_DIRECT_ENTRY_NODE).length,0);
  assert.equal(f.engine.store.list('artifact').filter(artifact=>artifact.data.missionId===mission.id
    &&artifact.data.payload.purpose===ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE).length,0);
  const reportBefore=f.engine.store.verifyJournal(),readOnlyReport=missionReport(f.engine.store,mission.id);
  assert.equal(readOnlyReport.final.id,completed.mission.finalArtifactId);
  assert.equal(readOnlyReport.adaptiveV3.finalArtifact.id,completed.mission.finalArtifactId);
  assert.deepEqual(f.engine.store.verifyJournal(),reportBefore,'read-only fallback revalidates delivery without changing state');
  const report=missionReport(f.engine.store,mission.id,{registry:f.engine.registry});
  assert.equal(report.adaptiveV3.selectedEntryMode,'planned');assert.equal(report.adaptiveV3.originRecord,null);
  assert.equal(report.adaptiveV3.deterministicCertificationRecord,null);

  // Planned delivery may revalidate its accepted snapshot on reopen. Dynamic
  // read leases/audit records are not a recreated plan/product/review lineage.
  const productShape=()=>f.engine.store.db.prepare("SELECT type,id,version,hash FROM records WHERE type NOT IN ('engine','lease','workspace-validation') ORDER BY type,id,version").all();
  const before=f.calls,durable=productShape();
  f.reopen({denyInference:true});
  const reentered=await f.engine.run(mission.id);
  assert.equal(reentered.mission.status,'COMPLETED');assert.equal(reentered.outcome.id,completed.outcome.id);
  assert.equal(f.calls,before,'reentry validates the accepted plan/product chain instead of starting a provider call');
  assert.deepEqual(productShape(),durable,'reentry may record snapshot validation but cannot recreate a plan, product, review or provider lineage');
  assert.equal(assertAdaptiveV3MissionRoute(f.engine.store,f.engine.authority,mission.id).decision.selectedEntryMode,'planned');
});

test('an invalidated planned-v3 delivery is hidden by status but preserves the established planned recovery path',async t=>{
  const f=fixture(t),mission=f.engine.create('What is the current capital of France?',options),completed=await f.engine.run(mission.id),
    oldFinal=completed.mission.finalArtifactId,before=f.calls;
  assert.equal(completed.mission.status,'COMPLETED',JSON.stringify(completed.mission.pending));
  f.engine.registry.invalidate([oldFinal],{kind:'test-invalidation'});
  const hidden=f.engine.status(mission.id);
  assert.equal(hidden.mission.status,'COMPLETED');assert.equal(hidden.outcome,null);assert.equal(hidden.outcomeIntegrity,'UNVERIFIED');
  const recovered=await f.engine.run(mission.id);
  assert.equal(recovered.mission.status,'COMPLETED',JSON.stringify(recovered.mission.pending));
  assert.notEqual(recovered.mission.finalArtifactId,oldFinal);assert.ok(f.calls>before,'planned recovery may rebuild instead of projecting invalidated delivery');
  assert.equal(f.engine.status(mission.id).outcome.id,recovered.mission.finalArtifactId);
});

test('adaptive-v3 planned material route writes, independently rereads and preserves the verified file across no-inference reentry',async t=>{
  const f=fixture(t,{material:true}),intent='Create result.txt containing exactly 13 and independently verify its exact bytes.';
  const mission=f.engine.create(intent,{...options,allowedTools:['workspace.write','workspace.read','workspace.list']});
  assert.equal(assertAdaptiveV3MissionRoute(f.engine.store,f.engine.authority,mission.id).decision.selectedEntryMode,'planned');
  const completed=await f.engine.run(mission.id);
  assert.equal(completed.mission.status,'COMPLETED',JSON.stringify(completed.mission.pending));
  assert.equal(f.calls,7,'inspected plan, plan review, write, bounded read/list, final and independent final review');
  assert.deepEqual(f.captures.map(call=>call.type),['planning-control','planning-control','review','produce','produce','produce','review']);
  const workspace=f.engine.broker.registerWorkspace(mission.id).path;
  assert.equal(readFileSync(join(workspace,'result.txt'),'utf8'),'13');
  const finalArtifact=f.engine.store.get('artifact',completed.mission.finalArtifactId).data;
  assert.equal(finalArtifact.status,'ACCEPTED');
  assert.deepEqual(finalArtifact.payload.requiredEffects,[{type:'file',path:'result.txt',command:'',expectedExit:null}]);
  const producer=f.engine.store.list('run').find(run=>run.data.missionId===mission.id&&run.data.nodeId==='deliver'&&run.data.mode==='producer');
  const reviewer=f.engine.store.list('run').find(run=>run.data.missionId===mission.id&&run.data.nodeId==='review:deliver'&&run.data.mode==='reviewer');
  assert.ok(producer&&reviewer);assert.notEqual(producer.id,reviewer.id);
  assert.ok(reviewer.data.toolObservations.some(observation=>observation.signedReceipt.data.tool==='workspace.read'&&observation.principalId===reviewer.id));
  assert.ok(reviewer.data.toolObservations.some(observation=>observation.signedReceipt.data.tool==='workspace.list'&&observation.principalId===reviewer.id));
  assert.equal(f.engine.store.list('effect').filter(effect=>effect.data.missionId===mission.id&&effect.data.tool==='workspace.write'&&effect.data.state==='SUCCEEDED').length,1);
  assert.equal(f.engine.store.get(ADAPTIVE_V3_DIRECT_ORIGIN_TYPE,mission.id),null);
  assert.equal(f.engine.store.list(ADAPTIVE_V3_DIRECT_CERTIFICATION_TYPE).length,0);

  // File revalidation issues fresh short-lived read leases and validation audit
  // records; all producer/reviewer/effect history must remain byte-identical.
  const productShape=()=>f.engine.store.db.prepare("SELECT type,id,version,hash FROM records WHERE type NOT IN ('engine','lease','workspace-validation') ORDER BY type,id,version").all();
  const before=f.calls,durable=productShape();f.reopen({denyInference:true});
  const reentered=await f.engine.run(mission.id);
  assert.equal(reentered.mission.status,'COMPLETED');assert.equal(reentered.outcome.id,completed.outcome.id);assert.equal(f.calls,before);
  assert.deepEqual(productShape(),durable,'reentry revalidates current bytes but cannot write, infer, recreate the product or replace its review');
  assert.equal(readFileSync(join(f.engine.broker.registerWorkspace(mission.id).path,'result.txt'),'utf8'),'13');
});

test('adaptive-v3 planned route records a material rejection, independently accepts a causally changed method, and never repeats the rejected output',async t=>{
  const f=fixture(t,{recover:true}),intent='Deliver the sum of the two original terms 9 and 4, preserving an independently reviewed correction path for any material omission.';
  const mission=f.engine.create(intent,{...options,maxNodeAttempts:1,inferenceBudget:{mode:'mission-calls-v1',maxCalls:10}});
  assert.equal(assertAdaptiveV3MissionRoute(f.engine.store,f.engine.authority,mission.id).decision.selectedEntryMode,'planned');
  const completed=await f.engine.run(mission.id);
  assert.equal(completed.mission.status,'COMPLETED',JSON.stringify(completed.mission.pending));
  assert.equal(completed.outcome.payload.body,'13');assert.equal(f.calls,10);
  assert.deepEqual(f.captures.map(call=>call.type),[
    'planning-control','planning-control','review','produce','review',
    'planning-control','planning-control','review','produce','review'
  ]);
  const rounds=f.engine.store.list('method-recovery-round'),done=f.engine.store.list('method-recovery-completion');
  assert.equal(rounds.length,1);assert.equal(done.length,1);
  const failure=rounds[0].data.failures[0];
  assert.equal(failure.node.nodeId,'deliver');assert.equal(failure.artifact.payload.body,'9');
  assert.equal(failure.review.result.decision,'RETURN');assert.ok(failure.review.result.findings.some(finding=>finding.severity==='material'));
  const installed=f.engine.store.get('plan',mission.id).data.plan.nodes.find(node=>node.id==='deliver');
  assert.equal(installed.method.id,'independent-reconstruction');
  assert.match(installed.instructions,/Recompute every original term explicitly/);
  const deliver=f.engine.store.get('node',`${mission.id}:deliver`).data;
  assert.equal(deliver.history.filter(entry=>entry.status==='RETURNED').length,1);
  assert.equal(deliver.history.filter(entry=>entry.status==='ACCEPTED').length,1);
  assert.equal(f.engine.store.list('artifact').filter(artifact=>artifact.data.missionId===mission.id&&artifact.data.payload.body==='9').length,1,
    'the rejected candidate is retained once as evidence, not regenerated');
  assert.equal(f.engine.store.get(ADAPTIVE_V3_DIRECT_ORIGIN_TYPE,mission.id),null);
  const productShape=()=>f.engine.store.db.prepare("SELECT type,id,version,hash FROM records WHERE type NOT IN ('engine','lease','workspace-validation') ORDER BY type,id,version").all();
  const before=f.calls,durable=productShape();f.reopen({denyInference:true});
  const reentered=await f.engine.run(mission.id);
  assert.equal(reentered.mission.status,'COMPLETED');assert.equal(reentered.outcome.payload.body,'13');assert.equal(f.calls,before);
  assert.deepEqual(productShape(),durable,'completed recovery validates the accepted revised chain without replacing the rejected or accepted method');
});
