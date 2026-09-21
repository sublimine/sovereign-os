import {canonical,sha256} from '../../factory/lib/contracts.mjs';

// Read-only presentation. Never reconstruct historical instructions from today's
// catalog, invent a plan for FALLBACK, or turn admitted source bytes into truth.
export function projectControllerEntries(store,report,{compactReview,stageProducts}){
  return [['boundedEntry','bounded-read-entry','Respuesta acotada'],
    ['sourcedEntry','sourced-response-entry','Respuesta con fuentes']].flatMap(([key,id,title])=>{
    const entry=report[key];if(!entry)return [];
    const controllers=(report.controllerExecutions??[]).filter(c=>c.binding.nodeId===id);
    const assignedInstructions=store.list('run').filter(r=>r.data.missionId===report.mission.id
      &&(r.data.nodeId===id||r.data.mode==='reviewer'&&r.data.nodeId==='review:'+id)).map(r=>{
      const c=store.get('worker-config',r.id);if(!c||sha256(c.data.instructions)!==c.data.prefixHash)throw Error('Retained instructions identity differs');
      return {runId:r.id,mode:r.data.mode,recordHash:c.hash,prefixHash:c.data.prefixHash,
        roleIds:c.data.roleIds,instructions:c.data.instructions};
    });
    for(const c of controllers){
      if(c.binding.missionId!==report.mission.id||!entry.runIds.includes(c.runId)
        ||c.binding.entryContractHash!==entry.contractHash)throw Error('Controller entry binding differs');
      const config=store.get('worker-config',c.runId);
      if(config?.hash!==c.configHash||config.data.prefixHash!==c.prefixHash)throw Error('Controller configuration identity differs');
    }
    const artifacts=store.list('artifact').filter(r=>r.data.missionId===report.mission.id&&r.data.payload.nodeId===id);
    if(entry.artifactId&&!artifacts.some(r=>r.id===entry.artifactId&&r.data.payloadHash===entry.artifactHash))throw Error('Entry candidate identity differs');
    const instructions=[...new Set(controllers.map(c=>c.binding.node.instructions))];
    return [{id,title,shortLabel:title,status:entry.status,roleIds:entry.roleIds,reviewerRoleIds:entry.reviewerRoleIds,
      dependencies:[],method:{id:entry.version,rationale:controllers[0]?.binding.responsibility?.method??'No hay contrato ejecutado registrado.',
        alternatives:['Derivar íntegra la petición al plan completo; no entregar el candidato rechazado.']},
      criteria:entry.criteria,requiredEffects:[],products:stageProducts(id),artifactId:entry.artifactId??null,history:[],
      instructions:instructions.join('\n\n'),controllerExecutions:controllers,assignedInstructions,
      disposition:entry.disposition??null,
      reviews:report.reviews.filter(r=>artifacts.some(a=>a.id===r.artifactId)).map(compactReview)}];
  });
}

export function projectSourceRecords(store,missionId){
  return store.list('source').filter(r=>r.data.missionId===missionId).map(r=>{
    if(typeof r.data.raw!=='string'||sha256(r.data.raw)!==r.data.hash)throw Error('Retained source bytes differ');
    return {recordId:r.id,recordVersion:r.version,recordHash:r.hash,...r.data};
  });
}

export function projectMaterialSequence(store,missionId){
  const result=[];let after=0;
  while(true){
    const events=store.events({after,limit:1000});if(!events.length)break;
    for(const event of events){
      if(event.kind!=='record.committed'||event.data.version!==1||!['source','artifact','review','run'].includes(event.data.type))continue;
      const record=store.get(event.data.type,event.data.id,1);
      if(!record||record.hash!==event.data.hash)throw Error('Chronology record identity differs');
      const d=record.data,recordMission=record.type==='review'?store.get('artifact',d.artifactId)?.data.missionId:d.missionId;
      if(recordMission!==missionId)continue;
      const kind=record.type==='source'?'source.acquired':record.type==='artifact'?'candidate.created':record.type==='review'?'review.committed':d.mode==='reviewer'?'reviewer.created':null;
      if(!kind)continue;
      result.push({seq:event.seq,at:event.createdAt,kind,id:record.id,recordHash:record.hash,
        nodeId:d.nodeId??d.payload?.nodeId??null,status:d.status??d.result?.decision??null});
    }
    const next=events.at(-1).seq;if(next<=after)throw Error('Chronology cursor did not advance');after=next;
  }
  return result;
}

export function projectClosedCaseClassification(summary,audit,journal,summaryHash){
  if(audit.summarySha256!==summaryHash||canonical(summary.journal)!==canonical(journal)
    ||canonical(audit.journal)!==canonical(journal))throw Error('Closed case audit binding differs');
  const calls=summary.calls.map(c=>({runId:c.runId,mode:c.mode??c.actorMode,
    simulation:c.receipt?.simulation===true?true:c.receipt?.simulation===false?false:null,
    status:c.receipt?.status??'UNKNOWN'}));
  return {scope:summary.scope,auditScope:audit.scope,auditedAt:audit.auditedAt,summaryHash,
    calls,realCompleted:calls.filter(c=>c.status==='completed'&&c.simulation===false).length,
    simulatedCompleted:calls.filter(c=>c.status==='completed'&&c.simulation===true).length,
    unknownClassification:calls.filter(c=>c.simulation===null).length};
}
