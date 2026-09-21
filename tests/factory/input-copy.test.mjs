import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {id,sha256} from '../../factory/lib/contracts.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {INPUT_COPY_KIND,INPUT_COPY_CRITERIA,selectInputCopy,normalizeInputCopyPlan} from '../../factory/lib/input-copy-contract.mjs';
import {registerInputCopyRun,materializeInputCopy,inputCopyEvidence} from '../../factory/lib/input-copy.mjs';
import {validatePlan,validatePlanProposal} from '../../factory/lib/plans.mjs';
import {assertPlanRoleExecution} from '../../factory/lib/role-execution.mjs';
import {unpackContext} from '../../factory/lib/context-codec.mjs';
import {unpackJsonContext} from '../../factory/lib/context-json-codec.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {compactCatalogReview,compactReviewEvidence} from '../../factory/lib/review-codec.mjs';
import {missionReport,formatMissionReport} from '../../factory/lib/report.mjs';
import {PUBLIC_DELIVERY_VIEW_SCHEMA} from '../../factory/lib/public-artifact-projection.mjs';

const text='A\r\n🧭e\u0301  Z';
const intent=`Conserva exactamente el contenido entre marcas: <objeto>${text}</objeto>. No certifiques su verdad ni normalices espacios o Unicode.`;
const execution={kind:'literal-input-copy-v1',requestQuote:`<objeto>${text}</objeto>`,copyText:text};
const spanExecution={kind:'literal-input-span-v1',before:'<objeto>',after:'</objeto>'};
const decode=readSourceContextView;
function plan(){return {requirements:[{id:'copy',text:intent,requestQuote:intent,criteria:[{id:'exact',text:'Preserve the exact requested complete object, including whitespace and Unicode; no truth claim.'}]}],
  nodes:[{id:'copy',title:'Preserve user object',purpose:'raw-object',roleIds:[],reviewerRoleIds:['omega_22'],requirementIds:['copy'],dependencies:[],
    method:{id:'native-copy',rationale:'Exact immutable bytes need no producing model.',alternatives:['Ask for an unambiguous source if the selection is unclear.']},
    instructions:'Copy the explicitly selected user object without declaring its contents true.',outputKind:INPUT_COPY_KIND,criteria:[],requiredEffects:[],tools:[],specialist:null,execution}],
  finalNodeId:'copy',routingRationale:'One actual product, one independent material review; no model producer.'};}

