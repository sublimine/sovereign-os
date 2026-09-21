import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {ToolBroker} from '../../factory/tools/broker.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';

const runtime=evaluation=>({id:evaluation,text:`Verify ${evaluation}`,evaluation});
function setup(t,criteria) {
  const dir=mkdtempSync(join(tmpdir(),'factory-controls-')),store=new Store(':memory:'),authority=new Authority(store),registry=new ArtifactRegistry(store,authority);
  const broker=new ToolBroker({store,authority,workspaceRoot:join(dir,'jobs')}),workspace=broker.registerWorkspace('mission');let n=0;
  const run=(mode,artifactIds=[])=>{const r=registry.registerRun({missionId:'mission',nodeId:mode,mode,context:{purpose:'purpose',artifactIds,sourceIds:[],instructionsHash:sha256('fixture'),producerConversationIncluded:false}});registry.attachInference(r.id,{status:'completed',simulation:true,threadId:`fixture-${++n}`,turnId:'turn'});return r;};
  const producer=run('producer'),artifact=registry.create({missionId:'mission',nodeId:producer.nodeId,producerRunId:producer.id,kind:'analysis',purpose:'purpose',body:'Observed candidate.',criteria}),reviewer=run('reviewer',[artifact.id]);
  const request=(checks=[])=>({artifactId:artifact.id,reviewerRunId:reviewer.id,result:{artifactHash:artifact.payloadHash,purpose:artifact.payload.purpose,decision:'ACCEPT',checks,findings:[],uncertainty:'Synthetic inference fixtures; runtime controls real.'}});
  const effect=async(tool,args)=>broker.execute({missionId:'mission',principalId:producer.id,lease:authority.issue({missionId:'mission',principalId:producer.id,actions:[tool],resources:['workspace:mission'],classification:'INTERNAL',expiresAt:new Date(Date.now()+60000).toISOString()}),operationId:`operation-${++n}`,tool,args});
  t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
  return {store,authority,registry,broker,workspace,producer,artifact,reviewer,request,effect};
}

test('runtime independent review is created atomically without requiring its own prior review record',t=>{
  const s=setup(t,[runtime('runtime.independent_review'),runtime('runtime.no_file_writes'),runtime('runtime.no_code_execution')]);
  assert.equal(s.store.list('review').length,0);
  const accepted=s.registry.review(s.request()),review=s.store.get('review',accepted.reviews[0]).data;
  assert.equal(accepted.status,'ACCEPTED');assert.equal(review.result.checks.length,3);assert.equal(s.store.list('review-control').length,3);
  for(const check of review.result.checks){assert.equal(check.verdict,'PASS');const proof=check.evidence[0],signed=s.store.get('review-control',proof.id).data.signed;assert.equal(proof.hash,sha256(signed));assert.equal(s.authority.open(signed,'review.control').reviewerRunId,s.reviewer.id);}
  assert.equal(s.registry.assertUsable(accepted.id,{missionId:'mission',purpose:'purpose'}).status,'ACCEPTED');
});

test('caller cannot fabricate runtime verdicts or internal control evidence',t=>{
  const s=setup(t,[runtime('runtime.no_file_writes')]);
  assert.throws(()=>s.registry.review(s.request([{criterionId:'runtime.no_file_writes',verdict:'PASS',evidence:[{kind:'control',id:'invented',hash:sha256('invented'),quote:'safe'}],reason:'Invented.'}])),{code:'REVIEW_COVERAGE'});
  assert.equal(s.store.list('review-control').length,0);assert.equal(s.store.list('review').length,0);
  const semantic=setup(t,[{id:'semantic',text:'Content judgment.'}]);
  assert.throws(()=>semantic.registry.review(semantic.request([{criterionId:'semantic',verdict:'PASS',evidence:[{kind:'control',id:'invented',hash:sha256('invented'),quote:'safe'}],reason:'Invented.'}])),{code:'REVIEW_EVIDENCE'});
});

