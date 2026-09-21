import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {ToolBroker} from '../../factory/tools/broker.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {id,sha256} from '../../factory/lib/contracts.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {BLIND_PROTOCOL_CRITERIA} from '../../factory/lib/blind-replication.mjs';
import {BLIND_MATERIAL_KIND,BLIND_MATERIAL_PURPOSE,BLIND_MATERIAL_CRITERIA} from '../../factory/lib/blind-material.mjs';
import {BLIND_COMPARISON_PURPOSE,BLIND_COMPARISON_CRITERIA} from '../../factory/lib/blind-comparison.mjs';
import {validatePlan} from '../../factory/lib/plans.mjs';
import {assertRoleExecution,assertPlanRoleExecution} from '../../factory/lib/role-execution.mjs';
import {normalizeFinalCoverage} from '../../factory/lib/final-coverage.mjs';
import {planReviewEvidenceContext,closedProductExposure} from '../../factory/lib/review-evidence-boundary.mjs';
import {unpackContext} from '../../factory/lib/context-codec.mjs';
import {unpackJsonContext} from '../../factory/lib/context-json-codec.mjs';
import {compactCatalogReview,compactReviewEvidence} from '../../factory/lib/review-codec.mjs';
import {normalizeBlindPlan,blindPlanningCapability,plannedProtocolInstructions} from '../../factory/lib/blind-plan.mjs';
import {missionReport,formatMissionReport} from '../../factory/lib/report.mjs';
import {CLOSED_PROTOCOL_CONTROL_BOUNDARY} from '../../factory/lib/closed-protocol-boundary.mjs';

const intent='Report a preregistered closed replication of 17 + 25 against the supplied raw target 42; do not claim universal correctness.';
const node=(id,purpose,criteria,dependencies=[])=>({id,title:id,purpose,roleIds:['omega_02'],reviewerRoleIds:['sigma_02'],requirementIds:['r'],dependencies,
  method:{id:'closed-protocol',rationale:'Separate actual acceptance boundaries and exclude the private target during replication.',alternatives:['Different prospective method after diagnosis, never post-hoc resampling.']},
  instructions:'Retain the complete bounded target/protocol/result for independent review.',outputKind:'delivery',criteria,requiredEffects:[],tools:[],specialist:null,execution:null});
