import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {missionReport,formatMissionReport} from '../../factory/lib/report.mjs';

const cli=new URL('../../factory/bin/sovereign.mjs',import.meta.url).pathname;
const literal=(transform,payload)=>`LITERAL-TRANSFORM/1 ${transform}\n<<<\n${payload}\n>>>`;
const options={preset:'adaptive-v3',model:'gpt-6-terra',reasoningEffort:'high',allowedTools:[]};

function fixture(t){
  const root=mkdtempSync(join(tmpdir(),'sovereign-adaptive-v3-report-')),
    engine=new FactoryEngine({databasePath:join(root,'state.sqlite'),workspaceRoot:join(root,'workspaces')});
  t.after(()=>{engine.close();rmSync(root,{recursive:true,force:true});});
  return {root,engine};
}

test('adaptive-v3 report projects route references without leaking selector proof or inventing a human review',async t=>{
  const {engine}=fixture(t),mission=engine.create(literal('uppercase-ascii-v1','hello'),options);
  await engine.run(mission.id);
  // Future v3 event payloads are not a public reporting API.  Include every
  // sensitive category in fixtures so the boundary is checked independently
  // from the current record/event shapes.
  engine.store.append('adaptive-v3.private.fixture',{missionId:mission.id,
    decision:{reasonCodes:['PRIVATE_V3_REASON_SENTINEL'],ast:'PRIVATE_V3_AST_SENTINEL'},
    proof:'PRIVATE_V3_PROOF_SENTINEL',staticPolicy:'PRIVATE_V3_POLICY_SENTINEL',
    preflight:'PRIVATE_V3_PREFLIGHT_SENTINEL',certificate:'PRIVATE_V3_CERTIFICATE_SENTINEL'});
  const genericEvent=engine.store.append('mission.private.fixture',{missionId:mission.id,
    decision:'PRIVATE_V3_GENERIC_EVENT_SENTINEL',proof:'PRIVATE_V3_GENERIC_PROOF_SENTINEL'});
  const before=engine.store.verifyJournal(),report=missionReport(engine.store,mission.id,{registry:engine.registry}),serialized=JSON.stringify(report),text=formatMissionReport(report);
  assert.deepEqual(engine.store.verifyJournal(),before,'reporting is read-only');
  assert.equal(report.mission.policy.routing,undefined);
  assert.equal(report.mission.policySelection.definition.routingMode,undefined);
  assert.deepEqual(Object.keys(report.adaptiveV3).sort(),['deterministicCertificationRecord','finalArtifact','originRecord','revision','route','schema','selectedEntryMode']);
  assert.deepEqual(Object.keys(report.adaptiveV3.route).sort(),['decisionHash','finalPolicyHash','record','revision','schema','selectorCatalogHash','staticPolicyHash']);
  assert.equal(report.adaptiveV3.selectedEntryMode,'closed-response-v3');
  assert.equal(report.adaptiveV3.schema,'sovereign.adaptive-v3-public-report.v1');
  assert.equal(report.adaptiveV3.revision,1);
  assert.equal(report.adaptiveV3.route.record.type,'adaptive-v3-route');
  assert.equal(report.adaptiveV3.originRecord.type,'adaptive-v3-origin');
  assert.equal(report.adaptiveV3.deterministicCertificationRecord.type,'adaptive-v3-certification');
  assert.equal(report.final.deterministicCertification,undefined);
  assert.deepEqual(report.reviews,[],'the deterministic certificate must not be represented as a reviewer decision');
  assert.deepEqual(report.timeline,[],'Generic journal chronology is not a public report channel');
  for(const privateValue of ['PRIVATE_V3_REASON_SENTINEL','PRIVATE_V3_AST_SENTINEL','PRIVATE_V3_PROOF_SENTINEL','PRIVATE_V3_POLICY_SENTINEL',
    'PRIVATE_V3_PREFLIGHT_SENTINEL','PRIVATE_V3_CERTIFICATE_SENTINEL','PRIVATE_V3_GENERIC_EVENT_SENTINEL','PRIVATE_V3_GENERIC_PROOF_SENTINEL']){
    assert(!serialized.includes(privateValue),privateValue);
    assert(!text.includes(privateValue),privateValue);
  }
  assert.match(text,/Ruta adaptive-v3: modo seleccionado closed-response-v3/);
  assert.match(text,/No es una revisión humana ni un juicio factual/);
});

