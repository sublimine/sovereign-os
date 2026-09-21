import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {ToolBroker} from '../../factory/tools/broker.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {documentContextRequestEvidence} from '../../factory/lib/document-context-frames.mjs';
import {prepareDocumentSession,applyDocumentOperation} from '../../factory/lib/documentary-session.mjs';
import {revokeSourceManifestGrant} from '../../factory/lib/source-manifest-grants.mjs';
import {expandDocumentClaims,expandDocumentReview} from '../../factory/lib/documentary-material.mjs';
import {missionReport} from '../../factory/lib/report.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {productionScope} from '../../factory/lib/production-scope.mjs';
import {documentSessionView} from '../../factory/lib/documentary-session.mjs';
import {documentaryEligible,documentaryRun} from '../../factory/lib/documentary-mode.mjs';
import {validateDocumentClaims,validateDocumentReview} from '../../factory/lib/documentary-material.mjs';
import {LearningService} from '../../factory/lib/learning-service.mjs';
import {missionInferenceBudget} from '../../factory/lib/mission-inference-budget.mjs';
import {auditRouteLineage} from '../../reconstruction/verification/full-route-audit.mjs';
import {DOCUMENTARY_CASE} from '../../reconstruction/verification/run-live-documentary.mjs';
import {FULL_ROUTE_CASES} from '../../reconstruction/verification/full-route-cases.mjs';
import {fullRoutePolicy} from '../../reconstruction/verification/full-route-harness.mjs';
import {runDocumentaryReviewRetest,closedDatabaseHash} from '../../reconstruction/verification/documentary-review-retest.mjs';
import {fileURLToPath} from 'node:url';

const intent='Verify the acquired count, preserve limitations and independently inspect its support.';
const node={id:'document',purpose:'document-report',roleIds:['sigma_01'],reviewerRoleIds:['sigma_02'],instructions:intent,outputKind:'report',tools:['source.fetch'],requiredEffects:[],
  criteria:[{id:'support',text:'Correct count with actual raw support and limitations.'},{id:'independent',text:'Independent reviewer.',evaluation:'runtime.independent_review'}]};
const sourceClaim=key=>({id:'count',text:'The acquired fixture says count=17.',kind:'fact',sources:[{sourceKey:key,quote:'count=17'}],basis:[],qualifiers:['Synthetic fixture, not a real-world claim.'],validUntil:null});
const final=claims=>({action:'final',tool:'',argsJson:'',body:'The fixture reports count=17; no claim about omitted context or external truth.',claims,method:'cite-own-observed-window',reason:''});
const producerOperation=(tool,args)=>({action:tool==='source.fetch'?'tool':'document',tool,argsJson:JSON.stringify(args),body:'',claims:[],method:'read-own-authorized-snapshot',reason:''});
const inactive=task=>({artifactHash:task.artifactHash,purpose:task.purpose,decision:'UNKNOWN',checks:[],findings:[],uncertainty:''});
// The provider enforces JSON Schema array bounds. Worker validateShape alone
// did not: simulations previously accepted checks:[] against minItems:11.
// Check the emitted grammar independently, before invoking the worker validator.
function assertWireArrayBounds(value,schema,pointer='$'){
  if(schema.type==='array'){
    assert.ok(Array.isArray(value),pointer+' must be an array');
    if(schema.minItems!==undefined)assert.ok(value.length>=schema.minItems,pointer+' violates wire minItems='+schema.minItems);
    if(schema.maxItems!==undefined)assert.ok(value.length<=schema.maxItems,pointer+' violates wire maxItems='+schema.maxItems);
    value.forEach((v,i)=>assertWireArrayBounds(v,schema.items,pointer+'['+i+']'));
  }else if(schema.type==='object')for(const [key,child] of Object.entries(schema.properties))assertWireArrayBounds(value[key],child,pointer+'.'+key);
}
function response({exposure,task,run,options}){
  const grants=exposure.documentSourceGrants,windows=exposure.documentEvidenceCatalog.filter(e=>e.kind==='source-window');
  if(run.mode==='producer'){
    if(!grants.length)return producerOperation('source.fetch',{url:'https://example.com/source'});
    if(!windows.length){
      if(!exposure.documentNavigation.operations.length)return producerOperation('source.locate',{grantId:grants[0].grant.id,literal:'count=17'});
      return producerOperation('source.read',{grantId:grants[0].grant.id,ranges:[{startByte:0,maxBytes:128}]});
    }
    return final([sourceClaim(windows[0].sourceKey)]);
  }
  if(!windows.length&&!options.omitReviewerRead){
    return {action:'document',tool:'source.read',argsJson:JSON.stringify({grantId:grants[0].grant.id,ranges:[{startByte:0,maxBytes:128}]}),method:'independent-original-window',result:inactive(task)};
  }
  const e=windows[0]??exposure.documentEvidenceCatalog.find(e=>e.kind==='artifact-body');
  return {action:'review',tool:'',argsJson:'',method:'compare-independent-literal-support',result:{...inactive(task),decision:'ACCEPT',checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',
    evidence:[{sourceKey:e.sourceKey,quote:windows.length?'count=17':'fixture reports count=17',usage:windows.length?'source':'artifact'}],reason:'Synthetic judge checks the exact raw support; not a live qualification.'})),uncertainty:'Synthetic source and judge only.'}};
}
function setup(t,options={}){
  const spec=options.node??node;
  const directory=mkdtempSync(join(tmpdir(),'sovereign-documentary-test-')),store=new Store(':memory:'),authority=new Authority(store),registry=new ArtifactRegistry(store,authority);
  const raw=options.raw??'HEAD count=17. Limit: fixture, not a population estimate.\r\n'+'z'.repeat(300)+'OMITTED_TAIL count=99.';
  const broker=new ToolBroker({store,authority,workspaceRoot:join(directory,'workspaces'),lookup:async()=>[{address:'93.184.216.34',family:4}],
    transport:async()=>({statusCode:200,headers:{'content-type':'text/plain'},body:Buffer.from(raw),remoteAddress:'93.184.216.34'})});
  if(!options.deferMission){broker.registerWorkspace('m');
    store.put('mission','m',{id:'m',intent,intentHash:sha256(intent),policy:{allowedTools:spec.tools,model:'gpt-6-astra',reasoningEffort:'ultra',
      documentContext:'literal-windows-v1',...(options.encoding?{contextEncoding:options.encoding}:{}),...(options.reviewEncoding?{reviewEncoding:options.reviewEncoding}:{})}},{expectedVersion:0});}
  let count=0,closed=0;const calls=[];
  const providerFactory=()=>({async generate(request){
    const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task),run=store.list('run').find(r=>r.data.expectedRequestHash===inferenceRequestHash(request)).data;
    count++;calls.push({runId:run.id,request,exposure,task});
    const value=options.respond?await options.respond({request,exposure,task,run,count,store,registry,options}):response({exposure,task,run,options});
    assertWireArrayBounds(value,request.schema);
    assert.equal(await request.validate(value),true);
    return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:'document-synthetic-'+count,turnId:'turn-'+count,contextHash:inferenceRequestHash(request),model:request.model,reasoningEffort:request.reasoningEffort}};
  },async close(){closed++;}});
  const workers=new WorkerService({store,authority,registry,broker,providerFactory,maxReviewRepairs:0,...(options.workerOptions??{})});
  const producer=options.deferMission?null:workers.createRun({missionId:'m',nodeId:spec.id,mode:'producer',purpose:spec.purpose,roleIds:spec.roleIds});
  const produce=()=>workers.produce({missionId:'m',node:spec,runId:producer.id,feedback:['Preserve the previous validation result.']});
  const review=artifact=>workers.review({artifact,reviewerRoleIds:spec.reviewerRoleIds,missionIntent:intent});
  t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
  return {store,registry,authority,broker,workers,producer,produce,review,raw,calls,providerFactory,get count(){return count;},get closed(){return closed;}};
}

