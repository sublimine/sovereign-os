import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {assertAdaptiveV3MissionRoute} from '../../factory/lib/adaptive-v3-route-contract.mjs';
import {
  ADAPTIVE_V3_DIRECT_CERTIFICATION_KIND,ADAPTIVE_V3_DIRECT_CERTIFICATION_TYPE,
  ADAPTIVE_V3_DIRECT_CRITERIA,ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY,ADAPTIVE_V3_DIRECT_ENTRY_NODE,
  ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE,ADAPTIVE_V3_DIRECT_ORIGIN_KIND,ADAPTIVE_V3_DIRECT_ORIGIN_TYPE,
  assertAdaptiveV3ClosedEvidence,assertAdaptiveV3ClosedPayload
} from '../../factory/lib/adaptive-v3-deterministic-entry.mjs';

const literal=(transform,payload)=>`LITERAL-TRANSFORM/1 ${transform}\n<<<\n${payload}\n>>>`;
const options={preset:'adaptive-v3',model:'gpt-6-terra',reasoningEffort:'high',allowedTools:[]};

function fixture(t,{intent=literal('uppercase-ascii-v1','hello terra')}={}){
  const root=mkdtempSync(join(tmpdir(),'sovereign-adaptive-v3-entry-'));
  let tick=0;const clock=()=>new Date(Date.parse('2026-09-19T12:00:00.000Z')+tick++).toISOString();
  const events=[],engine=new FactoryEngine({databasePath:join(root,'state.sqlite'),workspaceRoot:join(root,'workspaces'),clock,
    onEvent:event=>events.push(event)}),mission=engine.create(intent,options),route=assertAdaptiveV3MissionRoute(engine.store,engine.authority,mission.id);
  t.after(()=>{engine.close();rmSync(root,{recursive:true,force:true});});
  return {store:engine.store,authority:engine.authority,registry:engine.registry,engine,mission,route,events};
}

function durableProductShape(store){
  return sha256(store.db.prepare("SELECT type,id,version,hash FROM records WHERE type <> 'engine' ORDER BY type,id,version").all().map(row=>({...row})));
}

