import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {commitMissionInputs,makeMissionInputManifest,normalizeMissionInputs} from '../../factory/lib/mission-inputs.mjs';
import {
  ADAPTIVE_V3_MISSION_ROUTING_REVISION,
  ADAPTIVE_V3_MISSION_ROUTING_SCHEMA,
  ADAPTIVE_V3_ROUTE_RECORD_KIND,
  ADAPTIVE_V3_ROUTE_RECORD_SCHEMA,
  ADAPTIVE_V3_ROUTE_RECORD_TYPE,
  assertAdaptiveV3MissionRoute,
  createAdaptiveV3ClosedMaterializationPreflight,
  makeAdaptiveV3MissionRoute,
  makeAdaptiveV3RouteRecord
} from '../../factory/lib/adaptive-v3-route-contract.mjs';

const literal=(transform,payload)=>`LITERAL-TRANSFORM/1 ${transform}\n<<<\n${payload}\n>>>`;
let sequence=0;
const routeRecordPayload=({missionRecord,mission,route})=>({
  schema:ADAPTIVE_V3_ROUTE_RECORD_SCHEMA,
  revision:ADAPTIVE_V3_MISSION_ROUTING_REVISION,
  missionRef:{type:'mission',id:missionRecord.id,version:1,hash:missionRecord.hash},
  intentHash:mission.intentHash,
  policyHash:sha256(mission.policy),
  inputManifestHash:mission.inputManifestHash??null,
  routing:route.routing,
  decision:route.decision,
  decisionHash:route.decision.decisionHash
});

function setup(t,{intent=literal('uppercase-ascii-v1','hello'),inputs=null,model='gpt-6-terra',reasoningEffort='high',requestedEntryMode=null,recordFactory=null,missionPolicy=null}={}){
  const store=new Store(':memory:'),authority=new Authority(store,{key:Buffer.alloc(32,17)}),missionId=`mission:adaptive-v3-route-${++sequence}`;
  t.after(()=>store.close());
  const normalizedInputs=inputs===null?null:normalizeMissionInputs(inputs);
  const intentHash=sha256(intent),inputManifestHash=normalizedInputs===null?null:sha256(makeMissionInputManifest({id:missionId,intentHash},normalizedInputs));
  const route=makeAdaptiveV3MissionRoute({missionId,intent,inputManifestHash,requestedEntryMode,model,reasoningEffort});
  const policy=missionPolicy??{model,reasoningEffort,entryMode:route.decision.selectedEntryMode,routing:route.routing,allowedTools:[]};
  const mission={id:missionId,intent,intentHash,policy,status:'NEW',createdAt:'2026-09-19T00:00:00.000Z',updatedAt:'2026-09-19T00:00:00.000Z',
    finalArtifactId:null,pending:[],history:[],...(inputManifestHash===null?{}:{inputManifestHash})};
  store.transact(()=>{
    store.requireExecutionProtocol(13);
    store.put('mission',missionId,mission,{expectedVersion:0});
    if(normalizedInputs)commitMissionInputs(store,mission,normalizedInputs);
    const record=recordFactory
      ?recordFactory({store,authority,mission,route})
      :makeAdaptiveV3RouteRecord({store,authority,mission,decision:route.decision,routing:route.routing});
    store.put(ADAPTIVE_V3_ROUTE_RECORD_TYPE,missionId,record,{expectedVersion:0});
  });
  return {store,authority,mission,route,missionId};
}

test('preflight is exact only for input-free admitted closed work and hardens resource limits before selection',()=>{
  const directIntent=literal('uppercase-ascii-v1','hello'),ready=createAdaptiveV3ClosedMaterializationPreflight(directIntent,{inputManifestHash:null});
  assert.equal(ready.status,'READY');assert.match(ready.outputHash,/^[a-f0-9]{64}$/);
  assert.equal(ready.inputManifestHash,null);assert.equal(Object.isFrozen(ready),true);
  assert.equal(createAdaptiveV3ClosedMaterializationPreflight('¿Cuál es la capital actual de Francia?',{inputManifestHash:null}),null);
  assert.equal(createAdaptiveV3ClosedMaterializationPreflight(directIntent,{inputManifestHash:'a'.repeat(64)}),null);
  const resource=createAdaptiveV3ClosedMaterializationPreflight(literal('identity-utf8-v1','x'.repeat(20*1024+1)),{inputManifestHash:null});
  assert.equal(resource.status,'RESOURCE_LIMIT');assert.equal(resource.outputHash,null);
});

