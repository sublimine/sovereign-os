import {canonical,check,clone,digest,identifier,keys,list,sha256,unique} from './contracts.mjs';
import {documentaryRun} from './documentary-mode.mjs';
import {prepareSourceManifestGrant,readSourceManifestGrants} from './source-manifest-grants.mjs';
import {prepareSourceWindowSelection,readSourceWindowSelection,readSourceWindowSelections} from './source-window-evidence.mjs';
import {findSourceLiteral} from './source-windows.mjs';
import {documentContextMaterialEvidence} from './document-context-frames.mjs';

const TYPE='document-session',MAX_OPERATIONS=24,MAX_GRANTS=64;
export const DOCUMENT_BATCH_LIMIT=8;
export const DOCUMENT_BATCH_INSTRUCTIONS='source.batch argsJson={operations:[{tool,args},...]} groups 2..8 independent source.locate/source.read operations on DISTINCT grants already present in YOUR current documentSourceGrants. Use it when all arguments are already known; never invent future offsets, batch dependent reads, nest batches or include external tools. Each member spends one local operation. All local selections commit or roll back together; results remain separate. This is not parallel execution, new acquisition, completed reading or factual acceptance. Inspect the selected text in the next input.';
const ref=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
function localOperations(tool,args){
  check(['source.locate','source.read','source.batch'].includes(tool),'DOCUMENT_PROTOCOL','Unknown local document operation');
  let operations;
  if(tool==='source.batch'){
    keys(args,['operations']);list(args.operations,'local document batch',{min:2,max:DOCUMENT_BATCH_LIMIT});
    operations=args.operations;operations.forEach(o=>keys(o,['tool','args']));
  }else operations=[{tool,args}];
  for(const o of operations){
    check(['source.locate','source.read'].includes(o.tool),'DOCUMENT_BATCH','Batch members must be independent local reads or literal searches');
    keys(o.args,o.tool==='source.locate'?['grantId','literal','startByte','maxMatches']:['grantId','ranges'],
      o.tool==='source.locate'?['grantId','literal']:['grantId','ranges']);
    identifier(o.args.grantId);
  }
  check(new Set(operations.map(o=>o.args.grantId)).size===operations.length,'DOCUMENT_BATCH','A proposal cannot contain dependent operations or duplicate grants');
  return operations;
}
function atomicNavigation(registry,fn){
  // Store.transact joins an existing caller transaction. A local savepoint is
  // necessary when that caller catches a failed last member and still commits
  // its own work; no first-member selection may escape this operation.
  return registry.store.transact(()=>{
    const db=registry.store.db;db.exec('SAVEPOINT document_navigation');
    try{const result=fn();db.exec('RELEASE document_navigation');return result;}
    catch(error){db.exec('ROLLBACK TO document_navigation');db.exec('RELEASE document_navigation');throw error;}
  });
}
function active(registry,runId){const run=registry.store.get('run',runId)?.data;check(run&&documentaryRun(registry.store,run),'DOCUMENT_PROTOCOL','An explicitly compiled documentary actor is required');return run;}
function verifyProposal(registry,run,operation){
  const p=operation.proposalRecord,type=run.mode==='producer'?'worker-proposal':'worker-document-review-proposal';
  check(p?.type===type&&p.version===1,'DOCUMENT_PROPOSAL','Retained actor proposal required');
  const record=registry.store.get(type,p.id),d=record?.data;
  let args;try{args=JSON.parse(d.value.argsJson);}catch{}
  const receipt=(run.inferenceReceipts??[]).filter(r=>r.contextHash===operation.requestHash);
  check(record?.version===1&&record.hash===p.hash&&d.runId===run.id&&record.id===`${run.id}:proposal:${d.step}`
    &&d.requestHash===operation.requestHash&&receipt.length===1&&d.inferenceReceiptHash===sha256(receipt[0])
    &&d.value.action==='document'&&d.value.tool===operation.tool&&args!==undefined&&canonical(args)===canonical(operation.args),
  'DOCUMENT_PROPOSAL','Local operation differs from the retained completed model proposal');
  return record;
}
/** Discover only actually observed acquisitions or explicitly assigned claim
 * sources. No mission-wide source lookup grants authority. Never revive revoked
 * grants by creating another one under a newer actor version. */