test('adaptive-v3 direct entry materializes, certifies and delivers exactly once without a provider or ordinary review',async t=>{
  const f=fixture(t),publicResult=(await f.engine.run(f.mission.id)).outcome,
    // Public execution results intentionally carry the delivery view only.
    // This mechanism test inspects the durable certified artifact through its
    // trusted fixture store, not through the public projection.
    result=f.store.get('artifact',publicResult.id).data;
  assert.equal(result.payload.body,'HELLO TERRA');assert.equal(result.payload.kind,'deterministic-result');
  assert.equal(result.payload.nodeId,ADAPTIVE_V3_DIRECT_ENTRY_NODE);assert.equal(result.payload.purpose,ADAPTIVE_V3_DIRECT_ENTRY_PURPOSE);
  assert.deepEqual(result.payload.criteria,ADAPTIVE_V3_DIRECT_CRITERIA);assert.deepEqual(result.payload.claims,[]);assert.deepEqual(result.payload.inputRefs,[]);
  const mission=f.store.get('mission',f.mission.id).data;
  assert.equal(mission.status,'COMPLETED');assert.equal(mission.finalArtifactId,result.id);
  const origin=f.store.get(ADAPTIVE_V3_DIRECT_ORIGIN_TYPE,f.mission.id),cert=f.store.get(ADAPTIVE_V3_DIRECT_CERTIFICATION_TYPE,result.id);
  assert.equal(origin.version,1);assert.equal(cert.version,1);
  assert.equal(f.authority.open(origin.data.signed,ADAPTIVE_V3_DIRECT_ORIGIN_KIND).producer.provider,'none');
  const certificate=f.authority.open(cert.data.signed,ADAPTIVE_V3_DIRECT_CERTIFICATION_KIND);
  assert.deepEqual(certificate.certification,{method:'deterministic-recomputation-v1',provider:'none',semanticReview:'none',reviewKind:'not-a-model-review-v1'});
  assert.equal(certificate.candidate.id,result.id);assert.equal(certificate.candidate.version,1);
  const evidence=assertAdaptiveV3ClosedEvidence(f.registry,result.id);
  assert.equal(evidence.artifact.id,result.id);assert.equal(evidence.output.body,'HELLO TERRA');
  assert.ok(evidence.order.mission<evidence.order.route&&evidence.order.route<evidence.order.run&&evidence.order.run<evidence.order.origin);
  assert.ok(evidence.order.origin<evidence.order.candidate&&evidence.order.candidate<evidence.order.certification&&evidence.order.certification<evidence.order.accepted);
  const run=f.store.list('run')[0];
  assert.deepEqual(Object.keys(run.data).sort(),['context','contextHash','createdAt','forbiddenArtifactIds','id','missionId','mode','nodeId','providerThreadId']);
  assert.equal(run.data.providerThreadId,null);assert.equal(Object.hasOwn(run.data,'requests'),false);assert.equal(Object.hasOwn(run.data,'inferenceReceipt'),false);
  assert.equal(f.store.list('review').length,0);assert.equal(f.store.list('source').length,0);assert.equal(f.store.list('effect').length,0);assert.equal(f.store.list('node').length,0);
  assert.equal(f.store.get('plan',f.mission.id),null);assert.equal(f.store.get('worker-config',run.id),null);
  assert.equal(f.store.events({after:0,limit:10000}).filter(event=>event.kind.startsWith('worker.inference.')).length,0);
  const before=durableProductShape(f.store),again=(await f.engine.run(f.mission.id)).outcome;
  assert.equal(again.id,result.id);assert.equal(durableProductShape(f.store),before,'reentry must not create another origin, candidate, certification or provider work');
});

test('adaptive-v3 planned routes create no native actor, origin, candidate or certification',t=>{
  const f=fixture(t,{intent:'¿Cuál es la capital actual de Francia?'});
  assert.equal(f.route.decision.selectedEntryMode,'planned');
  for(const [type,id] of [['run',null],['artifact',null],[ADAPTIVE_V3_DIRECT_ORIGIN_TYPE,f.mission.id],[ADAPTIVE_V3_DIRECT_CERTIFICATION_TYPE,'artifact:missing']]){
    if(id===null)assert.equal(f.store.list(type).length,0,type);else assert.equal(f.store.get(type,id),null,type);
  }
});

test('a candidate cannot be re-materialized, and a re-versioned certificate quarantines rather than falling back',async t=>{
  const f=fixture(t,{intent:literal('uppercase-ascii-v1','integrity')}),publicResult=(await f.engine.run(f.mission.id)).outcome,
    result=f.store.get('artifact',publicResult.id).data,run=f.store.list('run')[0];
  assert.throws(()=>assertAdaptiveV3ClosedPayload(f.registry,result.payload),{code:ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY});
  const cert=f.store.get(ADAPTIVE_V3_DIRECT_CERTIFICATION_TYPE,result.id);
  f.store.put(ADAPTIVE_V3_DIRECT_CERTIFICATION_TYPE,result.id,{...cert.data,diagnostic:'forbidden re-version'},{expectedVersion:cert.version});
  assert.throws(()=>assertAdaptiveV3ClosedEvidence(f.registry,result.id),{code:ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY});
  const halted=await f.engine.run(f.mission.id);
  assert.equal(halted.mission.status,'UNVERIFIED');
  assert.equal(halted.mission.deliveryIntegrity,'UNVERIFIED');
  assert.equal(f.store.get('mission',f.mission.id).data.status,'NEEDS_DIRECTION');
  assert.equal(f.store.list('run').length,1);assert.equal(f.store.list('run')[0].id,run.id);assert.equal(f.store.list('artifact').length,1);
});