// Generic mission reports intentionally do not turn private actor, request,
// correction, operation or reservation evidence into public telemetry. Keep
// that boundary explicit while the documentary tests inspect their exact,
// durable counterparts below.
function assertPublicOperationalRedaction(report,{inferenceBudget=false}={}){
  assert.deepEqual(report.reviews,[]);assert.deepEqual(report.effects,[]);assert.deepEqual(report.timeline,[]);
  assert.ok(!Object.hasOwn(report,'documentary'));
  assert.ok(['NOT_ATTESTED','UNVERIFIED'].includes(report.metrics.integrity),'A generic report must not attest operational evidence');
  if(report.metrics.integrity==='UNVERIFIED'){
    assert.equal(report.metrics.operationalTelemetry,undefined);assert.equal(report.metrics.correctionTelemetry,undefined);
    assert.equal(report.metrics.usageTelemetry,undefined);assert.equal(report.inferenceBudget,undefined);return;
  }
  assert.equal(report.metrics.operationalTelemetry,'NOT_PROJECTED');
  assert.equal(report.metrics.correctionTelemetry,'NOT_PROJECTED');
  assert.equal(report.metrics.usageTelemetry,'NOT_PROJECTED');
  assert.equal(report.metrics.correctionRequests,undefined);assert.equal(report.metrics.failed,undefined);
  if(inferenceBudget){
    assert.equal(report.inferenceBudget?.integrity,'NOT_PROJECTED');
    assert.equal(report.inferenceBudget?.byKind,undefined);assert.equal(report.inferenceBudget?.remaining,undefined);
  }
}

// Reconstruct each completed documentary input from the immutable prospective
// request, then let ArtifactRegistry revalidate its signed frame, chronology
// and completed synthetic receipt. This is deliberately not the provider-call
// capture: the Store is the test's source of truth after a restart.
function durableDocumentaryRequests(f,actorRecord){
  const actor=actorRecord.data??actorRecord,seen=new Set(),receipts=actor.inferenceReceipts??[];
  assert.ok(receipts.length>0,'A documentary actor must retain completed requests');
  return receipts.map(receipt=>{
    const requestHash=receipt.contextHash;
    assert.equal(typeof requestHash,'string');assert.ok(!seen.has(requestHash),'A completed documentary request cannot be retained twice');seen.add(requestHash);
    const requestRecord=f.store.get('inference-request','inference-request:'+sha256([actor.id,requestHash]));
    assert.ok(requestRecord,'Every completed documentary receipt needs its exact BEFORE_DISPATCH request');
    const request=JSON.parse(requestRecord.data.requestJson),exposure=readSourceContextView(request.input),frameId=exposure.documentContextFrame?.id;
    assert.equal(inferenceRequestHash(request),requestHash);assert.equal(typeof frameId,'string');
    const evidence=documentContextRequestEvidence(f.registry,{runId:actor.id,frameId,requestHash});
    assert.equal(evidence.requestRecord.id,requestRecord.id);assert.equal(evidence.inference.simulation,true);
    return {receipt,requestRecord,request,exposure,evidence,task:JSON.parse(exposure.task)};
  });
}

for(const method of ['expand-claims','validate-claims','expand-review','validate-review'])test('material consumers reconstruct one complete frame per '+method,async t=>{
  const f=setup(t),a=await f.produce(),accepted=await f.review(a),r=f.store.get('review',accepted.reviews.at(-1)).data;
  const producer=f.store.get('run',a.payload.producerRunId).data,judge=f.store.get('run',r.reviewerRunId).data;
  const binding=d=>({frameId:d.frameId,requestHash:d.requestHash});
  const rawClaims=a.payload.claims.map(c=>({...c,sources:c.sources.map((s,index)=>({sourceKey:a.payload.documentary.claims.find(q=>q.claimId===c.id&&q.index===index).sourceKey,quote:s.quote}))}));
  const ids=new Set(a.payload.criteria.filter(c=>(c.evaluation??'content')==='content').map(c=>c.id));
  const contentResult={...r.result,checks:r.result.checks.filter(c=>ids.has(c.criterionId))};
  const rawReview={...contentResult,checks:contentResult.checks.map(c=>({...c,evidence:c.evidence.map((e,index)=>{
    const s=r.documentary.checks.find(q=>q.criterionId===c.criterionId&&q.index===index);return {sourceKey:s.sourceKey,quote:e.quote,usage:s.usage};
  })}))};
  const before=f.store.verifyJournal();let reads=0,result;const get=f.store.get.bind(f.store);
  f.store.get=(type,...args)=>{if(type==='document-context-frame')reads++;return get(type,...args);};
  try{
    if(method==='expand-claims')result=expandDocumentClaims(f.registry,producer,binding(a.payload.documentary),rawClaims);
    else if(method==='validate-claims')validateDocumentClaims(f.registry,producer,a.payload.claims,a.payload.documentary,{latest:true});
    else if(method==='expand-review')result=expandDocumentReview(f.registry,judge,binding(r.documentary),rawReview,a);
    else validateDocumentReview(f.registry,judge,r.result,a,r.documentary,{latest:true});
  }finally{f.store.get=get;}
  assert.equal(reads,1,'Complete exposure is authenticated by the same batch that checks each exact citation');
  if(method==='expand-claims')assert.deepEqual(result,{claims:a.payload.claims,documentary:a.payload.documentary});
  if(method==='expand-review')assert.deepEqual(result,{result:contentResult,documentary:r.documentary});
  assert.deepEqual(f.store.verifyJournal(),before);
});

test('local documentary operations authenticate their completed frame once before committing navigation',async t=>{
  const f=setup(t),get=f.store.get.bind(f.store),put=f.store.put.bind(f.store),observed=[];let active=false,reads=0;
  f.store.get=(type,...args)=>{if(active&&type==='document-context-frame')reads++;return get(type,...args);};
  f.store.put=(type,id,data,options)=>{
    const result=put(type,id,data,options);
    if(type==='worker-proposal'&&data.value.action==='document'){active=true;reads=0;}
    if(type==='document-operation'){observed.push({tool:data.tool,reads});active=false;}
    return result;
  };
  try{await f.produce();}finally{f.store.get=get;f.store.put=put;}
  assert.deepEqual(observed,[{tool:'source.locate',reads:1},{tool:'source.read',reads:1}]);
  assert.equal(f.store.list('document-operation').length,2);assert.equal(f.store.list('effect').length,1);
});

