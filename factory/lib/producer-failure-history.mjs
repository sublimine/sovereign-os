// Failed proposals survive an actor replacement through already admitted,
// authenticated tool observations. A new actor or method label is not progress.
import {check,sha256} from './contracts.mjs';
import {posix} from 'node:path';

export const PRODUCER_FAILURE_RULES=' Failed exact requests remain in admitted history across producer replacements. Another actor or method label alone does not permit replay. A workspace read/list may be proposed again after a confirmed later write to its relevant path. For ENOENT, a later successful parent listing identifying the missing file/directory can instead justify a fresh observation after an external repair. Unrelated writes or empty listings are not progress. These are earlier observations, not proof that the new read will succeed or that a product is accepted. Classified infrastructure recovery remains subject to existing budgets and authority.';

// Infrastructure recovery is not a cognitive retry. Its existing queue,
// pending-effect and mission-budget gates still apply; this is not authority.
const INFRASTRUCTURE=new Set(['QUOTA','AUTH','CAPABILITY','CANCELLED','ABORTED','TIMEOUT',
  'TRANSIENT_PROVIDER','CONTEXT_LIMIT','CLEANUP_UNCONFIRMED','SEARCH_UNOBSERVED',
  'INFERENCE_BUDGET_EXHAUSTED','INFERENCE_BUDGET_INTEGRITY']);

export function assertProducerFailureProgress(registry,runId,operation){
  const run=registry.store.get('run',runId)?.data,argsHash=sha256(operation.args);
  check(run?.id===runId&&run.mode==='producer','RECOVERY_SCOPE','Failure history belongs to a producer');
  const observations=(run.toolObservations??[]).map(o=>{
    const receipt=registry.verifiedToolReceipt(o.signedReceipt);
    check(receipt.missionId===run.missionId&&o.id===receipt.id&&o.hash===sha256(o.signedReceipt),
      'TOOL_RECEIPT','Failure history must be authenticated admitted observations');
    return receipt;
  });
  const failures=observations.filter(r=>r.tool===operation.tool&&r.argsHash===argsHash&&r.status==='FAILED'
    &&!INFRASTRUCTURE.has(r.result.error?.code));
  if(!failures.length)return;
  const sequence=receipt=>{
    const record=registry.store.get('effect',receipt.id),seq=registry.committedSequence('effect',receipt.id,record.version);
    check(Number.isSafeInteger(seq)&&seq>0,'TOOL_RECEIPT','Failure/progress needs a committed receipt');return seq;
  };
  const ordered=failures.map(receipt=>({receipt,seq:sequence(receipt)})).sort((a,b)=>b.seq-a.seq),last=ordered[0].seq;
  const progress=observations.filter(r=>r.status==='SUCCEEDED'&&['workspace.write','workspace.list'].includes(r.tool)).find(r=>{
    if(sequence(r)<=last)return false;
    // A confirmed write justifies REOBSERVING that file (or a directory whose
    // contents it changed), never replaying a mutation, network call or command.
    // It does not assert that the current file is still unchanged or now valid.
    if(r.tool==='workspace.write')return operation.tool==='workspace.read'&&r.result.path===operation.args.path
      ||operation.tool==='workspace.list'&&(operation.args.path==='.'||operation.args.path===''
        ||r.result.path.startsWith(operation.args.path+'/'));
    // A parent listing supports existence only for the exact ENOENT failure;
    // it cannot resolve content, permissions, network, limits or other errors.
    if(ordered[0].receipt.result.error?.code!=='ENOENT'||!['workspace.read','workspace.list'].includes(operation.tool))return false;
    const parent=posix.dirname(operation.args.path),kind=operation.tool==='workspace.read'?'file':'directory';
    return (r.result.path||'.')===parent&&Array.isArray(r.result.entries)
      &&r.result.entries.some(e=>e.name===posix.basename(operation.args.path)&&e.type===kind);
  });
  check(progress,'WORKER_REPEATED_FAILURE',
    'The exact request already failed in admitted history. A repeated workspace observation needs relevant later evidence of repair/existence. Another actor, unrelated write, empty listing or method label is not progress.',
    {failedOperationId:ordered[0].receipt.id,tool:operation.tool,argsHash});
  return {failedOperationId:ordered[0].receipt.id,progressOperationId:progress.id,failedSequence:last,
    progressSequence:sequence(progress),tool:operation.tool,argsHash,
    scope:'Relevant earlier committed evidence permits proposing a new observation. Not authority, current-state attestation, actual re-execution or product acceptance.'};
}