const edge=n=>({nodeId:n.id,purpose:n.purpose,reason:'The exact preceding product must be independently accepted before this stage.'});
function plan(){
  const original=node('original','raw-target',[{id:'target',text:'Preserve supplied raw comparison target exactly, without certifying its truth.'}]);
  const protocol=node('protocol','blind-protocol',structuredClone(BLIND_PROTOCOL_CRITERIA),[edge(original)]);protocol.outputKind='blind-protocol';
  const material=node('attempt',BLIND_MATERIAL_PURPOSE,structuredClone(BLIND_MATERIAL_CRITERIA),[edge(protocol)]);
  material.outputKind=BLIND_MATERIAL_KIND;material.roleIds=['veritas_04'];material.execution={kind:'closed-blind-material-v1',protocolNodeId:'protocol',comparisonNodeId:'report'};
  const report=node('report',BLIND_COMPARISON_PURPOSE,structuredClone(BLIND_COMPARISON_CRITERIA),[edge(material)]);
  report.roleIds=[];report.outputKind='deterministic-result';report.execution={kind:'closed-blind-comparison-v1',materialNodeId:'attempt'};
  return {requirements:[{id:'r',text:intent,requestQuote:intent,criteria:[{id:'scope',text:intent}]}],nodes:[original,protocol,material,report],finalNodeId:'report',routingRationale:'One producer for the raw target, one protocol author, one closed replica and deterministic comparison; actual independent gates, no report-rewriting producer.'};
}
const publicProtocol={purpose:'closed-sum',question:'Compute 17 + 25.',scope:'Only this supplied integer calculation.',method:'Add tens and units, then reverse with subtraction.',tolerance:'Exact equality of the complete integer text.',stopping:'One complete derivation, UNKNOWN on missing premise.',controls:[{id:'reverse',procedure:'Subtract the second operand from the result.',expected:'Recover the first operand.'}],varyingDimensions:['Derivation and reverse control'],sharedRoots:['Same model family; no cognitive independence claim.'],limitations:['Closed supplied arithmetic, no external empirical evidence.'],comparison:{kind:'exact-text-v1'}};
const final=body=>({action:'final',tool:'',argsJson:'',body,claims:[],method:'bounded-fixture',reason:'Simulated public output.'});
const decode=input=>{const d=JSON.parse(input);return d.encoding==='sovereign.lossless-context.v2'?unpackJsonContext(d):d.encoding==='sovereign.lossless-context.v1'?unpackContext(d):d;};
// Engine results are public delivery projections.  Fixtures that need to
// inspect retained provenance, criteria or producer custody must explicitly
// use the durable ledger rather than accidentally depending on an API leak.
const durableArtifact=(store,artifactOrId)=>{
  const artifactId=typeof artifactOrId==='string'?artifactOrId:artifactOrId?.id;
  const record=store.get('artifact',artifactId);
  assert.ok(record,`Missing durable artifact ${artifactId}`);
  return record.data;
};
const durableNode=(store,missionId,nodeId)=>{
  const record=store.get('node',`${missionId}:${nodeId}`);
  assert.ok(record,`Missing durable node ${nodeId}`);
  return record.data;
};
const durablePlan=(store,missionId)=>{
  const record=store.get('plan',missionId);
  assert.ok(record,`Missing durable plan for ${missionId}`);
  return record.data;
};
function fixture(t,{respond,contextEncoding='plain-json',reviewEncoding='expanded-json',maxNodeAttempts=4}={}){
  const directory=mkdtempSync(join(tmpdir(),'planned-blind-')),databasePath=join(directory,'state.sqlite');
  let engine,store,registry,authority;const calls=[];
  const open=()=>{
    store=new Store(databasePath);authority=new Authority(store);registry=new ArtifactRegistry(store,authority);
    const broker=new ToolBroker({store,authority,workspaceRoot:join(directory,'jobs')});
    const providerFactory=()=>({async generate(request){
      const exposure=decode(request.input),task=exposure.task?JSON.parse(exposure.task):null;
      const type=exposure.schema==='sovereign.blind-input.v1'?'replica':Object.hasOwn(request.schema.properties,'requirements')?'plan':Object.hasOwn(request.schema.properties,'artifactHash')?'review':'produce';
      const candidate=type==='review'?exposure.artifacts.find(a=>a.id===task.candidateId):null;
      const call={type,request,exposure,task,purpose:candidate?.payload.purpose??task?.node?.purpose};calls.push(call);
      let value;
      if(type==='plan')value=plan();
      else if(type==='replica')value={status:'RESULT',result:'42',publicArgument:'(10+20)+(7+5)=30+12=42.',controls:[{id:'reverse',verdict:'PASS',observation:'42-25=17.'}],deviations:[],unknowns:[]};
      else if(type==='produce'){
        if(task.node.id==='original')value=final('42');
        else if(task.node.id==='dossier')value=final('Native report:\n'+exposure.artifacts.find(a=>a.payload.purpose===BLIND_COMPARISON_PURPOSE).payload.body+'\nEnd native report.');
        else{
          assert.equal(task.node.id,'protocol','No extra producer may restate the replica or report');
          const original=exposure.artifacts.find(a=>a.payload.purpose==='raw-target');
          value=final(JSON.stringify({schema:'sovereign.closed-blind-protocol.v1',missionIntentHash:sha256(intent),original:{artifactId:original.id,hash:original.hash},roleId:'veritas_04',public:publicProtocol}));
        }
      }else{
        const proofKind=candidate.payload.kind==='literal-input-copy'?'artifact-input-copy':call.purpose===BLIND_MATERIAL_PURPOSE?'artifact-blind-material':call.purpose===BLIND_COMPARISON_PURPOSE?'artifact-blind-comparison':null;
        const proof=proofKind?exposure.runtimeObservations.find(o=>o.kind===proofKind):null;
        if(proofKind)assert.ok(proof);
        value={artifactHash:candidate.hash,purpose:call.purpose,decision:'ACCEPT',checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',reason:'SIMULATED substantive judgment; no real model qualification.',
          evidence:[{kind:'artifact',id:candidate.id,hash:candidate.hash,quote:candidate.payload.body},...(proof?[{kind:'runtime',id:proof.id,hash:proof.hash,quote:'"artifactId":'+JSON.stringify(candidate.id)}]:[])]})),findings:[],uncertainty:'Simulated provider.'};
      }
      if(respond)value=await respond({...call,value,engine,store,registry,calls});
      if(type==='review')value=reviewEncoding==='evidence-catalog-v1'?compactCatalogReview(value,task.observedEvidenceCatalog):reviewEncoding==='evidence-refs-v1'?compactReviewEvidence(value):value;
      await request.validate(value);
      return {value,receipt:{status:'completed',simulation:true,threadId:id('sim-planned'),turnId:'sim-turn',model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
    },async close(){}});
    const workers=new WorkerService({store,authority,registry,broker,providerFactory});engine=new FactoryEngine({store,authority,registry,broker,workers});
  };open();
  const mission=engine.create(intent,{allowedTools:[],contextEncoding,reviewEncoding,cardEncoding:'compact-json-v1',instructionProfile:'scoped-v1',maxNodeAttempts});
  t.after(()=>{engine.close();rmSync(directory,{recursive:true,force:true});});
  return {mission,calls,get engine(){return engine;},get store(){return store;},get registry(){return registry;},
    reopen(){engine.close();open();},run:options=>engine.run(mission.id,options)};
}

