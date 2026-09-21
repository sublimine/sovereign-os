import {check,clone,canonical,sha256,identifier,digest,integer,keys,instant} from './contracts.mjs';
import {validateExecutionArgs,validateExecutionResult} from '../tools/execution.mjs';

const STATES=['PREPARED','DISPATCHED','UNCERTAIN','SUCCEEDED','FAILED'];
const ref=row=>row?{type:row.type,id:row.id,version:row.version,hash:row.hash}:null;

function project(registry,row,job){
  const effect=row.data;
  check(effect.tool==='execution.run'&&STATES.includes(effect.state),'EXECUTION_HISTORY','Invalid historical execution state');
  identifier(effect.missionId);identifier(effect.principalId);digest(effect.argsHash);
  const receipt=effect.receipt?registry.authority.open(effect.receipt,'tool.receipt'):null;
  check(!['SUCCEEDED','FAILED'].includes(effect.state)||receipt,'EXECUTION_HISTORY','Completed history requires its actual signed receipt');
  if(receipt)check(['SUCCEEDED','FAILED'].includes(receipt.status)&&receipt.id===row.id&&receipt.status===effect.state
    &&['missionId','principalId','tool','argsHash'].every(k=>receipt[k]===effect[k]),
    'EXECUTION_HISTORY','Signed receipt differs from its exact historical operation');
  if(receipt)check(instant(receipt.completedAt)>=instant(receipt.startedAt),'EXECUTION_HISTORY','Receipt chronology differs');
  let recordedArgs=null,argumentOrigin='UNAVAILABLE',recordedResult=null;
  if(job){
    check(['PREPARED','STARTING','COMPLETED','FAILED','UNCERTAIN'].includes(job.data.state)
      &&['missionId','principalId','tool','argsHash'].every(k=>job.data[k]===effect[k])
      &&job.data.mode==='snapshot-discard'&&sha256(job.data.args)===effect.argsHash
      &&sha256(job.data.manifest)===job.data.snapshotHash,'EXECUTION_HISTORY','Historical job binding differs');
    validateExecutionArgs(job.data.args);recordedArgs=clone(job.data.args);argumentOrigin='RECORDED_JOB';
  }
  if(receipt?.status==='SUCCEEDED'){
    const result=receipt.result;validateExecutionResult(result);
    const args={argv:result.argv,cwd:result.cwd};
    check(sha256(args)===effect.argsHash&&(!job||canonical(args)===canonical(job.data.args)
      &&job.data.snapshotHash===result.snapshotHash&&canonical(job.data.manifest)===canonical(result.manifest)
      &&job.data.state==='COMPLETED'&&canonical(job.data.result)===canonical(result)),
      'EXECUTION_HISTORY','Successful command/result does not match its committed job and argument hash');
    recordedArgs=clone(args);argumentOrigin=job?'RECEIPT_AND_JOB':'COMPLETED_RECEIPT';
    recordedResult={schema:result.schema,simulation:result.simulation,mode:result.mode,...clone(args),
      exitCode:result.exitCode,snapshotHash:result.snapshotHash,manifest:clone(result.manifest),
      outputTruncated:result.outputTruncated,stdoutSha256:result.stdoutSha256,stderrSha256:result.stderrSha256,
      stdoutBytes:Buffer.byteLength(result.stdout),stderrBytes:Buffer.byteLength(result.stderr),
      ...(result.isolation.programStart?{programStart:clone(result.isolation.programStart)}:{})};
  }else if(receipt){
    recordedResult={errorCode:receipt.result?.error?.code??null,
      outcomeKnown:receipt.result?.outcomeKnown??null,automaticReplay:receipt.result?.automaticReplay??null};
  }
  return {id:row.id,version:row.version,recordHash:row.hash,tool:effect.tool,state:effect.state,
    principalId:effect.principalId,argsHash:effect.argsHash,jobRecord:ref(job),jobState:job?.data.state??null,
    recordedArgs,argumentOrigin,receiptHash:receipt?sha256(effect.receipt):null,
    receiptResultHash:receipt?sha256(receipt.result):null,
    startedAt:receipt?.startedAt??effect.startedAt??null,completedAt:receipt?.completedAt??null,recordedResult};
}

/** Historical data only. Enumerates every execution intent of the exact mission
 * at a journal cutoff; no replay, new receipt, lease, action identity or verdict.
 * The cutoff advances only with relevant effect/job records, avoiding an extra
 * observation for every unrelated journal append or model call.
 */
export function executionHistory(registry,missionId,{cutoff=null}={}){
  identifier(missionId);const {store}=registry;
  if(cutoff===null){
    const effects=store.list('effect').filter(r=>r.data.missionId===missionId&&r.data.tool==='execution.run');
    if(!effects.length)return null;
    const records=effects.flatMap(row=>[row,store.get('execution-job',row.id)].filter(Boolean));
    const sequences=records.map(row=>registry.committedSequence(row.type,row.id,row.version));
    check(sequences.every(n=>Number.isSafeInteger(n)&&n>0),'EXECUTION_HISTORY','Missing committed operation/job sequence');
    const seq=Math.max(...sequences),event=store.events({after:seq-1,limit:1})[0];
    check(event?.seq===seq,'EXECUTION_HISTORY','Missing execution cutoff event');cutoff={seq,hash:event.hash};
  }
  keys(cutoff,['seq','hash']);integer(cutoff.seq,'execution history cutoff',{min:1});digest(cutoff.hash);
  const heads=new Map();let after=0,reached=false;
  while(!reached){
    const events=store.events({after,limit:1000});check(events.length>0,'EXECUTION_HISTORY','Execution history cutoff is beyond the journal');
    for(const event of events){
      check(event.seq===after+1&&event.seq<=cutoff.seq,'EXECUTION_HISTORY','Execution history event sequence differs');
      after=event.seq;
      if(event.kind==='record.committed'&&['effect','execution-job'].includes(event.data.type)){
        const d=event.data,row=store.get(d.type,d.id,d.version);
        check(row?.hash===d.hash,'EXECUTION_HISTORY','Historical execution record is missing or changed');
        heads.set(canonical([d.type,d.id]),row);
      }
      if(event.seq===cutoff.seq){check(event.hash===cutoff.hash,'EXECUTION_HISTORY','Execution cutoff hash differs');reached=true;break;}
    }
  }
  const effects=[...heads.values()].filter(row=>row.type==='effect'&&row.data.missionId===missionId&&row.data.tool==='execution.run')
    .sort((a,b)=>a.id.localeCompare(b.id)).map(row=>project(registry,row,heads.get(canonical(['execution-job',row.id]))??null));
  check(effects.length>0,'EXECUTION_HISTORY','An execution history must contain actual recorded intents');
  return {version:'execution-history-v1',cutoff:clone(cutoff),effects,
    scope:'Complete mission-scoped execution.run broker intent history at the authenticated journal cutoff, including prior reviewers and failed, prepared or uncertain intents. Exact recorded argv/cwd come only from a bound signed completion or durable job; missing arguments remain UNAVAILABLE. Result projections preserve exit, snapshot, manifest and output hashes/byte counts, not output text. No worker conversation, tool authority, own-action identity, current-file attestation, independent test coverage, host-wide surveillance or acceptance verdict is transferred.'};
}
