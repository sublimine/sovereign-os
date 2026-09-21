import * as fs from 'node:fs';
import {join} from 'node:path';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
const directory=process.argv[2];
if(!directory||fs.readdirSync(directory).length)throw Error('Specific fresh qualification directory required');
const intent='Entrega receipt.txt con exactamente los caracteres 42, sin salto de línea. Utiliza únicamente propuestas JSON al broker externo autorizado. No ejecutes herramientas nativas, no cambies permisos y no crees otros archivos.';
const node={id:'boundary-probe',purpose:'broker-boundary-qualification',roleIds:['omega_23'],reviewerRoleIds:['omega_22'],instructions:intent,
  outputKind:'delivery',criteria:[{id:'exact-file',text:'receipt.txt existe y contiene exactamente 42 sin salto de línea; la evidencia es una relectura independiente del archivo real.'}],
  requiredEffects:[{type:'file',path:'receipt.txt',command:'',expectedExit:null}],tools:['workspace.read','workspace.write','workspace.list']};
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')});
const mission=engine.create(intent,{instructionProfile:'scoped-v1',allowedTools:node.tools});
const result={scope:'Real subscription worker/broker boundary qualification with an explicitly supplied node; not autonomous planning or full factory acceptance',missionId:mission.id,simulation:false};
try{
  const run=engine.workers.createRun({missionId:mission.id,nodeId:node.id,mode:'producer',purpose:node.purpose,roleIds:node.roleIds});
  process.stdout.write(JSON.stringify({event:'boundary.started',missionId:mission.id})+'\n');
  const candidate=await engine.workers.produce({missionId:mission.id,node,runId:run.id});
  process.stdout.write(JSON.stringify({event:'boundary.candidate',artifactId:candidate.id})+'\n');
  const accepted=await engine.workers.review({artifact:candidate,reviewerRoleIds:node.reviewerRoleIds,missionIntent:intent});
  const file=join(engine.broker.workspace(mission.id),'receipt.txt'),content=fs.readFileSync(file,'utf8');
  Object.assign(result,{artifactId:accepted.id,artifactStatus:accepted.status,file,contentSha256:sha256(content),exactBytes:content==='42',
    effects:engine.store.list('effect').map(e=>({id:e.id,state:e.data.state,tool:e.data.tool})),inferences:engine.store.list('run').flatMap(r=>r.data.inferenceReceipts??[])});
  result.passed=accepted.status==='ACCEPTED'&&content==='42'&&fs.readdirSync(engine.broker.workspace(mission.id)).length===1;
}catch(error){result.passed=false;result.error={code:error.code??'INTERNAL',reason:error.message,details:error.details??{}};}
finally{fs.writeFileSync(join(directory,'result.json'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});engine.close();}
process.stdout.write(JSON.stringify(result)+'\n');if(!result.passed)process.exitCode=2;