function twoSourceResponse(args,{batched=true,mutate}={}){
  const {exposure,task,run}=args,grants=exposure.documentSourceGrants,windows=exposure.documentEvidenceCatalog.filter(e=>e.kind==='source-window');
  if(run.mode==='producer'&&!grants.length)return {...producerOperation('source.fetch',{}),action:'batch',tool:'',
    argsJson:JSON.stringify(['source','second'].map(path=>({tool:'source.fetch',args:{url:'https://example.com/'+path}})))};
  const n=exposure.documentNavigation.operations.length;
  let operations;
  if(run.mode==='producer'&&n<(batched?2:4)){
    const locate=n<(batched?1:2),selected=batched?grants:[grants[n%2]];
    operations=selected.map(g=>({tool:locate?'source.locate':'source.read',args:locate?{grantId:g.grant.id,literal:'count=17'}:
      {grantId:g.grant.id,ranges:[{startByte:0,maxBytes:128}]}}));
  }else if(run.mode==='reviewer'&&windows.length<2){
    operations=(batched?grants:[grants[windows.length]]).map(g=>({tool:'source.read',args:{grantId:g.grant.id,ranges:[{startByte:0,maxBytes:128}]}}));
  }
  if(operations){
    const tool=batched?'source.batch':operations[0].tool,opArgs=batched?{operations}:operations[0].args;
    mutate?.(opArgs,args);
    return run.mode==='producer'?producerOperation(tool,opArgs):
      {action:'document',tool,argsJson:JSON.stringify(opArgs),method:'independent-two-source-inspection',result:inactive(task)};
  }
  if(run.mode==='producer')return final(windows.map((w,i)=>({...sourceClaim(w.sourceKey),id:'count_'+i})));
  return {action:'review',tool:'',argsJson:'',method:'judge-both-own-windows',result:{...inactive(task),decision:'ACCEPT',
    checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',evidence:windows.map(w=>({sourceKey:w.sourceKey,quote:'count=17',usage:'source'})),
      reason:'Two explicitly synthetic sources inspected, not independent real-world corroboration.'})),uncertainty:'Fixture only.'}};
}
for(const encoding of ['plain-json','lossless-json-v2','source-text-v1'])test('document batch '+encoding+' preserves two-source support with fewer simulated proposals',async t=>{
  const results=[];
  for(const batched of [false,true]){
    const f=setup(t,{encoding,respond:args=>twoSourceResponse(args,{batched})}),candidate=await f.produce(),accepted=await f.review(candidate);
    assert.equal(accepted.status,'ACCEPTED');assert.equal(f.count,batched?6:9);assert.equal(f.store.list('effect').length,2);
    assert.ok(f.calls.every(c=>c.request.instructions.includes('source.batch argsJson=')&&c.request.schema.properties.tool.enum.includes('source.batch')));
    const review=f.store.get('review',accepted.reviews.at(-1)).data,judge=f.workers.run(review.reviewerRunId);
    assert.equal(f.calls.find(c=>c.runId===judge.id).exposure.documentSourceViews.length,0);
    validateDocumentClaims(f.registry,f.workers.run(f.producer.id),accepted.payload.claims,accepted.payload.documentary);
    validateDocumentReview(f.registry,judge,review.result,accepted,review.documentary);
    const nav=documentSessionView(f.registry,f.producer.id).navigation;assert.equal(nav.remainingOperations,20);
    assert.equal(documentSessionView(f.registry,judge.id).navigation.remainingOperations,22);
    assert.equal(nav.operations.length,batched?2:4);
    const before=f.store.verifyJournal();for(const o of f.store.list('document-operation')){
      assert.deepEqual(applyDocumentOperation(f.registry,o.data),o.data);
      if(o.data.tool==='source.batch'){
        const changed=structuredClone(o.data);changed.args.operations.reverse();
        assert.throws(()=>applyDocumentOperation(f.registry,changed),{code:'IDEMPOTENCY_CONFLICT'});
      }
    }
    assert.deepEqual(f.store.verifyJournal(),before,'exact completed replay spends nothing and changes no records');
    results.push({body:accepted.payload.body,claims:accepted.payload.claims.map(c=>({...c,sources:c.sources.map(s=>({quote:s.quote,hash:s.hash}))}))});
  }
  assert.deepEqual(results[0],results[1]);
});
for(const mode of ['missing-grant','bad-last-range','duplicate-grant','nested','external-tool','too-many','extra-key'])test('document batch rejects '+mode+' without partial local selections',async t=>{
  const f=setup(t,{respond:args=>twoSourceResponse(args,{mutate:(operation,{run})=>{
    if(run.mode!=='producer')return;
    operation.operations=operation.operations.map(o=>({tool:'source.read',args:{grantId:o.args.grantId,ranges:[{startByte:0,maxBytes:128}]}}));
    if(mode==='missing-grant')operation.operations[1].args.grantId='source-manifest-grant:missing';
    if(mode==='bad-last-range')operation.operations[1].args.ranges[0].maxBytes=9999999;
    if(mode==='duplicate-grant')operation.operations[1].args.grantId=operation.operations[0].args.grantId;
    if(mode==='nested')operation.operations[1]={tool:'source.batch',args:{operations:[]}};
    if(mode==='external-tool')operation.operations[1]={tool:'source.fetch',args:{url:'https://example.com/third'}};
    if(mode==='too-many')operation.operations=Array.from({length:9},()=>operation.operations[0]);
    if(mode==='extra-key')operation.parallel=true;
  }})});
  await assert.rejects(f.produce(),e=>['DOCUMENT_GRANT','SCHEMA','DOCUMENT_PROTOCOL','DOCUMENT_BATCH','SOURCE_WINDOW_LIMIT'].includes(e.code));
  assert.equal(f.store.list('source-window-selection').length,0);assert.equal(f.store.list('document-operation').length,0);
  assert.equal(f.store.list('effect').length,2);assert.equal(f.store.list('artifact').length,0);
  assert.deepEqual(f.store.get('document-session',f.producer.id).data.selectionIds,[]);
});
test('document batch rolls back its own partial changes even when a caller catches failure inside a transaction',async t=>{
  const f=setup(t,{respond:args=>twoSourceResponse(args,{mutate:op=>{
    op.operations=op.operations.map(o=>({tool:'source.read',args:{grantId:o.args.grantId,ranges:[{startByte:0,maxBytes:128}]}}));
    op.operations[1].args.ranges[0].maxBytes=9999999;
  }})});
  await assert.rejects(f.produce(),{code:'SCHEMA'});
  const call=f.calls.at(-1),proposal=f.store.get('worker-proposal',`${call.runId}:proposal:${call.task.step}`).data.value;
  f.store.transact(()=>{
    f.store.put('fixture','caller-write',{preserved:true},{expectedVersion:0});const before=f.store.verifyJournal();
    assert.throws(()=>applyDocumentOperation(f.registry,{runId:call.runId,frameId:call.exposure.documentContextFrame.id,
      requestHash:inferenceRequestHash(call.request),tool:proposal.tool,args:JSON.parse(proposal.argsJson)}),{code:'SCHEMA'});
    assert.deepEqual(f.store.verifyJournal(),before,'the failed batch must not leak first-member records into the caller commit');
  });
  assert.equal(f.store.get('fixture','caller-write').data.preserved,true);assert.equal(f.store.list('source-window-selection').length,0);
});
for(const mode of ['windows','bytes'])test('document batch preserves aggregate '+mode+' cap with all-or-nothing selection',async t=>{
  const f=setup(t,{raw:'count=17 '+'z'.repeat(210000),respond:args=>twoSourceResponse(args,{mutate:op=>{
    op.operations=op.operations.map((o,i)=>({tool:'source.read',args:{grantId:o.args.grantId,
      ranges:Array.from({length:mode==='windows'?(i===0?9:8):3},(_,j)=>({startByte:j*(mode==='windows'?4:65536),maxBytes:mode==='windows'?4:65536}))}}));
  }})});
  await assert.rejects(f.produce(),{code:'DOCUMENT_LIMIT'});assert.equal(f.store.list('source-window-selection').length,0);
  assert.equal(f.store.list('document-operation').length,0);assert.equal(f.store.list('effect').length,2);
});
test('document batch charges each member against the 24-operation ceiling',async t=>{
  const f=setup(t,{workerOptions:{maxSteps:20},respond:args=>{
    if(!args.exposure.documentSourceGrants.length)return twoSourceResponse(args);
    return producerOperation('source.batch',{operations:args.exposure.documentSourceGrants.map(g=>({tool:'source.locate',args:{grantId:g.grant.id,literal:'count=17'}}))});
  }});
  await assert.rejects(f.produce(),{code:'DOCUMENT_LIMIT'});assert.equal(f.count,14);
  assert.equal(f.store.list('document-operation').length,12);assert.equal(documentSessionView(f.registry,f.producer.id).navigation.remainingOperations,0);
  const before=f.store.verifyJournal(),operation=f.store.list('document-operation')[0];
  assert.deepEqual(applyDocumentOperation(f.registry,operation.data),operation.data);assert.deepEqual(f.store.verifyJournal(),before);
});
test('document batch rejects a producer grant in the independent judge and keeps the first own selection uncommitted',async t=>{
  let producerGrant;
  const f=setup(t,{respond:args=>{
    if(args.run.mode==='producer'&&args.exposure.documentSourceGrants.length)producerGrant=args.exposure.documentSourceGrants[0].grant.id;
    return twoSourceResponse(args,{mutate:(op,{run})=>{if(run.mode==='reviewer')op.operations[1].args.grantId=producerGrant;}});
  }}),candidate=await f.produce();
  await assert.rejects(f.review(candidate),{code:'DOCUMENT_GRANT'});
  assert.equal(f.store.list('source-window-selection').length,2);assert.equal(f.store.list('document-operation').length,2);
  assert.equal(f.store.list('review').length,0);assert.equal(f.store.get('artifact',candidate.id).data.status,'CANDIDATE');
});
test('document batch cannot run during inference or revive a grant revoked before its completion',async t=>{
  let checked=false;
  const f=setup(t,{respond:args=>{
    const value=twoSourceResponse(args);
    if(value.tool==='source.batch'&&!checked){
      checked=true;const before=args.store.verifyJournal();
      assert.throws(()=>applyDocumentOperation(args.registry,{runId:args.run.id,frameId:args.exposure.documentContextFrame.id,
        requestHash:inferenceRequestHash(args.request),tool:value.tool,args:JSON.parse(value.argsJson)}),{code:'INFERENCE_PENDING'});
      assert.deepEqual(args.store.verifyJournal(),before);
      revokeSourceManifestGrant(args.registry,args.exposure.documentSourceGrants[1].grant.id,{runId:args.run.id,reason:'Synthetic in-flight revocation.'});
    }
    return value;
  }});
  await assert.rejects(f.produce(),{code:'SOURCE_GRANT_REVOKED'});assert.equal(checked,true);
  assert.equal(f.store.list('document-operation').length,0);assert.equal(f.store.list('source-window-selection').length,0);
});
test('document batch can mix independent search and read while preserving each typed result',async t=>{
  const f=setup(t,{respond:args=>twoSourceResponse(args,{mutate:(op,{run,exposure})=>{
    if(run.mode==='producer'&&exposure.documentNavigation.operations.length===0)
      op.operations[0]={tool:'source.read',args:{grantId:op.operations[0].args.grantId,ranges:[{startByte:0,maxBytes:128}]}};
  }})});
  const accepted=await f.review(await f.produce());assert.equal(accepted.status,'ACCEPTED');
  const first=documentSessionView(f.registry,f.producer.id).navigation.operations[0];
  assert.deepEqual(first.result.operations.map(o=>o.tool),['source.read','source.locate']);
  assert.deepEqual(first.result.operations.map(o=>o.index),[0,1]);assert.equal(f.count,6);
});
test('document batch production does not let a judge accept after reading only one of two supports',async t=>{
  const f=setup(t,{respond:args=>{
    if(args.run.mode==='producer')return twoSourceResponse(args);
    const windows=args.exposure.documentEvidenceCatalog.filter(e=>e.kind==='source-window');
    if(!windows.length)return {action:'document',tool:'source.read',argsJson:JSON.stringify({grantId:args.exposure.documentSourceGrants[0].grant.id,
      ranges:[{startByte:0,maxBytes:128}]}),method:'partial-own-read',result:inactive(args.task)};
    return {action:'review',tool:'',argsJson:'',method:'deliberately-missing-second-source',result:{...inactive(args.task),decision:'ACCEPT',
      checks:args.task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',evidence:[{sourceKey:windows[0].sourceKey,quote:'count=17',usage:'source'}],
        reason:'Negative fixture: one observed source does not establish observation of the other.'}))}};
  }}),candidate=await f.produce();
  await assert.rejects(f.review(candidate),{code:'DOCUMENT_UNOBSERVED'});assert.equal(f.store.list('review').length,0);
  assert.equal(f.store.get('artifact',candidate.id).data.status,'CANDIDATE');
});