function fixture(t,{respond,contextEncoding='plain-json',reviewEncoding='expanded-json',consumer=false,span=false}={}){
  const directory=mkdtempSync(join(tmpdir(),'native-copy-')),calls=[];let engine;
  const open=()=>{
    engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspace')});
    engine.workers.providerFactory=()=>({async generate(request){
      const exposure=decode(request.input),task=JSON.parse(exposure.task),type=Object.hasOwn(request.schema.properties,'requirements')?'plan'
        :Object.hasOwn(request.schema.properties,'artifactHash')?'review':'produce';
      if(type==='produce')assert.equal(task.node.id,consumer?'consume':null,'Native literal copy must never invoke an ordinary model producer');
      const candidate=type==='review'?exposure.artifacts.find(a=>a.id===task.candidateId):null;
      const call={request,exposure,task,type,candidate};calls.push(call);
      const proof=candidate?.payload.kind===INPUT_COPY_KIND?exposure.runtimeObservations.find(o=>o.kind==='artifact-input-copy'):null;
      if(candidate?.payload.kind===INPUT_COPY_KIND)assert.ok(proof,'Exact native origin must be supplied before review');
      let value=type==='plan'?plan():type==='produce'?{action:'final',tool:'',argsJson:'',body:exposure.artifacts.find(a=>a.payload.kind===INPUT_COPY_KIND).payload.body,claims:[],method:'preserve',reason:'Simulated consumer preserves accepted input.'}:{artifactHash:candidate.hash,purpose:candidate.payload.purpose,decision:'ACCEPT',
        checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',reason:'SIMULATED judgment for controller integration; not real semantic qualification.',
          evidence:[{kind:'artifact',id:candidate.id,hash:candidate.hash,quote:candidate.payload.body},...(proof?[{kind:'runtime',id:proof.id,hash:proof.hash,quote:'"artifactId":'+JSON.stringify(candidate.id)}]:[])]})),findings:[],uncertainty:'Simulated reviewer.'};
      if(type==='plan'&&span)value.nodes[0].execution=structuredClone(spanExecution);
      if(type==='plan'&&consumer){
        const parent=value.nodes[0];value.nodes.push({...structuredClone(parent),id:'consume',title:'Consume accepted copy',purpose:'delivery',
          roleIds:['omega_02'],outputKind:'delivery',execution:null,criteria:[],dependencies:[{nodeId:'copy',purpose:parent.purpose,reason:'Use the exact independently accepted literal object.'}]});
        value.finalNodeId='consume';
      }
      if(respond)value=await respond({...call,value,engine,calls});
      if(type==='review')value=reviewEncoding==='evidence-catalog-v1'?compactCatalogReview(value,task.observedEvidenceCatalog):reviewEncoding==='evidence-refs-v1'?compactReviewEvidence(value):value;
      await request.validate(value);
      return {value,receipt:{status:'completed',simulation:true,threadId:id('sim-copy'),turnId:'test',contextHash:inferenceRequestHash(request),model:request.model,reasoningEffort:request.reasoningEffort}};
    },async close(){}});
  };open();const mission=engine.create(intent,{entryMode:'planned',allowedTools:[],contextEncoding,reviewEncoding,cardEncoding:'compact-json-v1',producerContext:'node-contract-v1',maxNodeAttempts:2});
  t.after(()=>{engine.close();rmSync(directory,{recursive:true,force:true});});
  return {calls,mission,directory,get engine(){return engine;},run:options=>engine.run(mission.id,options),reopen(){engine.close();open();}};
}

// `Engine.run()` and `missionReport()` are public read boundaries.  A
// completed delivery deliberately contains only its body there; all claims,
// criteria, custody and review lineage below are checked through the same
// authenticated registry that the controller uses, rather than turning a
// public projection into an accidental internal API.
function acceptedDelivery(f,outcome,purpose){
  assert.equal(outcome.schema,PUBLIC_DELIVERY_VIEW_SCHEMA);
  assert.equal(outcome.missionId,f.mission.id);assert.equal(outcome.status,'ACCEPTED');
  assert.deepEqual(Object.keys(outcome.payload),['body']);
  for(const privateField of ['claims','criteria','toolReceipts','inputRefs','requiredEffects','producerRunId','provisional'])
    assert.equal(Object.hasOwn(outcome.payload,privateField),false,`Public delivery must not disclose ${privateField}`);
  const artifact=f.engine.registry.assertUsable(outcome.id,{missionId:f.mission.id,purpose});
  assert.equal(outcome.payload.body,artifact.payload.body);assert.equal(outcome.payloadHash,artifact.payloadHash);
  return artifact;
}

function acceptedPlanEvidence(f){
  const installed=f.engine.store.get('plan',f.mission.id);assert.ok(installed,'Installed plan record required');
  const artifact=f.engine.registry.assertUsable(installed.data.acceptedPlanArtifactId,{missionId:f.mission.id,purpose:'plan'});
  const plan=JSON.parse(artifact.payload.body);assert.deepEqual(plan,installed.data.plan,'Installed topology must equal the accepted plan artifact');
  return {artifact,plan};
}

function privateInferenceReceiptCount(engine,missionId){
  // Test-only internal recovery accounting.  It must never be asserted from a
  // public report: generic run rows are not an end-to-end telemetry attestation.
  return engine.store.list('run').filter(record=>record.data.missionId===missionId).reduce((total,record)=>
    total+(record.data.inferenceReceipts?.length??(record.data.inferenceReceipt?1:0)),0);
}

