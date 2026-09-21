// Adversarial coverage for non-worker global-budget consumers.  These tests
// use a simulated discovery provider, but real SQLite transactions, Authority
// verification and ToolBroker state transitions.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {missionInferenceBudget,missionBudgetRecordRef,reserveMissionInference} from '../../factory/lib/mission-inference-budget.mjs';
import {MISSION_SEARCH_DISPATCH_PROOF_TYPE,MissionExternalDispatchProvenanceControl} from '../../factory/lib/mission-external-dispatch-provenance.mjs';

const args={query:'independent public fixture',limit:1};
const discovery=input=>({schema:'sovereign.discovery.v1',query:input.query,queryHash:sha256(input),
  candidates:[{title:'Fixture discovery',url:'https://example.com/evidence',evidenceStatus:'UNVERIFIED_DISCOVERY_CANDIDATE'}],
  inference:{toolPolicy:'public-search-v1',simulation:true,status:'completed'},searchObservations:[{actionType:'search'}],
  closure:{processExitObserved:true}});

function fixture(t){
  const directory=fs.mkdtempSync(join(tmpdir(),'mission-external-provenance-'));
  const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspace'),
    searchProvider:{timeoutMs:1000,search:async input=>discovery(input)}});
  const mission=engine.create('Find one public source and preserve its provenance.',{
    allowedTools:['source.search'],inferenceBudget:{mode:'mission-calls-v1',maxCalls:2}});
  engine.broker.registerWorkspace(mission.id);
  t.after(()=>{engine.close();fs.rmSync(directory,{recursive:true,force:true});});
  return {engine,mission};
}

test('a real budgeted public search has a signed exact dispatch proof which survives later lease revocation',async t=>{
  const {engine,mission}=fixture(t);
  const lease=engine.authority.issue({missionId:mission.id,principalId:'search-worker',actions:['source.search'],resources:['public-web'],
    classification:'PUBLIC',expiresAt:new Date(Date.now()+60_000).toISOString(),
    dispatch:{operationId:'search:real',tool:'source.search',argsHash:sha256(args)}});
  const receipt=await engine.broker.execute({missionId:mission.id,principalId:'search-worker',lease,operationId:'search:real',tool:'source.search',args});
  assert.equal(receipt.data.status,'SUCCEEDED');
  const before=missionInferenceBudget(engine.registry,mission.id);
  assert.equal(before.reserved,1);assert.deepEqual(before.byKind,{worker:0,search:1});
  const proof=engine.store.list(MISSION_SEARCH_DISPATCH_PROOF_TYPE)[0];
  assert.equal(proof.version,1);
  // Revocation blocks future dispatches, but it must not rewrite a historical
  // logical reservation or make the accounting ledger refund capacity.
  engine.authority.revoke(lease.data.id,'Test historical proof preservation');
  assert.deepEqual(missionInferenceBudget(engine.registry,mission.id),before);
  // A re-versioned sidecar is not an immutable proof, even if its JSON bytes
  // were copied verbatim by a privileged test writer.
  engine.store.put(proof.type,proof.id,proof.data,{expectedVersion:proof.version});
  assert.throws(()=>missionInferenceBudget(engine.registry,mission.id),{code:'INFERENCE_PROVENANCE_INTEGRITY'});
});

test('a budgeted search rejects a broad bearer lease before the provider boundary',async t=>{
  const {engine,mission}=fixture(t);
  const lease=engine.authority.issue({missionId:mission.id,principalId:'broad-search-worker',actions:['source.search'],resources:['public-web'],
    classification:'PUBLIC',expiresAt:new Date(Date.now()+60_000).toISOString()});
  const receipt=await engine.broker.execute({missionId:mission.id,principalId:'broad-search-worker',lease,
    operationId:'search:broad',tool:'source.search',args});
  assert.equal(receipt.data.status,'FAILED');assert.equal(receipt.data.result.error.code,'INFERENCE_PROVENANCE_INTEGRITY');
  assert.equal(engine.store.list(MISSION_SEARCH_DISPATCH_PROOF_TYPE).length,0);
  assert.equal(missionInferenceBudget(engine.registry,mission.id).reserved,0);
});