test('adaptive-v3 planned reports expose only the selected public mode, not why the selector planned it',t=>{
  const {engine}=fixture(t),mission=engine.create('¿Cuál es la capital actual de Francia?',options),report=missionReport(engine.store,mission.id);
  assert.equal(report.adaptiveV3.selectedEntryMode,'planned');
  assert.equal(report.adaptiveV3.originRecord,null);
  assert.equal(report.adaptiveV3.deterministicCertificationRecord,null);
  assert.equal(report.mission.policy.routing,undefined);
  assert(!JSON.stringify(report).includes('reasonCodes'));
  assert(!JSON.stringify(report).includes('closedMaterialization'));
  assert(!JSON.stringify(report).includes('routingMode'));
  assert.match(formatMissionReport(report),/modo seleccionado planned/);
});

test('a read-only report reopens a custom adaptive-v3 route authority without writing state',t=>{
  const root=mkdtempSync(join(tmpdir(),'sovereign-adaptive-v3-custom-authority-')),
    store=new Store(join(root,'state.sqlite')),
    authority=new Authority(store,{key:Buffer.alloc(32,53),keyId:'custom-route-authority'}),
    engine=new FactoryEngine({store,authority,workspaceRoot:join(root,'workspaces')});
  t.after(()=>{engine.close();rmSync(root,{recursive:true,force:true});});
  const mission=engine.create('¿Cuál es la capital actual de Francia?',options),before=store.verifyJournal(),report=missionReport(store,mission.id);
  assert.equal(report.adaptiveV3.selectedEntryMode,'planned');assert.deepEqual(store.verifyJournal(),before);
});

test('a completed adaptive-v3 planned report requires an accepted final lineage before it exposes a delivery',t=>{
  const {engine}=fixture(t),mission=engine.create('¿Cuál es la capital actual de Francia?',options),artifactId='artifact:forged-planned-final',
    payload={missionId:mission.id,nodeId:'forged',producerRunId:'run:forged',kind:'delivery',purpose:'forged',body:'FORGED_PLANNED_FINAL_SENTINEL',
      claims:[],inputRefs:[],toolReceipts:[],requiredEffects:[],criteria:[],provisional:false};
  engine.store.put('artifact',artifactId,{id:artifactId,missionId:mission.id,payload,payloadHash:sha256(payload),status:'ACCEPTED',reviews:[],reviewDependencies:[],
    createdAt:'2026-09-20T00:00:00.000Z',invalidation:null},{expectedVersion:0});
  const current=engine.store.get('mission',mission.id);
  engine.store.put('mission',mission.id,{...current.data,status:'COMPLETED',finalArtifactId:artifactId,updatedAt:'2026-09-20T00:01:00.000Z',
    history:[...current.data.history,{status:'COMPLETED',at:'2026-09-20T00:01:00.000Z'}]},{expectedVersion:current.version});
  const before=engine.store.verifyJournal();
  for(const read of [()=>missionReport(engine.store,mission.id),()=>missionReport(engine.store,mission.id,{registry:engine.registry})]){
    // A public report stays readable after a stale planned delivery, but the
    // route-specific acceptance failure becomes a delivery quarantine rather
    // than an exception that encourages callers to fall back to raw storage.
    const report=read(),serialized=JSON.stringify(report);
    assert.equal(report.metrics.integrity,'DELIVERY_UNVERIFIED');
    assert.equal(report.final,null);assert.equal(report.mission.finalArtifactId,null);
    assert.equal(report.adaptiveV3.finalArtifact,null);
    assert.ok(!serialized.includes('FORGED_PLANNED_FINAL_SENTINEL'));
  }
  assert.deepEqual(engine.store.verifyJournal(),before);
});