test('literal selector preserves all code points, CRLF, combining marks and spaces with explicit half-open offsets',()=>{
  const s=selectInputCopy(intent,execution);
  assert.equal(s.body,text);assert.equal(intent.slice(s.start,s.end),text);assert.equal(intent.slice(s.quoteStart,s.quoteEnd),execution.requestQuote);
  assert.equal(s.bodySha256,sha256(text));assert.equal(s.bodyUtf8Bytes,Buffer.byteLength(text));assert.match(s.unit,/UTF-16/);
  assert.notEqual(s.body,text.normalize('NFC'));assert.notEqual(s.body,text.replaceAll('\r\n','\n'));
});

test('literal selector rejects missing, overlapping, ambiguous, foreign, normalized and malformed selections',()=>{
  for(const [source,selection]of [
    [intent,{...execution,requestQuote:'missing'}],
    [intent+intent,execution],
    ['aaaa',{kind:execution.kind,requestQuote:'aaa',copyText:'aa'}],
    ['<v>x x</v>',{kind:execution.kind,requestQuote:'<v>x x</v>',copyText:'x'}],
    [intent,{...execution,copyText:text.normalize('NFC')}],
    [intent,{...execution,copyText:'foreign'}],
    [intent,{...execution,copyText:'\ud800'}],
    [intent,{...execution,copyText:''}],
    [intent,{...execution,offset:0}],
  ])assert.throws(()=>selectInputCopy(source,selection));
});

test('literal span selects original bytes without model transcription, including repeated body text',()=>{
  const s=selectInputCopy(intent,spanExecution);
  assert.equal(s.body,text);assert.equal(s.bodySha256,sha256(text));assert.equal(s.bodyUtf8Bytes,Buffer.byteLength(text));
  assert.equal(intent.slice(s.start,s.end),text);assert.equal(intent.slice(s.quoteStart,s.quoteEnd),execution.requestQuote);
  assert.deepEqual(s.selector,spanExecution);
  assert.equal(selectInputCopy('<objeto>x x x</objeto>',spanExecution).body,'x x x');
  assert.equal(selectInputCopy('<objeto>\r\n  \t</objeto>',spanExecution).body,'\r\n  \t');
  const source='Mentions <objeto> and </objeto>. Actual:\n<objeto>'+text+'</objeto> END';
  assert.throws(()=>selectInputCopy(source,spanExecution),{code:'INPUT_COPY_SELECTION'});
  assert.equal(selectInputCopy(source,{...spanExecution,before:'Actual:\n<objeto>',after:'</objeto> END'}).body,text);
});

test('literal span rejects ambiguous, overlapping, reversed, empty, normalized, malformed and extra-field selectors',()=>{
  for(const [source,selection]of [
    [intent,{...spanExecution,before:'missing'}],[intent,{...spanExecution,after:'missing'}],
    [intent+intent,spanExecution],['aaaa x END',{...spanExecution,before:'aaa',after:'END'}],
    ['START x aaaa',{...spanExecution,before:'START',after:'aaa'}],
    ['abcdef',{...spanExecution,before:'abcd',after:'def'}],
    ['<objeto></objeto>',spanExecution],['</objeto>x<objeto>',spanExecution],
    [intent,{...spanExecution,before:''}],[intent,{...spanExecution,after:''}],
    [intent,{...spanExecution,before:'\ud800'}],[intent+'\ud800',spanExecution],
    ['e\u0301[content]END',{...spanExecution,before:'é[',after:']END'}],
    [intent,{...spanExecution,copyText:text}],[intent,{...spanExecution,start:0}],
  ])assert.throws(()=>selectInputCopy(source,selection));
});

