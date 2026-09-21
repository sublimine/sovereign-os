import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {validateProducerBatch} from '../../factory/lib/producer-batch.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {DEVELOPMENT_COMMAND} from './full-route-cases.mjs';
const boundary=(ok,message)=>{if(!ok)throw Object.assign(Error(message),{code:'EXPERIMENT_BOUNDARY'});};

// Read-only cross-binding of captured proposals to actual reported effects.
// This does NOT replace later SQLite/HMAC, role, semantic or native-start audit.
export function readTestBatchUsage({calls,effects,loadRequest,loadResponse}){
  const attempts=[];
  for(const call of calls){
    if(call.mode!=='producer'||call.nodeId==='planning'||!call.receipt)continue;
    const request=loadRequest(call.index),response=loadResponse(call.index);
    boundary(request.runId===call.runId&&request.requestHash===call.requestHash
      &&inferenceRequestHash(request.request)===call.requestHash
      &&canonical(response.receipt)===canonical(call.receipt),'Captured read-test call binding differs');
    if(response.value.action!=='batch')continue;
    let operations;try{operations=JSON.parse(response.value.argsJson);}catch{continue;}
    if(!Array.isArray(operations)||!operations.some(o=>o?.tool==='execution.run'))continue;
    const task=JSON.parse(readSourceContextView(request.request.input).task);
    boundary(task.node?.id===call.nodeId&&Number.isSafeInteger(task.step)&&task.step>=0,'Batch step differs from actual producer request');
    let contractError=null;
    try{validateProducerBatch(operations,{mode:'read-test-v1',requiredEffects:[{type:'execution',path:'.',command:JSON.stringify(DEVELOPMENT_COMMAND),expectedExit:0}]});}
    catch(error){contractError=error.code??'UNKNOWN';}
    const records=operations.map((operation,index)=>{
      const id=`${call.runId}:step:${task.step}:batch:${index}`,effect=effects.find(e=>e.id===id);
      if(effect)boundary(operation&&effect.principalId===call.runId&&effect.tool===operation.tool&&effect.argsHash===sha256(operation.args),'Actual batch effect differs from captured arguments');
      return {id,tool:operation?.tool??null,argsHash:operation?.args?sha256(operation.args):null,
        state:effect?.state??'NOT_ATTEMPTED',receiptHash:effect?.receiptHash??null};
    });
    const complete=!contractError&&operations.length>1&&records.every(e=>e.state==='SUCCEEDED'&&e.receiptHash);
    attempts.push({callIndex:call.index,runId:call.runId,requestHash:call.requestHash,proposalHash:sha256(response.value),contractError,complete,operations:records});
  }
  return {version:'recorded-read-test-usage-v1',observed:attempts.some(a=>a.complete),attempts,
    scope:'Recorded complete read/list-plus-fixed-command batches only. No proof of semantic independence, token savings, test quality, current state or full factory acceptance.'};
}
