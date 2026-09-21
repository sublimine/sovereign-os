import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {ToolBroker} from '../../factory/tools/broker.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';

// Offline synthetic routing/provider/HTTP, real control plane, SQLite, signed
// receipts and filesystem. Bytes are UTF-8 request payload, NOT billed tokens.
const bytes=x=>Buffer.byteLength(typeof x==='string'?x:JSON.stringify(x));
const action=(tool,args)=>({action:'tool',tool,argsJson:JSON.stringify(args),body:'',claims:[],method:'observe',reason:'Fixture acquisition'});
function plan(intent,kind,split){
  const effect=kind==='file'?[{type:'file',path:'result.txt',command:'',expectedExit:null}]:[];
  const node=(id,dependencies=[])=>({id,title:id,purpose:id,roleIds:['omega_02'],reviewerRoleIds:['omega_03'],requirementIds:['r1'],dependencies,
    method:{id:'fixture',rationale:'Explicit comparative fixture',alternatives:['Independent reconstruction']},instructions:intent,outputKind:'delivery',criteria:[{id:'result',text:intent}],
    tools:kind==='file'?['workspace.write','workspace.read']:kind==='fact'?['source.fetch']:[],requiredEffects:effect,specialist:null});
  return {requirements:[{id:'r1',text:intent,requestQuote:intent,criteria:[{id:'result',text:intent}]}],nodes:split?[node('acquire'),node('deliver',[{nodeId:'acquire',purpose:'acquire',reason:'Reuse observed product'}])]:[node('deliver')],finalNodeId:'deliver',routingRationale:'Fixed fixture, not a measured model routing decision'};
}
async function measure({kind='text',split=false,padding=0}){
  const dir=mkdtempSync(join(tmpdir(),'factory-efficiency-'));
  const store=new Store(join(dir,'state.sqlite')),authority=new Authority(store),registry=new ArtifactRegistry(store,authority);
  const sourceText='Synthetic value is 12.\n'+'x'.repeat(padding),calls=[];
  const broker=new ToolBroker({store,authority,workspaceRoot:join(dir,'workspaces'),lookup:async()=>[{address:'93.184.216.34',family:4}],transport:async()=>({statusCode:200,headers:{'content-type':'text/plain'},body:Buffer.from(sourceText),remoteAddress:'93.184.216.34'})});
  const providerFactory=()=>({async generate(request){
    const exposure=JSON.parse(request.input),task=JSON.parse(exposure.task);
    const type='requirements'in request.schema.properties?'plan':'artifactHash'in request.schema.properties?'review':'produce';
    calls.push({type,instructions:bytes(request.instructions),input:bytes(request.input),schema:bytes(request.schema),artifacts:exposure.artifacts.length,sources:exposure.sources.length,rawSourceBytes:exposure.sources.reduce((n,s)=>n+bytes(s.raw),0),observations:exposure.toolObservations.length});
    let value;
    if(type==='plan')value=plan(task.originalRequest,kind,split);
    else if(type==='review'){
      const a=exposure.artifacts.find(a=>a.id===task.candidateId);
      const evidence=[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body},...exposure.sources.map(s=>({kind:'source',id:s.id,hash:s.hash,quote:'Synthetic value is 12.'})),...exposure.toolObservations.filter(o=>o.tool==='workspace.read'&&o.relation==='OWN_ACTION'&&o.status==='SUCCEEDED').map(o=>({kind:'tool',id:o.id,hash:o.hash,quote:o.quoteText}))];
      value={artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',evidence,reason:'Synthetic fixture oracle only'})),findings:[],uncertainty:'Not live semantic validation'};
    }else if(task.step===0&&(!split||task.node.id==='acquire')&&kind!=='text')value=kind==='file'?action('workspace.write',{path:'result.txt',content:'verified fixture',expectedHash:null}):action('source.fetch',{url:'https://example.com/fixture'});
    else{
      const s=exposure.sources[0];
      value={action:'final',tool:'',argsJson:'',body:kind==='fact'?'Synthetic value is 12.':'verified fixture',claims:kind==='fact'?[{id:'value',text:'Synthetic value is 12.',kind:'fact',sources:[{sourceId:s.id,hash:s.hash,quote:'Synthetic value is 12.'}],basis:[],qualifiers:['Offline synthetic transport'],validUntil:null}]:[],method:'observed',reason:'Candidate for independent fixture review'};
    }
    assert.equal(await request.validate(value),true);
    return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:`fixture-${calls.length}`,turnId:`turn-${calls.length}`,model:request.model,reasoningEffort:request.reasoningEffort,contextHash:sha256(JSON.stringify({instructions:request.instructions,input:request.input,schema:request.schema,model:request.model,reasoningEffort:request.reasoningEffort}))}};
  },async close(){}});
  const workers=new WorkerService({store,authority,registry,broker,providerFactory}),engine=new FactoryEngine({store,authority,registry,broker,workers});
  try{
    const intent=kind==='file'?'Create result.txt containing verified fixture.':kind==='fact'?'Report the value in the synthetic source.':'Return verified fixture.';
    const mission=engine.create(intent),r=await engine.run(mission.id);
    assert.equal(r.mission.status,'COMPLETED',JSON.stringify(r.mission.pending));
    const durableOutcome=store.get('artifact',r.outcome.id).data,durablePlan=store.get('plan',mission.id).data.plan;
    assert.ok(r.nodes.every(n=>n.status==='ACCEPTED'));assert.ok(durableOutcome.payload.criteria.some(c=>c.id==='req.r1.result'));
    for(const a of store.list('artifact')){const review=store.get('review',a.data.reviews.at(-1)).data;assert.notEqual(review.reviewerRunId,a.data.payload.producerRunId);}
    if(kind==='file')assert.equal(readFileSync(join(broker.registerWorkspace(mission.id).path,'result.txt'),'utf8'),'verified fixture');
    if(kind==='fact'){assert.equal(store.list('source').length,1);assert.equal(durableOutcome.payload.claims[0].sources.length,1);}
    const summary={kind,split,padding,nodes:durablePlan.nodes.length,requirements:durablePlan.requirements.length,requiredEffects:durableOutcome.payload.requiredEffects.length,sourceRecords:store.list('source').length,inferences:calls.length,instructionBytes:calls.reduce((n,c)=>n+c.instructions,0),inputBytes:calls.reduce((n,c)=>n+c.input,0),schemaBytes:calls.reduce((n,c)=>n+c.schema,0),maxInputBytes:Math.max(...calls.map(c=>c.input)),rawSourceBytes:calls.reduce((n,c)=>n+c.rawSourceBytes,0),toolEffects:store.list('effect').length};
    return {summary,calls};
  }finally{engine.close();rmSync(dir,{recursive:true,force:true});}
}
test('OFFLINE efficiency: compact text retains planning and independent product acceptance',async t=>{
  const r=await measure({});assert.equal(r.summary.inferences,4);assert.equal(r.summary.nodes,1);assert.equal(r.summary.toolEffects,0);t.diagnostic(JSON.stringify(r.summary));
});
for(const kind of ['fact','file'])test(`OFFLINE efficiency: ${kind} compact versus split with preserved obligations`,async t=>{
  const compact=await measure({kind}),split=await measure({kind,split:true});
  assert.equal(compact.summary.inferences,5);assert.equal(split.summary.inferences,7);
  assert.equal(compact.summary.requiredEffects,split.summary.requiredEffects);assert.equal(compact.summary.sourceRecords,split.summary.sourceRecords);
  assert.ok(split.summary.instructionBytes>compact.summary.instructionBytes);assert.ok(split.summary.inputBytes>compact.summary.inputBytes);
  t.diagnostic(JSON.stringify(compact.summary));t.diagnostic(JSON.stringify(split.summary));
});
test('OFFLINE efficiency: source growth is measured, not silently truncated',async t=>{
  const small=await measure({kind:'fact'}),large=await measure({kind:'fact',padding:65536});
  assert.equal(small.summary.inferences,large.summary.inferences);
  assert.equal(large.summary.rawSourceBytes-small.summary.rawSourceBytes,2*65536);
  assert.ok(large.summary.inputBytes-small.summary.inputBytes>=2*65536);
  t.diagnostic(JSON.stringify(large.summary));
});