for(const [contextEncoding,reviewEncoding] of [['plain-json','expanded-json'],['lossless-v1','evidence-refs-v1'],['lossless-json-v2','evidence-catalog-v1']])test(`planner executes real ledger stages with private edges: ${contextEncoding}`,async t=>{
  const f=fixture(t,{contextEncoding,reviewEncoding}),result=await f.run();assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(f.calls.filter(c=>c.type==='replica').length,1);assert.equal(f.calls.filter(c=>c.type==='produce').length,2);assert.equal(f.calls.filter(c=>c.type==='review').length,5);
  assert.equal(result.nodes.length,4);assert.ok(result.nodes.every(n=>n.status==='ACCEPTED'));
  for(const n of result.nodes){
    const a=durableArtifact(f.store,n.artifactId),durable=durableNode(f.store,f.mission.id,n.id);
    assert.equal(a.payload.nodeId,n.id);assert.equal(a.payload.producerRunId,durable.runId);assert.deepEqual(a.payload.criteria,durable.spec.criteria);
  }
  assert.deepEqual(Object.keys(result.outcome.payload),['body'],'Public delivery exposes only the body');
  const durableOutcome=durableArtifact(f.store,result.outcome);
  assert.ok(durableOutcome.payload.criteria.some(c=>c.id==='req.r.scope'&&c.text===intent));
  const privateArtifacts=f.store.list('artifact').filter(a=>['plan','raw-target','blind-protocol'].includes(a.data.payload.purpose));
  const replica=f.calls.find(c=>c.type==='replica'),judge=f.calls.find(c=>c.type==='review'&&c.purpose===BLIND_MATERIAL_PURPOSE);
  assert.equal(judge.exposure.artifacts.length,1);assert.equal(Object.hasOwn(judge.exposure,'missionIntent'),false);
  for(const a of privateArtifacts)for(const hidden of [a.id,a.data.payloadHash]){assert.ok(!replica.request.input.includes(hidden));assert.ok(!judge.request.input.includes(hidden),hidden);}
  const body=JSON.parse(durableOutcome.payload.body);assert.equal(body.comparison.outcome,'MATCH');assert.equal(body.comparison.replicationEstablished,false);
  const report=missionReport(f.store,f.mission.id,{registry:f.engine.registry});assert.equal(report.nodes.find(n=>n.id==='report').execution.kind,'closed-blind-comparison-v1');
  assert.equal(report.metrics.integrity,'NOT_ATTESTED');assert.deepEqual(report.timeline,[]);
  assert.equal(f.store.events({after:0,limit:10000}).filter(e=>e.kind==='blind.original.opened').length,1);
  assert.equal(f.store.events({after:0,limit:10000}).filter(e=>e.kind==='blind.workflow.left').length,2);
  assert.ok(formatMissionReport(report).includes('comparador determinista (sin inferencia productora)'));
  const binding=f.store.list('blind-registration')[0],reg=f.engine.authority.open(binding.data.signed,'blind.registration');
  assert.equal(reg.planBinding.material.id,'attempt');assert.notEqual(reg.replicationId,'attempt');
  const seq=(type,id,version)=>f.registry.committedSequence(type,id,version);
  const materialNode=f.store.get('node',`${f.mission.id}:attempt`),opening=f.store.list('blind-opening')[0];
  assert.ok(seq('node',materialNode.id,materialNode.version)<seq(opening.type,opening.id,opening.version),'Ledger material acceptance precedes opening');
  const count=f.calls.length;f.reopen();assert.equal((await f.run()).mission.status,'COMPLETED');assert.equal(f.calls.length,count);assert.ok(f.store.verifyJournal());
});

test('native raw input integrates with closed replication without a producer call or private-target leak',async t=>{
  const f=fixture(t,{respond:({type,value})=>{
    if(type==='plan'){
      const original=value.nodes.find(n=>n.id==='original');
      original.roleIds=[];original.outputKind='literal-input-copy';original.criteria=[];
      original.execution={kind:'literal-input-copy-v1',requestQuote:'supplied raw target 42',copyText:'42'};
    }
    return value;
  }});
  const result=await f.run();assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(f.calls.filter(c=>c.type==='produce').length,1,'Only the protocol needs a model producer');
  assert.equal(f.calls.filter(c=>c.type==='produce')[0].task.node.id,'protocol');
  assert.equal(f.calls.filter(c=>c.type==='replica').length,1);
  const original=f.store.list('artifact').find(r=>r.data.payload.kind==='literal-input-copy').data;
  assert.equal(original.payload.body,'42');assert.deepEqual(original.payload.claims,[]);
  assert.equal(f.store.get('run',original.payload.producerRunId).data.inferenceReceipt,undefined);
  for(const call of f.calls.filter(c=>c.type==='replica'||c.type==='review'&&c.purpose===BLIND_MATERIAL_PURPOSE)){
    assert.equal(call.request.input.includes(original.id),false);assert.equal(call.request.input.includes(original.payloadHash),false);
    assert.equal(call.exposure.runtimeObservations?.some(o=>o.kind==='artifact-input-copy')??false,false);
  }
  assert.deepEqual(Object.keys(result.outcome.payload),['body'],'Public delivery exposes only the body');
  assert.equal(JSON.parse(durableArtifact(f.store,result.outcome).payload.body).original.body,'42');
  const count=f.calls.length;f.reopen();assert.equal((await f.run()).mission.status,'COMPLETED');assert.equal(f.calls.length,count);
});

test('closed plan rejects weakened gates, false role adapters, extra edges and tool-bearing ancestry before dispatch',()=>{
  assert.doesNotThrow(()=>validatePlan(plan(),intent));assert.doesNotThrow(()=>assertPlanRoleExecution(plan()));
  assert.throws(()=>assertRoleExecution(['veritas_04'],'producer'),{code:'ROLE_EXECUTION_UNSUPPORTED'});
  const mutations=[p=>p.nodes[2].criteria.pop(),p=>p.nodes[1].criteria[0].text='Accept anything',p=>p.nodes[3].criteria.pop(),
    p=>p.nodes[2].dependencies.push(edge(p.nodes[0])),p=>p.nodes[3].execution.materialNodeId='original',
    p=>p.nodes[2].roleIds=['omega_02'],p=>p.nodes[3].roleIds=['omega_02'],p=>p.nodes[0].tools=['source.fetch'],
    p=>p.nodes[2].execution.kind='ordinary',p=>p.finalNodeId='attempt'];
  for(const mutate of mutations){const p=plan();mutate(p);assert.throws(()=>validatePlan(p,intent));}
});

