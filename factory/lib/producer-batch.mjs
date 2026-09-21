import {canonical,check,clone} from './contracts.mjs';

export const READ_TEST_BATCH_MODE='read-test-v1';
// Explicit opt-in; historical read-test-v1 invocations are never upgraded.
export const READ_TEST_CURSOR_MODE='read-test-cursor-v1';
export function producerBatchPolicy(mode){
  check([READ_TEST_BATCH_MODE,READ_TEST_CURSOR_MODE].includes(mode),'POLICY','Unknown explicit producer batch mode');return mode;
}
const selected=mode=>mode===undefined?false:(producerBatchPolicy(mode),true);
const READ_TEST_RULE='read-test-v1 additionally permits one execution.run LAST after only workspace.read/workspace.list operations, with argv/cwd exactly matching a frozen requiredEffects execution. No writes, source operations, second execution or result-dependent arguments belong in that execution-containing batch. Use it only when no content inspection or other decision must intervene before executing the already fixed command. All individual limits, permissions, receipts and independent review remain required; this is sequential execution, not an atomic transaction or a resumable checkpoint.';
export function planningBatchRules(mode){
  return selected(mode)?'Never batch a read with its same-path write, dependent writes or source.search. '+READ_TEST_RULE
    :'Never batch a read with its same-path write, dependent writes, execution.run or source.search.';
}
export function producerBatchRules(mode){
  return selected(mode)?'Never batch dependent same-path writes, invent future result placeholders, or declare batch operations successful before observing receipts. '+READ_TEST_RULE+(mode===READ_TEST_CURSOR_MODE?' The separate read-test-cursor-v1 controller additionally preserves eligible exact read/list/test batches across local interruption, including original attempt charges and failure state. It never makes the external execution atomic or permits replay of uncertain effects.':'')
    :'Never batch execution.run or dependent same-path writes, invent future result placeholders, or declare batch operations successful before observing receipts.';
}
export function producerBatchSchema(base,mode){
  if(!selected(mode))return base;
  const schema=clone(base),legacy='Only independent pre-known source.fetch/workspace.list/workspace.read/workspace.write operations; no execution.run or source.search, no same-path write dependencies, no result placeholders.';
  check(schema.description.includes(legacy),'CONFIG','Producer schema lacks its exact baseline batch contract');
  schema.description=schema.description.replace(legacy,'Independent pre-known source.fetch/workspace.list/workspace.read/workspace.write operations retain their existing batch rules; no source.search, same-path write dependencies or result placeholders. '+READ_TEST_RULE);
  return schema;
}

/** Called only after complete operation shape/authority validation and before
 * the first effect. This is not a permission grant or semantic dependency proof.
 * Required effects are the exact merged obligations already checked by produce.
 */
export function validateProducerBatch(operations,{mode,requiredEffects}){
  const enabled=selected(mode);
  check(!operations.some(o=>o.tool==='source.search'),'BATCH_DEPENDENCY','Discovery remains a separate bounded step');
  const executions=operations.filter(o=>o.tool==='execution.run');
  if(!executions.length)return true;
  check(enabled,'BATCH_DEPENDENCY','Execution remains separate without explicit read-test-v1 policy');
  check(executions.length===1&&operations.at(-1)===executions[0]
    &&operations.slice(0,-1).every(o=>['workspace.read','workspace.list'].includes(o.tool)),
  'BATCH_DEPENDENCY','A read-test batch contains only preceding reads/listings and one final execution');
  const execution=executions[0];
  const matches=requiredEffects.filter(e=>e.type==='execution'&&e.path===execution.args.cwd
    &&canonical(JSON.parse(e.command))===canonical(execution.args.argv));
  check(matches.length>0&&new Set(matches.map(e=>e.expectedExit)).size===1,'BATCH_DEPENDENCY','Batch command must exactly match an unambiguous frozen execution obligation');
  return true;
}
