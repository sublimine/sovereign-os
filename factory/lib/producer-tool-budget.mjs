// Durable per-producer attempt ledger. Charges do not grant broker authority,
// certify dispatch, accept a result or refund a failed/interrupted attempt.
import {canonical,check,clone,integer,keys,sha256} from './contracts.mjs';
import {READ_TEST_CURSOR_MODE} from './producer-batch.mjs';
import {readVerifiedProducerProposal,PRODUCER_CLEANUP_PROTOCOL,PRODUCER_RESPONSE_RETENTION} from './producer-response.mjs';
export const PRODUCER_TOOL_ACCOUNTING='producer-tool-accounting-v1';
const ref=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
const integrity=(ok,message)=>check(ok,'PRODUCER_TOOL_BUDGET_INTEGRITY',message);
export function producerExecutionLimits(value){
  keys(value,['maxSteps','maxToolOperations','maxBatchOperations']);
  integer(value.maxSteps,'maxSteps',{min:1,max:100000});integer(value.maxToolOperations,'maxToolOperations',{min:1,max:100});
  integer(value.maxBatchOperations,'maxBatchOperations',{min:1,max:8});return clone(value);
}
function binding(registry,runId){
  const s=registry.store,run=s.get('run',runId),origin=s.get('worker-production',runId,1),state=s.get('worker-production',runId),config=s.get('worker-config',runId);
  const mission=run&&s.get('mission',run.data.missionId);
  integrity(run?.data.mode==='producer'&&origin?.data.responseRetention===PRODUCER_RESPONSE_RETENTION
    &&origin.data.cleanupProtocol===PRODUCER_CLEANUP_PROTOCOL&&origin.data.toolAccounting===PRODUCER_TOOL_ACCOUNTING
    &&mission?.data.policy.producerBatch===READ_TEST_CURSOR_MODE&&config?.data.compilationScope.producerBatch===READ_TEST_CURSOR_MODE,
    'Only a new original cursor-mode producer has this tool ledger');
  const limits=producerExecutionLimits(origin.data.executionLimits);
  integrity(state.data.toolAccounting===origin.data.toolAccounting&&canonical(state.data.executionLimits)===canonical(limits)
    &&state.data.contractHash===origin.data.contractHash&&mission.data.intentHash===sha256(mission.data.intent)
    &&run.data.contextHash===sha256(run.data.context)&&config.data.prefixHash===sha256(config.data.instructions),
    'Producer limits, invocation, context or prefix changed');
  return {run,origin,config,mission,limits};
}
function budgetData(a){return {schema:PRODUCER_TOOL_ACCOUNTING,runId:a.run.id,missionId:a.mission.id,nodeId:a.run.data.nodeId,
  producerOrigin:ref(a.origin),workerConfiguration:ref(a.config),policyHash:sha256(a.mission.data.policy),limits:a.limits};}
