import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {compactCatalogReview,compactReviewEvidence} from '../../factory/lib/review-codec.mjs';
import {SOURCED_RESPONSE_NODE,SOURCED_RESPONSE_CRITERIA,SOURCED_RESPONSE_PURPOSE,SOURCED_RESPONSE_DEFER_ONLY_FALLBACK,SOURCED_RESPONSE_ACQUISITION_V2,sourcedResponseAcquisition} from '../../factory/lib/sourced-response-spec.mjs';
import {missionReport,formatMissionReport} from '../../factory/lib/report.mjs';
import {PUBLIC_DELIVERY_VIEW_SCHEMA} from '../../factory/lib/public-artifact-projection.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';

test('Sourced response: creation freezes a distinct protocol without changing defaults',t=>{
  const dir=fs.mkdtempSync(join(tmpdir(),'sovereign-sourced-entry-'));
  const e=new FactoryEngine({databasePath:join(dir,'state.sqlite'),workspaceRoot:join(dir,'jobs')});
  t.after(()=>{e.close();fs.rmSync(dir,{recursive:true,force:true});});
  const before=e.create('A closed request.',{allowedTools:[]});
  assert.equal(before.policy.entryMode,undefined);
  const m=e.create('Consult https://example.com/fixture and report the fixture value with its source.',
    {entryMode:'sourced-response-v1',allowedTools:['source.fetch']});
  assert.equal(m.policy.entryMode,'sourced-response-v1');
  assert.deepEqual(m.policy.sourcedAcquisition,{schema:'sourced-response-acquisition-v2',maxSearchIntents:1,
    maxFetchIntents:4,maxSourceBytes:65536,acceptedHttpStatus:'2xx-only'});
  // The preceding default/planned mission opts this shared database into the
  // stronger planning-close protocol. The sourced route remains valid at that
  // monotonic global floor rather than downgrading it to its own floor 10.
  assert.equal(e.store.db.prepare('PRAGMA user_version').get().user_version,15);
  assert.equal(e.store.list('run').length,0);
  assert.equal(e.store.list('effect').length,0);
});
test('Sourced response: an historic policy without v2 acquisition remains on its original envelope',()=>{
  const historic={policy:{entryMode:'sourced-response-v1'}};
  assert.deepEqual(sourcedResponseAcquisition(historic),{maxSearchIntents:1,maxFetchIntents:2,maxSourceBytes:65536});
  assert.equal(Object.hasOwn(historic.policy,'sourcedAcquisition'),false);
});
test('Sourced response: v2 acquisition envelope is structural, not key-order sensitive after persistence',()=>{
  const reordered={acceptedHttpStatus:'2xx-only',maxSourceBytes:65536,maxFetchIntents:4,
    maxSearchIntents:1,schema:'sourced-response-acquisition-v2'};
  assert.deepEqual(sourcedResponseAcquisition({policy:{sourcedAcquisition:reordered}}),SOURCED_RESPONSE_ACQUISITION_V2);
});

const tool=(name,args)=>({action:'tool',tool:name,argsJson:JSON.stringify(args),body:'',claims:[],method:'scoped-public-acquisition',reason:''});
const final=(body,claims=[])=>({action:'final',tool:'',argsJson:'',body,claims,method:'source-comparison',reason:''});
const blocked=reason=>({action:'blocked',tool:'',argsJson:'',body:'',claims:[],method:'full-planning',reason});
const fact=source=>({id:'fact-'+source.id,text:'The synthetic fixture says value 17.',kind:'fact',
  sources:[{sourceId:source.id,hash:source.hash,quote:source.raw}],basis:[],qualifiers:['Synthetic fixture, not real-world truth.'],validUntil:null});
const SOURCED_BOUNDARY_CRITERIA=new Set(['sourced-eligibility','complete-request','public-listing-audience-v2']);
function sourcedAnswerBoundaryEvidence(exposure){
  const boundaries=(exposure.runtimeObservations??[]).filter(observation=>observation.kind==='sourced-answer-boundary');
  assert.equal(boundaries.length,1,'a sourced reviewer fixture receives exactly one signed answer boundary');
  const boundary=boundaries[0];
  return {kind:'runtime',id:boundary.id,hash:boundary.hash,quote:boundary.quoteText};
}
function withSourcedAnswerBoundaryEvidence(value,exposure,task){
  // New sourced reviewers use a closed artifact/source/runtime catalog.  The
  // runtime entry authenticates the requested answer boundary; it deliberately
  // does not replace exact source evidence for factual support.
  if(!task.candidateId||!Array.isArray(task.observedEvidenceCatalog)||!Array.isArray(value?.checks))return value;
  const boundary=sourcedAnswerBoundaryEvidence(exposure);
  return {...value,checks:value.checks.map(checkResult=>{
    if(!SOURCED_BOUNDARY_CRITERIA.has(checkResult.criterionId))return checkResult;
    const evidence=checkResult.evidence??[];
    return evidence.some(item=>item.kind==='runtime'&&item.id===boundary.id&&item.hash===boundary.hash)
      ?checkResult:{...checkResult,evidence:[...evidence,boundary]};
  })};
}
function plan(intent){return {requirements:[{id:'r1',text:intent,requestQuote:intent,criteria:[{id:'complete',text:intent}]}],
  nodes:[{id:'deliver',title:'Full request',purpose:'delivery',roleIds:['omega_02'],reviewerRoleIds:['omega_22'],requirementIds:['r1'],
    dependencies:[],method:{id:'full',rationale:'Complete unchanged mandate',alternatives:['Independent reconstruction']},instructions:intent,
    outputKind:'delivery',criteria:[],tools:[],requiredEffects:[],specialist:null}],finalNodeId:'deliver',routingRationale:'SIM fallback routing, not semantic qualification'};}