test('observed cVQFI4 wire-escape selection is rejected, never decoded or repaired into acceptance',()=>{
  const body='Registro α: 0042\r\n🧭 Cafe\u0301  | no verificado';
  const before='Bloque solicitado:\n<OBJETO_ENTREGA>',after='</OBJETO_ENTREGA>\nDato de contexto';
  const source=before+body+after;
  // The real selector returned U+005C U+006E where the source had U+000A.
  const rejected={kind:'literal-input-span-v1',before:'Bloque solicitado:\\n<OBJETO_ENTREGA>',after:'</OBJETO_ENTREGA>\\nDato de contexto'};
  assert.throws(()=>selectInputCopy(source,rejected),{code:'INPUT_COPY_SELECTION'});
  assert.equal(selectInputCopy(source,{kind:'literal-input-span-v1',before,after}).body,body);
  // Literal backslash+n is valid only when those very characters occur in the
  // source. A global unescape would break that distinct legitimate request.
  const literalSource=rejected.before+body+rejected.after;
  assert.equal(selectInputCopy(literalSource,rejected).body,body);
  assert.throws(()=>selectInputCopy(literalSource,{kind:'literal-input-span-v1',before,after}),{code:'INPUT_COPY_SELECTION'});
  const corrupted=body.replace('\u0301','\u000301');
  assert.throws(()=>selectInputCopy(source,{kind:'literal-input-copy-v1',requestQuote:before+corrupted+after,copyText:corrupted}),{code:'INPUT_COPY_SELECTION'});
});

test('native copy gates are normalized before plan review, without weakening or waiving other obligations',()=>{
  assert.doesNotThrow(()=>validatePlanProposal(plan(),intent,{allowedTools:[]}));
  const normalized=normalizeInputCopyPlan(plan()).plan;
  assert.doesNotThrow(()=>validatePlan(normalized,intent,{allowedTools:[]}));assert.doesNotThrow(()=>assertPlanRoleExecution(normalized));
  assert.equal(normalized.nodes[0].criteria.length,2);assert.deepEqual(normalized.requirements,plan().requirements);
  for(const mutate of [p=>p.nodes[0].criteria.pop(),p=>p.nodes[0].criteria[0].text='Always accept',p=>p.nodes[0].roleIds=['omega_02'],
    p=>p.nodes[0].tools=['source.fetch'],p=>p.nodes[0].execution=null,p=>p.nodes[0].outputKind='delivery']){
    const p=structuredClone(normalized);mutate(p);assert.throws(()=>validatePlan(p,intent));
  }
  const weakened=plan();weakened.nodes[0].criteria=[{...INPUT_COPY_CRITERIA[0],text:'Accept anything'}];assert.throws(()=>normalizeInputCopyPlan(weakened),{code:'INPUT_COPY_PLAN'});
  const falseRole=structuredClone(normalized);falseRole.nodes[0].roleIds=['omega_02'];assert.throws(()=>assertPlanRoleExecution(falseRole),{code:'INPUT_COPY_PLAN'});
});