test('a direct v3 mission has an immutable signed mission@1 route and assertion is entirely read-only',t=>{
  const f=setup(t),before=f.store.verifyJournal(),beforeEffects=f.store.list('effect');
  const facts=assertAdaptiveV3MissionRoute(f.store,f.authority,f.missionId);
  assert.equal(facts.decision.selectedEntryMode,'closed-response-v3');
  assert.equal(facts.preflight.status,'READY');
  assert.equal(facts.routing.schema,ADAPTIVE_V3_MISSION_ROUTING_SCHEMA);
  assert.equal(facts.routing.revision,ADAPTIVE_V3_MISSION_ROUTING_REVISION);
  assert.equal(facts.routeRecord.type,ADAPTIVE_V3_ROUTE_RECORD_TYPE);
  assert.equal(facts.inputManifestHash,null);
  assert.deepEqual(f.store.verifyJournal(),before,'assertion must not add an event or record');
  assert.deepEqual(f.store.list('effect'),beforeEffects,'assertion must not create an effect');
  assert.deepEqual(assertAdaptiveV3MissionRoute(f.store,f.authority,f.missionId).decision,facts.decision);
});

test('facts, user inputs, and resource ceilings all remain planned while validating an input manifest when present',t=>{
  const fact=setup(t,{intent:'¿Cuál es la capital actual de Francia?'});
  assert.equal(fact.route.preflight,null);assert.equal(assertAdaptiveV3MissionRoute(fact.store,fact.authority,fact.missionId).decision.selectedEntryMode,'planned');
  const input=setup(t,{inputs:[{path:'brief.txt',content:'untrusted local premise'}]});
  const inputFacts=assertAdaptiveV3MissionRoute(input.store,input.authority,input.missionId);
  assert.equal(inputFacts.preflight,null);assert.equal(inputFacts.decision.selectedEntryMode,'planned');
  assert.equal(inputFacts.inputManifestHash,input.mission.inputManifestHash);
  const resource=setup(t,{intent:literal('identity-utf8-v1','x'.repeat(20*1024+1))});
  const resourceFacts=assertAdaptiveV3MissionRoute(resource.store,resource.authority,resource.missionId);
  assert.equal(resourceFacts.preflight.status,'RESOURCE_LIMIT');assert.equal(resourceFacts.decision.selectedEntryMode,'planned');
  const manifest=input.store.get('mission-input-manifest',input.missionId);
  input.store.put('mission-input-manifest',input.missionId,manifest.data,{expectedVersion:manifest.version});
  assert.throws(()=>assertAdaptiveV3MissionRoute(input.store,input.authority,input.missionId),{code:'ADAPTIVE_V3_ROUTE_INTEGRITY'});
});

test('only lifecycle updates are tolerated; policy drift is blocked before a route can be reused',t=>{
  const f=setup(t),first=f.store.get('mission',f.missionId);
  const lifecycle={...first.data,status:'RUNNING',updatedAt:'2026-09-19T00:01:00.000Z',pending:[{code:'WAIT'}],history:[{status:'RUNNING',at:'2026-09-19T00:01:00.000Z'}]};
  f.store.put('mission',f.missionId,lifecycle,{expectedVersion:first.version});
  assert.doesNotThrow(()=>assertAdaptiveV3MissionRoute(f.store,f.authority,f.missionId));
  const current=f.store.get('mission',f.missionId),drift={...current.data,policy:{...current.data.policy,reasoningEffort:'ultra'}};
  f.store.put('mission',f.missionId,drift,{expectedVersion:current.version});
  assert.throws(()=>assertAdaptiveV3MissionRoute(f.store,f.authority,f.missionId),{code:'ADAPTIVE_V3_ROUTE_INTEGRITY'});
});