test('a shaped DISPATCHED search effect cannot consume a global reservation without a signed broker proof',t=>{
  const {engine,mission}=fixture(t);
  const operationId='search:forged',principalId='untrusted-row-writer';
  const prepared=engine.store.put('effect',operationId,{missionId:mission.id,principalId,tool:'source.search',argsHash:sha256(args),
    state:'PREPARED',startedAt:new Date().toISOString()},{expectedVersion:0});
  const dispatched=engine.store.put('effect',operationId,{...prepared.data,state:'DISPATCHED'},{expectedVersion:prepared.version});
  const call=reserveMissionInference(engine.registry,{missionId:mission.id,kind:'search',binding:{effect:missionBudgetRecordRef(dispatched)}});
  assert.ok(call);
  assert.throws(()=>missionInferenceBudget(engine.registry,mission.id),{code:'INFERENCE_PROVENANCE_INTEGRITY'});
});

test('a later transaction cannot heal a historical search reservation with a sidecar proof',t=>{
  const {engine,mission}=fixture(t),control=new MissionExternalDispatchProvenanceControl({store:engine.store,authority:engine.authority});
  const lease=engine.authority.issue({missionId:mission.id,principalId:'historical-writer',actions:['source.search'],resources:['public-web'],
    classification:'PUBLIC',expiresAt:new Date(Date.now()+60_000).toISOString()});
  const operationId='search:historic-healing',prepared=engine.store.put('effect',operationId,{missionId:mission.id,principalId:'historical-writer',
    tool:'source.search',argsHash:sha256(args),state:'PREPARED',startedAt:new Date().toISOString()},{expectedVersion:0});
  const dispatched=engine.store.put('effect',operationId,{...prepared.data,state:'DISPATCHED'},{expectedVersion:prepared.version});
  const call=reserveMissionInference(engine.registry,{missionId:mission.id,kind:'search',binding:{effect:missionBudgetRecordRef(dispatched)}});
  assert.ok(call);
  assert.throws(()=>missionInferenceBudget(engine.registry,mission.id),{code:'INFERENCE_PROVENANCE_INTEGRITY'});
  // The old API could issue a valid-looking signature here.  The control now
  // requires the exact effect and call to be current writes in one outer
  // Store transaction, so neither historic row can be retroactively blessed.
  assert.throws(()=>engine.store.transact(()=>{
    const preflight=control.prepareSearch({effectRecord:dispatched,signedLease:lease,issuedAt:engine.store.clock()});
    control.issueSearch(preflight,{callRecord:call});
  }),{code:'INFERENCE_PROVENANCE_INTEGRITY'});
  assert.equal(engine.store.list(MISSION_SEARCH_DISPATCH_PROOF_TYPE).length,0);
  assert.throws(()=>missionInferenceBudget(engine.registry,mission.id),{code:'INFERENCE_PROVENANCE_INTEGRITY'});
});

test('a captured external-proof preflight expires with its transaction and is one-shot',t=>{
  const {engine,mission}=fixture(t),control=new MissionExternalDispatchProvenanceControl({store:engine.store,authority:engine.authority});
  const lease=engine.authority.issue({missionId:mission.id,principalId:'preflight-writer',actions:['source.search'],resources:['public-web'],
    classification:'PUBLIC',expiresAt:new Date(Date.now()+60_000).toISOString(),
    dispatch:{operationId:'search:stale-preflight',tool:'source.search',argsHash:sha256(args)}});
  let preflight,call;
  engine.store.transact(()=>{
    const prepared=engine.store.put('effect','search:stale-preflight',{missionId:mission.id,principalId:'preflight-writer',tool:'source.search',
      argsHash:sha256(args),state:'PREPARED',startedAt:new Date().toISOString()},{expectedVersion:0});
    const dispatched=engine.store.put('effect','search:stale-preflight',{...prepared.data,state:'DISPATCHED'},{expectedVersion:prepared.version});
    preflight=control.prepareSearch({effectRecord:dispatched,signedLease:lease,issuedAt:engine.store.clock()});
    call=reserveMissionInference(engine.registry,{missionId:mission.id,kind:'search',binding:{effect:missionBudgetRecordRef(dispatched)}});
    assert.ok(call);
  });
  assert.throws(()=>control.issueSearch(preflight,{callRecord:call}),{code:'INFERENCE_PROVENANCE_INTEGRITY'});
  assert.throws(()=>control.issueSearch(preflight,{callRecord:call}),{code:'INFERENCE_PROVENANCE_INTEGRITY'});
  assert.equal(engine.store.list(MISSION_SEARCH_DISPATCH_PROOF_TYPE).length,0);
  assert.throws(()=>missionInferenceBudget(engine.registry,mission.id),{code:'INFERENCE_PROVENANCE_INTEGRITY'});
});