for(const span of [false,true])for(const [contextEncoding,reviewEncoding]of [['plain-json','expanded-json'],['lossless-v1','evidence-refs-v1'],['lossless-json-v2','evidence-catalog-v1'],['source-text-v1','evidence-catalog-v1']])
test(`planned native ${span?'span':'copy'} preserves complete source/selection and independent gates: ${contextEncoding}`,async t=>{
  const f=fixture(t,{contextEncoding,reviewEncoding,span}),result=await f.run();
  assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));assert.equal(result.outcome.payload.body,text);
  const finalArtifact=acceptedDelivery(f,result.outcome,'raw-object');
  assert.equal(finalArtifact.payload.claims.length,0);assert.equal(f.calls.length,3,'Only planning, plan review and product review');
  assert.ok(finalArtifact.payload.criteria.some(c=>c.id==='req.copy.exact'));
  assert.deepEqual(finalArtifact.payload.toolReceipts,[]);assert.deepEqual(finalArtifact.payload.requiredEffects,[]);
  assert.equal(finalArtifact.payload.provisional,false);assert.equal(finalArtifact.payloadHash,sha256(finalArtifact.payload));
  const publicNode=result.nodes.find(node=>node.id==='copy');assert.ok(publicNode,'Verified public topology contains the planned copy node');
  assert.equal(publicNode.status,'ACCEPTED');assert.equal(publicNode.artifactId,result.outcome.id);assert.equal(publicNode.spec.id,'copy');
  for(const privateField of ['attempt','fence','leaseUntil','runId','history','engineEpoch','recoveryRunId'])
    assert.equal(Object.hasOwn(publicNode,privateField),false,`Public node topology must not disclose ${privateField}`);
  const {artifact:planArtifact,plan:acceptedPlan}=acceptedPlanEvidence(f),acceptedNode=acceptedPlan.nodes.find(node=>node.id==='copy');
  assert.ok(acceptedNode);assert.equal(acceptedPlan.finalNodeId,'copy');assert.deepEqual(finalArtifact.payload.criteria,acceptedNode.criteria);
  assert.ok(acceptedPlan.requirements.every(requirement=>requirement.criteria.every(criterion=>
    finalArtifact.payload.criteria.some(frozen=>frozen.text===criterion.text&&(frozen.evaluation??'content')===(criterion.evaluation??'content')))));
  const proof=inputCopyEvidence(f.engine.registry,result.outcome.id);
  assert.equal(proof.selection.body,text);assert.equal(proof.binding.missionId,f.mission.id);
  assert.ok(proof.chronology.mission<proof.chronology.plan&&proof.chronology.plan<proof.chronology.run
    &&proof.chronology.run<proof.chronology.origin&&proof.chronology.origin<proof.chronology.candidate);
  const producer=f.engine.store.get('run',finalArtifact.payload.producerRunId),judge=f.calls.find(c=>c.candidate?.payload.kind===INPUT_COPY_KIND);
  assert.equal(producer.version,1);assert.equal(producer.data.inferenceReceipt,undefined);assert.equal(producer.data.providerThreadId,null);
  assert.equal(judge.exposure.missionIntent,intent);assert.ok(judge.exposure.artifacts.some(a=>a.payload.purpose==='plan'));
  assert.equal(JSON.parse(judge.exposure.runtimeObservations.find(o=>o.kind==='artifact-input-copy').quoteText).detail.selection.body,text);
  assert.equal(materializeInputCopy(f.engine.registry,producer.id).id,result.outcome.id,'Native materialization is idempotent');
  assert.throws(()=>f.engine.registry.create(finalArtifact.payload),{code:'INPUT_COPY_INTEGRITY'},'Native identity cannot create a second candidate');
  assert.throws(()=>f.engine.registry.create({...finalArtifact.payload,kind:'deterministic-result'}),{code:'INPUT_COPY_INTEGRITY'});
  const planReview=f.engine.store.get('review',planArtifact.reviews.at(-1)).data,finalReview=f.engine.store.get('review',finalArtifact.reviews.at(-1)).data;
  assert.equal(planReview.result.decision,'ACCEPT');assert.equal(finalReview.result.decision,'ACCEPT');
  assert.notEqual(planReview.reviewerRunId,finalReview.reviewerRunId,'Plan and product require independent accepted reviews');
  const report=missionReport(f.engine.store,f.mission.id,{registry:f.engine.registry}),serialized=JSON.stringify(report);
  assert.deepEqual(report.final,result.outcome);assert.deepEqual(report.effects,[]);assert.deepEqual(report.timeline,[]);
  assert.equal(report.metrics.integrity,'NOT_ATTESTED');assert.equal(report.metrics.operationalTelemetry,'NOT_PROJECTED');
  assert.equal(report.metrics.correctionTelemetry,'NOT_PROJECTED');assert.equal(report.metrics.usageTelemetry,'NOT_PROJECTED');
  assert.equal(Object.hasOwn(report.metrics,'dispatched'),false);assert.equal(report.nodes.length,1);
  assert.equal(report.nodes[0].id,'copy');assert.equal(report.nodes[0].artifactId,result.outcome.id);
  for(const privateField of ['runId','history','attempt','fence','leaseUntil','producerRunId'])
    assert.equal(Object.hasOwn(report.nodes[0],privateField),false,`Report topology must not disclose ${privateField}`);
  for(const privateValue of [producer.id,planReview.reviewerRunId,finalReview.reviewerRunId])
    assert.equal(serialized.includes(privateValue),false,`Report must not disclose private actor ${privateValue}`);
  assert.match(formatMissionReport(report),/copia literal nativa \(sin inferencia productora\)/);
  const before=f.engine.store.verifyJournal();
  const stable=(ignoreValidationId='')=>sha256(f.engine.store.db.prepare("SELECT type,id,version,hash FROM records WHERE type!='engine' AND NOT(type='workspace-validation' AND id=?) ORDER BY type,id,version").all(ignoreValidationId).map(r=>({...r})));
  const beforeCore=stable();
  f.reopen();assert.equal((await f.run()).mission.status,'COMPLETED');assert.equal(f.calls.length,3);assert.ok(f.engine.store.verifyJournal());
  const reentryEvents=f.engine.store.events({after:before.events,limit:1000});assert.equal(reentryEvents.length,4);
  assert.deepEqual(reentryEvents.map(e=>[e.kind,e.data.type??null]),[['record.committed','engine'],['record.committed','workspace-validation'],['workspace.validation',null],['record.committed','engine']]);
  const validationRecord=f.engine.store.get('workspace-validation',reentryEvents[2].data.validationId),validation=f.engine.authority.open(validationRecord.data.signed,'workspace.validation');
  assert.equal(validationRecord.version,1);assert.equal(validationRecord.id,reentryEvents[1].data.id);assert.equal(validation.artifactId,result.outcome.id);
  assert.equal(validation.artifactHash,result.outcome.payloadHash);assert.equal(validation.status,'UNCHANGED');assert.deepEqual(validation.files,[]);assert.deepEqual(validation.executions,[]);
  assert.equal(stable(validationRecord.id),beforeCore,'No earlier non-engine record changes or new material work on reentry');
});