test('a historical policy or mandate mutation cannot regain a direct route by exact restoration',t=>{
  const attacks=[
    {name:'policy',mutate:mission=>({...mission,policy:{...mission.policy,reasoningEffort:'ultra'}})},
    {name:'mandate',mutate:mission=>{
      const intent=literal('identity-utf8-v1','substituted mandate');
      return {...mission,intent,intentHash:sha256(intent)};
    }}
  ];
  for(const attack of attacks){
    const f=setup(t),origin=f.store.get('mission',f.missionId);
    const changed=f.store.put('mission',f.missionId,attack.mutate(origin.data),{expectedVersion:origin.version});
    f.store.put('mission',f.missionId,{...changed.data,intent:origin.data.intent,intentHash:origin.data.intentHash,
      policy:origin.data.policy},{expectedVersion:changed.version});
    const before=f.store.verifyJournal();
    assert.throws(()=>assertAdaptiveV3MissionRoute(f.store,f.authority,f.missionId),{code:'ADAPTIVE_V3_ROUTE_INTEGRITY'},attack.name);
    assert.deepEqual(f.store.verifyJournal(),before,`${attack.name}: route assertion stays read-only after rejecting history`);
  }
});

test('re-versioned or reverted route heads are rejected even when their signed bytes are otherwise valid',t=>{
  const f=setup(t),record=f.store.get(ADAPTIVE_V3_ROUTE_RECORD_TYPE,f.missionId);
  f.store.put(ADAPTIVE_V3_ROUTE_RECORD_TYPE,f.missionId,record.data,{expectedVersion:record.version});
  assert.throws(()=>assertAdaptiveV3MissionRoute(f.store,f.authority,f.missionId),{code:'ADAPTIVE_V3_ROUTE_INTEGRITY'});
  f.store.db.prepare('UPDATE heads SET version=1 WHERE type=? AND id=?').run(ADAPTIVE_V3_ROUTE_RECORD_TYPE,f.missionId);
  assert.throws(()=>assertAdaptiveV3MissionRoute(f.store,f.authority,f.missionId),{code:'ADAPTIVE_V3_ROUTE_INTEGRITY'});
});

test('a route record requires an authentic signature, not merely a record-shaped payload',t=>{
  const f=setup(t,{recordFactory:({store,authority,mission,route})=>{
    const valid=makeAdaptiveV3RouteRecord({store,authority,mission,decision:route.decision,routing:route.routing});
    const forged=JSON.parse(JSON.stringify(valid));forged.signed.signature.value='0'.repeat(64);return forged;
  }});
  assert.throws(()=>assertAdaptiveV3MissionRoute(f.store,f.authority,f.missionId),{code:'ADAPTIVE_V3_ROUTE_INTEGRITY'});
});

test('a validly signed record still cannot silently substitute a different model or reasoning target',t=>{
  const intent=literal('uppercase-ascii-v1','hello'),missionId='mission:adaptive-v3-model-mismatch';
  const terraRoute=makeAdaptiveV3MissionRoute({missionId,intent,model:'gpt-6-terra',reasoningEffort:'high'});
  const f=setup(t,{intent,model:'gpt-6-astra',reasoningEffort:'ultra',missionPolicy:{model:'gpt-6-astra',reasoningEffort:'ultra',
    entryMode:terraRoute.decision.selectedEntryMode,routing:terraRoute.routing,allowedTools:[]},recordFactory:({store,authority,mission})=>{
      const missionRecord=store.get('mission',mission.id,1),payload=routeRecordPayload({missionRecord,mission,route:terraRoute});
      return {signed:authority.seal(ADAPTIVE_V3_ROUTE_RECORD_KIND,payload)};
    }});
  assert.throws(()=>makeAdaptiveV3RouteRecord({store:f.store,authority:f.authority,mission:f.mission,decision:terraRoute.decision,routing:terraRoute.routing}),
    {code:'ADAPTIVE_V3_ROUTE_INTEGRITY'});
  assert.throws(()=>assertAdaptiveV3MissionRoute(f.store,f.authority,f.missionId),{code:'ADAPTIVE_V3_ROUTE_INTEGRITY'});
});

test('non-v3 missions are a read-only no-op for the v3 route assertion',t=>{
  const store=new Store(':memory:'),authority=new Authority(store,{key:Buffer.alloc(32,23)}),missionId='mission:legacy-route';t.after(()=>store.close());
  const mission={id:missionId,intent:'legacy',intentHash:sha256('legacy'),policy:{model:'gpt-6-terra',reasoningEffort:'high',entryMode:'planned'},
    status:'NEW',createdAt:'2026-09-19T00:00:00.000Z',updatedAt:'2026-09-19T00:00:00.000Z',finalArtifactId:null,pending:[],history:[]};
  store.put('mission',missionId,mission,{expectedVersion:0});const before=store.verifyJournal();
  assert.equal(assertAdaptiveV3MissionRoute(store,authority,missionId),null);assert.deepEqual(store.verifyJournal(),before);
});