for(const encoding of ['plain-json','lossless-json-v2','source-text-v1'])test('integrated '+encoding+' producer and judge select their own windows, accept and revalidate exact source support',async t=>{
  const f=setup(t,{encoding}),candidate=await f.produce();assert.equal(candidate.status,'CANDIDATE');
  assert.ok(candidate.payload.documentary);assert.equal(f.store.list('review').length,0);
  const accepted=await f.review(candidate);assert.equal(accepted.status,'ACCEPTED');
  const review=f.store.get('review',accepted.reviews.at(-1)).data;
  assert.ok(review.documentary);assert.notEqual(review.documentary.frameId,candidate.payload.documentary.frameId);
  assert.equal(f.count,6);assert.equal(f.closed,6);assert.equal(f.store.list('effect').length,1);
  assert.equal(f.store.list('document-operation').length,3);assert.equal(f.store.list('source-manifest-grant').length,2);
  for(const r of f.store.list('run'))assert.deepEqual(r.data.context.sourceIds,[]);
  for(const c of f.calls){
    assert.ok(c.request.instructions.includes('literal-windows-v1'));assert.ok(!JSON.stringify(c.exposure).includes('OMITTED_TAIL'));
    assert.equal(c.exposure.missionIntent,intent);assert.ok(c.exposure.documentNavigation);
    assert.equal(documentContextRequestEvidence(f.registry,{runId:c.runId,frameId:c.exposure.documentContextFrame.id,requestHash:inferenceRequestHash(c.request)}).inference.simulation,true);
  }
  const producerCalls=f.calls.filter(c=>c.runId===f.producer.id);assert.ok(producerCalls.every(c=>c.task.feedback[0]==='Preserve the previous validation result.'));
  const judgeCalls=f.calls.filter(c=>c.runId===review.reviewerRunId);assert.equal(judgeCalls[0].exposure.documentSourceViews.length,0);assert.equal(judgeCalls[0].exposure.documentNavigation.operations.length,0);
  assert.ok(judgeCalls.every(c=>c.task.criteria.length===1&&c.task.runtimeCriteria.length===1));
  const before=f.store.verifyJournal();assert.equal(f.registry.assertUsable(accepted.id,{missionId:'m',purpose:node.purpose}).payloadHash,accepted.payloadHash);assert.deepEqual(f.store.verifyJournal(),before);
  const durableJudge=durableDocumentaryRequests(f,f.store.get('run',review.reviewerRunId));
  const acceptedReview=durableJudge.find(r=>r.evidence.requestHash===review.documentary.requestHash);
  assert.equal(acceptedReview?.evidence.frameRecord.id,review.documentary.frameId);
  assertPublicOperationalRedaction(missionReport(f.store,'m'));assert.equal(f.store.list('source')[0].data.raw,f.raw);
});
test('a 2MiB source completes integrated documentary production and independent review without full-raw prompt copies',async t=>{
  const f=setup(t,{raw:'HEAD count=17. Source-specific limitation.\r\n'+'z'.repeat(2033807)+'OMITTED_TAIL',encoding:'lossless-json-v2'});
  const accepted=await f.review(await f.produce());assert.equal(accepted.status,'ACCEPTED');
  assert.ok(f.calls.every(c=>Buffer.byteLength(c.request.input)<100000));assert.equal(f.store.list('source')[0].data.raw,f.raw);assert.equal(f.count,6);
});
for(const count of [0,11])test('wire grammar permits inactive navigation then exact '+count+'-criterion judgment',async t=>{
  const spec={...node,criteria:[...Array.from({length:count},(_,i)=>({id:'support_'+i,text:'Inspect the synthetic count and limitation '+i})),node.criteria[1]]};
  const f=setup(t,{node:spec}),candidate=await f.produce(),accepted=await f.review(candidate);
  assert.equal(accepted.status,'ACCEPTED');
  const calls=f.calls.filter(c=>c.runId!==f.producer.id);
  assert.equal(calls.length,2);assert.equal(calls[0].exposure.documentSourceViews.length,0);
  for(const c of calls){
    assert.equal(c.request.schema.properties.result.properties.checks.minItems,0);
    assert.equal(c.request.schema.properties.result.properties.checks.maxItems,count);
    assert.deepEqual(c.task.criteria.map(c=>c.id),spec.criteria.slice(0,count).map(c=>c.id));
    assert.equal(c.task.runtimeCriteria.length,1);
  }
  assert.equal(f.store.list('review')[0].data.result.checks.length,count+1);
});
for(const mutation of ['empty','partial','duplicate'])test('navigation grammar does not permit a '+mutation+' final criterion set',async t=>{
  const spec={...node,criteria:[node.criteria[0],{id:'limits',text:'Preserve the synthetic scope.'},node.criteria[1]]};
  const f=setup(t,{node:spec,respond:args=>{
    const value=response(args);
    if(args.run.mode==='reviewer'&&value.action==='review'){
      if(mutation==='empty')value.result.checks=[];
      if(mutation==='partial')value.result.checks.pop();
      if(mutation==='duplicate')value.result.checks[1]=structuredClone(value.result.checks[0]);
    }
    return value;
  }}),candidate=await f.produce();
  await assert.rejects(f.review(candidate),{code:'REVIEW_COVERAGE'});
  assert.equal(f.store.get('artifact',candidate.id).data.status,'CANDIDATE');
  assert.equal(f.store.list('review').length,0);assert.equal(f.store.list('effect').length,1);
  assert.equal(f.store.list('worker-rejected-review')[0].data.code,'REVIEW_COVERAGE');
});
test('navigation cannot smuggle a substantive check even when its array fits the wire bounds',async t=>{
  const f=setup(t,{respond:args=>{
    const value=response(args);
    if(args.run.mode==='reviewer'&&value.action==='document')value.result.checks=[{criterionId:'support',verdict:'UNKNOWN',evidence:[],reason:'Must not judge before the local read.'}];
    return value;
  }}),candidate=await f.produce();
  await assert.rejects(f.review(candidate),{code:'DOCUMENT_PROTOCOL'});
  assert.equal(f.store.get('artifact',candidate.id).data.status,'CANDIDATE');
  assert.equal(f.store.list('review').length,0);
  assert.equal(f.store.list('document-operation').filter(r=>r.data.runId!==f.producer.id).length,0);
});
test('a body-only judge cannot borrow producer reading to accept factual claims',async t=>{
  const f=setup(t,{omitReviewerRead:true}),candidate=await f.produce();
  await assert.rejects(f.review(candidate),{code:'DOCUMENT_UNOBSERVED'});assert.equal(f.store.get('artifact',candidate.id).data.status,'CANDIDATE');assert.equal(f.store.list('review').length,0);
  assert.equal(f.store.list('worker-rejected-review').length,1);assert.equal(f.store.list('effect').length,1);
});
test('documentary input distinguishes historical preparation from literal windows already present in this request',async t=>{
  const f=setup(t),candidate=await f.produce();await f.review(candidate);
  for(const c of f.calls){
    const nav=c.exposure.documentNavigation;
    assert.deepEqual(nav.activeSelections,c.exposure.documentSourceViews.map(v=>({selectionId:v.selection.id,grantId:v.grantRecord.id,
      sourceId:v.source.id,sourceHash:v.source.hash,ranges:v.windows.map(w=>({startByte:w.startByte,endByte:w.endByte,textSha256:w.textSha256}))})));
    assert.ok(nav.scope.includes('same input'));
    // A producer's protocol ends in action=final, never the reviewer's review.
    assert.equal(c.request.instructions.includes('not a reason to read the same window again'),c.runId!==f.producer.id);
    for(const operation of nav.operations){
      assert.equal(operation.resultScope,'HISTORICAL_OPERATION_RESULT');
      assert.deepEqual(operation.result,f.store.get('document-operation',operation.record.id).data.result);
    }
    if(c.runId!==f.producer.id)assert.equal(c.task.remainingReviewSteps,12-c.task.step);
  }
});
for(const failure of [null,'timeout','ceiling','partial','freeze'])test('isolated review retest preserves original candidate and acquisitions: '+(failure??'accept'),async t=>{
  const f=setup(t),candidate=await f.produce();
  const directory=mkdtempSync(join(tmpdir(),'sovereign-review-retest-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const sourceDatabase=join(directory,'original.sqlite'),output=join(directory,'diagnostic');mkdirSync(output);
  f.store.db.prepare('VACUUM INTO ?').run(sourceDatabase);
  const hash=closedDatabaseHash(sourceDatabase);let count=0,closed=0;
  const providerFactory=()=>({async generate(request){
    count++;
    if(failure==='timeout')throw Object.assign(Error('SIMULATED timeout'),{code:'TIMEOUT'});
    const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);
    assert.equal(task.remainingReviewSteps,(failure==='ceiling'?1:6)-count+1);
    const value=response({exposure,task,run:{mode:'reviewer'},options:{}});
    if(failure==='partial'&&value.action==='review')value.result.checks=[];
    assertWireArrayBounds(value,request.schema);assert.equal(await request.validate(value),true);
    return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:'retest-'+count,turnId:'turn',
      contextHash:inferenceRequestHash(request),model:request.model,reasoningEffort:request.reasoningEffort,usage:{totalTokens:10}}};
  },async close(){closed++;}});
  const result=await runDocumentaryReviewRetest({runtimeRoot:fileURLToPath(new URL('../..',import.meta.url)),directory:output,sourceDatabase,
    artifactId:candidate.id,reviewerRoleIds:node.reviewerRoleIds,providerFactory,maxCalls:failure==='ceiling'?1:6,
    frozen:()=>failure!=='freeze'||count===0});
  assert.equal(closed,count);assert.equal(closedDatabaseHash(sourceDatabase),hash);
  assert.equal(f.store.list('review').length,0);assert.equal(f.store.get('artifact',candidate.id).data.status,'CANDIDATE');
  assert.equal(result.checks.historicalHeadsUnchanged,true);assert.equal(result.checks.missionNotCompleted,true);
  assert.equal(result.passed,failure===null);
  if(!failure){assert.equal(count,2);assert.equal(result.totalTokensObserved,20);assert.equal(result.review.result.decision,'ACCEPT');}
  else{assert.equal(result.fatal.code,failure==='timeout'?'TIMEOUT':failure==='partial'?'REVIEW_COVERAGE':failure==='ceiling'?'WORKER_LIMIT':'EXPERIMENT_BOUNDARY');
    assert.equal(count,failure==='partial'?2:1);assert.equal(result.review,null);}
  if(failure==='timeout'){assert.equal(result.calls[0].receipt,null);assert.equal(result.totalTokenCoverage,false);assert.equal(result.totalTokensObserved,null);}
  assert.equal(JSON.parse(readFileSync(join(output,'summary.json'))).passed,result.passed);
});
test('revoking either actor grant blocks current consumption and preserves the accepted historical bytes',async t=>{
  for(const actor of ['producer','reviewer']){
    const f=setup(t),accepted=await f.review(await f.produce()),review=f.store.get('review',accepted.reviews.at(-1)).data;
    const runId=actor==='producer'?f.producer.id:review.reviewerRunId,grant=f.store.get('document-session',runId).data.grantIds[0],before=f.store.get('artifact',accepted.id);
    revokeSourceManifestGrant(f.registry,grant,{runId,reason:'Fixture evidence withdrawn.'});
    assert.throws(()=>f.registry.assertUsable(accepted.id,{missionId:'m',purpose:node.purpose}),{code:'SOURCE_GRANT_REVOKED'});assert.deepEqual(f.store.get('artifact',accepted.id),before);
    assert.throws(()=>prepareDocumentSession(f.registry,runId),{code:'SOURCE_GRANT_REVOKED'});assert.equal(f.store.list('source-manifest-grant').length,2);
  }
});
test('source retraction invalidates a documentary accepted product through its preserved original source IDs',async t=>{
  const f=setup(t),accepted=await f.review(await f.produce()),source=f.store.list('source')[0];
  assert.deepEqual(f.registry.retractSource(source.id,'Fixture correction.'),[accepted.id]);assert.equal(f.store.get('artifact',accepted.id).data.status,'INVALIDATED');
  assert.equal(f.store.get('artifact',accepted.id,1).data.payloadHash,accepted.payloadHash);assert.throws(()=>f.registry.assertUsable(accepted.id,{missionId:'m',purpose:node.purpose}),{code:'UNACCEPTED_INPUT'});
});
test('prepared local operations replay idempotently without spending or selecting twice; altered replay is rejected',async t=>{
  const f=setup(t);await f.produce();const operation=f.store.list('document-operation')[0].data,before=f.store.verifyJournal();
  assert.deepEqual(applyDocumentOperation(f.registry,operation),operation);assert.deepEqual(f.store.verifyJournal(),before);
  assert.throws(()=>applyDocumentOperation(f.registry,{...operation,args:{...operation.args,literal:'different'}}),{code:'IDEMPOTENCY_CONFLICT'});
  await assert.rejects(f.produce(),{code:'WORKER_REENTRY'});assert.equal(f.count,4);
});
test('a new recovery actor inherits acquisitions, not sourceIds, selected windows, reading or predecessor authority',async t=>{
  const f=setup(t);await f.produce();const next=f.workers.createRun({missionId:'m',nodeId:node.id,mode:'producer',purpose:node.purpose,roleIds:node.roleIds});
  f.workers.inheritProductionObservations(f.producer.id,next.id);assert.deepEqual(f.workers.run(next.id).context.sourceIds,[]);
  const state=prepareDocumentSession(f.registry,next.id);assert.equal(state.grantIds.length,1);assert.deepEqual(state.selectionIds,[]);
  assert.equal(f.workers.run(next.id).inferenceReceipt,undefined);assert.equal(f.workers.run(next.id).toolObservations[0].relation,'EXTERNAL_OBSERVATION');
});
test('policy/compiled mode drift and unqualified instruction overlays stop dispatch before a provider call',async t=>{
  for(const change of ['policy','missing-policy','config','overlay','raw']){
    const isMission=['policy','missing-policy'].includes(change),f=setup(t),r=f.store.get(isMission?'mission':change==='raw'?'run':'worker-config',isMission?'m':f.producer.id);
    let data=structuredClone(r.data);
    if(change==='policy')delete data.policy.documentContext;
    if(change==='missing-policy')delete data.policy;
    if(change==='config')delete data.compilationScope.documentContext;
    if(change==='overlay')data.learnedInstructionVersions.push({roleId:'sigma_01',version:1});
    if(change==='raw'){data.context.sourceIds=['source:invented'];data.contextHash=sha256(data.context);}
    f.store.put(r.type,r.id,data,{expectedVersion:r.version});
    if(change==='missing-policy')assert.throws(()=>documentaryRun(f.store,f.workers.run(f.producer.id)),{code:'DOCUMENT_PROTOCOL'});
    await assert.rejects(f.produce(),{code:change==='missing-policy'?'MISSION_POLICY':'DOCUMENT_PROTOCOL'});assert.equal(f.count,0);assert.equal(f.store.list('inference-request').length,0);
  }
});
test('documentary final cannot strip its material binding or cite metadata as raw support',async t=>{
  const f=setup(t);await f.produce();const c=f.calls.at(-1),run=f.workers.run(f.producer.id),binding={frameId:c.exposure.documentContextFrame.id,requestHash:inferenceRequestHash(c.request)};
  const metadata=c.exposure.documentEvidenceCatalog.find(e=>e.kind==='source-manifest');
  assert.throws(()=>expandDocumentClaims(f.registry,run,binding,[{...sourceClaim(metadata.sourceKey),sources:[{sourceKey:metadata.sourceKey,quote:'example.com'}]}]),{code:'DOCUMENT_EVIDENCE'});
  assert.throws(()=>f.registry.create({missionId:'m',nodeId:node.id,producerRunId:run.id,kind:'report',purpose:node.purpose,body:'Unbound.',claims:[],criteria:node.criteria}),{code:'DOCUMENT_FRAME_NOT_INTEGRATED'});
});