for(const purpose of [BLIND_MATERIAL_PURPOSE,BLIND_COMPARISON_PURPOSE])test(`quota resumes the same planned ${purpose} without another replica`,async t=>{
  let failed=false;const f=fixture(t,{respond:({type,purpose:p,value})=>{if(type==='review'&&p===purpose&&!failed){failed=true;throw Object.assign(Error('Simulated quota'),{code:'QUOTA'});}return value;}});
  assert.equal((await f.run()).mission.status,'WAITING_QUOTA');const registration=f.store.list('blind-registration')[0];
  f.reopen();const result=await f.run();assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(f.calls.filter(c=>c.type==='replica').length,1);assert.equal(f.store.list('blind-registration').length,1);assert.equal(f.store.list('blind-registration')[0].hash,registration.hash);
});

for(const purpose of [BLIND_MATERIAL_PURPOSE,BLIND_COMPARISON_PURPOSE])test(`planned rejection retained at ${purpose}; no resampling on continue`,async t=>{
  const f=fixture(t,{respond:({type,purpose:p,value})=>type==='review'&&p===purpose?{...value,decision:'RETURN',checks:value.checks.map(c=>({...c,verdict:'FAIL'})),findings:[{severity:'material',description:'Simulated substantive rejection',recovery:'A different prospective protocol is needed, not another vote.'}]}:value});
  const first=await f.run();assert.equal(first.mission.status,'NEEDS_DIRECTION',JSON.stringify(first.mission.pending));const count=f.calls.length;
  f.reopen();assert.equal((await f.run()).mission.status,'NEEDS_DIRECTION');assert.equal(f.calls.length,count);assert.equal(f.calls.filter(c=>c.type==='replica').length,1);
  if(purpose===BLIND_MATERIAL_PURPOSE)assert.equal(f.store.list('blind-opening').length,0);
});

test('plan review describes private boundaries rather than promising original exposure to a blind judge',()=>{
  const p=normalizeFinalCoverage(plan()).plan,payload={nodeId:'planning',purpose:'plan',kind:'mission-plan',body:JSON.stringify(p)};
  const context=planReviewEvidenceContext({id:'plan',payload,payloadHash:sha256(payload)},intent);
  assert.deepEqual(context.nodes.find(n=>n.nodeId==='attempt').reviewedProductNodeIds,['attempt']);
  assert.deepEqual(context.nodes.find(n=>n.nodeId==='report').reviewedProductNodeIds,['report']);
  assert.deepEqual(context.nodes.find(n=>n.nodeId==='attempt').privateControlPrerequisites,['protocol']);
  assert.match(context.nodes.find(n=>n.nodeId==='report').candidateBody.fields.publicProtocol,/COMPLETE frozen public protocol/);
  assert.ok(context.nodes.find(n=>n.nodeId==='report').unexposedProductNodeIds.includes('protocol'),'Private upstream wrapper remains unexposed');
});

test('prospective embedded-content map matches complete actual closed reviewer bodies and authenticated observations',async t=>{
  const f=fixture(t),outcome=await f.run();assert.equal(outcome.mission.status,'COMPLETED');
  for(const [stage,purpose,observationKind,bodyKey] of [['material',BLIND_MATERIAL_PURPOSE,'artifact-blind-material',null],['comparison',BLIND_COMPARISON_PURPOSE,'artifact-blind-comparison','report']]){
    const call=f.calls.find(c=>c.type==='review'&&c.purpose===purpose),body=JSON.parse(call.exposure.artifacts[0].payload.body),contract=closedProductExposure(stage);
    assert.equal(body.schema,contract.schema);assert.deepEqual(Object.keys(body).sort(),Object.keys(contract.fields).sort());
    assert.deepEqual(body.publicProtocol,publicProtocol,'Complete public bytes are present despite private ancestor exclusion');
    const observation=JSON.parse(call.exposure.runtimeObservations.find(o=>o.kind===observationKind).quoteText).detail;
    assert.deepEqual((bodyKey?observation[bodyKey]:observation).publicProtocol,publicProtocol,'Authenticated observation binds the same complete public content');
    assert.equal(call.exposure.artifacts.length,1,'No new upstream artifact exposure is introduced');
    if(stage==='comparison'){
      assert.equal(body.original.body,'42');
      assert.deepEqual(body.replica,JSON.parse(f.calls.find(c=>c.type==='review'&&c.purpose===BLIND_MATERIAL_PURPOSE).exposure.artifacts[0].payload.body).result);
      for(const [key,actual] of [['replica',f.calls.find(c=>c.type==='replica')],['materialReviewer',f.calls.find(c=>c.type==='review'&&c.purpose===BLIND_MATERIAL_PURPOSE)]]){
        const recorded=observation.closedExposure[key];assert.equal(recorded.coverage,'RECORDED');
        assert.equal(recorded.requests.length,1);assert.equal(recorded.requests[0].request.input,actual.request.input);
        assert.equal(recorded.requests[0].request.instructions,actual.request.instructions);
        assert.ok(recorded.completedSequence<observation.closedExposure.openingSequence);
      }
    }
    else assert.equal(Object.hasOwn(body,'original'),false);
  }
});

