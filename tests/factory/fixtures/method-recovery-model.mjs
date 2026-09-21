// Deterministic test responses only: never evidence of model competence.
import {readSourceContextView} from '../../../factory/lib/source-context-view.mjs';
import {inferenceRequestHash} from '../../../factory/providers/instruction-profiles.mjs';
export const methodRecoveryIntent='Compute 9 + 4 from both original terms and independently review the result.';
export function methodRecoveryPlan(){const intent=methodRecoveryIntent;return {
  requirements:[{id:'r1',text:intent,requestQuote:intent,criteria:[{id:'sum',text:'The result uses both terms and equals 13.'}]}],
  nodes:[{id:'deliver',title:'Compute',purpose:'deliver',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],requirementIds:['r1'],dependencies:[],
    method:{id:'direct',rationale:'Direct synthesis from the original terms.',alternatives:['Term-by-term reconstruction']},instructions:intent,
    outputKind:'delivery',criteria:[{id:'sum',text:'The result uses both terms and equals 13.'}],requiredEffects:[],tools:[],specialist:null}],
  finalNodeId:'deliver',routingRationale:'A single closed material product for this synthetic crash test.'};}
export function methodRecoveryFixtureProvider(prefix='sim-method'){
  let count=0;return ()=>({async generate(request){
    count++;const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);let value;
    if(request.schema.properties.requirements){
      value=task.previousPlan?structuredClone(task.previousPlan):methodRecoveryPlan();
      if(task.previousPlan){value.nodes[0].instructions+=' Recompute each original term separately and reconcile their sum.';
        value.nodes[0].method={id:'term-reconstruction',rationale:'The rejected direct synthesis omitted the second term; explicitly enumerate both before summing.',alternatives:['Rejected direct synthesis']};}
    }else if(request.schema.properties.artifactHash){
      const a=exposure.artifacts.find(a=>a.id===task.candidateId),fail=a.payload.purpose==='deliver'&&a.payload.body==='9';
      value={artifactHash:a.hash,purpose:a.payload.purpose,decision:fail?'RETURN':'ACCEPT',checks:task.criteria.map(c=>({criterionId:c.id,verdict:fail?'FAIL':'PASS',
        evidence:[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body}],reason:fail?'The second input term 4 was omitted.':'Explicitly simulated gate; not live semantic evidence.'})),
        findings:fail?[{severity:'material',description:'The second term 4 is absent from the computed answer.',recovery:'Enumerate both terms before summing.'}]:[],uncertainty:'Simulated model fixture'};
    }else value={action:'final',tool:'',argsJson:'',body:task.node.instructions.includes('Recompute each original term')?'13':'9',claims:[],method:'fixture',reason:'Controlled test answer'};
    await request.validate(value);return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:`${prefix}-${count}`,turnId:`${prefix}-turn-${count}`,
      model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
  },async close(){return {processExitObserved:true};}});
}
