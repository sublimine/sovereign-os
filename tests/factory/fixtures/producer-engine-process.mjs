// Full coordinator crash fixture: actual process/ledger, explicitly simulated models.
import fs from 'node:fs';import {join} from 'node:path';
import {FactoryEngine} from '../../../factory/lib/engine.mjs';
import {inferenceRequestHash} from '../../../factory/providers/instruction-profiles.mjs';
import {readSourceContextView} from '../../../factory/lib/source-context-view.mjs';
import {captureProcessIdentity} from '../../../factory/lib/process-identity.mjs';
const [directory,boundary='after-cleanup-commit']=process.argv.slice(2);
if(!directory||!['after-response-commit','after-cleanup-commit'].includes(boundary))throw Error('Exact fixture directory and cut');
const intent='Preserve the original answer through a producer crash and then review it.';
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspaces')});
const mission=engine.create(intent,{allowedTools:[],maxNodeAttempts:1,inferenceBudget:{mode:'mission-calls-v1',maxCalls:4}});
fs.writeFileSync(join(directory,'fixture.json'),JSON.stringify({missionId:mission.id,owner:captureProcessIdentity(),boundary}),{flag:'wx',mode:0o600});
let count=0;
engine.workers.providerFactory=()=>({async generate(request){
  count++;const e=readSourceContextView(request.input),task=JSON.parse(e.task);let value;
  if(request.schema.properties.requirements)value={requirements:[{id:'r1',text:intent,requestQuote:intent,criteria:[{id:'result',text:intent}]}],
    nodes:[{id:'deliver',title:'Deliver',purpose:'deliver',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],requirementIds:['r1'],dependencies:[],
      method:{id:'fixture',rationale:'Bounded fixture',alternatives:['Independent derivation']},instructions:intent,outputKind:'delivery',criteria:[{id:'result',text:intent}],
      tools:[],requiredEffects:[],specialist:null}],finalNodeId:'deliver',routingRationale:'Explicitly simulated full coordinator fixture'};
  else if(request.schema.properties.artifactHash){const a=e.artifacts.find(a=>a.id===task.candidateId);
    value={artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',
      evidence:[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body}],reason:'Explicitly simulated independent review fixture'})),findings:[],uncertainty:'Simulated model'};
  }else value={action:'final',tool:'',argsJson:'',body:'Original full-engine response',claims:[],method:'fixture-result',reason:''};
  await request.validate(value);return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:'sim-child-'+count,turnId:'sim-child-turn-'+count,
    model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
},async close(){}});
const append=engine.store.append.bind(engine.store);
engine.store.append=(kind,data)=>{if(kind===(boundary==='after-response-commit'?'worker.inference.completed':'worker.producer.cleanup.recorded')
  &&engine.store.get('run',data.runId)?.data.nodeId==='deliver')process.kill(process.pid,'SIGKILL');
  return append(kind,data);};
const result=await engine.run(mission.id);throw Error('Expected SIGKILL was not reached: '+JSON.stringify(result.mission.pending));