test('downstream work waits for native review and inherits exact provenance; plan revocation invalidates both',async t=>{
  const f=fixture(t,{consumer:true}),result=await f.run();assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(f.calls.length,5);assert.deepEqual(f.calls.map(c=>c.type),['plan','review','review','produce','review']);
  const original=result.nodes.find(node=>node.id==='copy'),consumer=result.nodes.find(node=>node.id==='consume');
  assert.ok(original&&consumer,'Public topology contains both accepted planned nodes');
  const originalArtifact=f.engine.registry.assertUsable(original.artifactId,{missionId:f.mission.id,purpose:'raw-object'}),
    consumed=f.engine.registry.assertUsable(consumer.artifactId,{missionId:f.mission.id,purpose:'delivery'});
  assert.equal(originalArtifact.payload.body,text);assert.equal(consumed.payload.body,text);
  assert.ok(consumed.payload.inputRefs.some(r=>r.artifactId===original.artifactId&&r.hash===originalArtifact.payloadHash));
  const evidence=f.calls.find(c=>c.type==='produce').exposure.runtimeObservations.find(o=>o.kind==='artifact-input-copy');assert.ok(evidence);
  const planId=f.engine.store.get('plan',f.mission.id).data.acceptedPlanArtifactId;
  f.engine.registry.invalidate([planId],{reason:'Explicit test revocation; not permission to rerun.'});
  assert.equal(f.engine.store.get('artifact',original.artifactId).data.status,'INVALIDATED');
  assert.equal(f.engine.store.get('artifact',consumer.artifactId).data.status,'INVALIDATED');
  const calls=f.calls.length;f.reopen();assert.notEqual((await f.run()).mission.status,'COMPLETED');assert.equal(f.calls.length,calls);
});

