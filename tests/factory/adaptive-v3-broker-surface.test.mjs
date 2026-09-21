import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {ToolBroker} from '../../factory/tools/broker.mjs';

const literal=(transform,payload)=>`LITERAL-TRANSFORM/1 ${transform}\n<<<\n${payload}\n>>>`;
const directOptions={preset:'adaptive-v3',model:'gpt-6-terra',reasoningEffort:'high',allowedTools:[]};
const directCode='ADAPTIVE_V3_ROUTE_INTEGRITY';

function setup(t){
  const root=mkdtempSync(join(tmpdir(),'sovereign-adaptive-v3-broker-'));
  const store=new Store(join(root,'state.sqlite')),authority=new Authority(store);
  let transportCalls=0,searchCalls=0;
  const broker=new ToolBroker({store,authority,workspaceRoot:join(root,'workspaces'),
    lookup:async()=>{throw Error('direct route must not resolve DNS');},
    transport:async()=>{transportCalls++;throw Error('direct route must not dispatch HTTP');},
    searchProvider:{timeoutMs:1000,search:async()=>{searchCalls++;throw Error('direct route must not dispatch search');}}});
  const engine=new FactoryEngine({store,authority,broker,workspaceRoot:join(root,'workspaces')});
  t.after(()=>{engine.close();rmSync(root,{recursive:true,force:true});});
  return {root,store,authority,broker,engine,calls:()=>({transportCalls,searchCalls})};
}

test('a direct adaptive-v3 route rejects every mission-bound broker surface before a formerly unleased write, network dispatch or durable state',async t=>{
  const s=setup(t),mission=s.engine.create(literal('uppercase-ascii-v1','closed broker boundary'),directOptions);
  const signal=new AbortController().signal;
  const workspacePath=join(s.root,'workspaces','mission-'+sha256(mission.id));

  // This is the former bypass: register a workspace, then invoke the public
  // low-level write helper without a lease, effect record or Engine call.
  assert.throws(()=>s.broker.registerWorkspace(mission.id),{code:directCode});
  assert.throws(()=>s.broker.workspace(mission.id),{code:directCode});
  assert.throws(()=>s.broker.resolvePath(mission.id,'escaped.txt',{createParents:true}),{code:directCode});
  assert.throws(()=>s.broker.workspaceTool(mission.id,'workspace.write',{path:'escaped.txt',content:'must not exist',expectedHash:null},signal),{code:directCode});
  assert.throws(()=>s.broker.executionSnapshot(mission.id),{code:directCode});
  await assert.rejects(s.broker.runExecution({missionId:mission.id,operationId:'direct:execution',binding:{missionId:mission.id,principalId:'forged',tool:'execution.run',argsHash:sha256({})},args:{argv:['node','-e','0'],cwd:'.'},signal,verify:()=>{}}),{code:directCode});
  await assert.rejects(s.broker.fetchSource(mission.id,{url:'https://example.com'},signal,()=>{}),{code:directCode});
  await assert.rejects(s.broker.searchSource(mission.id,{query:'must not search',limit:1},signal,()=>{}),{code:directCode});
  await assert.rejects(s.broker.perform({operationId:'direct:perform',binding:{missionId:mission.id,principalId:'forged',tool:'workspace.write',argsHash:sha256({path:'escaped.txt',content:'must not exist',expectedHash:null})},args:{path:'escaped.txt',content:'must not exist',expectedHash:null},signal,verify:()=>{}}),{code:directCode});
  await assert.rejects(s.broker.execute({missionId:mission.id,principalId:'forged',lease:{},operationId:'direct:execute',tool:'workspace.write',args:{path:'escaped.txt',content:'must not exist',expectedHash:null},signal}),{code:directCode});
  assert.throws(()=>s.broker.reconcileExecutions(mission.id),{code:directCode});

  assert.deepEqual(s.calls(),{transportCalls:0,searchCalls:0});
  assert.equal(existsSync(workspacePath),false,'the rejected write never gets a mission directory');
  for(const type of ['tool-workspace','effect','execution-job','source-http-trace','source','inference-request'])
    assert.equal(s.store.list(type).length,0,`${type} must remain empty after every rejected broker entry`);

  const result=await s.engine.run(mission.id);
  assert.equal(result.mission.status,'COMPLETED');
  assert.equal(result.mission.finalArtifactId!==null,true);
  assert.equal(existsSync(workspacePath),false,'deterministic completion must not create the previously attempted workspace');
  assert.equal(s.store.get('tool-workspace',mission.id),null);
  assert.equal(s.store.list('effect').length,0);
});

test('the route check remains a no-op for an absent legacy mission',t=>{
  const s=setup(t),missionId='legacy-no-mission',workspace=s.broker.registerWorkspace(missionId);
  const result=s.broker.workspaceTool(missionId,'workspace.write',{path:'legacy.txt',content:'legacy is not an adaptive-v3 route',expectedHash:null});
  assert.equal(result.path,'legacy.txt');
  assert.equal(readFileSync(join(workspace.path,'legacy.txt'),'utf8'),'legacy is not an adaptive-v3 route');
  assert.equal(s.store.get('tool-workspace',missionId)?.data.path,workspace.path);
});
