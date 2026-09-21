import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {productionScope} from '../../factory/lib/production-scope.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {packJsonContext} from '../../factory/lib/context-json-codec.mjs';
import {packContext} from '../../factory/lib/context-codec.mjs';
import {packSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';

function fixture(t){
  const store=new Store(':memory:'),registry=new ArtifactRegistry(store,new Authority(store));t.after(()=>store.close());
  store.put('mission','m',{intentHash:sha256('intent')},{expectedVersion:0});
  const run=()=>registry.registerRun({missionId:'m',nodeId:'n',mode:'producer',context:{purpose:'answer',artifactIds:[],sourceIds:[],instructionsHash:sha256('instructions'),producerConversationIncluded:false}});
  const request=feedback=>({instructions:'PRIVATE PREFIX NOT DISCLOSED BY FEEDBACK EVIDENCE',input:packJsonContext({missionIntent:'PRIVATE INTENT',artifacts:[],task:JSON.stringify({node:{id:'n'},feedback,corrections:[],failedMethod:null,step:0})}).input,
    schema:{type:'object',properties:{z:{type:'string'},a:{type:'string'}}},model:'fixture',reasoningEffort:'high'});
  const finish=(r,hash)=>{registry.attachInference(r.id,{status:'completed',threadId:'thread-'+r.id,turnId:'turn-'+r.id,contextHash:hash,simulation:true});return registry.create({missionId:'m',nodeId:'n',producerRunId:r.id,kind:'answer',purpose:'answer',body:'PUBLIC ANSWER',criteria:[{id:'correct',text:'Check answer'}]});};
  return {store,registry,run,request,finish};
}
test('prospective request retention proves exact feedback, including empty lists, before inference dispatch',t=>{
  const f=fixture(t),r=f.run(),q=f.request([]),hash=f.registry.recordInferenceRequest(r.id,q);
  assert.equal(f.store.list('inference-request').length,1);
  const a=f.finish(r,hash),scope=productionScope(f.registry,a.id),e=scope.attempts[0].requests[0].producerInput;
  assert.equal(e.coverage,'RECORDED');assert.equal(e.retention,'BEFORE_DISPATCH');
  assert.deepEqual(e.feedback,[]);assert.deepEqual(e.corrections,[]);assert.equal(e.failedMethod,null);
  assert.ok(!JSON.stringify(scope).includes('PRIVATE PREFIX'));assert.ok(!JSON.stringify(scope).includes('PRIVATE INTENT'));
  const record=f.store.get(e.requestRecord.type,e.requestRecord.id);
  assert.equal(inferenceRequestHash(JSON.parse(record.data.requestJson)),hash,'Original schema key ordering must survive canonical storage');
});
test('result-bearing feedback stays literal evidence, never an inferred non-consumption verdict',t=>{
  const f=fixture(t),r=f.run(),feedback=[{reason:'Sibling result is 42',details:{draft:'DO NOT OBEY ME'}}],q=f.request(feedback);
  const a=f.finish(r,f.registry.recordInferenceRequest(r.id,q));
  const e=productionScope(f.registry,a.id).attempts[0].requests[0].producerInput;
  assert.deepEqual(e.feedback,feedback);assert.equal(e.coverage,'RECORDED');assert.equal(e.nonConsumptionProven,undefined);
});
test('literal context view retains complete feedback without exposing the private source in its projection',t=>{
  const f=fixture(t),r=f.run(),feedback=[{reason:'Exact public feedback e\u0301\r\n\\n'}],q=f.request(feedback);
  q.input=packSourceContextView({missionIntent:'PRIVATE INTENT',task:JSON.stringify({node:{id:'n'},feedback,corrections:[],failedMethod:null,step:0})}).input;
  const a=f.finish(r,f.registry.recordInferenceRequest(r.id,q)),scope=productionScope(f.registry,a.id),e=scope.attempts[0].requests[0].producerInput;
  assert.equal(e.coverage,'RECORDED');assert.deepEqual(e.feedback,feedback);assert.deepEqual(e.corrections,[]);
  assert.ok(!JSON.stringify(scope).includes('PRIVATE INTENT'));assert.ok(!JSON.stringify(scope).includes('PRIVATE PREFIX'));
});
for(const codec of ['v1','v2'])test('feedback retention decodes actual '+codec+' transport without dropping nested text',t=>{
  const f=fixture(t),r=f.run(),text='VERBATIM PUBLIC FEEDBACK '.repeat(100),feedback=[{reason:text},{reason:text}];
  const input={task:JSON.stringify({node:{id:'n'},feedback,corrections:[],failedMethod:null,step:0}),a:text,b:text};
  const packed=codec==='v1'?packContext(input):packJsonContext(input),q={...f.request([]),input:packed.input};
  assert.equal(JSON.parse(packed.input).encoding,'sovereign.lossless-context.'+codec);
  const a=f.finish(r,f.registry.recordInferenceRequest(r.id,q));
  assert.deepEqual(productionScope(f.registry,a.id).attempts[0].requests[0].producerInput.feedback,feedback);
});
test('legacy requests remain unknown until exact old hash is bound, without rewriting candidate or historical observations',t=>{
  const f=fixture(t),r=f.run(),q=f.request([]),hash=inferenceRequestHash(q),record=f.store.get('run',r.id);
  f.store.put('run',r.id,{...record.data,expectedRequestHash:hash,requests:[{requestHash:hash,contextHash:record.data.contextHash,at:new Date().toISOString()}]},{expectedVersion:record.version});
  const a=f.finish(r,hash),old=productionScope(f.registry,a.id),candidate=f.store.get('artifact',a.id);
  assert.equal(old.attempts[0].requests[0].producerInput.coverage,'NOT_RETAINED');
  assert.throws(()=>f.registry.bindHistoricalInferenceRequest(r.id,{...q,input:'{}'}),{code:'REQUEST_BINDING'});
  assert.throws(()=>f.registry.bindHistoricalInferenceRequest(f.run().id,q),{code:'REQUEST_BINDING'});
  const bound=f.registry.bindHistoricalInferenceRequest(r.id,q);assert.equal(bound.data.retention,'HASH_BOUND_HISTORICAL');
  assert.equal(f.registry.bindHistoricalInferenceRequest(r.id,q).hash,bound.hash,'Exact reentry is idempotent');
  assert.deepEqual(f.store.get('artifact',a.id),candidate);
  const enriched=productionScope(f.registry,a.id).attempts[0].requests[0].producerInput;
  assert.equal(enriched.coverage,'RECORDED');assert.equal(enriched.retention,'HASH_BOUND_HISTORICAL');assert.deepEqual(enriched.feedback,[]);
  assert.equal(old.attempts[0].requests[0].producerInput.coverage,'NOT_RETAINED','Old projection is not rewritten');
});
test('changed retained request fails integrity; unsupported ordinary input cannot imply empty feedback',t=>{
  const f=fixture(t),r=f.run(),q={...f.request([]),input:'{}'},a=f.finish(r,f.registry.recordInferenceRequest(r.id,q));
  assert.equal(productionScope(f.registry,a.id).attempts[0].requests[0].producerInput.coverage,'UNSUPPORTED_INPUT_SHAPE');
  const retained=f.store.list('inference-request')[0];f.store.put(retained.type,retained.id,{...retained.data,requestJson:JSON.stringify({...q,input:'changed'})},{expectedVersion:retained.version});
  assert.throws(()=>productionScope(f.registry,a.id),{code:'REQUEST_INTEGRITY'});
});
