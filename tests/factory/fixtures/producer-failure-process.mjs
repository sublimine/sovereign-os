// Real child-process crash boundaries; no provider, network or installed state.
import {join} from 'node:path';
import {FactoryEngine} from '../../../factory/lib/engine.mjs';

const [directory,mode]=process.argv.slice(2);
if(!directory||!['receipt-only','observed','repaired'].includes(mode))throw Error('Explicit temporary fixture and boundary required');
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspace')});
engine.workers.providerFactory=()=>{throw Error('No inference in crash preparation');};
const mission=engine.create('Create result.txt containing verified result.',{entryMode:'planned',allowedTools:['workspace.read','workspace.write']});
const run=engine.workers.createRun({missionId:mission.id,nodeId:'result',mode:'producer',purpose:'file-delivery',roleIds:['omega_02']});
const args={path:'result.txt'},operationId=run.id+':failed-read';
if(mode==='receipt-only'){
  const signed=await engine.broker.execute({missionId:mission.id,principalId:run.id,tool:'workspace.read',args,operationId,
    lease:engine.workers.lease(run.id,'workspace.read')});
  if(signed.data.status!=='FAILED')throw Error('Expected committed failure before observation');
}else{
  const result=await engine.workers.tool(run.id,'workspace.read',args,operationId);
  if(result.status!=='FAILED')throw Error('Expected admitted failure');
}
if(mode==='repaired'){
  const result=await engine.workers.tool(run.id,'workspace.write',{path:'result.txt',content:'verified result',expectedHash:null},run.id+':repair');
  if(result.status!=='SUCCEEDED')throw Error('Expected committed repair');
}
process.kill(process.pid,'SIGKILL');