test('a legacy policy cannot retrofit any adaptive-v3 marker into a public route or leak its hashes',t=>{
  const store=new Store(':memory:'),authority=new Authority(store,{key:Buffer.alloc(32,47)});
  t.after(()=>store.close());
  const variants=[
    {name:'entry-mode-and-schema',routing:{schema:'sovereign.adaptive-v3-mission-routing.v1',revision:1}},
    {name:'routing-mode-only',routing:{routingMode:'deterministic-adaptive-v3'}}
  ];
  for(const [index,variant] of variants.entries()){
    const missionId=`mission:legacy-retrofit-${index}`,intent=`legacy mission ${variant.name}`,
      sentinels=['a','b','c','d'].map(char=>char.repeat(64)),
      origin={id:missionId,intent,intentHash:sha256(intent),policy:{model:'gpt-6-terra',reasoningEffort:'high',entryMode:'closed-response-v2',allowedTools:[]},
        status:'NEW',createdAt:'2026-09-19T00:00:00.000Z',updatedAt:'2026-09-19T00:00:00.000Z',finalArtifactId:null,pending:[],history:[]},
      routing={...variant.routing,selectorCatalogHash:sentinels[0],decisionHash:sentinels[1],staticPolicyHash:sentinels[2],finalPolicyHash:sentinels[3]},
      retrofitted={...origin,policy:{...origin.policy,entryMode:variant.routing.schema?'closed-response-v3':'closed-response-v2',routing},
        updatedAt:'2026-09-19T00:01:00.000Z'};
    const first=store.transact(()=>{
      if(index===0)store.requireExecutionProtocol(13);
      return store.put('mission',missionId,origin,{expectedVersion:0});
    });
    store.put('mission',missionId,retrofitted,{expectedVersion:first.version});
    store.append('adaptive-v3.private.fixture',{missionId,privateSelectorProof:sentinels[0]});
    const before=store.verifyJournal(),report=missionReport(store,missionId),serialized=JSON.stringify(report),text=formatMissionReport(report);
    assert.deepEqual(store.verifyJournal(),before,`${variant.name}: fallback report stays read-only`);
    assert.equal(report.mission.policy,null);assert.equal(report.mission.policyIntegrity,'UNVERIFIED');
    assert.equal(report.mission.adaptiveV3RouteIntegrity,'UNVERIFIED');assert.equal(report.final,null);
    assert.ok(!Object.hasOwn(report,'adaptiveV3'));
    assert.ok(!report.timeline.some(event=>event.kind==='adaptive-v3.private.fixture'));
    for(const sentinel of sentinels){assert.ok(!serialized.includes(sentinel),`${variant.name}: JSON ${sentinel[0]}`);assert.ok(!text.includes(sentinel),`${variant.name}: text ${sentinel[0]}`);}
  }
  assert.ok(authority,'the persisted authority permits only read-only route verification');
});

test('a direct adaptive-v3 report refuses a duck-typed registry and an invalidated final',async t=>{
  const {engine}=fixture(t),mission=engine.create(literal('identity-utf8-v1','trusted report only'),options);
  const completed=await engine.run(mission.id),artifactId=completed.mission.finalArtifactId;
  engine.registry.invalidate([artifactId],{kind:'test-invalidation'});
  assert.throws(()=>missionReport(engine.store,mission.id,{registry:engine.registry}),{code:'ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY'});
  const counterfeit={store:engine.store,authority:engine.authority,
    assertUsable:id=>engine.store.get('artifact',id).data};
  assert.throws(()=>missionReport(engine.store,mission.id,{registry:counterfeit}),{code:'ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY'});
});

test('CLI documents the public adaptive-v3 boundary without publishing its internal selector controls',t=>{
  const root=mkdtempSync(join(tmpdir(),'sovereign-adaptive-v3-cli-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const help=spawnSync(process.execPath,[cli,'--help'],{encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
  assert.equal(help.error,undefined);assert.equal(help.status,0,help.stderr);
  assert.match(help.stdout,/--preset adaptive-v3/);assert.match(help.stdout,/closed-response-v3/);
  assert.match(help.stdout,/ruta determinista estrecha/);assert.match(help.stdout,/cae a planned/);
  assert.doesNotMatch(help.stdout,/routingMode/);
  const state=join(root,'state'),internal=spawnSync(process.execPath,[cli,'submit','--text','must not create','--routing-mode','private','--state-dir',state],
    {encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
  assert.equal(internal.error,undefined);assert.equal(internal.status,1);assert.match(internal.stderr,/Unknown option '--routing-mode'/);
});