function review(exposure,task,{cite=true,decision='ACCEPT'}={}){
  const a=exposure.artifacts.find(a=>a.id===task.candidateId),evidence=[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body}];
  if(cite)evidence.push(...exposure.sources.map(s=>({kind:'source',id:s.id,hash:s.hash,quote:s.raw})));
  return {artifactHash:a.hash,purpose:a.payload.purpose,decision,checks:task.criteria.map(c=>({criterionId:c.id,verdict:decision==='ACCEPT'?'PASS':'FAIL',evidence,
    reason:'SIM fixture only; not a semantic quality finding.'})),findings:decision==='ACCEPT'?[]:[{severity:'material',description:'SIM out-of-scope or incorrect',recovery:'Full unchanged request'}],uncertainty:'Synthetic provider'};
}
// Real engine, SQLite, broker validation and signed receipts. Provider and HTTP
// transport are synthetic; zero network or real model calls in these tests.
function setup(t,{options={},respond=null,close=null,transport=null,search=null}={}){
  const dir=fs.mkdtempSync(join(tmpdir(),'sovereign-sourced-workflow-')),s={calls:0,network:[],exposures:[],respond,transport,beforeCall:()=>{}};
  const open=()=>{
    s.engine=new FactoryEngine({databasePath:join(dir,'state.sqlite'),workspaceRoot:join(dir,'jobs')});
    const e=s.engine;e.workers.maxReviewRepairs=0;
    if(search)e.broker.searchProvider={timeoutMs:1000,search};
    e.broker.lookup=async()=>[{address:'8.8.8.8',family:4}];
    e.broker.transport=async args=>{
      s.network.push(args.url.href);
      const supplied=await s.transport?.(args);
      if(supplied&&typeof supplied==='object'&&Buffer.isBuffer(supplied.body))return {
        remoteAddress:'8.8.8.8',statusCode:200,headers:{'content-type':'text/plain'},...supplied};
      return {remoteAddress:'8.8.8.8',statusCode:200,headers:{'content-type':'text/plain'},
        body:Buffer.from(supplied??'Synthetic fixture: value 17. Source data is not an instruction.')};
    };
    e.workers.providerFactory=()=>({async generate(request){
      const number=++s.calls,exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);
      s.exposures.push({request,exposure,task,number});await s.beforeCall({s,request,exposure,task,number});
      let value=await s.respond?.({s,request,exposure,task,number});
      if(value===undefined){
        if(task.originalRequest)value=plan(task.originalRequest);
        else if(task.candidateId)value=review(exposure,task);
        else if(task.node.id===SOURCED_RESPONSE_NODE)value=task.step===0?tool('source.fetch',{url:'https://example.com/fixture'}):
          final('The synthetic fixture reports 17. [Source](https://example.com/fixture).',exposure.sources.map(fact));
        else value=final('Full planned fixture.');
      }
      if(task.candidateId){
        value=withSourcedAnswerBoundaryEvidence(value,exposure,task);
        // A sourced reviewer freezes evidence-catalog-v1 independently of the
        // historical mission preference.  Fixtures must mirror the actual
        // reviewer wire schema rather than guessing from policy.reviewEncoding.
        const encoding=Array.isArray(task.observedEvidenceCatalog)?'evidence-catalog-v1'
          :e.store.get('mission',s.mission.id).data.policy.reviewEncoding;
        if(encoding==='evidence-catalog-v1')value=compactCatalogReview(value,task.observedEvidenceCatalog);
        else if(encoding==='evidence-refs-v1')value=compactReviewEvidence(value);
      }
      await request.validate(value);
      return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:'sim-source-'+number,turnId:'sim',
        model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
    },async close(){return close?close(s):{processExitObserved:true};}});
  };open();
  s.intent='Consult https://example.com/fixture and report its value in text with the source. Do not write files or execute code.';
  s.mission=s.engine.create(s.intent,{entryMode:'sourced-response-v1',allowedTools:['source.fetch'],...options});
  s.run=opts=>s.engine.run(s.mission.id,opts);s.entry=()=>s.engine.store.get('sourced-response-entry',s.mission.id)?.data;
  s.reopen=()=>{s.engine.close();open();};
  t.after(()=>{s.engine.close();fs.rmSync(dir,{recursive:true,force:true});});return s;
}
// Engine status and mission reports deliberately expose a delivery view, not
// the canonical artifact.  Keep behavioral assertions on the authenticated
// internal artifact, while making the public redaction boundary explicit.
function acceptedSourcedArtifact(s,outcome){
  assert.equal(outcome.schema,PUBLIC_DELIVERY_VIEW_SCHEMA);
  assert.equal(outcome.missionId,s.mission.id);assert.equal(outcome.status,'ACCEPTED');
  assert.deepEqual(Object.keys(outcome.payload),['body']);
  for(const privateField of ['claims','criteria','toolReceipts','inputRefs','requiredEffects','producerRunId'])
    assert.equal(Object.hasOwn(outcome.payload,privateField),false);
  const artifact=s.engine.registry.assertUsable(outcome.id,{missionId:s.mission.id,purpose:SOURCED_RESPONSE_PURPOSE});
  assert.equal(outcome.payload.body,artifact.payload.body);return artifact;
}
for(const encoding of ['expanded-json','evidence-refs-v1','evidence-catalog-v1'])test('Sourced response / SIM: source → candidate → independent citations, '+encoding,async t=>{
  const s=setup(t,{options:{reviewEncoding:encoding,contextEncoding:'lossless-json-v2',cardEncoding:'compact-json-v1',producerBatch:'read-test-cursor-v1'}}),r=await s.run();
  assert.equal(r.mission.status,'COMPLETED',JSON.stringify(r.mission.pending));assert.equal(s.calls,3);assert.equal(s.network.length,1);
  assert.equal(r.plan,null);assert.deepEqual(r.nodes,[]);assert.equal(s.entry().status,'ACCEPTED');
  const artifact=acceptedSourcedArtifact(s,r.outcome);
  assert.deepEqual(artifact.payload.criteria,SOURCED_RESPONSE_CRITERIA);assert.equal(artifact.payload.claims.length,1);
  const q=s.exposures.at(-1);assert.equal(q.exposure.missionIntent,s.intent);assert.equal(q.exposure.sources.length,1);
  assert.equal(s.engine.store.list('effect').length,1);assert.ok(q.exposure.sources[0].raw.includes('value 17'));
  const report=missionReport(s.engine.store,s.mission.id,{registry:s.engine.registry});
  assert.deepEqual(report.final,r.outcome);assert.deepEqual(report.effects,[]);assert.deepEqual(report.timeline,[]);
  assert.equal(report.metrics.integrity,'NOT_ATTESTED');
  assert.equal(Object.hasOwn(report,'sourcedEntry'),false);assert.equal(Object.hasOwn(report,'controllerExecutions'),false);
  // Both the generic-report and actor-telemetry-safe report variants deliberately
  // withhold unverifiable runtime detail; this assertion covers that public
  // boundary rather than coupling the sourced route to either label.
  assert.match(formatMissionReport(report),/Telemetría operativa(?: genérica)? no proyectada/);
  const count=s.calls;s.reopen();assert.equal((await s.run()).outcome.id,r.outcome.id);assert.equal(s.calls,count);assert.equal(s.network.length,1);
});
test('Sourced response / SIM: reviewer receives only the sealed artifact-source-runtime catalog, never a producer tool receipt',async t=>{
  const s=setup(t),result=await s.run();
  assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  const reviewer=s.exposures.find(exposure=>exposure.task.candidateId);
  assert.ok(reviewer,'the independent sourced reviewer was invoked');
  assert.deepEqual(reviewer.exposure.toolObservations,[],'source-fetch receipt is not exposed to the reviewer');
  assert.equal(Object.hasOwn(reviewer.exposure,'toolReceipts'),false,'the review context has no alternate receipt channel');
  const catalog=reviewer.task.observedEvidenceCatalog;
  assert.ok(Array.isArray(catalog));
  assert.equal(catalog.length,3,'one exact candidate, one admitted source, and one signed answer boundary');
  assert.deepEqual([...new Set(catalog.map(item=>item.kind))].sort(),['artifact','runtime','source']);
  assert.equal(catalog.every(item=>!['tool','tool-history'].includes(item.kind)),true);
  const boundary=reviewer.exposure.runtimeObservations?.filter(item=>item.kind==='sourced-answer-boundary')??[];
  assert.equal(boundary.length,1);
  const reviewRecord=s.engine.store.list('review').find(record=>record.data.artifactId===s.entry().artifactId)?.data;
  assert.ok(reviewRecord,'the sourced candidate has an independent review record');
  for(const criterionId of SOURCED_BOUNDARY_CRITERIA){
    const checkResult=reviewRecord.result.checks.find(item=>item.criterionId===criterionId);
    if(!checkResult)continue;
    assert.ok(checkResult.evidence.some(item=>item.kind==='runtime'&&item.id===boundary[0].id&&item.hash===boundary[0].hash),
      criterionId+' cites the authenticated answer boundary');
  }
  assert.equal(reviewRecord.result.checks.flatMap(checkResult=>checkResult.evidence).some(item=>['tool','tool-history'].includes(item.kind)),false);
});
test('Sourced response / SIM: a RETURN with the signed answer boundary persists without an unobserved-tool failure',async t=>{
  const s=setup(t,{options:{sourcedFallback:SOURCED_RESPONSE_DEFER_ONLY_FALLBACK},respond:({task,exposure})=>
    task.candidateId?review(exposure,task,{decision:'RETURN'}):undefined});
  const result=await s.run();
  assert.equal(result.mission.status,'NEEDS_DIRECTION',JSON.stringify(result.mission.pending));
  assert.equal(s.entry().status,'FALLBACK');
  const candidate=s.engine.store.get('artifact',s.entry().artifactId).data;
  assert.equal(candidate.status,'RETURNED');
  const reviewRecord=s.engine.store.list('review').find(record=>record.data.artifactId===s.entry().artifactId)?.data;
  assert.ok(reviewRecord,'the returned sourced candidate has an independent review record');
  assert.equal(reviewRecord.result.decision,'RETURN');
  assert.equal(s.engine.store.list('worker-rejected-review').some(record=>record.data.code==='UNOBSERVED_TOOL'),false);
  const reviewerRun=s.engine.store.get('run',reviewRecord.reviewerRunId).data;
  assert.deepEqual(reviewerRun.toolObservations??[],[],'the returned review did not need a reviewer tool receipt');
  assert.equal(reviewRecord.result.checks.flatMap(checkResult=>checkResult.evidence)
    .some(item=>['tool','tool-history'].includes(item.kind)),false);
});
test('Sourced response / SIM: an evidence-catalog reviewer repairs an empty semantic check from the same observed catalog',async t=>{
  const s=setup(t,{options:{reviewEncoding:'evidence-catalog-v1',contextEncoding:'lossless-json-v2'},respond:({task,exposure})=>{
    if(!task.candidateId)return undefined;
    const value=review(exposure,task);
    if((task.recoveryFeedback??[]).length===0){
      // Leave the required signed answer boundary in the two boundary checks.
      // This isolates the generic empty-semantic-check repair path instead of
      // accidentally testing the sourced boundary contract.
      value.checks.find(checkResult=>checkResult.criterionId==='source-support').evidence=[];
      return value;
    }
    assert.equal(task.recoveryFeedback.length,1);
    assert.equal(task.recoveryFeedback[0].code,'REVIEW_EVIDENCE');
    assert.equal(task.recoveryFeedback[0].validationDiagnostic.criterionId,'source-support');
    return value;
  }});
  s.engine.workers.maxReviewRepairs=1;
  const result=await s.run();
  assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(s.calls,4,'producer, source continuation, reviewer, bounded reviewer repair');
  const rejected=s.engine.store.list('worker-rejected-review');
  assert.equal(rejected.length,1);
  assert.equal(rejected[0].data.code,'REVIEW_EVIDENCE');
  assert.equal(rejected[0].data.validationDiagnostic.criterionId,'source-support');
  assert.equal(s.entry().status,'ACCEPTED');
});
test('Sourced response / SIM: literal raw JSON source view binds producer and reviewer citations without relaxing SOURCE_SUPPORT',async t=>{
  const raw=JSON.stringify({article:{body:'<p style="font-weight: 400;">Synthetic value 17.</p>'}}),quote='style=\\"font-weight: 400;\\"',seen=[];
  assert.ok(raw.includes(quote));assert.equal(JSON.parse(raw).article.body.includes(quote),false,'the quote is wire-literal, not decoded body text');
  const s=setup(t,{options:{contextEncoding:'lossless-json-v2',reviewEncoding:'expanded-json'},transport:()=>raw,
    respond:({task,exposure,request})=>{
      if(task.node?.id===SOURCED_RESPONSE_NODE&&task.step===0)return tool('source.fetch',{url:'https://example.com/json-source'});
      if(task.node?.id===SOURCED_RESPONSE_NODE){
        seen.push('producer');assert.ok(request.input.startsWith('SOVEREIGN_SOURCED_SOURCE_CONTEXT_VIEW_V1\n'));
        assert.ok(request.input.includes(raw));assert.match(request.instructions,/parsed JSON value/);
        const source=exposure.sources[0];
        return final('The acquired JSON source carries a literal style attribute.',[{id:'json-wire-fact',text:'The acquired JSON wire source contains the cited style attribute.',kind:'fact',
          sources:[{sourceId:source.id,hash:source.hash,quote}],basis:[],qualifiers:['Synthetic raw-wire citation regression.'],validUntil:null}]);
      }
      if(task.candidateId){
        seen.push('reviewer');assert.ok(request.input.startsWith('SOVEREIGN_SOURCED_SOURCE_CONTEXT_VIEW_V1\n'));
        assert.ok(request.input.includes(raw));assert.match(request.instructions,/parsed JSON value/);
        const artifact=exposure.artifacts.find(item=>item.id===task.candidateId),source=exposure.sources[0],evidence=[
          {kind:'artifact',id:artifact.id,hash:artifact.hash,quote:artifact.payload.body},
          {kind:'source',id:source.id,hash:source.hash,quote},
        ];
        return {artifactHash:artifact.hash,purpose:artifact.payload.purpose,decision:'ACCEPT',checks:task.criteria.map(criterion=>({
          criterionId:criterion.id,verdict:'PASS',evidence,reason:'Synthetic literal raw evidence is independently present.'
        })),findings:[],uncertainty:'Synthetic transport only.'};
      }
    }});
  const result=await s.run();assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.deepEqual(seen,['producer','reviewer']);
  const artifact=acceptedSourcedArtifact(s,result.outcome),ref=artifact.payload.claims[0].sources[0];
  assert.equal(s.engine.store.get('source',ref.sourceId).data.raw.includes(ref.quote),true);
  const reviewRecord=s.engine.store.get('review',s.entry().reviewId).data;
  assert.equal(reviewRecord.result.checks.flatMap(check=>check.evidence).some(e=>e.kind==='source'&&e.quote===quote),true);
});
test('Sourced response / SIM: an admitted empty 2xx body reaches both producer and reviewer without becoming a schema error',async t=>{
  const supported='Supported nonempty raw source for the only factual citation.',seen=[];
  const s=setup(t,{options:{contextEncoding:'lossless-json-v2',reviewEncoding:'expanded-json'},transport:args=>
    args.url.pathname==='/empty'?{body:Buffer.alloc(0)}:{body:Buffer.from(supported)},respond:({task,exposure,request})=>{
      if(task.node?.id===SOURCED_RESPONSE_NODE&&task.step===0)return tool('source.fetch',{url:'https://example.com/empty'});
      if(task.node?.id===SOURCED_RESPONSE_NODE&&task.step===1){
        seen.push('producer-after-empty');assert.ok(request.input.startsWith('SOVEREIGN_SOURCED_SOURCE_CONTEXT_VIEW_V1\n'));
        assert.equal(exposure.sources.length,1);assert.equal(exposure.sources[0].raw,'');assert.equal(exposure.sources[0].hash,sha256(''));
        return tool('source.fetch',{url:'https://example.com/supported'});
      }
      if(task.node?.id===SOURCED_RESPONSE_NODE){
        seen.push('producer-final');assert.ok(request.input.startsWith('SOVEREIGN_SOURCED_SOURCE_CONTEXT_VIEW_V1\n'));
        assert.equal(exposure.sources[0].raw,'');const source=exposure.sources.find(item=>item.raw===supported);
        return final('The nonempty acquired source is the only cited factual support.',[{id:'supported-empty-peer',
          text:'The supported acquired source contains the cited literal text.',kind:'fact',
          sources:[{sourceId:source.id,hash:source.hash,quote:supported}],basis:[],
          qualifiers:['The empty 2xx source is retained but is not evidence for this claim.'],validUntil:null}]);
      }
      if(task.candidateId){
        seen.push('reviewer');assert.ok(request.input.startsWith('SOVEREIGN_SOURCED_SOURCE_CONTEXT_VIEW_V1\n'));
        // The independent reviewer receives the exact claimed source subset,
        // not an ambient source list. Its wrapper is still used and its one
        // nonempty evidence source remains literal-bound.
        assert.equal(exposure.sources.length,1);assert.equal(exposure.sources[0].raw,supported);const artifact=exposure.artifacts.find(item=>item.id===task.candidateId),source=exposure.sources[0],evidence=[
          {kind:'artifact',id:artifact.id,hash:artifact.hash,quote:artifact.payload.body},
          {kind:'source',id:source.id,hash:source.hash,quote:supported},
        ];
        return {artifactHash:artifact.hash,purpose:artifact.payload.purpose,decision:'ACCEPT',checks:task.criteria.map(criterion=>({
          criterionId:criterion.id,verdict:'PASS',evidence,reason:'Independent review uses only the nonempty exact source support.'
        })),findings:[],uncertainty:'Synthetic empty-2xx transport only.'};
      }
    }});
  const result=await s.run();assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.deepEqual(seen,['producer-after-empty','producer-final','reviewer']);
  const empty=s.engine.store.list('source').find(record=>record.data.raw==='').data;
  assert.equal(empty.hash,sha256(''));assert.equal(s.engine.store.get('source',acceptedSourcedArtifact(s,result.outcome).payload.claims[0].sources[0].sourceId).data.raw,supported);
});
test('Sourced response / SIM: no acquisition cannot become factual acceptance',async t=>{
  const s=setup(t,{respond:({task})=>task.node?.id===SOURCED_RESPONSE_NODE?final('Invented external answer.'):undefined}),r=await s.run();
  assert.equal(s.entry().status,'FALLBACK');assert.equal(s.network.length,0);assert.ok(r.plan);
  assert.equal(s.engine.store.list('artifact').filter(a=>a.data.payload.kind==='sourced-response').length,0);
});
test('Sourced response / SIM: defer-only preserves an explicit escalation boundary without planning or a workspace',async t=>{
  const s=setup(t,{options:{sourcedFallback:SOURCED_RESPONSE_DEFER_ONLY_FALLBACK},
    respond:({task})=>task.node?.id===SOURCED_RESPONSE_NODE?final('Invented external answer.'):undefined});
  const result=await s.run();
  assert.equal(result.mission.status,'NEEDS_DIRECTION',JSON.stringify(result.mission.pending));
  assert.deepEqual(result.mission.pending,[{code:'SOURCED_ROUTE_ESCALATION_REQUIRED'}]);
  assert.equal(result.mission.policy.sourcedFallback,SOURCED_RESPONSE_DEFER_ONLY_FALLBACK);
  assert.equal(s.entry().status,'FALLBACK');
  for(const type of ['plan','node','tool-workspace','planning-progress','planning-inspection-call'])
    assert.equal(s.engine.store.list(type).length,0,`${type} must not be created by a defer-only sourced fallback`);
  assert.equal(s.engine.store.list('artifact').filter(a=>a.data.payload.kind==='sourced-response').length,0);
  const calls=s.calls,again=await s.run();
  assert.equal(again.mission.status,'NEEDS_DIRECTION');assert.equal(s.calls,calls,'resume must not fall through to planning');
});
test('Sourced response / SIM: defer-only can still deliver a verified public answer without a workspace',async t=>{
  const s=setup(t,{options:{sourcedFallback:SOURCED_RESPONSE_DEFER_ONLY_FALLBACK}}),result=await s.run();
  assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.equal(s.engine.store.get('tool-workspace',s.mission.id),null);
  const producer=s.engine.store.get('worker-config',s.entry().runId).data;
  assert.equal(producer.sourcedResponseContract.sourcedFallback,SOURCED_RESPONSE_DEFER_ONLY_FALLBACK);
  assert.equal(producer.sourcedResponseContract.fallback.disposition,'EXPLICIT_NEW_PLANNED_ADMISSION_REQUIRED');
});
test('Sourced response: input, project-context and asset options are rejected before admission',t=>{
  const dir=fs.mkdtempSync(join(tmpdir(),'sovereign-sourced-scope-')),
    e=new FactoryEngine({databasePath:join(dir,'state.sqlite'),workspaceRoot:join(dir,'jobs')});
  t.after(()=>{e.close();fs.rmSync(dir,{recursive:true,force:true});});
  const inputs=[{path:'private.txt',content:'private project material'}],before=e.store.verifyJournal();
  for(const options of [
    {inputs},
    {inputs,projectContext:{path:'private.txt',sha256:sha256('private project material'),classification:'project-context-untrusted-v1',requiredRead:true}},
    {assetManifest:{untrusted:'asset-manifest'}}
  ])assert.throws(()=>e.create('A bounded public question.',{entryMode:'sourced-response-v1',...options}),{code:'SOURCED_RESPONSE_SCOPE'});
  assert.equal(e.store.list('mission').length,0);assert.deepEqual(e.store.verifyJournal(),before);
});
test('Sourced response / SIM: permissive judge without source citations is rejected',async t=>{
  const s=setup(t,{respond:({task,exposure})=>task.candidateId&&exposure.artifacts.some(a=>a.payload.kind==='sourced-response')?review(exposure,task,{cite:false}):undefined}),r=await s.run();
  assert.equal(s.entry().status,'FALLBACK');assert.equal(s.entry().disposition.code,'SOURCED_REVIEW_COVERAGE');assert.ok(r.plan);
  assert.notEqual(s.engine.store.list('artifact').find(a=>a.data.payload.kind==='sourced-response').data.status,'ACCEPTED');
});
test('Sourced response / SIM: rejected candidate and routing reason do not become plan premises',async t=>{
  const marker='REJECTED_SOURCE_PRODUCT_MARKER';const s=setup(t,{respond:({task,exposure,request})=>{
    if(task.node?.id===SOURCED_RESPONSE_NODE&&task.step>0)return final(marker,exposure.sources.map(fact));
    if(task.candidateId&&exposure.artifacts.some(a=>a.payload.kind==='sourced-response'))return review(exposure,task,{decision:'RETURN'});
    if(task.originalRequest){assert.equal(task.originalRequest,s.intent);assert.ok(!request.input.includes(marker));}
  }}),r=await s.run();assert.ok(r.plan);assert.equal(s.entry().status,'FALLBACK');
  assert.equal(s.engine.store.list('artifact').find(a=>a.data.payload.kind==='sourced-response').data.status,'RETURNED');
});
for(const name of ['workspace.read','workspace.list','workspace.write','execution.run'])test('Sourced response / SIM: outside authority cannot execute '+name,async t=>{
  const s=setup(t,{options:{allowedTools:['source.fetch',name]},respond:({task})=>task.node?.id===SOURCED_RESPONSE_NODE?tool(name,{path:'input.txt'}):undefined}),r=await s.run();
  assert.equal(s.entry().status,'FALLBACK');assert.equal(s.engine.store.list('effect').length,0);assert.equal(s.network.length,0);assert.ok(r.plan);
});
test('Sourced response / SIM: acquisition limit is validated before the first batch effect',async t=>{
  const s=setup(t,{options:{producerBatch:'read-test-cursor-v1'},respond:({task})=>task.node?.id===SOURCED_RESPONSE_NODE?{...tool('',{}),action:'batch',argsJson:JSON.stringify([1,2,3,4,5].map(i=>({tool:'source.fetch',args:{url:'https://example.com/'+i}})))}:undefined});
  s.engine.workers.maxBatchOperations=8;
  await s.run();assert.equal(s.entry().status,'FALLBACK');assert.equal(s.network.length,0);assert.equal(s.engine.store.list('effect').length,0);
});
test('Sourced response / SIM: two known acquisitions can share one proposal without self-review',async t=>{
  const s=setup(t,{options:{producerBatch:'read-test-cursor-v1'},respond:({task})=>task.node?.id===SOURCED_RESPONSE_NODE&&task.step===0?
    {...tool('',{}),action:'batch',argsJson:JSON.stringify([1,2].map(i=>({tool:'source.fetch',args:{url:'https://example.com/'+i}})))}:undefined}),r=await s.run();
  assert.equal(r.mission.status,'COMPLETED',JSON.stringify(r.mission.pending));assert.equal(s.calls,3);assert.equal(s.network.length,2);
  assert.equal(acceptedSourcedArtifact(s,r.outcome).payload.claims.length,2);
});
test('Sourced response / SIM: rejected HTTP and oversized bodies stay failed, then bounded alternatives can deliver',async t=>{
  const deniedMarker='PRIVATE_DENIED_RESPONSE_MUST_NOT_PERSIST',oversizedMarker='PRIVATE_OVERSIZED_RESPONSE_MUST_NOT_PERSIST',
    oversized=oversizedMarker+'é'.repeat(32769),caps=[];
  const s=setup(t,{transport:args=>{
    caps.push(args.maxBytes);
    if(args.url.pathname==='/denied')return {remoteAddress:'8.8.8.8',statusCode:403,headers:{'content-type':'text/plain'},body:Buffer.from(deniedMarker)};
    if(args.url.pathname==='/oversized')return {remoteAddress:'8.8.8.8',statusCode:200,headers:{'content-type':'text/plain'},body:Buffer.from(oversized)};
    return {remoteAddress:'8.8.8.8',statusCode:200,headers:{'content-type':'text/plain'},body:Buffer.from('Admissible source '+args.url.pathname)};
  },respond:({task,exposure})=>{
    if(task.node?.id!==SOURCED_RESPONSE_NODE)return;
    const acquire=(path,method)=>({...tool('source.fetch',{url:'https://example.com/'+path}),method});
    if(task.step===0)return acquire('denied','initial-denied-source');
    if(task.step===1){assert.equal(exposure.sources.length,0);assert.equal(exposure.toolObservations.at(-1).result.error.code,'SOURCE_HTTP_STATUS');return acquire('oversized','replace-denied-source');}
    if(task.step===2){assert.equal(exposure.sources.length,0);assert.equal(exposure.toolObservations.at(-1).result.error.code,'SOURCE_LIMIT');return acquire('primary','replace-oversized-source');}
    if(task.step===3){assert.equal(exposure.sources.length,1);return acquire('corroborating','independent-corroboration');}
    if(task.step===4){assert.equal(exposure.sources.length,2);return final('Two complete admissible sources were acquired.',exposure.sources.map(fact));}
  }}),r=await s.run();
  assert.equal(r.mission.status,'COMPLETED',JSON.stringify(r.mission.pending));
  assert.deepEqual(caps,[65536,65536,65536,65536]);
  const effects=s.engine.store.list('effect').map(record=>record.data);
  assert.deepEqual(effects.map(effect=>effect.state),['FAILED','FAILED','SUCCEEDED','SUCCEEDED']);
  assert.equal(effects[0].receipt.data.result.error.code,'SOURCE_HTTP_STATUS');
  assert.equal(effects[1].receipt.data.result.error.code,'SOURCE_LIMIT');
  assert.equal(Object.hasOwn(effects[0].receipt.data.result,'content'),false);
  assert.equal(Object.hasOwn(effects[1].receipt.data.result,'content'),false);
  assert.equal(s.engine.store.list('source').length,2,'only 2xx and cap-compliant responses are admitted');
  const durable=JSON.stringify({effects:s.engine.store.list('effect').map(record=>record.data),
    sources:s.engine.store.list('source').map(record=>record.data),traces:s.engine.store.list('source-http-trace').map(record=>record.data)});
  assert.equal(durable.includes(deniedMarker),false);assert.equal(durable.includes(oversizedMarker),false);
  assert.equal(JSON.stringify(s.exposures).includes(deniedMarker),false);assert.equal(JSON.stringify(s.exposures).includes(oversizedMarker),false);
});
test('Sourced response / SIM: a distinct source URL may retain the same cosmetic method label after a failed fetch',async t=>{
  const label='candidate-source-acquisition';
  const s=setup(t,{transport:args=>args.url.pathname==='/rejected'
    ?{remoteAddress:'8.8.8.8',statusCode:404,headers:{'content-type':'text/plain'},body:Buffer.from('Rejected fixture')}
    :{remoteAddress:'8.8.8.8',statusCode:200,headers:{'content-type':'text/plain'},body:Buffer.from('Admissible alternate source')},
  respond:({task,exposure})=>{
    if(task.node?.id!==SOURCED_RESPONSE_NODE)return;
    if(task.step===0)return {...tool('source.fetch',{url:'https://example.com/rejected'}),method:label};
    if(task.step===1){
      assert.equal(exposure.sources.length,0);
      assert.equal(exposure.toolObservations.at(-1).result.error.code,'SOURCE_HTTP_STATUS');
      return {...tool('source.fetch',{url:'https://example.com/alternate'}),method:label};
    }
    if(task.step===2)return final('The alternate source was acquired after the rejected candidate.',exposure.sources.map(fact));
  }}),r=await s.run();
  assert.equal(r.mission.status,'COMPLETED',JSON.stringify(r.mission.pending));
  assert.deepEqual(s.network,['https://example.com/rejected','https://example.com/alternate']);
  assert.deepEqual(s.engine.store.list('effect').map(record=>record.data.state),['FAILED','SUCCEEDED']);
  assert.equal(s.engine.store.list('source').length,1,'Only the alternate 2xx source is admitted');
  assert.equal(s.calls,4,'Two bounded fetch proposals, then candidate and independent review');
});
test('Sourced response / SIM: exact failed source URL remains blocked even when its method label changes',async t=>{
  const url='https://example.com/rejected';
  const s=setup(t,{options:{sourcedFallback:SOURCED_RESPONSE_DEFER_ONLY_FALLBACK},transport:()=>({
    remoteAddress:'8.8.8.8',statusCode:404,headers:{'content-type':'text/plain'},body:Buffer.from('Rejected fixture')
  }),respond:({task})=>{
    if(task.node?.id!==SOURCED_RESPONSE_NODE)return;
    return task.step===0
      ?{...tool('source.fetch',{url}),method:'initial-source-candidate'}
      :{...tool('source.fetch',{url}),method:'renamed-identical-source-candidate'};
  }}),r=await s.run();
  assert.equal(r.mission.status,'NEEDS_DIRECTION',JSON.stringify(r.mission.pending));
  assert.equal(s.entry().status,'FALLBACK');assert.equal(s.entry().disposition.code,'WORKER_REPEATED_FAILURE');
  assert.deepEqual(s.network,[url],'The identical failed request is rejected before another network attempt');
  assert.equal(s.engine.store.list('effect').length,1);
});
test('Sourced response / SIM: reviewer quota retains candidate, no new acquisition or producer',async t=>{
  let fail=true;const s=setup(t,{respond:({task})=>{if(task.candidateId&&fail){fail=false;throw Object.assign(Error('SIM quota'),{code:'QUOTA'});}}});
  assert.equal((await s.run()).mission.status,'WAITING_QUOTA');const a=s.entry().artifactId;
  s.reopen();const r=await s.run();assert.equal(r.mission.status,'COMPLETED',JSON.stringify(r.mission.pending));
  assert.equal(r.outcome.id,a);assert.equal(s.entry().productionAttempts,1);assert.equal(s.network.length,1);assert.equal(s.calls,4);
});
test('Sourced response / SIM: producer recovery retains source and does not refund prior acquisition',async t=>{
  let fail=true;const s=setup(t,{respond:({task,exposure})=>{
    if(task.node?.id===SOURCED_RESPONSE_NODE&&task.step===1&&fail){fail=false;throw Object.assign(Error('SIM quota'),{code:'QUOTA'});}
    if(task.node?.id===SOURCED_RESPONSE_NODE&&!fail)return final('The previously acquired fixture reports 17.',exposure.sources.map(fact));
  }});
  assert.equal((await s.run()).mission.status,'WAITING_QUOTA');const old=s.entry().runId;s.reopen();const r=await s.run();
  assert.equal(r.mission.status,'COMPLETED',JSON.stringify(r.mission.pending));assert.notEqual(s.entry().runId,old);
  assert.equal(s.entry().productionAttempts,2);assert.equal(s.network.length,1);assert.equal(s.calls,4);
  assert.deepEqual(acceptedSourcedArtifact(s,r.outcome).payload.toolReceipts,[]);
});
test('Sourced response / SIM: uncertain provider closure cannot fall through to another inference',async t=>{
  const s=setup(t,{close:()=>({processExitObserved:false})});const r=await s.run();
  assert.equal(r.mission.status,'WAITING_CAPABILITY');assert.equal(s.calls,1);assert.equal(s.network.length,0);
  s.reopen();await s.run();assert.equal(s.calls,1);
});
test('Sourced response / SIM: immutable original policy is checked before recovery',async t=>{
  const s=setup(t,{respond:()=>{throw Object.assign(Error('SIM quota'),{code:'QUOTA'});}});await s.run();
  const m=s.engine.store.get('mission',s.mission.id);s.engine.store.put('mission',m.id,{...m.data,policy:{...m.data.policy,maxNodeAttempts:9}},{expectedVersion:m.version});
  s.reopen();const count=s.calls,r=await s.run();assert.equal(r.mission.status,'UNVERIFIED');assert.equal(r.mission.admissionIntegrity,'UNVERIFIED');
  assert.equal(r.outcome,null);assert.equal(r.plan,null);assert.deepEqual(r.nodes,[]);assert.equal(s.calls,count);
  const durable=s.engine.store.get('mission',s.mission.id).data;
  assert.equal(durable.status,'FAILED');assert.equal(durable.pending.at(-1).code,'SOURCED_RESPONSE_BINDING');
});