test('explicit post-opening convergence remains supported without leaking into earlier closed actors',async t=>{
  const f=fixture(t,{respond:({type,value})=>{
    if(type!=='plan')return value;
    const p=plan(),dossier=node('dossier','delivery',[{id:'delivery',text:'Preserve the complete native report and its public limits.'}],p.nodes.map(edge));
    p.nodes.push(dossier);p.finalNodeId='dossier';return p;
  }});
  const result=await f.run();assert.equal(result.mission.status,'COMPLETED');
  const comparison=f.store.list('artifact').find(a=>a.data.payload.purpose===BLIND_COMPARISON_PURPOSE).data;
  assert.notEqual(result.outcome.id,comparison.id);assert.deepEqual(Object.keys(result.outcome.payload),['body']);
  assert.ok(durableArtifact(f.store,result.outcome).payload.body.includes(comparison.payload.body));
  const integration=f.calls.find(c=>c.type==='produce'&&c.task.node.id==='dossier');
  assert.ok(integration.exposure.artifacts.some(a=>a.payload.purpose==='blind-protocol'));
  assert.ok(integration.exposure.artifacts.some(a=>a.payload.purpose==='raw-target'));
  const replica=f.calls.find(c=>c.type==='replica'),judge=f.calls.find(c=>c.type==='review'&&c.purpose===BLIND_MATERIAL_PURPOSE);
  assert.equal(Object.hasOwn(replica.exposure,'artifacts'),false);assert.equal(judge.exposure.artifacts.length,1);
  assert.equal(f.calls.filter(c=>c.type==='replica').length,1);
  const opening=f.store.events({after:0,limit:1000}).find(e=>e.kind==='blind.original.opened');
  const producer=f.store.list('run').find(r=>r.data.mode==='producer'&&r.data.nodeId==='dossier');
  assert.ok(opening.seq<f.registry.committedSequence('run',producer.id,1));
  assert.match(blindPlanningCapability().contract,/final node receives every final criterion/);
  const calls=f.calls.length;f.reopen();assert.equal((await f.run()).mission.status,'COMPLETED');assert.equal(f.calls.length,calls);
});

test('cancellation after material review commit resumes without another vote or premature opening',async t=>{
  const f=fixture(t),controller=new AbortController(),review=f.engine.workers.review.bind(f.engine.workers);let interrupted=false;
  f.engine.workers.review=async args=>{const a=await review(args);if(args.artifact.payload.purpose===BLIND_MATERIAL_PURPOSE&&!interrupted){interrupted=true;controller.abort();}return a;};
  const paused=await f.run({signal:controller.signal,pauseOnAbort:true});assert.equal(paused.mission.status,'PAUSED');
  assert.equal(f.store.list('blind-opening').length,0);assert.notEqual(paused.nodes.find(n=>n.id==='attempt').status,'ACCEPTED');
  assert.equal(f.store.list('artifact').find(a=>a.data.payload.kind===BLIND_MATERIAL_KIND).data.status,'ACCEPTED');
  f.reopen();const result=await f.run();assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(f.calls.filter(c=>c.type==='replica').length,1);assert.equal(f.calls.filter(c=>c.type==='review'&&c.purpose===BLIND_MATERIAL_PURPOSE).length,1);
});

for(const stage of ['replica','review'])test(`uncertain ${stage} dispatch cannot be automatically replayed after reopen`,async t=>{
  const f=fixture(t,{respond:({type,purpose,value})=>{if(type===stage&&(stage==='replica'||purpose===BLIND_MATERIAL_PURPOSE))throw Object.assign(Error('Simulated lost response'),{code:'INFERENCE_OUTCOME_UNKNOWN'});return value;}});
  assert.equal((await f.run()).mission.status,'NEEDS_DIRECTION');const count=f.calls.length;
  f.reopen();assert.equal((await f.run()).mission.status,'NEEDS_DIRECTION');assert.equal(f.calls.length,count);assert.equal(f.store.list('blind-opening').length,0);
});

test('plan-bound review budget does not reset when the ledger reclaims a node',async t=>{
  const f=fixture(t,{maxNodeAttempts:1,respond:({type,purpose,value})=>{if(type==='review'&&purpose===BLIND_MATERIAL_PURPOSE)throw Object.assign(Error('Simulated quota'),{code:'QUOTA'});return value;}});
  assert.equal((await f.run()).mission.status,'WAITING_QUOTA');const count=f.calls.length;f.reopen();
  const result=await f.run();assert.equal(result.mission.status,'NEEDS_DIRECTION');assert.equal(result.mission.pending[0].code,'BLIND_REVIEW_BUDGET');assert.equal(f.calls.length,count);
});

