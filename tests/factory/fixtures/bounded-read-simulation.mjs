// Reusable deterministic provider for protocol tests only; no model quality claim.
import assert from 'node:assert/strict';
import {readSourceContextView} from '../../../factory/lib/source-context-view.mjs';
import {inferenceRequestHash} from '../../../factory/providers/instruction-profiles.mjs';
import {BOUNDED_READ_NODE} from '../../../factory/lib/bounded-read-spec.mjs';
export function boundedReadSimulation(engine,name){
  const state={calls:0,closes:0};
  engine.workers.providerFactory=()=>({async generate(request){
    const call=++state.calls,exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);let value;
    if(task.candidateId){
      const a=exposure.artifacts.find(a=>a.id===task.candidateId);assert.equal(a.payload.kind,'bounded-read-response');
      const own=exposure.toolObservations.filter(o=>o.relation==='OWN_ACTION'&&o.tool==='workspace.read'&&o.status==='SUCCEEDED');assert.equal(own.length,1);
      assert.equal(own[0].result.content,'13\n17\n');
      const evidence=[{kind:'artifact',id:a.id,hash:a.hash,quote:a.payload.body},...own.map(o=>({kind:'tool',id:o.id,hash:o.hash,quote:o.quoteText}))];
      value={artifactHash:a.hash,purpose:a.payload.purpose,decision:'ACCEPT',checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',evidence,
        reason:'SIM fixture: protocol observation only, not semantic quality.'})),findings:[],uncertainty:'Deterministic simulated provider'};
    }else{
      assert.equal(task.node.id,BOUNDED_READ_NODE,'No substitute full planning in this recovery qualification');
      value=task.step===0?{action:'batch',tool:'',argsJson:JSON.stringify([{tool:'workspace.read',args:{path:'input.txt'}}]),body:'',claims:[],method:'single-exact-read',reason:''}
        :{action:'final',tool:'',argsJson:'',body:'13 + 17 = 30.',claims:[],method:'derive-from-supplied-input',reason:''};
    }
    await request.validate(value);return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:'sim-'+name+'-'+call,turnId:'sim',
      model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
  },async close(){state.closes++;return {processExitObserved:true};}});return state;
}