const discovery=a=>({schema:'sovereign.discovery.v1',query:a.query,queryHash:sha256(a),candidates:[
  {title:'Synthetic unverified pointer',url:'https://example.com/fixture',evidenceStatus:'UNVERIFIED_DISCOVERY_CANDIDATE'}],
  inference:{toolPolicy:'public-search-v1',simulation:true,status:'completed'},searchObservations:[{actionType:'search'}],closure:{processExitObserved:true}});
test('Sourced response / SIM: discovery is only a pointer; fetch precedes factual candidate',async t=>{
  let searches=0;const s=setup(t,{options:{allowedTools:['source.search','source.fetch'],producerBatch:'read-test-cursor-v1'},
    search:async args=>{searches++;return discovery(args);},respond:({task,exposure})=>{
      if(task.node?.id!==SOURCED_RESPONSE_NODE)return;
      if(task.step===0)return tool('source.search',{query:'synthetic public fixture',limit:1});
      if(task.step===1){assert.equal(exposure.sources.length,0);const found=exposure.toolObservations[0].result.candidates[0];
        assert.equal(found.evidenceStatus,'UNVERIFIED_DISCOVERY_CANDIDATE');return tool('source.fetch',{url:found.url});}
    }}),r=await s.run();
  assert.equal(r.mission.status,'COMPLETED',JSON.stringify(r.mission.pending));assert.equal(s.calls,4);assert.equal(searches,1);assert.equal(s.network.length,1);
  assert.equal(s.engine.store.list('source').length,1);
  assert.equal(acceptedSourcedArtifact(s,r.outcome).payload.claims[0].sources[0].sourceId,s.exposures.at(-1).exposure.sources[0].id);
});
test('Sourced response / SIM: a second search never spends another discovery call',async t=>{
  let searches=0;const s=setup(t,{options:{allowedTools:['source.search','source.fetch']},search:async a=>{searches++;return discovery(a);},
    respond:({task})=>task.node?.id===SOURCED_RESPONSE_NODE?tool('source.search',{query:'public fixture '+task.step,limit:1}):undefined});
  await s.run();assert.equal(s.entry().status,'FALLBACK');assert.equal(searches,1);assert.equal(s.network.length,0);assert.equal(s.engine.store.list('source').length,0);
});
test('Sourced response / SIM: search receipt cannot masquerade as an acquired source',async t=>{
  const s=setup(t,{options:{allowedTools:['source.search','source.fetch']},search:async a=>discovery(a),respond:({task,exposure})=>{
    if(task.node?.id!==SOURCED_RESPONSE_NODE)return;
    if(task.step===0)return tool('source.search',{query:'public fixture',limit:1});
    const o=exposure.toolObservations[0];return final('Invented search-snippet fact.',[fact({id:'source:'+o.id,hash:o.hash,raw:'Synthetic unverified pointer'})]);
  }});await s.run();assert.equal(s.entry().status,'FALLBACK');assert.equal(s.network.length,0);assert.equal(s.engine.store.list('source').length,0);
  assert.equal(s.engine.store.list('artifact').filter(a=>a.data.payload.kind==='sourced-response').length,0);
});
test('Sourced response / SIM: recovery cannot reset the four-acquisition envelope',async t=>{
  let fail=true;const s=setup(t,{respond:({task})=>{
    if(task.node?.id!==SOURCED_RESPONSE_NODE)return;
    if(fail&&task.step===1){fail=false;throw Object.assign(Error('SIM quota'),{code:'QUOTA'});}
    return tool('source.fetch',{url:'https://example.com/'+(fail?'first':'recovery-'+task.step)});
  }});
  assert.equal((await s.run()).mission.status,'WAITING_QUOTA');s.reopen();await s.run();
  assert.equal(s.entry().status,'FALLBACK');assert.equal(s.network.length,4);assert.equal(s.engine.store.list('effect').length,4);assert.equal(s.entry().productionAttempts,2);
});
test('Sourced response / SIM: completed producer and reviewer cannot acquire extra sources',async t=>{
  const s=setup(t),r=await s.run();assert.equal(r.mission.status,'COMPLETED');const before=s.engine.store.list('effect').length;
  const judge=s.engine.store.list('run').find(r=>r.data.mode==='reviewer').id;
  for(const actor of [s.entry().runId,judge])await assert.rejects(s.engine.workers.tool(actor,'source.fetch',{url:'https://example.com/extra'},actor+':extra'),{code:'SOURCED_RESPONSE_SCOPE'});
  assert.equal(s.network.length,1);assert.equal(s.engine.store.list('effect').length,before);
});
test('Sourced response / SIM: retracted evidence invalidates delivered answer on reentry',async t=>{
  const s=setup(t),r=await s.run();assert.equal(r.mission.status,'COMPLETED');
  const id=s.engine.store.list('source')[0].id;s.engine.registry.retractSource(id,'Synthetic retraction of original evidence.');
  assert.throws(()=>s.engine.registry.assertUsable(r.outcome.id,{missionId:s.mission.id,purpose:SOURCED_RESPONSE_PURPOSE}));
  s.reopen();const next=await s.run();assert.notEqual(next.mission.finalArtifactId,r.outcome.id);assert.ok(next.plan);
  assert.equal(s.engine.store.get('artifact',r.outcome.id).data.status,'INVALIDATED');
});
test('Sourced response / SIM: claim expiration cannot return the old delivered answer',async t=>{
  const future=new Date(Date.now()+600000).toISOString(),s=setup(t,{respond:({task,exposure})=>task.node?.id===SOURCED_RESPONSE_NODE&&task.step>0?
    final('Synthetic dated answer.',exposure.sources.map(source=>({...fact(source),validUntil:future}))):undefined});
  const r=await s.run();assert.equal(r.mission.status,'COMPLETED');const count=s.calls;
  s.engine.registry.clock=()=>new Date(Date.parse(future)+1).toISOString();const next=await s.run();
  assert.notEqual(next.mission.status,'COMPLETED');assert.equal(next.mission.finalArtifactId,null);assert.equal(s.calls,count);assert.equal(s.network.length,1);
});
test('Sourced response / SIM: legacy instruction resolver is not called by either actor',async t=>{
  const s=setup(t);let calls=0;s.engine.workers.learningInstructionsResolver=()=>{calls++;throw Error('Unqualified overlay must not resolve');};
  assert.equal((await s.run()).mission.status,'COMPLETED');assert.equal(calls,0);
  const configs=s.engine.store.list('worker-config').map(r=>r.data);
  assert.equal(configs.length,2);
  const producer=s.engine.store.get('worker-config',s.entry().runId).data;
  const reviewerId=s.engine.store.get('review',s.entry().reviewId).data.reviewerRunId;
  const reviewer=s.engine.store.get('worker-config',reviewerId).data;
  assert.ok(producer.learningDisposition.exclusions.includes('SOURCED_CONTROLLER_UNQUALIFIED'));
  assert.ok(reviewer.learningDisposition.exclusions.includes('SOURCED_REVIEW_UNQUALIFIED'));
  assert.ok(configs.every(c=>c.learnedInstructionVersions.length===0));
});
for(const options of [{nativeReadTransport:'native-read-v1'},{boundedReadPresentation:'separate-evidence-v1'},
  {documentContext:'literal-windows-v1'},{contextEncoding:'source-text-v1'}])test('Sourced response: incompatible policy fails before creating another mission '+JSON.stringify(options),t=>{
  const s=setup(t),before=s.engine.store.verifyJournal(),count=s.engine.store.list('mission').length;
  assert.throws(()=>s.engine.create(s.intent,{entryMode:'sourced-response-v1',...options}),{code:'POLICY'});
  assert.equal(s.engine.store.list('mission').length,count);assert.deepEqual(s.engine.store.verifyJournal(),before);
});
test('Sourced response: transaction rollback preserves preceding protocol and history',t=>{
  const dir=fs.mkdtempSync(join(tmpdir(),'sovereign-sourced-rollback-'));
  const e=new FactoryEngine({databasePath:join(dir,'state.sqlite'),workspaceRoot:join(dir,'jobs')});
  t.after(()=>{e.close();fs.rmSync(dir,{recursive:true,force:true});});
  e.create('Existing legacy request.',{allowedTools:[]});
  const store=e.store,before=store.verifyJournal(),put=store.put.bind(store);
  store.put=(type,...args)=>{if(type==='mission')throw Error('Synthetic cut after floor before mission');return put(type,...args);};
  assert.throws(()=>e.create('A new public factual question.',{entryMode:'sourced-response-v1'}),/Synthetic cut/);
  assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,15);assert.deepEqual(store.verifyJournal(),before);
});
test('Sourced response / SIM: retained exact final survives candidate commit window without another inference',async t=>{
  const s=setup(t),create=s.engine.registry.create.bind(s.engine.registry);let fail=true;
  s.engine.registry.create=args=>{if(args.kind==='sourced-response'&&fail){fail=false;throw Object.assign(Error('SIM crash before candidate'),{code:'QUOTA'});}return create(args);};
  assert.equal((await s.run()).mission.status,'WAITING_QUOTA');assert.equal(s.calls,2);assert.equal(s.network.length,1);
  s.reopen();const r=await s.run();assert.equal(r.mission.status,'COMPLETED',JSON.stringify(r.mission.pending));
  assert.equal(s.calls,3);assert.equal(s.network.length,1);assert.equal(s.entry().productionAttempts,1);
});
test('Sourced response / SIM: source-support citations for only one of two claims cannot pass',async t=>{
  const s=setup(t,{respond:({task,exposure})=>{
    if(task.node?.id===SOURCED_RESPONSE_NODE&&task.step===0)return {...tool('',{}),action:'batch',argsJson:JSON.stringify([1,2].map(i=>({tool:'source.fetch',args:{url:'https://example.com/'+i}})))};
    if(task.candidateId&&exposure.artifacts.some(a=>a.payload.kind==='sourced-response')){
      const r=review(exposure,task),keep=exposure.sources[0].id;
      r.checks.find(c=>c.criterionId==='source-support').evidence=r.checks[0].evidence.filter(e=>e.kind!=='source'||e.id===keep);return r;
    }
  }});await s.run();assert.equal(s.entry().status,'FALLBACK');assert.equal(s.entry().disposition.code,'SOURCED_REVIEW_COVERAGE');
});
test('Sourced response / SIM: source exactly at route byte boundary stays complete',async t=>{
  const raw='é'.repeat(32768),s=setup(t,{transport:()=>raw,respond:({task,exposure})=>{
    if(task.node?.id===SOURCED_RESPONSE_NODE&&task.step>0)return final('The complete synthetic source is recorded.',
      exposure.sources.map(source=>({...fact(source),sources:[{sourceId:source.id,hash:source.hash,quote:'é'}]})));
    if(task.candidateId&&exposure.artifacts.some(a=>a.payload.kind==='sourced-response')){
      const r=review(exposure,task);for(const c of r.checks)for(const e of c.evidence)if(e.kind==='source')e.quote='é';return r;
    }
  }}),r=await s.run();assert.equal(r.mission.status,'COMPLETED',JSON.stringify(r.mission.pending));
  assert.equal(s.exposures.at(-1).exposure.sources[0].raw,raw);assert.equal(s.engine.store.list('source')[0].data.raw,raw);
});
test('Sourced response: previous bounded presentation still executes after floor 10 on the same DB',async t=>{
  const s=setup(t,{respond:({task})=>task.node?.id==='bounded-read-entry'?final('13 + 17 = 30.'):undefined});
  const m=s.engine.create('Calculate 13 + 17.',{entryMode:'bounded-read-response-v1',boundedReadPresentation:'separate-evidence-v1',allowedTools:[]});
  const r=await s.engine.run(m.id);assert.equal(r.mission.status,'COMPLETED',JSON.stringify(r.mission.pending));
  assert.equal(r.outcome.payload.body,'13 + 17 = 30.');assert.equal(s.engine.store.db.prepare('PRAGMA user_version').get().user_version,10);
});