test('revoked plan invalidates exact closed products; missing plan sequence is not prior acceptance',async t=>{
  const f=fixture(t),result=await f.run();assert.equal(result.mission.status,'COMPLETED');
  const p=f.store.get('plan',f.mission.id),artifactId=result.outcome.id,sequence=f.registry.committedSequence.bind(f.registry);
  const binding=f.engine.authority.open(f.store.list('blind-registration')[0].data.signed,'blind.registration').planBinding;
  f.registry.committedSequence=(type,id,version)=>type==='artifact'&&id===binding.planArtifact.id&&version===binding.planArtifact.version?null:sequence(type,id,version);
  assert.throws(()=>f.registry.assertUsable(artifactId,{missionId:f.mission.id,purpose:BLIND_COMPARISON_PURPOSE}),{code:'BLIND_PLAN_BINDING'});
  f.registry.committedSequence=sequence;assert.doesNotThrow(()=>f.registry.assertUsable(artifactId,{missionId:f.mission.id,purpose:BLIND_COMPARISON_PURPOSE}));
  f.registry.invalidate([p.data.acceptedPlanArtifactId],{reason:'Withdraw plan in fixture'});
  assert.throws(()=>f.registry.assertUsable(artifactId,{missionId:f.mission.id,purpose:BLIND_COMPARISON_PURPOSE}));
  assert.equal(f.calls.filter(c=>c.type==='replica').length,1);
});

test('controller inserts complete fixed gates before independent plan review, without extra planner output',async t=>{
  const f=fixture(t,{respond:({type,value,request})=>{
    if(type==='plan'){for(const n of value.nodes.slice(1))n.criteria=[];}
    if(type==='produce'&&request.instructions.includes('CLOSED PROTOCOL AUTHOR'))assert.ok(request.instructions.includes('sovereign.closed-blind-protocol.v1'));
    return value;
  }});
  const result=await f.run();assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  const planReview=f.calls.find(c=>c.type==='review'&&c.purpose==='plan'),p=JSON.parse(planReview.exposure.artifacts[0].payload.body);
  assert.equal(p.nodes[1].criteria.length,5);assert.equal(p.nodes[2].criteria.length,5);assert.equal(p.nodes[3].criteria.length,6);
  assert.equal(f.calls.find(c=>c.type==='plan').task.runtimeCapabilities.closedBlindPlan.gates,undefined,'Fixed gate texts are not repeated in every ordinary planner request');
  assert.equal(f.store.events({limit:10000}).filter(e=>e.kind==='planning.closed-gates.normalized').length,1);
});

test('gate normalization is idempotent, preserves custom final obligations and rejects a colliding rewrite',()=>{
  const p=plan();p.nodes[1].criteria=[];p.nodes[2].criteria=[];p.nodes[3].criteria=[{id:'extra',text:'Retain a distinct extra final obligation.'}];
  const normalized=normalizeBlindPlan(p);assert.equal(normalized.added.length,15);assert.equal(normalized.plan.nodes[3].criteria[0].id,'extra');
  assert.deepEqual(normalizeBlindPlan(normalized.plan).plan,normalized.plan);assert.deepEqual(normalizeBlindPlan(normalized.plan).added,[]);
  const bad=plan();bad.nodes[2].criteria[0].text='Approve all outputs.';assert.throws(()=>normalizeBlindPlan(bad),{code:'BLIND_PLAN'});
  assert.equal(plannedProtocolInstructions(null,'unused',{purpose:'ordinary',outputKind:'delivery'}),'');
  assert.ok(JSON.stringify(blindPlanningCapability()).length<2200,'Only compact routing contract belongs in every plan request');
});

