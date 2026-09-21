// Own disposable test state only. Exit 86 bypasses WorkerService and SQLite
// cleanup at the named durable boundary; no model, network or installed service.
import {join} from 'node:path';
import {Store} from '../../../factory/lib/store.mjs';
import {Authority} from '../../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../../factory/lib/artifacts.mjs';
import {WorkerService} from '../../../factory/lib/workers.mjs';
import {ToolBroker} from '../../../factory/tools/broker.mjs';
import {IsolatedExecutionRunner} from '../../../factory/tools/execution.mjs';
import {sha256} from '../../../factory/lib/contracts.mjs';
import {inferenceRequestHash} from '../../../factory/providers/instruction-profiles.mjs';
const [directory,phase]=process.argv.slice(2);
if(!['after-first-read','before-execution','dispatched-no-result','after-execution-receipt','after-execution-observation'].includes(phase))throw Error('Exact fixture phase required');
const store=new Store(join(directory,'state.sqlite')),authority=new Authority(store),registry=new ArtifactRegistry(store,authority),runner=new IsolatedExecutionRunner();
const broker=new ToolBroker({store,authority,workspaceRoot:join(directory,'workspaces'),executionRunner:runner});
broker.registerWorkspace('m');const intent='Own durable batch crash fixture';
store.put('mission','m',{intent,intentHash:sha256(intent),policy:{allowedTools:['workspace.write','workspace.read','execution.run'],
  producerBatch:'read-test-v1',model:'gpt-6-astra',reasoningEffort:'ultra'}},{expectedVersion:0});
const contents={'value.mjs':'export const value = 42;\n','test.mjs':"import assert from 'node:assert/strict';\nimport {value} from './value.mjs';\nassert.equal(value,42);\n"};
const args={argv:['node','test.mjs'],cwd:'.'};
const node={id:'build',purpose:'tested-files',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],instructions:intent,outputKind:'delivery',criteria:[{id:'exact',text:intent}],
  tools:['workspace.write','workspace.read','execution.run'],requiredEffects:[...Object.keys(contents).map(path=>({type:'file',path,command:'',expectedExit:null})),
    {type:'execution',path:'.',command:JSON.stringify(args.argv),expectedExit:0}]};
let calls=0;
const workers=new WorkerService({store,authority,registry,broker,providerFactory:()=>({async generate(request){
  if(++calls>2)throw Error('Cut must precede the final proposal');
  const operations=calls===1?Object.entries(contents).map(([path,content])=>({tool:'workspace.write',args:{path,content,expectedHash:null}}))
    :[...Object.keys(contents).map(path=>({tool:'workspace.read',args:{path}})),{tool:'execution.run',args}];
  const value={action:'batch',tool:'',argsJson:JSON.stringify(operations),body:'',claims:[],method:'fixture-exact-arguments',reason:''};
  await request.validate(value);return {value,receipt:{kind:'inference',status:'completed',simulation:true,threadId:'fixture-'+calls,turnId:String(calls),
    model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
},async close(){}})});
const cut=()=>{if(store.db.isTransaction)throw Error('Cut must be after the durable commit');process.exit(86);};
const execute=broker.execute.bind(broker);broker.execute=async request=>{
  if(request.tool==='execution.run'&&phase==='before-execution')cut();
  const receipt=await execute(request);
  if(request.tool==='execution.run'&&phase==='after-execution-receipt')cut();
  return receipt;
};
if(phase==='dispatched-no-result')runner.run=async()=>cut();
const tool=workers.tool.bind(workers);workers.tool=async(...args)=>{
  const receipt=await tool(...args);
  if(args[1]==='workspace.read'&&args[2].path==='value.mjs'&&phase==='after-first-read')cut();
  if(args[1]==='execution.run'&&phase==='after-execution-observation')cut();
  return receipt;
};
const producer=workers.createRun({missionId:'m',nodeId:node.id,mode:'producer',purpose:node.purpose,roleIds:node.roleIds});
try{await workers.produce({missionId:'m',node,runId:producer.id});throw Error('Expected process cut not reached');}finally{store.close();}