test('real mission write defeats no-write control even absent from model exposure',async t=>{
  const s=setup(t,[runtime('runtime.no_file_writes')]);
  const signed=await s.effect('workspace.write',{path:'actual.txt',content:'actual effect',expectedHash:null});assert.equal(signed.data.status,'SUCCEEDED');
  assert.equal(readFileSync(join(s.workspace.path,'actual.txt'),'utf8'),'actual effect');
  assert.equal(s.registry.getToolObservations(s.reviewer.id).length,0);
  const returned=s.registry.review(s.request()),review=s.store.get('review',returned.reviews[0]).data;
  assert.equal(returned.status,'RETURNED');assert.equal(review.result.checks[0].verdict,'FAIL');assert.equal(review.result.findings[0].severity,'material');
  assert.equal(s.authority.open(s.store.list('review-control')[0].data.signed,'review.control').effects[0].id,signed.data.id);
});

test('attempted unavailable execution never produces a false absence-of-code-execution certificate',async t=>{
  const s=setup(t,[runtime('runtime.no_code_execution')]);
  assert.equal((await s.effect('execution.run',{argv:['true'],cwd:'.'})).data.status,'FAILED');
  const returned=s.registry.review(s.request());assert.equal(returned.status,'RETURNED');
  assert.equal(s.store.get('review',returned.reviews[0]).data.result.checks[0].verdict,'FAIL');
});

test('absence certificate cannot remain usable after a subsequent real mission write',async t=>{
  const s=setup(t,[runtime('runtime.no_file_writes')]),accepted=s.registry.review(s.request());
  assert.equal(s.registry.assertUsable(accepted.id,{missionId:'mission',purpose:'purpose'}).status,'ACCEPTED');
  await s.effect('workspace.write',{path:'later.txt',content:'later effect',expectedHash:null});
  assert.throws(()=>s.registry.assertUsable(accepted.id,{missionId:'mission',purpose:'purpose'}),{code:'UNACCEPTED_INPUT'});
});

test('pending mission effect intent yields UNKNOWN rather than an absence claim',t=>{
  const s=setup(t,[runtime('runtime.no_file_writes')]);
  // Explicit durable-intent unit fixture; this test does not claim a file effect.
  s.store.put('effect','pending-operation',{missionId:'mission',principalId:s.producer.id,tool:'workspace.write',state:'PREPARED',argsHash:sha256({path:'pending.txt'})},{expectedVersion:0});
  const returned=s.registry.review(s.request());assert.equal(returned.status,'RETURNED');
  assert.equal(s.store.get('review',returned.reviews[0]).data.result.checks[0].verdict,'UNKNOWN');
});
test('no-source-fetch control uses the complete broker ledger, not empty model exposure',t=>{
  const s=setup(t,[runtime('runtime.no_source_fetch')]),accepted=s.registry.review(s.request());
  assert.equal(accepted.status,'ACCEPTED');
  s.store.put('effect','external-source-attempt',{missionId:'mission',principalId:s.producer.id,tool:'source.fetch',state:'FAILED',argsHash:sha256({url:'https://example.com'})},{expectedVersion:0});
  assert.throws(()=>s.registry.assertUsable(accepted.id,{missionId:'mission',purpose:'purpose'}),{code:'UNACCEPTED_INPUT'});
  const other=setup(t,[runtime('runtime.no_source_fetch')]);
  other.store.put('effect','pending-source-attempt',{missionId:'mission',principalId:other.producer.id,tool:'source.fetch',state:'PREPARED',argsHash:sha256({url:'https://example.com'})},{expectedVersion:0});
  const returned=other.registry.review(other.request());assert.equal(returned.status,'RETURNED');
  assert.equal(other.store.get('review',returned.reviews[0]).data.result.checks[0].verdict,'UNKNOWN');
});
test('legacy no-source-fetch control also excludes discovery; a search cannot bypass the no-external-research constraint',t=>{
  const s=setup(t,[runtime('runtime.no_source_fetch')]),a=s.registry.review(s.request());
  s.store.put('effect','search-attempt',{missionId:'mission',principalId:s.producer.id,tool:'source.search',state:'FAILED',argsHash:sha256({query:'fixture',limit:1})},{expectedVersion:0});
  assert.throws(()=>s.registry.assertUsable(a.id,{missionId:'mission',purpose:'purpose'}),{code:'UNACCEPTED_INPUT'});
});
