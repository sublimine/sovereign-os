// Exact local read/test proposal recovery, not an autonomous plan or permission.
import {canonical,check,clone,integer,keys,sha256} from './contracts.mjs';
import {readVerifiedProducerProposal,producerResponseContract} from './producer-response.mjs';
import {producerToolBudget} from './producer-tool-budget.mjs';
import {READ_TEST_BATCH_MODE,validateProducerBatch} from './producer-batch.mjs';
import {mergeRequiredEffects} from './plans.mjs';
export const PRODUCER_BATCH_CURSOR='producer-read-test-cursor-v1';
const integrity=(ok,message)=>check(ok,'PRODUCER_BATCH_INTEGRITY',message);
const ref=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
const idFor=(runId,step)=>runId+':batch-cursor:'+step;
function eligible(value){
  if(value?.action!=='batch')return null;let operations;try{operations=JSON.parse(value.argsJson);}catch{return null;}
  return Array.isArray(operations)&&operations.length>0&&operations.every(o=>['workspace.read','workspace.list','execution.run'].includes(o?.tool))?operations:null;
}
function context(registry,runId){
  const p=readVerifiedProducerProposal(registry,runId);if(!p)return null;
  const operations=eligible(p.value);if(!operations)return null;
  integrity(p.documentary===null&&p.value.tool===''&&p.value.body===''&&Array.isArray(p.value.claims)&&p.value.claims.length===0,
    'Ordinary exact tool batch cannot contain documentary navigation, final body or claims');
  const budget=producerToolBudget(registry,runId),s=registry.store,mission=s.get('mission',p.missionId),run=s.get('run',runId);
  const completed=s.get('run',runId,p.completedRunRecord.version);
  integrity(run.data.contextHash===completed.data.contextHash
    &&canonical(run.data.runtimeObservations??[])===canonical(completed.data.runtimeObservations??[]),
    'A read/test cursor cannot change the retained non-tool exposure');
  integrity(mission&&!['CANCELLED','COMPLETED'].includes(mission.data.status),'A terminal mission cannot resume tool work');
  const nodeRecord=s.get('node',p.missionId+':'+p.nodeId);
  integrity(!nodeRecord||!['INVALIDATED','ACCEPTED'].includes(nodeRecord.data.status)
    &&canonical(nodeRecord.data.spec)===canonical(p.task.node),'Current node must preserve the exact unaccepted original specification');
  const inputs=p.task.inputRefs;
  integrity(Array.isArray(inputs)&&producerResponseContract({missionId:p.missionId,node:p.task.node,inputRefs:inputs})===p.contractHash,
    'Exact original accepted-input contract required');
  for(const input of inputs){const a=registry.assertUsable(input.artifactId,{missionId:p.missionId,purpose:input.purpose});
    integrity(a.payloadHash===input.hash&&run.data.context.artifactIds.includes(a.id),'Cursor input changed or was not exposed');}
  for(const sourceId of run.data.context.sourceIds){const source=s.get('source',sourceId)?.data;
    check(source?.status==='ADMITTED'&&source.missionId===p.missionId,'SOURCE_UNAVAILABLE','Cursor cannot resume with withdrawn evidence');}
  const requiredEffects=mergeRequiredEffects(p.task.node.requiredEffects,...inputs.map(input=>s.get('artifact',input.artifactId).data.payload.requiredEffects??[]));
  integrity(p.step<budget.limits.maxSteps&&operations.length<=budget.limits.maxBatchOperations,'Original proposal or batch limit exceeded');
  const seen=new Set();for(const operation of operations){keys(operation,['tool','args']);
    integrity(p.task.node.tools.includes(operation.tool)&&mission.data.policy.allowedTools.includes(operation.tool),'Cursor operation exceeds original scope');
    const fingerprint=sha256(operation);integrity(!seen.has(fingerprint),'Duplicate operation in retained cursor');seen.add(fingerprint);}
  validateProducerBatch(operations,{mode:READ_TEST_BATCH_MODE,requiredEffects});
  return {p,budget,operations,completed};
}
function binding(c){return {schema:PRODUCER_BATCH_CURSOR,runId:c.p.runId,missionId:c.p.missionId,nodeId:c.p.nodeId,step:c.p.step,
  proposal:c.p.proposal,completedRunRecord:c.p.completedRunRecord,requestHash:c.p.requestHash,cleanup:c.p.cleanup,producerOrigin:c.p.producerOrigin,
  workerConfiguration:c.p.workerConfiguration,contractHash:c.p.contractHash,limits:c.budget.limits,
  operations:c.operations.map((operation,index)=>({...clone(operation),operationId:c.p.runId+':step:'+c.p.step+':batch:'+index}))};}
