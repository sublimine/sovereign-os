// Actual full-engine SIGKILL with real files/isolated execution. ALL model
// responses are SIM; this fixture does not establish subscription efficiency.
import fs from 'node:fs';import {join} from 'node:path';
import {FactoryEngine} from '../../../factory/lib/engine.mjs';
import {IsolatedExecutionRunner} from '../../../factory/tools/execution.mjs';
import {readSourceContextView} from '../../../factory/lib/source-context-view.mjs';
import {inferenceRequestHash} from '../../../factory/providers/instruction-profiles.mjs';
import {captureProcessIdentity} from '../../../factory/lib/process-identity.mjs';
const [directory,boundary]=process.argv.slice(2);
if(!directory||!['before-declaration','before-declaration-commit','after-charge','prepared-not-dispatched','after-receipt','before-observation-commit','after-observation','dispatched-no-result'].includes(boundary))throw Error('Exact fixture boundary required');
const intent='Create value.mjs and test.mjs, inspect both exact files, run node test.mjs and require independent verification.';
const contents={'value.mjs':'export const value=42;\n','test.mjs':"import assert from 'node:assert/strict';import {value} from './value.mjs';assert.equal(value,42);process.stdout.write('CURSOR_NATIVE_PASS\\n');\n"};
const operations=[...Object.keys(contents).map(path=>({tool:'workspace.read',args:{path}})),{tool:'execution.run',args:{argv:['node','test.mjs'],cwd:'.'}}];
const runner=new IsolatedExecutionRunner(),engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces'),executionRunner:runner});
const mission=engine.create(intent,{producerBatch:'read-test-cursor-v1',allowedTools:['workspace.write','workspace.read','execution.run'],maxNodeAttempts:1,
  inferenceBudget:{mode:'mission-calls-v1',maxCalls:6}});
const node={id:'build',title:'Build exact fixture',purpose:'tested-files',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],requirementIds:['r1'],dependencies:[],
  method:{id:'fixture-exact',rationale:'Exact bounded files and fixed test.',alternatives:['Independent derivation']},instructions:intent,outputKind:'delivery',
  criteria:[{id:'exact',text:intent}],tools:['workspace.write','workspace.read','execution.run'],specialist:null,
  requiredEffects:[...Object.keys(contents).map(path=>({type:'file',path,command:'',expectedExit:null})),{type:'execution',path:'.',command:'["node","test.mjs"]',expectedExit:0}]};
fs.writeFileSync(join(directory,'fixture.json'),JSON.stringify({missionId:mission.id,owner:captureProcessIdentity(),boundary,contents}),{flag:'wx',mode:0o600});
let calls=0;engine.workers.providerFactory=()=>({async generate(request){
  calls++;const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);let value;
  if(request.schema.properties.requirements)value={requirements:[{id:'r1',text:intent,requestQuote:intent,criteria:node.criteria}],nodes:[node],finalNodeId:'build',routingRationale:'SIM full-engine exact fixture.'};
  else if(request.schema.properties.artifactHash){const a=exposure.artifacts.find(a=>a.id===task.candidateId);
    value={artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',
      evidence:[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body}],reason:'SIM initial independent plan review.'})),findings:[],uncertainty:'Simulated planning review.'};
  }else{
    if(calls>4)throw Error('Cut must happen before buying the final response');
    const selected=task.step===0?Object.entries(contents).map(([path,content])=>({tool:'workspace.write',args:{path,content,expectedHash:null}})):operations;
    value={action:'batch',tool:'',argsJson:JSON.stringify(selected),body:'',claims:[],method:'fixture-exact-arguments',reason:''};
  }
  await request.validate(value);return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:'sim-cursor-child-'+calls,turnId:'sim-cursor-turn-'+calls,
    model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
},async close(){}});
const cut=()=>process.kill(process.pid,'SIGKILL');
const transact=engine.store.transact.bind(engine.store);engine.store.transact=fn=>{
  const result=transact(fn);if(boundary==='prepared-not-dispatched'&&!engine.store.db.isTransaction
    &&result?.type==='effect'&&result.data.tool==='execution.run'&&result.data.state==='PREPARED')cut();return result;
};
const append=engine.store.append.bind(engine.store);engine.store.append=(kind,data)=>{
  if(boundary==='before-declaration'&&kind==='worker.producer.cleanup.recorded'&&calls===4)cut();return append(kind,data);
};
const put=engine.store.put.bind(engine.store);engine.store.put=(type,id,data,options)=>{
  const result=put(type,id,data,options);
  if(boundary==='before-declaration-commit'&&type==='producer-batch-cursor'&&data.nextIndex===0){
    if(!engine.store.db.isTransaction)throw Error('Expected in-transaction declaration boundary');cut();}
  if(boundary==='before-observation-commit'&&type==='producer-batch-cursor'&&data.nextIndex===3){
    if(!engine.store.db.isTransaction)throw Error('Expected in-transaction observation boundary');cut();}
  return result;
};
const execute=engine.broker.execute.bind(engine.broker);engine.broker.execute=async request=>{
  const result=await execute(request);if(boundary==='after-receipt'&&request.tool==='execution.run')cut();return result;
};
if(boundary==='dispatched-no-result')runner.run=async()=>cut();
const tool=engine.workers.tool.bind(engine.workers);engine.workers.tool=async(...args)=>{
  if(boundary==='after-charge'&&args[1]==='execution.run')cut();const result=await tool(...args);
  if(boundary==='after-observation'&&args[1]==='execution.run')cut();return result;
};
const result=await engine.run(mission.id);throw Error('Expected full-engine SIGKILL was not reached: '+JSON.stringify(result.mission.pending));