export function prepareDocumentSession(registry,runId){
  return registry.store.transact(()=>{
    const run=active(registry,runId);check(!run.expectedRequestHash,'INFERENCE_PENDING','Documentary state cannot change during inference');
    const old=registry.store.get(TYPE,runId),state=old?.data??{schema:'sovereign.document-session.v1',runId,missionId:run.missionId,grantIds:[],selectionIds:[],operationIds:[]};
    const grants=readSourceManifestGrants(registry,{runId,grantIds:state.grantIds}),known=new Set(grants.map(g=>g.source.sourceId)),origins=new Map();
    for(const o of run.toolObservations??[]){const r=registry.verifiedToolReceipt(o.signedReceipt);if(r.tool==='source.fetch'&&r.status==='SUCCEEDED')origins.set('source:'+r.id,{kind:'observed-acquisition'});}
    for(const id of run.context.artifactIds){const a=registry.store.get('artifact',id).data;for(const c of a.payload.claims)for(const s of c.sources)if(!origins.has(s.sourceId))origins.set(s.sourceId,{kind:'assigned-artifact',artifactId:id});}
    check(known.size+[...origins.keys()].filter(id=>!known.has(id)).length<=MAX_GRANTS,'DOCUMENT_LIMIT','Document manifest inventory exceeds its explicit bound');
    const grantIds=[...state.grantIds];
    for(const [sourceId,origin]of origins)if(!known.has(sourceId))grantIds.push(prepareSourceManifestGrant(registry,{runId,sourceId,origin}).grant.id);
    const next={...state,grantIds};
    if(!old||canonical(next)!==canonical(state))registry.store.put(TYPE,runId,next,{expectedVersion:old?.version??0});
    return documentSessionView(registry,runId);
  });
}
export function documentSessionView(registry,runId){
  active(registry,runId);const record=registry.store.get(TYPE,runId),s=record?.data;
  check(s?.schema==='sovereign.document-session.v1'&&s.runId===runId,'DOCUMENT_SESSION','Document session missing');
  list(s.grantIds,'document grants',{max:MAX_GRANTS});unique(s.grantIds);list(s.operationIds,'document operations',{max:MAX_OPERATIONS});unique(s.operationIds);
  list(s.selectionIds,'document selections',{max:16});unique(s.selectionIds);
  readSourceManifestGrants(registry,{runId,grantIds:s.grantIds});
  const views=readSourceWindowSelections(registry,{runId,selectionIds:s.selectionIds});
  check(views.every(v=>s.grantIds.includes(v.grantRecord?.id)),'DOCUMENT_SESSION','Selected window lacks its explicit current grant');
  const run=active(registry,runId);
  let spent=0;
  const operations=s.operationIds.map(id=>{const r=registry.store.get('document-operation',id);check(r?.version===1&&r.data.runId===runId&&r.id==='document-operation:'+sha256([runId,r.data.requestHash]),'DOCUMENT_SESSION','Operation changed');
    const proposal=verifyProposal(registry,run,r.data);
    spent+=localOperations(r.data.tool,r.data.args).length;
    check(registry.committedSequence(proposal.type,proposal.id,1)<registry.committedSequence(r.type,r.id,1),'DOCUMENT_PROPOSAL','Operation preceded its retained proposal');
    return {record:ref(r),tool:r.data.tool,resultScope:'HISTORICAL_OPERATION_RESULT',result:clone(r.data.result)};});
  // Keep the original result and its time-relative warning intact. On a later
  // request "NEXT input" describes that historical operation, not another
  // prerequisite before using literal text supplied in the current frame.
  // This projection is stable during inference; do not derive it from a receipt
  // that is only attached after completion, or operation/exposure equality breaks.
  check(spent<=MAX_OPERATIONS,'DOCUMENT_LIMIT','Local operation history exceeds its per-member budget');
  const activeSelections=views.map(v=>({selectionId:v.selection.id,grantId:v.grantRecord.id,sourceId:v.source.id,sourceHash:v.source.hash,
    ranges:v.windows.map(({startByte,endByte,textSha256})=>({startByte,endByte,textSha256}))}));
  return {record:ref(record),grantIds:[...s.grantIds],selectionIds:[...s.selectionIds],navigation:{schema:'sovereign.document-navigation.v1',sessionRecord:ref(record),remainingOperations:MAX_OPERATIONS-spent,operations,activeSelections,
    scope:'Operation results describe their historical selection time; NEXT input in an old result is not a new reading prerequisite. During inference, activeSelections identify literal documentSourceViews.windows already included in this same input. Inspect and cite that text now using its current sourceKey; request another range only for missing context or an intentional change of selection. Selecting an identical range on an unchanged snapshot provides no new evidence. Presence is not semantic support, a completed inference receipt or acceptance; the control plane validates this response after completion.'}};
}
/** A model-proposed local read is committed atomically with its active
 * selection. Replay of the same completed request is idempotent; another
 * command with that request hash cannot spend or replace a second operation. */