function snapshot(registry,runId){
  const c=context(registry,runId);if(!c)return null;
  const s=registry.store,id=idFor(runId,c.p.step),origin=s.get('producer-batch-cursor',id,1),current=s.get('producer-batch-cursor',id);
  const priorObservations=c.completed.data.toolObservations??[],observations=s.get('run',runId).data.toolObservations??[];
  integrity(observations.length===priorObservations.length+(current?.data.nextIndex??0)
    &&canonical(observations.slice(0,priorObservations.length))===canonical(priorObservations),
    'Cursor must preserve the original observation prefix without unrelated new observations');
  if(!origin)return {context:c,origin:null,current:null};
  integrity(canonical(origin.data)===canonical({binding:binding(c),nextIndex:0,status:'ACTIVE',observations:[]}),
    'Original immutable cursor declaration changed');
  const d=current.data;keys(d,['binding','nextIndex','status','observations']);integer(d.nextIndex,'cursor position',{min:0,max:c.operations.length});
  integrity(canonical(d.binding)===canonical(origin.data.binding)&&current.version===d.nextIndex+1
    &&Array.isArray(d.observations)&&d.observations.length===d.nextIndex,'Cursor identity, position or observation prefix changed');
  let failed=false;
  for(const [index,observation]of d.observations.entries()){
    keys(observation,['operationId','receiptHash','status']);const operation=d.binding.operations[index],effect=s.get('effect',operation.operationId);
    const receipt=effect?.data.receipt&&registry.verifiedToolReceipt(effect.data.receipt);
    integrity(!failed&&receipt&&observation.operationId===operation.operationId&&observation.receiptHash===sha256(effect.data.receipt)
      &&observation.status===receipt.status&&receipt.principalId===runId&&receipt.missionId===c.p.missionId&&receipt.tool===operation.tool
      &&receipt.argsHash===sha256(operation.args),'Cursor must retain each exact original receipt, stopping on the first failure');
    const charge=s.get('producer-tool-charge',operation.operationId);
    integrity(charge?.version===1&&c.budget.charges.some(r=>canonical(r)===canonical(ref(charge))),'An observed cursor member requires its durable original charge');
    const run=s.get('run',runId),observed=(run.data.toolObservations??[]).find(o=>o.id===operation.operationId);
    integrity(observed&&observed.hash===observation.receiptHash&&sha256(observed.signedReceipt)===observation.receiptHash,
      'Cursor progress lacks its atomically retained observation');
    const transition=s.get('producer-batch-cursor',id,index+2);
    integrity(transition&&transition.data.nextIndex===index+1&&canonical(transition.data.binding)===canonical(d.binding)
      &&canonical(transition.data.observations)===canonical(d.observations.slice(0,index+1))
      &&transition.data.status===(receipt.status==='FAILED'?'FAILED':index+1===c.operations.length?'COMPLETED':'ACTIVE'),
      'Cursor transition history changed');
    const sequence=registry.committedSequence('producer-batch-cursor',id,index+2);
    integrity(sequence>registry.committedSequence(charge.type,charge.id,1)&&sequence>registry.committedSequence(effect.type,effect.id,effect.version)
      &&registry.committedSequence(charge.type,charge.id,1)>registry.committedSequence(origin.type,origin.id,1),
      'Cursor advancement must follow original charge and committed receipt');
    failed=receipt.status==='FAILED';
  }
  integrity(d.status===(failed?'FAILED':d.nextIndex===c.operations.length?'COMPLETED':'ACTIVE'),'Cursor terminal state contradicts its observed prefix');
  return {context:c,origin,current};
}
export function readProducerBatchCursor(registry,runId){
  const db=registry.store.db,own=!db.isTransaction;if(own)db.exec('BEGIN');
  try{const state=snapshot(registry,runId);if(!state?.current)return null;
    return clone({record:ref(state.current),...state.current.data,task:state.context.p.task,value:state.context.p.value,
      budget:state.context.budget,scope:'Exact retained batch position; no new inference, authority, current-file claim or acceptance.'});
  }finally{if(own&&db.isTransaction)db.exec('ROLLBACK');}
}
// The process may die after a closed exact proposal but before declaring its
// cursor. Such a proposal can be reused only if none of its members was charged
// or dispatched. The producer must still perform the complete original preflight.
export function readRecoverableProducerBatch(registry,runId){
  const db=registry.store.db,own=!db.isTransaction;if(own)db.exec('BEGIN');
  try{const state=snapshot(registry,runId);if(!state)return null;
    if(state.current)return readProducerBatchCursor(registry,runId);
    const c=state.context,bound=binding(c);
    integrity(!c.budget.charges.some(r=>registry.store.get(r.type,r.id).data.step===c.p.step)
      &&bound.operations.every(o=>!registry.store.get('effect',o.operationId)),
      'A batch without its original declaration cannot borrow previously attempted effects');
    return clone({record:null,binding:bound,nextIndex:0,status:'ACTIVE',observations:[],declarationPending:true,
      task:c.p.task,value:c.p.value,budget:c.budget,
      scope:'Unconsumed closed batch proposal only. Full preflight and original cursor declaration still required before any effect.'});
  }finally{if(own&&db.isTransaction)db.exec('ROLLBACK');}
}
/** The worker must complete its all-member argument/failure preflight first.
 * This declaration itself dispatches nothing and does not replace the broker. */
