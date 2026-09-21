// Own test child only. Abrupt process exit skips engine cleanup at a precise
// durable boundary; all provider responses are explicitly simulated.
import {join} from 'node:path';
import {FactoryEngine} from '../../../factory/lib/engine.mjs';
import {id} from '../../../factory/lib/contracts.mjs';
import {inferenceRequestHash} from '../../../factory/providers/instruction-profiles.mjs';
const [directory,missionId,phase,planJson]=process.argv.slice(2);
if(!['registered','claimed','materialized','accepted'].includes(phase))throw Error('Known own-test crash phase required');
const engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'workspace'),
  onEvent:event=>{if(phase==='claimed'&&event.kind==='node.started'&&event.nodeId==='copy')process.exit(86);}});
const transition=engine.ledger.transition.bind(engine.ledger);
const claim=engine.ledger.claim.bind(engine.ledger);
engine.ledger.claim=(...args)=>{if(phase==='registered')process.exit(86);return claim(...args);};
engine.ledger.transition=(mission,node,options)=>{
  if(node==='copy'&&(phase==='materialized'&&options.status==='REVIEW_PENDING'||phase==='accepted'&&options.status==='ACCEPTED'))process.exit(86);
  return transition(mission,node,options);
};
engine.workers.providerFactory=()=>({async generate(request){
  const exposure=JSON.parse(request.input),task=JSON.parse(exposure.task);
  let value;
  if(Object.hasOwn(request.schema.properties,'requirements'))value=JSON.parse(planJson);
  else if(Object.hasOwn(request.schema.properties,'artifactHash')){
    const candidate=exposure.artifacts.find(a=>a.id===task.candidateId),proof=exposure.runtimeObservations?.find(o=>o.kind==='artifact-input-copy');
    value={artifactHash:candidate.hash,purpose:candidate.payload.purpose,decision:'ACCEPT',
      checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',reason:'SIMULATED review for real process-recovery test, not semantic qualification.',
        evidence:[{kind:'artifact',id:candidate.id,hash:candidate.hash,quote:candidate.payload.body},
          ...(proof?[{kind:'runtime',id:proof.id,hash:proof.hash,quote:'"artifactId":'+JSON.stringify(candidate.id)}]:[])]})),findings:[],uncertainty:'Simulated reviewer.'};
  }else throw Error('Native copy must not invoke a producing model');
  await request.validate(value);
  return {value,receipt:{status:'completed',simulation:true,threadId:id('sim-copy-crash'),turnId:'test',
    contextHash:inferenceRequestHash(request),model:request.model,reasoningEffort:request.reasoningEffort}};
},async close(){}});
try{const outcome=await engine.run(missionId);throw Error('Expected test boundary did not exit: '+JSON.stringify({status:outcome.mission.status,pending:outcome.mission.pending}));}finally{engine.close();}