test('quota after native candidate creation resumes its review without another native identity or model producer',async t=>{
  let quota=false;const f=fixture(t,{respond:({candidate,value})=>{if(candidate?.payload.kind===INPUT_COPY_KIND&&!quota){quota=true;throw Object.assign(Error('Simulated quota'),{code:'QUOTA'});}return value;}});
  assert.equal((await f.run()).mission.status,'WAITING_QUOTA');const origin=f.engine.store.list('input-copy-origin')[0],a=f.engine.store.list('artifact').find(r=>r.data.payload.kind===INPUT_COPY_KIND);
  f.reopen();const result=await f.run();assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(result.outcome.id,a.id);assert.equal(f.engine.store.list('input-copy-origin').length,1);assert.equal(f.engine.store.get('input-copy-origin',origin.id).hash,origin.hash);
});

test('material rejection is preserved and never voted away by making the same literal copy again',async t=>{
  const f=fixture(t,{respond:({candidate,value})=>candidate?.payload.kind===INPUT_COPY_KIND?{...value,decision:'RETURN',checks:value.checks.map(c=>({...c,verdict:'FAIL'})),
    findings:[{severity:'material',description:'Simulated wrong object selection despite matching bytes.',recovery:'Replan the source selection, do not recopy or revote.'}]}:value});
  assert.equal((await f.run()).mission.status,'NEEDS_DIRECTION');const calls=f.calls.length;
  f.reopen();assert.equal((await f.run()).mission.status,'NEEDS_DIRECTION');assert.equal(f.calls.length,calls);
  assert.equal(f.engine.store.list('input-copy-origin').length,1);assert.equal(f.engine.store.list('artifact').find(r=>r.data.payload.kind===INPUT_COPY_KIND).data.status,'RETURNED');
});

test('a body-only acceptance without native source evidence is rejected',async t=>{
  const f=fixture(t,{respond:({candidate,value})=>candidate?.payload.kind===INPUT_COPY_KIND?{...value,checks:value.checks.map(c=>({...c,evidence:c.evidence.filter(e=>e.kind==='artifact')}))}:value});
  const result=await f.run();assert.notEqual(result.mission.status,'COMPLETED');
  assert.ok(result.mission.pending.some(p=>p.code==='INPUT_COPY_PROOF'),JSON.stringify(result.mission.pending));
  assert.equal(f.engine.store.list('artifact').find(r=>r.data.payload.kind===INPUT_COPY_KIND).data.status,'CANDIDATE');
});

test('native copy invalidates on request/plan/producer change, and cannot gain factual claims',async t=>{
  const f=fixture(t),result=await f.run();assert.equal(result.mission.status,'COMPLETED');
  const {store,registry}=f.engine,a=result.outcome,artifact=acceptedDelivery(f,a,'raw-object'),scope={missionId:f.mission.id,purpose:artifact.payload.purpose};
  const {plan:acceptedPlan}=acceptedPlanEvidence(f),copyNode=acceptedPlan.nodes.find(node=>node.id==='copy');assert.ok(copyNode);
  const nativeCount=store.list('input-copy-origin').length;
  assert.equal(registerInputCopyRun(registry,f.mission.id,copyNode,{recoverRunId:artifact.payload.producerRunId}).id,artifact.payload.producerRunId);
  assert.throws(()=>registerInputCopyRun(registry,f.mission.id,copyNode,{recoverRunId:'run:missing-origin'}),{code:'INPUT_COPY_INTEGRITY'});
  assert.equal(store.list('input-copy-origin').length,nativeCount,'Recovery never substitutes a new identity for an absent origin');
  for(const mutate of [
    ()=>{const r=store.get('mission',f.mission.id);store.put('mission',r.id,{...r.data,intent:r.data.intent+' changed',intentHash:sha256(r.data.intent+' changed')},{expectedVersion:r.version});},
    ()=>{const r=store.get('plan',f.mission.id);store.put('plan',r.id,{...r.data,acceptedPlanArtifactId:'artifact:foreign'},{expectedVersion:r.version});},
    ()=>{const r=store.get('run',artifact.payload.producerRunId);store.put('run',r.id,{...r.data,providerThreadId:'reused-thread'},{expectedVersion:r.version});},
  ]){const stop=Error('rollback isolated mutation');assert.throws(()=>store.transact(()=>{mutate();assert.throws(()=>registry.assertUsable(a.id,scope));
    assert.throws(()=>registerInputCopyRun(registry,f.mission.id,copyNode,{recoverRunId:artifact.payload.producerRunId}));throw stop;}),error=>error===stop);}
  const run=registerInputCopyRun(registry,f.mission.id,copyNode),base={...artifact.payload,producerRunId:run.id};
  assert.throws(()=>registry.create({...base,body:'different'}),{code:'INPUT_COPY_INTEGRITY'});
  assert.throws(()=>registry.create({...base,criteria:base.criteria.slice(1)}),{code:'INPUT_COPY_INTEGRITY'});
  assert.throws(()=>registry.create({...base,claims:[{id:'claim',text:'Copied text is a fact',kind:'fact',sources:[],basis:[],qualifiers:[],validUntil:null}]}),{code:'UNSUPPORTED_FACT'});
  assert.equal(registry.assertUsable(a.id,scope).id,a.id);assert.ok(store.verifyJournal());
});