export function prepareProducerBatchCursor(registry,runId){
  return registry.store.transact(()=>{
    const state=snapshot(registry,runId);if(!state)return null;if(state.current)return readProducerBatchCursor(registry,runId);
    const {context:c}=state,charged=c.budget.charges.map(r=>registry.store.get(r.type,r.id).data).filter(d=>d.step===c.p.step);
    integrity(charged.length===0,'Cursor must be declared before its first charged member');
    check(c.operations.length<=c.budget.remaining,'WORKER_LIMIT','The complete cursor batch must fit before its first charge');
    registry.store.put('producer-batch-cursor',idFor(runId,c.p.step),{binding:binding(c),nextIndex:0,status:'ACTIVE',observations:[]},{expectedVersion:0});
    return readProducerBatchCursor(registry,runId);
  });
}
/** Receipt observation and cursor advancement are one SQLite commit. Broker
 * completion is a distinct prior boundary; never include an external effect in
 * this transaction or infer a receipt from a started job. */
export function observeProducerBatchReceipt(registry,{runId,index,signedReceipt}){
  return registry.store.transact(()=>{
    const state=snapshot(registry,runId);integrity(state?.current,'Original cursor declaration required');
    const d=state.current.data;integer(index,'cursor receipt index',{min:0,max:d.binding.operations.length-1});
    const operation=d.binding.operations[index],receipt=registry.verifiedToolReceipt(signedReceipt);
    integrity(receipt.id===operation.operationId&&receipt.principalId===runId&&receipt.missionId===d.binding.missionId
      &&receipt.tool===operation.tool&&receipt.argsHash===sha256(operation.args),'Receipt belongs to a different original operation');
    if(index<d.nextIndex){integrity(d.observations[index].receiptHash===sha256(signedReceipt),'Already observed receipt cannot change');return readProducerBatchCursor(registry,runId);}
    integrity(d.status==='ACTIVE'&&index===d.nextIndex,'Cursor may consume only its next member');
    const charge=registry.store.get('producer-tool-charge',operation.operationId);
    integrity(charge&&state.context.budget.charges.some(r=>canonical(r)===canonical(ref(charge))),'Uncharged operation cannot advance');
    registry.recordToolObservation(runId,signedReceipt);
    const nextIndex=index+1,status=receipt.status==='FAILED'?'FAILED':nextIndex===d.binding.operations.length?'COMPLETED':'ACTIVE';
    registry.store.put('producer-batch-cursor',state.current.id,{...d,nextIndex,status,observations:[...d.observations,
      {operationId:operation.operationId,receiptHash:sha256(signedReceipt),status:receipt.status}]},{expectedVersion:state.current.version});
    return readProducerBatchCursor(registry,runId);
  });
}