test('schema and role/review modules load cold as independent ESM entry points',()=>{
  for(const name of ['role-execution','review-codec','plans','blind-plan','blind-material','blind-comparison','blind-approval']){
    const url=new URL(`../../factory/lib/${name}.mjs`,import.meta.url).href;
    assert.doesNotThrow(()=>execFileSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(url)})`],{timeout:10000,stdio:'pipe'}),name);
  }
});

test('extra closed proposal criteria are retained as rejection before a corrected plan receives every original obligation',async t=>{
  let proposals=0;
  const f=fixture(t,{respond:({type,value,task})=>{
    if(type!=='plan')return value;
    proposals++;
    if(proposals===1)value.nodes[1].criteria.push({id:'public-detail',text:'An additional public control proposed in the wrong criteria field.'});
    else{
      assert.equal(task.feedback.length,1);assert.equal(task.feedback[0].failure.code,'BLIND_PLAN');
      assert.match(task.feedback[0].failure.detail,/Node protocol:/);
      assert.match(task.feedback[0].failure.detail,/retain every user obligation in requirements/);
      value.nodes[1].criteria=[];value.nodes[2].criteria=[];
    }
    return value;
  }});
  const result=await f.run();assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(proposals,2);assert.equal(f.calls.filter(c=>c.type==='replica').length,1);
  const rejected=f.store.list('worker-rejected-output');assert.equal(rejected.length,1);
  assert.equal(rejected[0].data.accepted,false);assert.equal(rejected[0].data.payloadCaptured,true);
  assert.equal(rejected[0].data.payload.nodes[1].criteria.at(-1).id,'public-detail');
  const accepted=f.store.get('plan',f.mission.id).data.plan;
  assert.deepEqual(accepted.requirements,plan().requirements);
  assert.deepEqual(accepted.nodes[1].criteria,BLIND_PROTOCOL_CRITERIA);
  assert.deepEqual(accepted.nodes[2].criteria,BLIND_MATERIAL_CRITERIA);
  assert.ok(durableArtifact(f.store,result.outcome).payload.criteria.some(c=>c.text===intent));
  assert.match(blindPlanningCapability().contract,/Propose criteria:\[\] for protocol\/material; no extra local criteria/);
  assert.match(blindPlanningCapability().contract,/inserts their full fixed gates BEFORE independent plan review/);
  assert.match(blindPlanningCapability().contract,/Empty criteria describe only the pre-normalization proposal/);
});

test('future-event protocol control is returned before dispatch; corrected public method preserves the rejected version',async t=>{
  let authors=0,rejections=0;
  const f=fixture(t,{respond:({type,purpose,task,request,value,exposure})=>{
    if(type==='produce'&&task.node.id==='protocol'){
      assert.ok(request.instructions.includes(CLOSED_PROTOCOL_CONTROL_BOUNDARY));authors++;
      if(authors===1){const p=JSON.parse(value.body);p.public.controls.push({id:'future-comparison',procedure:'Inspect the final comparison after this attempt has been accepted.',expected:'The final comparison is already independently accepted.'});value.body=JSON.stringify(p);}
      else value.method='corrected-before-first-dispatch-replica-local-controls';
    }
    if(type==='review'&&['blind-protocol',BLIND_MATERIAL_PURPOSE].includes(purpose))assert.ok(request.schema.description.includes(CLOSED_PROTOCOL_CONTROL_BOUNDARY));
    if(type==='review'&&purpose==='blind-protocol'){
      const candidate=exposure.artifacts.find(a=>a.id===task.candidateId),p=JSON.parse(candidate.payload.body);
      if(p.public.controls.some(c=>c.id==='future-comparison')){
        rejections++;
        return {...value,decision:'RETURN',checks:value.checks.map(c=>c.criterionId==='blind-method'?{...c,verdict:'FAIL',reason:'SIMULATED judgment: the replica cannot observe a future comparison.'}:c),
          findings:[{severity:'material',description:'A required control is outside the closed response exposure.',recovery:'Before any replica, keep lifecycle gates with their controller and preregister only executable replica-local controls; retain the rejected protocol.'}]};
      }
    }
    return value;
  }});
  const result=await f.run();assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(authors,2);assert.equal(rejections,1);assert.equal(f.calls.filter(c=>c.type==='replica').length,1);
  const protocols=f.store.list('artifact').filter(a=>a.data.payload.purpose==='blind-protocol');assert.equal(protocols.length,2);
  const rejected=protocols.find(a=>a.data.status==='RETURNED'),accepted=protocols.find(a=>a.data.status==='ACCEPTED');
  assert.ok(rejected.data.payload.body.includes('future-comparison'));assert.ok(!accepted.data.payload.body.includes('future-comparison'));
  const reg=f.engine.authority.open(f.store.list('blind-registration')[0].data.signed,'blind.registration');assert.equal(reg.protocolRef.id,accepted.id);
  const review=f.store.get('review',rejected.data.reviews.at(-1)),registration=f.store.list('blind-registration')[0];
  assert.ok(f.registry.committedSequence(review.type,review.id,review.version)<f.registry.committedSequence(registration.type,registration.id,registration.version));
  assert.deepEqual(f.store.get('plan',f.mission.id).data.plan.requirements,plan().requirements);
  assert.deepEqual(JSON.parse(f.calls.find(c=>c.type==='replica').request.input).publicProtocol.controls,publicProtocol.controls);
  assert.ok(!f.calls.find(c=>c.type==='produce'&&c.task.node.id==='original').request.instructions.includes(CLOSED_PROTOCOL_CONTROL_BOUNDARY));
});

test('explicit UNKNOWN is independently assessed and retained but cannot open, compare, or complete the mission',async t=>{
  const unknown={status:'UNKNOWN',result:'',publicArgument:'The required control cannot be executed from the supplied public packet.',
    controls:[{id:'reverse',verdict:'UNKNOWN',observation:'No result was established; the reverse calculation was not performed.'}],
    deviations:['Calculation stopped before an unsupported claim.'],unknowns:['The method is unresolved.']};
  const f=fixture(t,{respond:({type,value})=>type==='replica'?structuredClone(unknown):value});
  const first=await f.run();assert.equal(first.mission.status,'NEEDS_DIRECTION');
  const reviews=f.calls.filter(c=>c.type==='review'&&c.purpose===BLIND_MATERIAL_PURPOSE);
  assert.equal(reviews.length,1,'A completed UNKNOWN response is a material attempt needing its own judgment');
  const node=first.nodes.find(n=>n.id==='attempt');assert.equal(node.status,'ACCEPTED','Acceptance is of the faithful attempt record only');
  const artifact=f.store.get('artifact',node.artifactId).data;
  assert.deepEqual(JSON.parse(artifact.payload.body).result,unknown);
  const registration=f.store.list('blind-registration')[0],seal=f.store.list('blind-seal')[0];
  assert.equal(f.engine.blind.status(registration.id).state,'INCONCLUSIVE');
  assert.equal(f.store.list('blind-opening').length,0);assert.equal(f.store.list('blind-comparison').length,0);
  assert.equal(first.mission.finalArtifactId,null);assert.equal(first.mission.pending[0].code,'REPLICA_INCONCLUSIVE');
  assert.throws(()=>f.engine.blind.open(registration.id),{code:'BLIND_STATE'});
  const hidden=f.store.list('artifact').filter(a=>['plan','raw-target','blind-protocol'].includes(a.data.payload.purpose));
  assert.equal(reviews[0].exposure.artifacts.length,1);assert.ok(!Object.hasOwn(reviews[0].exposure,'missionIntent'));
  for(const a of hidden)for(const secret of [a.id,a.data.payloadHash])assert.ok(!reviews[0].request.input.includes(secret));
  const count=f.calls.length;f.reopen();assert.equal((await f.run()).mission.status,'NEEDS_DIRECTION');
  assert.equal(f.calls.length,count);assert.equal(f.store.list('blind-registration')[0].hash,registration.hash);
  assert.equal(f.store.list('blind-seal')[0].hash,seal.hash);assert.equal(f.store.list('blind-opening').length,0);
});

test('replacement plan before any freeze regenerates its protocol but preserves a usable exact raw input',async t=>{
  const f=fixture(t),controller=new AbortController();
  f.engine.onEvent=e=>{if(e.kind==='node.accepted'&&e.nodeId==='protocol')controller.abort();};
  const paused=await f.run({signal:controller.signal,pauseOnAbort:true});assert.equal(paused.mission.status,'PAUSED');
  assert.equal(f.store.list('blind-registration').length,0);
  const original=paused.nodes.find(n=>n.id==='original'),protocol=paused.nodes.find(n=>n.id==='protocol');
  assert.ok(original&&protocol,'Public planned topology retains non-secret node IDs and pointers before the blind route freezes');
  const oldPlan=f.store.get('plan',f.mission.id).data.acceptedPlanArtifactId;
  const ownerId='fixture:prospective-plan';f.engine.ledger.acquireEngine({ownerId});
  try{await f.engine.plan(f.mission);}finally{f.engine.ledger.releaseEngine(ownerId);}
  const nextPlan=f.store.get('plan',f.mission.id).data.acceptedPlanArtifactId;assert.notEqual(nextPlan,oldPlan);
  assert.equal(f.store.get('node',`${f.mission.id}:original`).data.artifactId,original.artifactId);
  assert.equal(f.store.get('node',`${f.mission.id}:protocol`).data.status,'PENDING','Private protocol must bind the new exact accepted plan, even when its node spec is unchanged');
  f.engine.onEvent=()=>{};const result=await f.run();assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  const newProtocol=durableArtifact(f.store,durableNode(f.store,f.mission.id,'protocol').artifactId);
  assert.notEqual(newProtocol.id,protocol.artifactId);assert.ok(newProtocol.payload.inputRefs.some(r=>r.artifactId===nextPlan));
  assert.equal(f.store.get('artifact',protocol.artifactId).data.status,'INVALIDATED');
  assert.equal(f.calls.filter(c=>c.type==='replica').length,1);assert.equal(f.calls.filter(c=>c.type==='produce'&&c.task.node.id==='original').length,1);
  assert.deepEqual(durablePlan(f.store,f.mission.id).plan.requirements,plan().requirements);
});

test('a replacement plan after a frozen attempt is not implicit authority for another experiment',async t=>{
  const f=fixture(t,{respond:({type,value})=>type==='replica'?{...value,status:'UNKNOWN',result:'',unknowns:['Fixture failed method']} :value});
  assert.equal((await f.run()).mission.status,'NEEDS_DIRECTION');
  const count=f.calls.length,prior=f.store.get('plan',f.mission.id),registration=f.store.list('blind-registration')[0],seal=f.store.list('blind-seal')[0];
  const ownerId='fixture:unsafe-replan';f.engine.ledger.acquireEngine({ownerId});
  try{await assert.rejects(f.engine.plan(f.mission),{code:'BLIND_REPLAN_REQUIRED'});}finally{f.engine.ledger.releaseEngine(ownerId);}
  assert.equal(f.calls.length,count,'Do not pay for speculative replacement plans before resolving their authority boundary');
  // An independently accepted proposal is still not permission to supersede
  // this closed experiment. Exercise the lower ledger API, not only plan().
  const originalPlan=f.store.get('artifact',prior.data.acceptedPlanArtifactId).data;
  const candidate=f.registry.create({missionId:f.mission.id,nodeId:'planning',producerRunId:originalPlan.payload.producerRunId,
    kind:'mission-plan',purpose:'plan',body:originalPlan.payload.body,claims:[],inputRefs:[],criteria:originalPlan.payload.criteria});
  const approved=await f.engine.workers.review({artifact:candidate,reviewerRoleIds:['omega_22'],missionIntent:intent});
  assert.equal(approved.status,'ACCEPTED','SIMULATED independently accepted replacement candidate');
  f.engine.ledger.acquireEngine({ownerId});
  try{assert.throws(()=>f.engine.ledger.install(f.mission.id,prior.data.plan,{intent,acceptedPlanArtifactId:approved.id,allowedTools:[]}),{code:'BLIND_REPLAN_REQUIRED'});}
  finally{f.engine.ledger.releaseEngine(ownerId);}
  assert.deepEqual(f.store.get('plan',f.mission.id),prior);assert.equal(f.store.list('blind-registration').length,1);
  assert.equal(f.store.list('blind-registration')[0].hash,registration.hash);assert.equal(f.store.list('blind-seal')[0].hash,seal.hash);
  assert.equal(f.store.list('blind-opening').length,0);
});