test('a completed final response cannot be converted into a local command by the caller',async t=>{
  const f=setup(t);await f.produce();const c=f.calls.at(-1),before=f.store.verifyJournal();
  assert.throws(()=>applyDocumentOperation(f.registry,{runId:c.runId,frameId:c.exposure.documentContextFrame.id,requestHash:inferenceRequestHash(c.request),
    tool:'source.read',args:{grantId:c.exposure.documentSourceGrants[0].grant.id,ranges:[{startByte:150,maxBytes:50}]}}),{code:'DOCUMENT_PROPOSAL'});
  assert.deepEqual(f.store.verifyJournal(),before);
  for(const operation of f.store.list('document-operation')){
    const p=operation.data.proposalRecord;assert.equal(f.store.get(p.type,p.id).hash,p.hash);
    assert.ok(f.registry.committedSequence(p.type,p.id,1)<f.registry.committedSequence(operation.type,operation.id,1));
  }
});
test('changing the head of a retained proposal cannot authorize an old session operation',async t=>{
  const f=setup(t);await f.produce();const operation=f.store.list('document-operation')[0],p=operation.data.proposalRecord,r=f.store.get(p.type,p.id);
  f.store.put(p.type,p.id,{...r.data,value:{...r.data.value,method:'rewritten-history'}},{expectedVersion:1});
  assert.throws(()=>documentSessionView(f.registry,f.producer.id),{code:'DOCUMENT_PROPOSAL'});
  assert.throws(()=>applyDocumentOperation(f.registry,operation.data),{code:'DOCUMENT_PROPOSAL'});
});
test('old source keys cannot be imported by a later independent actor',async t=>{
  let oldKey;
  const f=setup(t,{respond:args=>{const v=response(args);if(args.run.mode==='producer'&&v.action==='final')oldKey=v.claims[0].sources[0].sourceKey;
    if(args.run.mode==='reviewer')return {action:'review',tool:'',argsJson:'',method:'invalid-borrowed-key',result:{...inactive(args.task),decision:'ACCEPT',
      checks:args.task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',evidence:[{sourceKey:oldKey,quote:'count=17',usage:'source'}],reason:'Deliberate foreign selector fixture.'}))}};return v;}});
  const a=await f.produce();await assert.rejects(f.review(a),e=>['DOCUMENT_FRAME_QUOTE','DOCUMENT_EVIDENCE'].includes(e.code));
  assert.equal(f.store.list('review').length,0);assert.equal(f.store.get('artifact',a.id).data.status,'CANDIDATE');
});
for(const decision of ['RETURN','UNKNOWN'])test('substantive documentary '+decision+' remains a negative/uncertain judgment without forced raw reading',async t=>{
  const f=setup(t,{respond:args=>{if(args.run.mode==='producer')return response(args);const e=args.exposure.documentEvidenceCatalog.find(e=>e.kind==='artifact-body');
    return {action:'review',tool:'',argsJson:'',method:'report-support-gap',result:{...inactive(args.task),decision,
      checks:args.task.criteria.map(c=>({criterionId:c.id,verdict:decision==='RETURN'?'FAIL':'UNKNOWN',evidence:[{sourceKey:e.sourceKey,quote:'fixture reports count=17',usage:'artifact'}],reason:'Raw support not independently examined.'})),
      findings:[{severity:'material',description:'Missing substantive raw-source examination.',recovery:'Inspect relevant own windows without weakening the criterion.'}],uncertainty:'Support not assessed.'}};}});
  const a=await f.produce(),result=await f.review(a),r=f.store.list('review')[0].data;
  assert.notEqual(result.status,'ACCEPTED');assert.equal(r.result.decision,decision);assert.deepEqual(r.documentary.factual,[]);
  assert.throws(()=>f.registry.assertUsable(a.id,{missionId:'m',purpose:node.purpose}),{code:'UNACCEPTED_INPUT'});
});
for(const reviewEncoding of ['expanded-json','evidence-refs-v1','evidence-catalog-v1'])test('documentary version has its own complete response grammar under legacy mission encoding '+reviewEncoding,async t=>{
  const f=setup(t,{reviewEncoding}),a=await f.review(await f.produce());assert.equal(a.status,'ACCEPTED');
  const r=f.store.list('review')[0].data;assert.equal(f.store.get('worker-config',r.reviewerRunId).data.compilationScope.reviewEncoding,undefined);
  const schema=f.calls.at(-1).request.schema;assert.ok(schema.properties.result.properties.checks.items.properties.evidence);
  assert.ok(schema.properties.result.description.includes('DECISION CONSISTENCY'));assert.ok(schema.properties.result.description.includes('node-effect-inventory'));
});
test('an inline documentary review repair is bounded, retains the old binding and records its correction event',async t=>{
  let wrong=true;
  const f=setup(t,{workerOptions:{maxReviewRepairs:1},respond:args=>{const v=response(args);
    if(args.run.mode==='reviewer'&&v.action==='review'&&wrong){wrong=false;v.result.checks[0].evidence[0].quote='a quote never present';}
    return v;}});
  const a=await f.review(await f.produce());assert.equal(a.status,'ACCEPTED');assert.equal(f.count,7);
  const rejectedRecord=f.store.list('worker-rejected-review')[0],rejected=rejectedRecord.data;
  const repaired=durableDocumentaryRequests(f,f.store.get('run',rejected.runId)).find(r=>r.task.recoveryFeedback?.some(c=>c.rejectionId===rejectedRecord.id));
  const correction=repaired?.task.recoveryFeedback.find(c=>c.rejectionId===rejectedRecord.id);
  assert.deepEqual(correction?.previousBinding,rejected.documentary);assert.notEqual(rejected.documentary.frameId,repaired?.evidence.frameRecord.id);
  const events=f.store.events().filter(e=>e.kind==='worker.review.correction.required');
  assert.equal(events.length,1);assert.deepEqual(events[0].data,{runId:rejected.runId,artifactId:a.id,attempt:1,code:rejected.code,rejectionId:rejectedRecord.id});
  assertPublicOperationalRedaction(missionReport(f.store,'m'));
});
test('local navigation cannot run indefinitely or hide source.read argument failure',async t=>{
  for(const mode of ['endless','bad-range']){
    const f=setup(t,{workerOptions:{maxSteps:3},respond:args=>{
      if(!args.exposure.documentSourceGrants.length)return response(args);
      return producerOperation(mode==='endless'?'source.locate':'source.read',mode==='endless'?{grantId:args.exposure.documentSourceGrants[0].grant.id,literal:'absent'}:
        {grantId:args.exposure.documentSourceGrants[0].grant.id,ranges:[{startByte:0,maxBytes:9999999}]});}});
    await assert.rejects(f.produce(),e=>mode==='endless'?e.code==='WORKER_LIMIT':['SCHEMA','SOURCE_WINDOW_LIMIT'].includes(e.code));
    assert.equal(f.store.list('artifact').length,0);assert.equal(f.store.list('effect').length,1);
    assert.equal(f.store.list('document-operation').length,mode==='endless'?2:0);assert.equal(f.store.get('worker-production',f.producer.id).data.status,'blocked');
  }
});
test('planning, sealed and native actors do not acquire documentary authority by enabling mission policy',t=>{
  const f=setup(t),mission=f.store.get('mission','m').data;
  for(const nodeId of ['planning','review:planning','closed-entry','review:closed-entry'])assert.equal(documentaryEligible(f.store,mission,{mode:'producer',nodeId,context:{purpose:'x'}}),false);
  for(const purpose of ['blind-protocol','closed-blind-attempt-assessment','closed-blind-comparison'])assert.equal(documentaryEligible(f.store,mission,{mode:'producer',nodeId:'x',context:{purpose}}),false);
  f.store.put('node','m:native',{spec:{execution:{kind:'literal-input-copy-v1'}}},{expectedVersion:0});
  assert.equal(documentaryEligible(f.store,mission,{mode:'reviewer',nodeId:'review:native',context:{purpose:'copy'}}),false);
  assert.equal(documentaryEligible(f.store,{id:'legacy'},f.producer),false,'A historical policy-less registry record is not documentary permission');
});

function enginePlan(text){
  const n=(id,dependencies)=>({id,title:id,purpose:id,roleIds:['omega_02'],reviewerRoleIds:['omega_03'],requirementIds:['r1'],dependencies,
    method:{id:'bounded-source-inspection',rationale:'Acquire before factual use, independently inspect before dependency consumption.',alternatives:['Inspect different supporting and contradicting passages.']},
    instructions:text,outputKind:'delivery',criteria:id==='deliver'?[]:[{id:'support',text:'Preserve literal support and its limitation.'}],tools:id==='build'?['source.fetch']:[],requiredEffects:[],specialist:null});
  return {requirements:[{id:'r1',text,requestQuote:text,criteria:[{id:'result',text}]}],nodes:[n('build',[]),n('deliver',[{nodeId:'build',purpose:'build',reason:'Integrate only independently accepted source support.'}])],
    finalNodeId:'deliver',routingRationale:'Two causally required test-fixture products; not a universal agent count.'};
}
function engineSetup(t,{intercept}={}){
  let engine;
  const f=setup(t,{deferMission:true,respond:async args=>{
    if(args.request.schema.properties.requirements)return enginePlan(args.task.originalRequest);
    if(args.request.schema.properties.artifactHash){const a=args.exposure.artifacts.find(a=>a.id===args.task.candidateId);
      return {artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:args.task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',
        evidence:[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body}],reason:'Synthetic plan coverage fixture.'})),findings:[],uncertainty:'Simulated plan review only.'};}
    const value=intercept?await intercept({...args,engine}):undefined;return value??response(args);
  }});
  engine=new FactoryEngine({store:f.store,authority:f.authority,registry:f.registry,broker:f.broker,workers:f.workers});
  return {f,engine,mission:engine.create(intent,{documentContext:'literal-windows-v1',allowedTools:['source.fetch'],contextEncoding:'lossless-json-v2',producerContext:'node-contract-v1',maxNodeAttempts:1,
    inferenceBudget:{mode:'mission-calls-v1',maxCalls:20}})};
}
test('full engine runs plan, two documentary nodes and their independent reviews, and completed reentry performs no work',async t=>{
  const {f,engine,mission}=engineSetup(t),r=await engine.run(mission.id);
  assert.equal(r.mission.status,'COMPLETED',JSON.stringify(r.mission.pending));assert.equal(r.outcome.status,'ACCEPTED');assert.equal(f.store.list('effect').length,1);
  const lineage=auditRouteLineage(engine,mission.id);assert.equal(lineage.length,3);
  assert.ok(lineage[0].gates.dependencies.some(d=>d.review.documentary?.windows.length));
  const report=missionReport(f.store,mission.id,{registry:f.registry});assertPublicOperationalRedaction(report,{inferenceBudget:true});
  const documentaryActors=f.store.list('run').filter(r=>r.data.missionId===mission.id&&documentaryRun(f.store,r.data));
  assert.equal(documentaryActors.length,4);
  const documentaryRequests=documentaryActors.flatMap(actor=>durableDocumentaryRequests(f,actor));
  assert.ok(documentaryRequests.every(r=>r.evidence.inference.simulation===true));
  const operations=f.store.list('document-operation').filter(r=>documentaryActors.some(actor=>actor.id===r.data.runId));
  assert.equal(operations.length,6);
  const sessionOperations=documentaryActors.flatMap(actor=>documentSessionView(f.registry,actor.id).navigation.operations);
  assert.deepEqual(sessionOperations.map(o=>o.record.id).sort(),operations.map(o=>o.id).sort());
  const documentaryJournal=f.store.verifyJournal();for(const operation of operations)assert.deepEqual(applyDocumentOperation(f.registry,operation.data),operation.data);
  assert.deepEqual(f.store.verifyJournal(),documentaryJournal,'durable documentary operation replays must be exact and write nothing');
  const budget=missionInferenceBudget(f.registry,mission.id);
  assert.equal(f.count,13);assert.equal(budget.reserved,f.count);assert.equal(budget.byKind.worker,f.count);assert.equal(budget.byKind.search,0);
  assert.equal(budget.remaining,mission.policy.inferenceBudget.maxCalls-budget.reserved);
  assert.ok(f.store.get('artifact',r.outcome.id)?.data.payload.documentary,'The delivered artifact keeps its material binding in durable storage');
  const finalScope=productionScope(f.registry,r.outcome.id);assert.ok(finalScope.attempts[0].requests.some(r=>r.documentary?.windows.length));
  assert.ok(finalScope.attempts[0].contexts.every(c=>c.sources.length===0));
  const journal=f.store.verifyJournal(),count=f.count,material=f.store.list('artifact');assert.equal((await engine.run(mission.id)).mission.status,'COMPLETED');assert.equal(f.count,count);
  const reentry=f.store.events({after:journal.events});assert.deepEqual(reentry.map(e=>e.kind),['record.committed','record.committed','workspace.validation','record.committed']);
  assert.deepEqual(reentry.filter(e=>e.kind==='record.committed').map(e=>e.data.type),['engine','workspace-validation','engine']);
  assert.deepEqual(f.store.list('artifact'),material);assert.equal(f.store.list('effect').length,1);
  const source=f.store.list('source')[0],invalidated=f.registry.retractSource(source.id,'Fixture upstream correction.');assert.equal(invalidated.length,2);
  assert.throws(()=>f.registry.assertUsable(r.outcome.id,{missionId:mission.id,purpose:'deliver'}),{code:'UNACCEPTED_INPUT'});
  // Historical source rows remain durable in storage, but a public delivery
  // report must not use their adjacent documentary projection to bypass the
  // invalidated final-delivery boundary.
  const withdrawn=missionReport(f.store,mission.id,{registry:f.registry});
  assert.equal(withdrawn.metrics.integrity,'DELIVERY_UNVERIFIED');assert.equal(withdrawn.final,null);
  assert.ok(!Object.hasOwn(withdrawn,'documentary'));
});
test('full engine quota after acquisition creates a fresh actor with independent reading and does not refetch or weaken quality budget',async t=>{
  let stop=true,oldRun;
  const {f,engine,mission}=engineSetup(t,{intercept:args=>{if(stop&&args.run.mode==='producer'&&args.exposure.documentSourceGrants.length){stop=false;oldRun=args.run.id;throw Object.assign(Error('Synthetic quota after recorded acquisition.'),{code:'QUOTA'});}}});
  assert.equal((await engine.run(mission.id)).mission.status,'WAITING_QUOTA');const before=f.store.get('run',oldRun).data;assert.ok(before.expectedRequestHash);assert.equal(f.store.list('effect').length,1);
  const failedRequest=f.store.get('inference-request','inference-request:'+sha256([oldRun,before.expectedRequestHash]));
  assert.equal(failedRequest?.data.retention,'BEFORE_DISPATCH');
  const failedEvents=f.store.events().filter(e=>e.kind==='worker.inference.failed'&&e.data.runId===oldRun);
  assert.deepEqual(failedEvents.map(e=>e.data),[{runId:oldRun,code:'QUOTA'}]);
  const beforeBudget=missionInferenceBudget(f.registry,mission.id);
  const failedReservation=f.store.list('mission-inference-call').find(r=>r.data.kind==='worker'&&r.data.binding.run.id===oldRun&&r.data.binding.requestHash===before.expectedRequestHash);
  assert.ok(failedReservation,'The failed physical call retains its exact logical reservation');
  assert.equal(beforeBudget.reserved,f.count);assert.equal(beforeBudget.byKind.worker,beforeBudget.reserved);assert.equal(beforeBudget.byKind.search,0);
  assert.equal(beforeBudget.remaining,mission.policy.inferenceBudget.maxCalls-beforeBudget.reserved);
  const r=await engine.run(mission.id);assert.equal(r.mission.status,'COMPLETED',JSON.stringify(r.mission.pending));assert.equal(f.store.list('effect').length,1);
  const next=f.calls.find(c=>c.runId!==oldRun&&c.task.node?.id==='build'&&c.exposure.documentSourceGrants.length);assert.ok(next);assert.deepEqual(next.exposure.documentSourceViews,[]);
  assert.equal(f.store.get('run',oldRun).data.expectedRequestHash,before.expectedRequestHash);assert.equal(r.mission.policy.maxNodeAttempts,1);
  const budget=missionInferenceBudget(f.registry,mission.id);
  assert.ok(budget.reserved>beforeBudget.reserved);assert.equal(budget.reserved,f.count);assert.equal(budget.byKind.worker,budget.reserved);assert.equal(budget.byKind.search,0);
  assert.equal(budget.remaining,mission.policy.inferenceBudget.maxCalls-budget.reserved);
  assert.equal(f.store.get('mission-inference-call',failedReservation.id)?.hash,failedReservation.hash,'A failed reservation is never refunded or rewritten');
  assertPublicOperationalRedaction(missionReport(f.store,mission.id,{registry:f.registry}),{inferenceBudget:true});
});
test('cancellation after model proposes navigation commits no read and cannot resume a cancelled mission',async t=>{
  const {f,engine,mission}=engineSetup(t,{intercept:args=>{if(args.run.mode==='producer'&&args.exposure.documentSourceGrants.length){args.engine.cancel(args.run.missionId);return response(args);}}});
  assert.equal((await engine.run(mission.id)).mission.status,'CANCELLED');assert.equal(f.store.list('document-operation').length,0);assert.equal(f.store.list('source-window-selection').length,0);
  const count=f.count;assert.equal((await engine.run(mission.id)).mission.status,'CANCELLED');assert.equal(f.count,count);assert.equal(f.store.list('effect').length,1);
});
test('factual and review bindings reject modified sources, quote selectors and borrowed producer frames',async t=>{
  const f=setup(t),a=await f.review(await f.produce()),r=f.store.list('review')[0].data,producer=f.workers.run(f.producer.id),judge=f.workers.run(r.reviewerRunId);
  const wrongClaims=structuredClone(a.payload.claims);wrongClaims[0].sources[0].hash='0'.repeat(64);
  assert.throws(()=>validateDocumentClaims(f.registry,producer,wrongClaims,a.payload.documentary),{code:'DOCUMENT_EVIDENCE'});
  const selector=structuredClone(a.payload.documentary);selector.claims[0].claimId='other';
  assert.throws(()=>validateDocumentClaims(f.registry,producer,a.payload.claims,selector),{code:'DOCUMENT_EVIDENCE'});
  const review=structuredClone(r.documentary);review.checks[0].usage='artifact';
  assert.throws(()=>validateDocumentReview(f.registry,judge,r.result,a,review),{code:'DOCUMENT_EVIDENCE'});
  assert.throws(()=>validateDocumentReview(f.registry,judge,r.result,a,{...r.documentary,frameId:a.payload.documentary.frameId}),e=>/DOCUMENT/.test(e.code));
  assert.equal(f.registry.assertUsable(a.id,{missionId:'m',purpose:node.purpose}).status,'ACCEPTED');
});
test('an independent judge cannot select a producer-owned grant even when source bytes are identical',async t=>{
  let producerGrant;
  const f=setup(t,{respond:args=>{const v=response(args);
    if(args.run.mode==='producer'&&args.exposure.documentSourceGrants.length)producerGrant=args.exposure.documentSourceGrants[0].grant.id;
    if(args.run.mode==='reviewer')v.argsJson=JSON.stringify({grantId:producerGrant,ranges:[{startByte:0,maxBytes:128}]});return v;}});
  const a=await f.produce();await assert.rejects(f.review(a),{code:'DOCUMENT_GRANT'});assert.equal(f.store.list('review').length,0);
  assert.equal(f.store.list('document-operation').length,2);assert.equal(f.store.list('source-window-selection').length,1);
});
test('documentary sources retain mechanical origin/equal-byte relationships without inventing independent corroboration',async t=>{
  let second=false;
  const f=setup(t,{respond:args=>{if(args.run.mode==='producer'&&args.exposure.documentSourceGrants.length===1&&!second){second=true;return producerOperation('source.fetch',{url:'https://example.com/mirror'});}return response(args);}});
  await f.produce();const relationships=f.calls.at(-1).exposure.documentSourceRelationships;
  assert.equal(relationships.sourceCount,2);assert.equal(relationships.uniqueContentCount,1);assert.equal(relationships.identicalContent[0].sourceIds.length,2);
  assert.equal(relationships.sharedHttpOrigin[0].sourceIds.length,2);assert.equal(relationships.rootIndependence,'NOT_ESTABLISHED');
});
test('documentary actors never import legacy learned overlays or silently normalize away the new scope',async t=>{
  let lookups=0;const f=setup(t,{workerOptions:{learningInstructionsResolver:()=>{lookups++;throw Error('Legacy scope resolver must not run.');}}});
  assert.equal((await f.review(await f.produce())).status,'ACCEPTED');assert.equal(lookups,0);
  const learning=new LearningService({store:f.store,authority:f.authority});
  assert.throws(()=>learning.registerBaseline({roleId:'sigma_01',datasetSpec:{},scope:{roleIds:['sigma_01'],purpose:node.purpose,mode:'producer',documentContext:'literal-windows-v1'}}),{code:'SCHEMA'});
  assert.equal(f.store.list('learning-compilation').length,0);
});
test('documentary source review still needs its own real file reread and the file must remain unchanged at use',async t=>{
  for(const includeOwnRead of [false,true]){
    const spec={...node,tools:['source.fetch','workspace.write','workspace.read'],requiredEffects:[{type:'file',path:'result.txt',command:'',expectedExit:null}]};
    const f=setup(t,{node:spec,respond:args=>{
      const v=response(args);
      if(args.run.mode==='producer'&&v.action==='final'&&!args.exposure.documentEvidenceCatalog.some(e=>e.kind==='tool-observation'))
        return {action:'tool',tool:'workspace.write',argsJson:JSON.stringify({path:'result.txt',content:'verified count=17',expectedHash:null}),body:'',claims:[],method:'persist-source-bound-delivery',reason:''};
      if(args.run.mode==='reviewer'&&v.action==='review'&&includeOwnRead){
        const own=args.exposure.documentEvidenceCatalog.find(e=>e.kind==='tool-observation'&&e.principalId===args.run.id&&e.relation==='OWN_ACTION');assert.ok(own);
        v.result.checks[0].evidence.push({sourceKey:own.sourceKey,quote:'verified count=17',usage:'tool'});
      }
      return v;
    }});
    const a=await f.produce();
    if(!includeOwnRead){await assert.rejects(f.review(a),{code:'UNVERIFIED_WRITE'});assert.equal(f.store.list('review').length,0);continue;}
    const accepted=await f.review(a),review=f.store.list('review')[0].data;assert.equal(accepted.status,'ACCEPTED');
    assert.ok(review.result.checks[0].evidence.some(e=>e.kind==='tool'));
    await f.workers.tool(f.producer.id,'workspace.write',{path:'result.txt',content:'changed after acceptance',expectedHash:sha256('verified count=17')},'fixture:later-write');
    assert.throws(()=>f.workers.verifyWorkspaceSnapshot(accepted,{runId:review.reviewerRunId}),{code:'WORKSPACE_CHANGED'});
  }
});
test('documentary complete-input budget failure is recorded before provider dispatch with no silent truncation',async t=>{
  const f=setup(t,{workerOptions:{maxContextBytes:100}});await assert.rejects(f.produce(),{code:'CONTEXT_LIMIT'});
  const blocked=f.store.events({limit:1000}).find(e=>e.kind==='worker.context.blocked');assert.ok(blocked);assert.equal(f.count,0);
  assert.equal(f.store.list('inference-request').length,0);assert.equal(f.store.list('effect').length,0);assert.ok(blocked.data.diagnostic.logicalBytes>100);
});
test('new real documentary harness preserves the old case request/oracle and has its own explicit bounded policy',()=>{
  assert.equal(DOCUMENTARY_CASE.request,FULL_ROUTE_CASES[1].request);assert.deepEqual(DOCUMENTARY_CASE.expected,FULL_ROUTE_CASES[1].expected);
  assert.equal(FULL_ROUTE_CASES[1].maxCalls,12);assert.equal(FULL_ROUTE_CASES[1].documentContext,undefined);
  assert.equal(DOCUMENTARY_CASE.maxCalls,20);assert.deepEqual(DOCUMENTARY_CASE.modes,['planned']);
  const policy=fullRoutePolicy(DOCUMENTARY_CASE,'planned');assert.equal(policy.documentContext,'literal-windows-v1');assert.equal(policy.entryMode,'planned');
  assert.equal(policy.model,'gpt-6-astra');assert.equal(policy.reasoningEffort,'ultra');assert.deepEqual(policy.allowedTools,['source.fetch']);
  assert.throws(()=>fullRoutePolicy({...DOCUMENTARY_CASE,family:'development'},'planned'),{code:'EXPERIMENT_BOUNDARY'});
  assert.throws(()=>fullRoutePolicy({...DOCUMENTARY_CASE,documentContext:'invented'},'planned'),{code:'EXPERIMENT_BOUNDARY'});
});
