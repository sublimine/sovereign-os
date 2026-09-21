import {check,integer,canonical} from './contracts.mjs';

/** Select only already-ready nodes; this never removes a dependency or starts
 * work. Concurrent nodes and their whole material ancestry must have neither
 * tool authority nor required effects. All effect-bearing work stays exclusive.
 * limit bounds simultaneous inference, not role count or quality requirements.
 */
export function selectPureReadyBatch({ready,plan,limit=1}) {
  integer(limit,'maxParallelPureNodes',{min:1,max:4});
  check(Array.isArray(ready),'SCHEDULER','Ready nodes required');
  if(!ready.length)return [];
  const byId=new Map(plan.nodes.map(n=>[n.id,n])),memo=new Map(),visiting=new Set();
  const pure=id=>{
    if(memo.has(id))return memo.get(id);
    const spec=byId.get(id);check(spec&&!visiting.has(id),'SCHEDULER','Invalid material ancestry');
    visiting.add(id);
    const eligible=spec.tools.length===0&&spec.requiredEffects.length===0&&spec.dependencies.every(d=>pure(d.nodeId));
    visiting.delete(id);memo.set(id,eligible);return eligible;
  };
  for(const node of ready)check(byId.has(node.nodeId)&&canonical(byId.get(node.nodeId))===canonical(node.spec),'SCHEDULER','Ready node differs from frozen plan');
  if(limit===1||!pure(ready[0].nodeId))return [ready[0]];
  return ready.filter(n=>pure(n.nodeId)).slice(0,limit);
}