for(const span of [false,true])for(const phase of ['registered','claimed','materialized','accepted'])
test(`REAL native ${span?'span':'copy'} controller exit at ${phase} preserves its exact origin and committed work`,async t=>{
  const f=fixture(t,{span}),proposal=plan();if(span)proposal.nodes[0].execution=structuredClone(spanExecution);
  const child=spawnSync(process.execPath,[new URL('./fixtures/input-copy-controller.mjs',import.meta.url).pathname,
    f.directory,f.mission.id,phase,JSON.stringify(proposal)],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  assert.equal(child.signal,null,child.stderr);assert.equal(child.status,86,child.stderr);
  const origins=f.engine.store.list('input-copy-origin');assert.equal(origins.length,phase==='registered'?0:1);
  const original=origins[0],candidate=f.engine.store.list('artifact').find(r=>r.data.payload.kind===INPUT_COPY_KIND);
  assert.equal(!!candidate,!['registered','claimed'].includes(phase));
  if(candidate)assert.equal(candidate.data.status,phase==='accepted'?'ACCEPTED':'CANDIDATE');
  const dispatchedBefore=privateInferenceReceiptCount(f.engine,f.mission.id);
  f.reopen();const result=await f.run();assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  const artifact=acceptedDelivery(f,result.outcome,'raw-object');
  assert.equal(f.engine.store.list('input-copy-origin').length,1,'A durable native origin must be reused, not abandoned and registered again');
  if(original){assert.equal(f.engine.store.get('input-copy-origin',original.id).hash,original.hash);
    assert.equal(artifact.payload.producerRunId,original.id);}
  assert.equal(result.outcome.payload.body,text);
  if(candidate)assert.equal(result.outcome.id,candidate.id,'Do not reproduce a committed candidate');
  assert.equal(f.calls.length,phase==='accepted'?0:1,'Only the missing material review may infer after recovery');
  assert.equal(privateInferenceReceiptCount(f.engine,f.mission.id),dispatchedBefore+f.calls.length);
  const report=missionReport(f.engine.store,f.mission.id,{registry:f.engine.registry});
  assert.deepEqual(report.final,result.outcome);assert.deepEqual(report.effects,[]);assert.deepEqual(report.timeline,[]);
  assert.equal(report.metrics.integrity,'NOT_ATTESTED');assert.equal(report.metrics.operationalTelemetry,'NOT_PROJECTED');
  assert.equal(Object.hasOwn(report.metrics,'dispatched'),false);assert.ok(f.engine.store.verifyJournal());
});