export function applyDocumentOperation(registry,{runId,frameId,requestHash,tool,args}){
  canonical(args);identifier(runId);digest(requestHash);
  return atomicNavigation(registry,()=>{
    const run=active(registry,runId),operationId='document-operation:'+sha256([runId,requestHash]);
    check(!run.expectedRequestHash,'INFERENCE_PENDING','Local read cannot race a pending inference');
    check(['source.locate','source.read','source.batch'].includes(tool),'DOCUMENT_PROTOCOL','Unknown local document operation');
    const old=registry.store.get('document-operation',operationId);
    if(old){check(old.version===1&&canonical({frameId,tool,args})===canonical({frameId:old.data.frameId,tool:old.data.tool,args:old.data.args}),
      'IDEMPOTENCY_CONFLICT','Completed document proposal changed');verifyProposal(registry,run,old.data);return clone(old.data);}
    const members=localOperations(tool,args);
    check(run.inferenceReceipt?.contextHash===requestHash,'DOCUMENT_REQUEST','Operation must follow this actor latest completed proposal');
    const {exposure,input}=documentContextMaterialEvidence(registry,{runId,frameId,requestHash,quotes:[]});
    let task;try{task=JSON.parse(input.task);}catch{}
    const proposal=registry.store.get(run.mode==='producer'?'worker-proposal':'worker-document-review-proposal',`${runId}:proposal:${task?.step}`);
    check(proposal,'DOCUMENT_PROPOSAL','No retained model proposal for the completed input step');
    const proposalRecord=ref(proposal);
    verifyProposal(registry,run,{requestHash,tool,args,proposalRecord});
    check(exposure.chronology.completedSequence<registry.committedSequence(proposal.type,proposal.id,proposal.version),
      'DOCUMENT_PROPOSAL','Proposal preceded actual request completion');
    const view=documentSessionView(registry,runId),state=registry.store.get(TYPE,runId);
    check(canonical(input.documentNavigation)===canonical(view.navigation),'DOCUMENT_SESSION','Proposal used a different navigation state');
    check(view.navigation.remainingOperations>=members.length,'DOCUMENT_LIMIT','Local documentary operation budget exhausted');
    let selectionIds=view.selectionIds;const sources=new Set();
    const results=members.map(({tool:memberTool,args:memberArgs},index)=>{
      const grant=input.documentSourceGrants.find(g=>g.grant.id===memberArgs.grantId);
      check(grant&&view.grantIds.includes(grant.grant.id),'DOCUMENT_GRANT','Grant was not exposed to this actor in its completed request');
      const source=registry.store.get('source',grant.source.sourceId).data;let result;
      check(!sources.has(source.id),'DOCUMENT_BATCH','Batch members must address distinct sources, not alternate grants to the same source');sources.add(source.id);
      if(memberTool==='source.locate'){const {grantId,...query}=memberArgs;result=findSourceLiteral(source,query);}
      else {
        const selected=prepareSourceWindowSelection(registry,{runId,sourceId:source.id,grantId:memberArgs.grantId,ranges:memberArgs.ranges});
        // Replacement is explicit per source; history remains immutable. It does
        // not silently drop other sources or concatenate missing byte gaps.
        selectionIds=selectionIds.filter(id=>readSourceWindowSelection(registry,id,{runId}).source.id!==source.id).concat(selected.selection.id);
        result={selection:selected.selection,sourceId:source.id,sourceHash:source.hash,ranges:selected.windows.map(({startByte,endByte,textSha256})=>({startByte,endByte,textSha256})),
          scope:'Selection prepared for the NEXT input, not yet completed reading or factual support. Previous selection of this same source is replaced in the active view only.'};
      }
      return {index,tool:memberTool,result};
    });
    // Each valid selection contains at least one window. Bound the final set
    // before its batch reader; keep the exact aggregate count/byte check below.
    // Do not apply this to intermediate replacement collections in the loop.
    check(selectionIds.length<=16,'DOCUMENT_LIMIT','Aggregate current windows exceed their explicit cap');
    const windows=readSourceWindowSelections(registry,{runId,selectionIds}).flatMap(v=>v.windows);
    check(windows.length<=16&&windows.reduce((n,w)=>n+w.endByte-w.startByte,0)<=256*1024,'DOCUMENT_LIMIT','Aggregate current windows exceed their explicit cap');
    const result=tool==='source.batch'?{schema:'sovereign.document-batch-result.v1',operations:results,
      scope:'Atomic local navigation only. Each member spent one operation. Prepared selections are not completed reading; inspect their literal text in the next input. No external effect, inherited authority or acceptance.'}:results[0].result;
    const data={runId,frameId,requestHash,tool,args:clone(args),requestRecord:exposure.requestRecord,proposalRecord,result};
    registry.store.put('document-operation',operationId,data,{expectedVersion:0});
    registry.store.put(TYPE,runId,{...state.data,selectionIds,operationIds:[...state.data.operationIds,operationId]},{expectedVersion:state.version});
    return clone(data);
  });
}