export function initializeProducerToolBudget(registry,runId){
  const s=registry.store;
  check(s.db.isTransaction,'STORAGE_VERSION','Tool budget must be initialized in its producer-origin transaction');
  const a=binding(registry,runId);s.requireExecutionProtocol(4);
  return s.put('producer-tool-budget',runId,budgetData(a),{expectedVersion:0});
}
function currentBudget(registry,runId){
  const a=binding(registry,runId),budget=registry.store.get('producer-tool-budget',runId);
  integrity(budget?.version===1&&canonical(budget.data)===canonical(budgetData(a)),'Original immutable producer budget changed or is missing');
  // Protocol 12 adds learning-provenance custody, not another producer-tool
  // accounting mode; the original immutable budget remains the only authority.
  integrity([4,5,6,7,8,9,10,11,12,13,14,15,16,17].includes(registry.store.db.prepare('PRAGMA user_version').get().user_version),'Tool accounting execution protocol changed or is unsupported');
  return {a,budget};
}
function operationsOf(proposal){
  integrity(['tool','batch'].includes(proposal.value.action),'Only an exact tool/batch proposal can charge a tool attempt');
  let args;try{args=JSON.parse(proposal.value.argsJson);}catch{integrity(false,'Retained tool arguments are not JSON');}
  const operations=proposal.value.action==='batch'?args:[{tool:proposal.value.tool,args}];
  integrity(Array.isArray(operations)&&operations.length>0&&operations.length<=8,'Bounded exact operation list required');
  for(const operation of operations){keys(operation,['tool','args']);integrity(typeof operation.tool==='string'&&operation.args&&typeof operation.args==='object'&&!Array.isArray(operation.args),'Exact tool and object arguments required');}
  return operations;
}
function operationId(runId,step,index,batched){return runId+':step:'+step+(batched?':batch:'+index:'');}
function exactRecord(store,r,type,{versions=[1]}={}){
  integrity(r?.type===type&&versions.includes(r.version),'Original record reference required');const record=store.get(type,r.id);
  integrity(record?.version===r.version&&record.hash===r.hash,'Original referenced record changed or disappeared');return record;
}
function charges(registry,runId,expected){
  const s=registry.store,records=s.list('producer-tool-charge').filter(r=>r.id.startsWith(runId+':step:')||r.data.runId===runId).sort((a,b)=>a.data.ordinal-b.data.ordinal);
  integrity(records.length<=expected.a.limits.maxToolOperations,'Producer charges exceed original limit');
  let previousSequence=registry.committedSequence(expected.budget.type,expected.budget.id,1),previousCharge=null;
  for(const [index,record]of records.entries()){
    const d=record.data;keys(d,['schema','runId','missionId','nodeId','ordinal','operationId','step','index','batched','tool','argsHash','proposal','cleanup','requestHash','budget']);
    integrity(record.version===1&&d.schema===PRODUCER_TOOL_ACCOUNTING&&d.ordinal===index+1&&d.runId===runId
      &&d.missionId===expected.a.mission.id&&d.nodeId===expected.a.run.data.nodeId&&canonical(d.budget)===canonical(ref(expected.budget)),
      'Immutable charge identity, ordinal or budget changed');
    const proposal=exactRecord(s,d.proposal,'worker-proposal'),p=proposal.data,cleanup=exactRecord(s,d.cleanup,'producer-cleanup',{versions:[1,2]}),c=cleanup.data;
    const operations=operationsOf(p),operation=operations[d.index];
    integrity(p.runId===runId&&p.requestHash===d.requestHash&&p.step===d.step&&p.retention?.valueHash===sha256(p.value)
      &&p.retention.policyHash===expected.budget.data.policyHash&&c.runId===runId&&c.requestHash===d.requestHash&&c.status==='CLOSED'
      &&c.adapterCloseConfirmed===true&&c.processExitObserved!==false&&canonical(c.proposalRecord)===canonical(ref(proposal))
      &&canonical(c.producerOrigin)===canonical(expected.budget.data.producerOrigin)&&canonical(c.workerConfiguration)===canonical(expected.budget.data.workerConfiguration),
      'Charge must preserve its actual protected proposal and closure');
    integrity(Number.isSafeInteger(d.step)&&d.step>=0&&d.step<expected.a.limits.maxSteps&&Number.isSafeInteger(d.index)&&d.index>=0
      &&d.batched===(p.value.action==='batch')&&operation&&d.tool===operation.tool&&d.argsHash===sha256(operation.args)
      &&(!d.batched||operations.length<=expected.a.limits.maxBatchOperations)&&expected.a.mission.data.policy.allowedTools.includes(d.tool)
      &&record.id===d.operationId&&record.id===operationId(runId,d.step,d.index,d.batched)
      &&(previousCharge&&d.step===previousCharge.step?d.index===previousCharge.index+1:d.index===0&&(!previousCharge||d.step>previousCharge.step)),
      'Charge operation or proposal position changed');
    const sequence=registry.committedSequence(record.type,record.id,1);
    integrity(Number.isSafeInteger(sequence)&&sequence>previousSequence&&sequence>registry.committedSequence(cleanup.type,cleanup.id,1),'Charge chronology changed');
    previousSequence=sequence;previousCharge=d;
  }
  return records;
}
export function producerToolBudget(registry,runId){
  const db=registry.store.db,own=!db.isTransaction;if(own)db.exec('BEGIN');
  try{const current=currentBudget(registry,runId),records=charges(registry,runId,current);
    return {runId,limits:clone(current.a.limits),used:records.length,remaining:current.a.limits.maxToolOperations-records.length,
      charges:records.map(ref),scope:'Durable attempted-operation count, not a count of successfully executed effects or authority.'};
  }finally{if(own&&db.isTransaction)db.exec('ROLLBACK');}
}
export function chargeProducerTool(registry,{runId,index}){
  integer(index,'operation index',{min:0,max:7});
  return registry.store.transact(()=>{
    const current=currentBudget(registry,runId),previous=charges(registry,runId,current),proposal=readVerifiedProducerProposal(registry,runId);
    integrity(proposal&&proposal.documentary===null&&proposal.runId===runId&&proposal.contractHash===current.a.origin.data.contractHash,
      'Charge requires the exact latest ordinary producer proposal');
    const operations=operationsOf(proposal),limits=current.a.limits,batched=proposal.value.action==='batch';
    integrity(proposal.step<limits.maxSteps&&index<operations.length&&(!batched||operations.length<=limits.maxBatchOperations),
      'Original step, batch or operation limit exceeded');
    const earlier=previous.filter(r=>r.data.step<proposal.step);
    integrity(previous.every(r=>r.data.step<=proposal.step)&&proposal.task.remainingToolOperations===limits.maxToolOperations-earlier.length,
      'Original exposed allowance differs from durable prior attempts');
    for(const operation of operations)integrity(current.a.mission.data.policy.allowedTools.includes(operation.tool)
      &&proposal.task.node.tools.includes(operation.tool),'Tool attempt is outside original mission/node scope');
    const ids=operations.map((_,i)=>operationId(runId,proposal.step,i,batched));
    const remaining=ids.filter(id=>!previous.some(r=>r.id===id));
    check(previous.length+remaining.length<=limits.maxToolOperations,'WORKER_LIMIT','The complete original batch must fit without forgetting any charge');
    for(let i=0;i<index;i++)integrity(previous.some(r=>r.id===ids[i]),'Earlier batch members must be charged before a later member');
    const existing=previous.find(r=>r.id===ids[index]);if(existing)return {record:existing,alreadyCharged:true};
    const cursor=registry.store.get('producer-batch-cursor',runId+':batch-cursor:'+proposal.step);
    integrity(!cursor||cursor.data.status==='ACTIVE'&&cursor.data.nextIndex===index,
      'A declared batch may charge only its next active member, never a failed suffix');
    const operation=operations[index],record=registry.store.put('producer-tool-charge',ids[index],{schema:PRODUCER_TOOL_ACCOUNTING,
      runId,missionId:current.a.mission.id,nodeId:current.a.run.data.nodeId,ordinal:previous.length+1,operationId:ids[index],
      step:proposal.step,index,batched,tool:operation.tool,argsHash:sha256(operation.args),proposal:proposal.proposal,
      cleanup:proposal.cleanup,requestHash:proposal.requestHash,budget:ref(current.budget)},{expectedVersion:0});
    return {record,alreadyCharged:false};
  });
}
