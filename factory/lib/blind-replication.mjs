import {check,clone,digest,id,identifier,integer,keys,list,sha256,string,unique,canonical,safeCode} from './contracts.mjs';
import {compileRoleInstructions,getRole} from '../catalog/index.mjs';
import {CodexProvider} from '../providers/codex.mjs';
import {inferenceRequestHash,instructionProfile} from '../providers/instruction-profiles.mjs';
import {packContext,CONTEXT_ENCODINGS,CONTEXT_CODEC_INSTRUCTIONS} from './context-codec.mjs';
import {packJsonContext,CONTEXT_JSON_CODEC_INSTRUCTIONS} from './context-json-codec.mjs';
import {packSourceContextView,SOURCE_CONTEXT_VIEW_INSTRUCTIONS} from './source-context-view.mjs';
import {BLIND_MATERIAL_KIND,BLIND_MATERIAL_PURPOSE,BLIND_MATERIAL_CRITERIA,blindMaterialBody,blindMaterialEvidence,closedBlindReviewTarget,assertClosedReviewThreadFresh} from './blind-material.mjs';
import {BLIND_COMPARISON_PURPOSE,BLIND_COMPARISON_CRITERIA,blindComparisonBody,blindComparisonEvidence,validateComparisonRule} from './blind-comparison.mjs';
import {frozenBlindWorkflow,assertFrozenBlindWorkflow,runClosedBlindWorkflow} from './closed-blind-workflow.mjs';
import {createBlindPlanBinding,assertBlindPlanBinding} from './blind-plan.mjs';
import {historicalBlindApproval} from './blind-approval.mjs';
import {missionInferenceBudget} from './mission-inference-budget.mjs';
import {assertMissionBlindReplicaDispatchProvenance,sharedMissionBlindReplicaProvenanceControl} from './mission-blind-replica-provenance.mjs';

export const BLIND_PROTOCOL_CRITERIA=Object.freeze([
  ['blind-target','The private original ID/hash is the exact requested operational target; the public question and scope preserve the whole authorized replication obligation.'],
  ['blind-isolation','The complete public packet has no original conclusion, rationale, route, author prestige, comparison hints or missing material premises. No external input or tool is needed.'],
  ['blind-method','The preregistered method, varying dimensions, controls and stopping rule are executable and appropriate; shared roots and limits are explicit, not a claim of cognitive independence.'],
  ['blind-tolerance','The exact comparison criterion and tolerance are fixed before execution; failure, divergence and UNKNOWN remain reportable without post-hoc adjustment.'],
  ['blind-boundaries','One fresh closed execution must seal its complete public result before a distinct comparator sees the original; neither a seal nor agreement is independent material acceptance.'],
].map(([id,text])=>Object.freeze({id,text})));
const str={type:'string'},arr=items=>({type:'array',items});
const obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const RESULT_SCHEMA=obj({status:{type:'string',enum:['RESULT','UNKNOWN']},result:str,publicArgument:str,
  controls:arr(obj({id:str,verdict:{type:'string',enum:['PASS','FAIL','UNKNOWN']},observation:str})),deviations:arr(str),unknowns:arr(str)});
const RECORD_SCOPE='Closed provider request only. Not proof of semantic decontamination, cognitive independence, host isolation, successful replication or final acceptance.';
const ref=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});

function validatePublic(p){
  const required=['purpose','question','scope','method','tolerance','stopping','controls','varyingDimensions','sharedRoots','limitations'];
  keys(p,[...required,'comparison'],required);
  if(Object.hasOwn(p,'comparison'))validateComparisonRule(p.comparison);
  for(const k of ['purpose','question','scope','method','tolerance','stopping'])string(p[k],k,{max:65536});
  list(p.controls,'controls',{min:1,max:30});unique(p.controls.map(c=>c.id));
  for(const c of p.controls){keys(c,['id','procedure','expected']);identifier(c.id);string(c.procedure);string(c.expected);}
  for(const k of ['varyingDimensions','sharedRoots','limitations']){list(p[k],k,{min:1,max:30}).forEach(v=>string(v));unique(p[k]);}
}
function validateResult(value,protocol){
  keys(value,['status','result','publicArgument','controls','deviations','unknowns']);
  check(['RESULT','UNKNOWN'].includes(value.status),'SCHEMA','Unknown replica result status');
  string(value.result,'result',{min:value.status==='RESULT'?1:0,max:262144});string(value.publicArgument,'public argument',{max:262144});
  list(value.controls,'controls',{max:30});unique(value.controls.map(c=>c.id));
  check(canonical(value.controls.map(c=>c.id).sort())===canonical(protocol.controls.map(c=>c.id).sort()),'BLIND_CONTROLS','Every preregistered control must be reported exactly once');
  for(const c of value.controls){keys(c,['id','verdict','observation']);check(['PASS','FAIL','UNKNOWN'].includes(c.verdict),'SCHEMA','Control verdict invalid');string(c.observation);}
  for(const k of ['deviations','unknowns'])list(value[k],k,{min:k==='unknowns'&&value.status==='UNKNOWN'?1:0,max:100}).forEach(v=>string(v));
  check(value.status!=='UNKNOWN'||value.result==='','SCHEMA','UNKNOWN cannot carry a result masquerading as complete');return true;
}

/** Trusted controller API, never a model tool. Not yet an ordinary planner lane.
 * The accepted protocol contains a PRIVATE original binding and a separately
 * reviewed public packet. Only the latter is dispatched. No general context,
 * feedback, workspace, tools or learning overlay enters this closed adapter.
 */
export class BlindReplicationService{
  #blindInferenceProvenance=null;
  constructor({store,authority,registry,providerFactory=()=>new CodexProvider(),timeoutMs=900000,maxContextBytes=1024*1024,maxOutputBytes=262144}={}){
    check(store&&authority&&registry&&typeof providerFactory==='function','CONFIG','Trusted replication dependencies required');
    for(const [key,value] of Object.entries({timeoutMs,maxContextBytes,maxOutputBytes}))integer(value,key,{min:1});
    Object.assign(this,{store,authority,registry,providerFactory,timeoutMs,maxContextBytes,maxOutputBytes});
  }
  #ensureBlindInferenceProvenance(){
    if(this.#blindInferenceProvenance)return this.#blindInferenceProvenance;
    check(this.registry.store===this.store&&this.registry.authority===this.authority,
      'INFERENCE_PROVENANCE_CONTROL','Closed blind dispatch provenance requires one shared registry, Store and signing authority');
    const control=sharedMissionBlindReplicaProvenanceControl({store:this.store,authority:this.authority});
    this.registry.installBlindInferenceDispatchControl(control);
    this.#blindInferenceProvenance=control;return control;
  }
  protocol(missionId,protocolArtifactId,planBinding=null){
    const mission=this.store.get('mission',missionId)?.data;
    check(mission&&mission.intentHash===sha256(mission.intent),'MISSION_POLICY','Frozen mission required');
    const a=this.registry.assertUsable(protocolArtifactId,{missionId,purpose:'blind-protocol'});
    const semanticCriteria=criteria=>criteria.map(c=>({...c,evaluation:c.evaluation??'content'}));
    check(canonical(semanticCriteria(a.payload.criteria))===canonical(semanticCriteria(BLIND_PROTOCOL_CRITERIA)),
      'BLIND_PROTOCOL','Prior complete protocol gates cannot be replaced or relaxed');
    check((planBinding||a.payload.inputRefs.length===0)&&a.payload.claims.length===0&&a.payload.toolReceipts.length===0&&a.payload.requiredEffects.length===0,
      'BLIND_PROTOCOL','Closed protocol cannot import undisclosed external evidence or effects');
    let p;try{p=JSON.parse(a.payload.body);}catch{check(false,'BLIND_PROTOCOL','Protocol body must be structured JSON');}
    keys(p,['schema','missionIntentHash','original','roleId','public']);
    check(p.schema==='sovereign.closed-blind-protocol.v1'&&p.missionIntentHash===mission.intentHash,'BLIND_PROTOCOL','Protocol is not bound to this frozen mission');
    keys(p.original,['artifactId','hash']);identifier(p.original.artifactId);digest(p.original.hash);validatePublic(p.public);
    check(getRole(p.roleId).canonicalCapabilities.some(c=>c.id==='blind_replication'),'BLIND_PROTOCOL','A preserved blind-replication role is required');
    const original=this.store.get('artifact',p.original.artifactId)?.data;
    check(original&&original.missionId===missionId&&original.id!==a.id&&original.payloadHash===p.original.hash&&sha256(original.payload)===p.original.hash
      &&['CANDIDATE','ACCEPTED'].includes(original.status)&&!original.payload.provisional,'BLIND_TARGET','Original version is missing, altered, provisional, rejected or invalidated');
    if(planBinding){
      assertBlindPlanBinding(this.registry,planBinding);
      const parent=this.store.get('node',`${missionId}:${planBinding.protocol.dependencies[0].nodeId}`)?.data;
      const planArtifact=this.registry.assertUsable(planBinding.planArtifact.id,{missionId,purpose:'plan'});
      check(parent?.status==='ACCEPTED'&&parent.artifactId===original.id&&p.roleId===planBinding.material.roleIds[0]
        &&a.payload.nodeId===planBinding.protocol.id&&canonical(a.payload.criteria)===canonical(planBinding.protocol.criteria)
        &&canonical(a.payload.inputRefs)===canonical([{artifactId:original.id,hash:original.payloadHash,purpose:original.payload.purpose},
          {artifactId:planArtifact.id,hash:planArtifact.payloadHash,purpose:'plan'}]),
        'BLIND_PLAN_BINDING','Protocol must bind the accepted original and exact plan, with no extra private ancestry');
      this.registry.assertUsable(original.id,{missionId,purpose:original.payload.purpose});
    }
    // Acceptance is a historical decision. A later context update/inference
    // cannot retroactively establish what the approving reviewer observed.
    // Bind the LAST exact acceptance, not any earlier favorable review.
    const approval=historicalBlindApproval(this.registry,a,original);
    return {mission,artifact:a,protocol:p,original,approval};
  }
  registration(replicationId){
    identifier(replicationId);const state=this.store.get('blind-replication',replicationId);check(state,'NOT_FOUND','Replication not registered');
    const record=this.store.get('blind-registration',replicationId);check(record?.version===1&&record.hash===state.data.registrationHash,'BLIND_INTEGRITY','Frozen registration changed');
    const data=this.authority.open(record.data.signed,'blind.registration');
    check(data.replicationId===replicationId,'BLIND_INTEGRITY','Registration identity mismatch');
    return {state,record,data};
  }
  status(replicationId){
    const {state,data}=this.registration(replicationId);
    return {replicationId,state:state.data.state,runId:data.runId,scope:RECORD_SCOPE,...(state.data.failure?{failure:state.data.failure}:{}),
      ...(state.data.sealHash?{sealHash:state.data.sealHash}:{})};
  }
  materialize(replicationId){
    return this.store.transact(()=>{
      const {state,record:registration,data}=this.registration(replicationId);
      check(['SEALED','OPENED','INCONCLUSIVE'].includes(state.data.state),'BLIND_STATE','Only a completed sealed response can become a reviewable material attempt; a missing response cannot');
      const {protocol}=this.current(data),run=this.exposure(data,{completed:true});
      if(state.data.materialArtifactId){
        blindMaterialEvidence(this.registry,state.data.materialArtifactId);
        return this.store.get('artifact',state.data.materialArtifactId).data;
      }
      const sealRecord=this.store.get('blind-seal',replicationId);
      check(sealRecord?.version===1&&sealRecord.hash===state.data.sealHash,'BLIND_INTEGRITY','Sealed result changed');
      const seal=this.authority.open(sealRecord.data.signed,'blind.result');
      check(seal.replicationId===replicationId&&seal.registrationHash===registration.hash&&seal.requestHash===data.requestHash,
        'BLIND_INTEGRITY','Result seal binding changed');
      const artifact=this.registry.create({missionId:data.missionId,nodeId:data.planBinding?.material.id??replicationId,producerRunId:run.id,
        kind:BLIND_MATERIAL_KIND,purpose:BLIND_MATERIAL_PURPOSE,body:blindMaterialBody(replicationId,protocol.public,seal.result),criteria:data.planBinding?.material.criteria??BLIND_MATERIAL_CRITERIA});
      const binding={replicationId,artifactId:artifact.id,artifactHash:artifact.payloadHash,registration:ref(registration),seal:ref(sealRecord),run:ref(this.store.get('run',run.id))};
      this.store.put('blind-material',replicationId,{signed:this.authority.seal('blind.material',binding)},{expectedVersion:0});
      this.store.put('blind-replication',replicationId,{...state.data,materialArtifactId:artifact.id},{expectedVersion:state.version});
      blindMaterialEvidence(this.registry,artifact.id);
      this.store.append('blind.material.created',{replicationId,artifactId:artifact.id,artifactHash:artifact.payloadHash});
      return artifact;
    });
  }
  freeze({replicationId,missionId,protocolArtifactId,reviewers,materialNodeId}){
    identifier(replicationId);identifier(missionId);identifier(protocolArtifactId);
    return this.store.transact(()=>{
      if(this.store.get('blind-replication',replicationId)){
        const {data}=this.registration(replicationId);
        check(data.missionId===missionId&&data.protocolRef.id===protocolArtifactId,'BLIND_CONFLICT','Existing replication ID cannot be rebound');
        check(canonical(reviewers??null)===canonical(data.workflow?.reviewers??null),'BLIND_CONFLICT','Preregistered reviewer roles cannot be rebound');
        check((materialNodeId??null)===(data.planBinding?.material.id??null),'BLIND_CONFLICT','Planned assignment cannot be rebound');
        return this.status(replicationId);
      }
      const planBinding=materialNodeId?createBlindPlanBinding(this.registry,missionId,materialNodeId,protocolArtifactId):null;
      if(planBinding)check(canonical(reviewers)===canonical({material:planBinding.material.reviewerRoleIds,comparison:planBinding.comparison.reviewerRoleIds}),
        'BLIND_PLAN_BINDING','Reviewer assignment must equal the accepted plan before freeze');
      const {mission,artifact,protocol,original,approval}=this.protocol(missionId,protocolArtifactId,planBinding);
      const workflow=reviewers===undefined?null:frozenBlindWorkflow(reviewers,mission.policy.maxNodeAttempts??4,mission.policy);
      if(workflow)validateComparisonRule(protocol.public.comparison);
      const encoding=mission.policy.contextEncoding??'plain-json';check(CONTEXT_ENCODINGS.includes(encoding),'BLIND_PROTOCOL','Unknown frozen context encoding');
      const instructions=compileRoleInstructions([protocol.roleId],{mode:'producer',purpose:protocol.public.purpose,cardEncoding:mission.policy.cardEncoding??'pretty-json'})
        +(encoding!=='plain-json'?'\n'+CONTEXT_CODEC_INSTRUCTIONS:'')+(['lossless-json-v2','source-text-v1'].includes(encoding)?'\n'+CONTEXT_JSON_CODEC_INSTRUCTIONS:'')+(encoding==='source-text-v1'?'\n'+SOURCE_CONTEXT_VIEW_INSTRUCTIONS:'')
        +'\nCLOSED SEALED REPLICA: Execute only publicProtocol. No tools, external acquisition, original answer or producer history are available. Apply the preregistered method and report every control, including failures, deviations and unknowns. Give the requested public result and checkable argument, not private chain-of-thought. Never invent execution or acceptance. A result is sealed before any comparison. If required work cannot be performed within this exact packet, return UNKNOWN with the missing obligation.';
      const logical={schema:'sovereign.blind-input.v1',replicationId,publicProtocol:protocol.public};
      const packed=encoding==='source-text-v1'?packSourceContextView(logical):encoding==='lossless-json-v2'?packJsonContext(logical):encoding==='lossless-v1'?packContext(logical):null;
      const logicalBytes=Buffer.byteLength(JSON.stringify(logical)),input=packed?.input??JSON.stringify(logical);
      const profile=mission.policy.instructionProfile??'model-default';instructionProfile(profile);
      check(profile!=='public-search-v1','BLIND_PROTOCOL','Closed replication cannot enable native public search');
      const request={instructions,input,schema:clone(RESULT_SCHEMA),model:mission.policy.model??'gpt-6-astra',reasoningEffort:mission.policy.reasoningEffort??'ultra',instructionProfile:profile};
      check(logicalBytes<=this.maxContextBytes&&Buffer.byteLength(input)<=this.maxContextBytes&&Buffer.byteLength(instructions)<=this.maxContextBytes,'CONTEXT_LIMIT','Frozen replica request exceeds bound; nothing is truncated');
      // Exact identifiers/body are a useful structural tripwire, not a semantic
      // leak detector. Semantic adequacy remains a prior independent gate.
      const exposed=instructions+'\n'+JSON.stringify(logical)+'\n'+JSON.stringify(request.schema);
      for(const hidden of [original.id,original.payloadHash,artifact.id,artifact.payloadHash])check(!exposed.includes(hidden),'BLIND_CONTAMINATION','Private target binding leaked into public packet');
      if(original.payload.body.length>=24)check(!exposed.includes(JSON.stringify(original.payload.body).slice(1,-1)),'BLIND_CONTAMINATION','Original body copied into public packet');
      const run=this.registry.registerRun({missionId,nodeId:planBinding?.material.id??replicationId,mode:'replicator',forbiddenArtifactIds:[original.id,artifact.id],context:{purpose:protocol.public.purpose,artifactIds:[],sourceIds:[],instructionsHash:sha256(instructions),producerConversationIncluded:false}});
      const data={replicationId,missionId,missionRef:ref(this.store.get('mission',missionId)),runId:run.id,contextHash:run.contextHash,protocolRef:ref(this.store.get('artifact',artifact.id)),
        originalRef:{artifactId:original.id,hash:original.payloadHash},approval,missionIntentHash:mission.intentHash,policyHash:sha256(mission.policy),
        requestJson:JSON.stringify(request),requestHash:inferenceRequestHash(request),encoding,logicalBytes,wireBytes:Buffer.byteLength(input),scope:RECORD_SCOPE,
        ...(workflow?{workflow}:{}),...(planBinding?{planBinding}:{})};
      const record=this.store.put('blind-registration',replicationId,{signed:this.authority.seal('blind.registration',data)},{expectedVersion:0});
      this.store.put('blind-replication',replicationId,{state:'FROZEN',registrationHash:record.hash},{expectedVersion:0});
      this.store.append('blind.protocol.frozen',{replicationId,missionId,runId:run.id,registrationHash:record.hash,requestHash:data.requestHash});
      return this.status(replicationId);
    });
  }
  current(data){
    if(data.workflow)assertFrozenBlindWorkflow(data.workflow);
    const found=this.protocol(data.missionId,data.protocolRef.id,data.planBinding),record=this.store.get('artifact',data.protocolRef.id);
    check(record.version===data.protocolRef.version&&record.hash===data.protocolRef.hash&&found.original.id===data.originalRef.artifactId
      &&found.original.payloadHash===data.originalRef.hash&&sha256(found.mission.policy)===data.policyHash
      &&canonical(found.approval)===canonical(data.approval),'BLIND_INTEGRITY','Frozen protocol, approval, original or policy changed');
    const request=JSON.parse(data.requestJson);check(inferenceRequestHash(request)===data.requestHash,'BLIND_INTEGRITY','Frozen request differs');
    return {...found,request};
  }
  exposure(data,{completed=false}={}){
    const run=this.store.get('run',data.runId)?.data;
    check(run&&run.mode==='replicator'&&run.missionId===data.missionId&&run.nodeId===(data.planBinding?.material.id??data.replicationId)&&run.contextHash===data.contextHash
      &&sha256(run.context)===data.contextHash&&!(run.contextHistory?.length)&&!(run.toolObservations?.length)&&!(run.runtimeObservations?.length)
      &&run.requests?.length===1&&run.requests[0].requestHash===data.requestHash&&run.requests[0].contextHash===data.contextHash
      &&!this.store.list('effect').some(r=>r.data.principalId===run.id),'BLIND_CONTAMINATION','Frozen replica exposure or operation history changed');
    check(completed?run.expectedRequestHash===null&&run.inferenceReceipts?.length===1:run.expectedRequestHash===data.requestHash&&!run.inferenceReceipt,
      'BLIND_CONTAMINATION','Replica inference history differs from one frozen dispatch');
    if(completed)this.registry.requireCompletedExposure(run);return run;
  }
  async execute(replicationId,{signal}={}){
    check(!signal?.aborted,'CANCELLED','Replica cancelled before dispatch');
    const start=this.store.transact(()=>{
      const {state,record,data}=this.registration(replicationId);
      if(['SEALED','OPENED','INCONCLUSIVE'].includes(state.data.state))return null;
      check(state.data.state==='FROZEN','BLIND_STATE','Running, uncertain or failed replicas cannot be automatically replayed');
      const {request,protocol}=this.current(data);
      const budget=missionInferenceBudget(this.registry,data.missionId),control=this.#ensureBlindInferenceProvenance();
      // The opaque preflight exists only in this outer transaction.  It binds
      // the signed registration and FROZEN checkpoint before any pending run,
      // retained request or reservation is written; a later transaction cannot
      // use it to "heal" a shaped historical dispatch.
      const preflight=control.prepareBlindDispatch({replicationId,registrationRecord:record,frozenStateRecord:state});
      const requestHash=this.registry.recordBlindInferenceRequest(data.runId,request,{replicationId,blindInferenceDispatchPreflight:preflight});
      check(requestHash===data.requestHash,'BLIND_INTEGRITY','Retained blind request differs from its frozen registration');
      this.exposure(data);
      this.store.put('blind-replication',replicationId,{...state.data,state:'RUNNING',dispatchRequestHash:data.requestHash},{expectedVersion:state.version});
      if(budget){
        const proof=assertMissionBlindReplicaDispatchProvenance({store:this.store,authority:this.authority},{replicationId,requestHash:data.requestHash});
        check(proof.runId===data.runId&&proof.missionId===data.missionId,'INFERENCE_PROVENANCE_INTEGRITY',
          'Blind dispatch proof belongs to another frozen replica');
        // Re-read the complete ledger only after proof + RUNNING checkpoint
        // exist.  A partial integration must roll back before any provider I/O.
        missionInferenceBudget(this.registry,data.missionId);
      }
      this.store.append('blind.inference.dispatched',{replicationId,missionId:data.missionId,runId:data.runId,requestHash:data.requestHash,
        contextBytes:Buffer.byteLength(request.input),instructionBytes:Buffer.byteLength(request.instructions),schemaBytes:Buffer.byteLength(JSON.stringify(request.schema))});return {data,request,protocol};
    });
    if(!start)return this.status(replicationId);
    let provider=null;
    const checkedValidate=value=>{
      try{return validateResult(value,start.protocol.public);}catch(error){
        const known=value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>Object.hasOwn(RESULT_SCHEMA.properties,k));
        let encoded=null;if(known)try{encoded=canonical(value);}catch{}
        const captured=encoded!==null&&Buffer.byteLength(encoded)<=Math.min(65536,this.maxOutputBytes);
        this.store.put('blind-rejected-output',id('blind-rejected'),{replicationId,requestHash:start.data.requestHash,code:safeCode(error),
          payloadCaptured:captured,payload:captured?JSON.parse(encoded):null,scope:'Requested public fields only; not an accepted result or private reasoning.'},{expectedVersion:0});
        throw error;
      }
    };
    try{
      provider=this.providerFactory();
      const response=await provider.generate({...start.request,validate:checkedValidate,signal,
        timeoutMs:this.timeoutMs,maxOutputBytes:this.maxOutputBytes});
      check(!signal?.aborted,'CANCELLED','Replica cancelled');checkedValidate(response.value);
      check(Buffer.byteLength(canonical(response.value))<=this.maxOutputBytes,'OUTPUT_LIMIT','Replica result exceeds bound');
      this.exposure(start.data);this.current(start.data);
      const r=response.receipt;check(r&&r.contextHash===start.data.requestHash&&r.model===start.request.model&&r.reasoningEffort===start.request.reasoningEffort,
        'INFERENCE_CONTEXT','Replica receipt does not attest frozen request/model/effort');
      check(!this.store.list('run').some(run=>run.data.providerThreadId===r.threadId||(run.data.inferenceReceipts??[]).some(old=>old.threadId===r.threadId)),
        'BLIND_CONTAMINATION','Replica reused an already exposed provider thread');
      this.store.put('blind-returned',replicationId,{requestHash:start.data.requestHash,response:{value:clone(response.value),receipt:clone(response.receipt)}},{expectedVersion:0});
      const closing=provider;provider=null;await closing.close();
      check(!signal?.aborted,'CANCELLED','Replica cancelled while closing provider');
      this.store.transact(()=>{
        const {state,data}=this.registration(replicationId);check(state.data.state==='RUNNING','BLIND_STATE','Replica state changed during dispatch');
        check(!this.store.list('run').some(run=>run.data.providerThreadId===r.threadId||(run.data.inferenceReceipts??[]).some(old=>old.threadId===r.threadId)),
          'BLIND_CONTAMINATION','Replica thread acquired conflicting exposure before sealing');
        this.current(data);this.exposure(data);this.registry.attachInference(data.runId,response.receipt);this.exposure(data,{completed:true});
        const seal=this.authority.seal('blind.result',{replicationId,runId:data.runId,registrationHash:state.data.registrationHash,requestHash:data.requestHash,
          result:response.value,receipt:response.receipt,scope:RECORD_SCOPE});
        const record=this.store.put('blind-seal',replicationId,{signed:seal},{expectedVersion:0});
        this.store.put('blind-replication',replicationId,{...state.data,state:response.value.status==='RESULT'?'SEALED':'INCONCLUSIVE',sealHash:record.hash},{expectedVersion:state.version});
        this.store.append('blind.result.sealed',{replicationId,runId:data.runId,sealHash:record.hash,resultStatus:response.value.status});
      });
      return this.status(replicationId);
    }catch(error){
      this.store.transact(()=>{const {state}=this.registration(replicationId);if(state.data.state==='RUNNING'){
        const code=safeCode(error);this.store.put('blind-replication',replicationId,{...state.data,state:code==='BLIND_CONTAMINATION'?'INVALIDATED':'FAILED',failure:{code}},{expectedVersion:state.version});
        this.store.append('blind.inference.failed',{replicationId,missionId:start.data.missionId,runId:start.data.runId,code});
      }});throw error;
    }finally{if(provider)await provider.close();}
  }
  open(replicationId){
    return this.store.transact(()=>{
      const {state,data}=this.registration(replicationId);
      check(['SEALED','OPENED'].includes(state.data.state),'BLIND_STATE','Only a sealed result can authorize later comparison');
      const {protocol,original}=this.current(data);this.exposure(data,{completed:true});
      check(state.data.materialArtifactId,'BLIND_REVIEW','A sealed attempt must be materialized and independently reviewed before opening');
      const material=this.registry.assertUsable(state.data.materialArtifactId,{missionId:data.missionId,purpose:BLIND_MATERIAL_PURPOSE});
      blindMaterialEvidence(this.registry,material.id);
      const review=this.store.get('review',material.reviews.at(-1));
      check(review?.version===1,'BLIND_REVIEW','Immutable material review required');
      const sequence=this.registry.committedSequence('review',review.id,1);
      check(Number.isSafeInteger(sequence)&&sequence>0,'BLIND_REVIEW','Material approval lacks committed order');
      let reviewer=this.store.get('run',review.data.reviewerRunId);
      while(reviewer){
        const prior=this.registry.committedSequence('run',reviewer.id,reviewer.version);
        check(Number.isSafeInteger(prior)&&prior>0,'BLIND_REVIEW','Material reviewer history lacks committed order');
        if(prior<sequence)break;
        reviewer=reviewer.version>1?this.store.get('run',reviewer.id,reviewer.version-1):null;
      }
      check(reviewer?.data.mode==='reviewer'&&reviewer.data.missionId===data.missionId
        &&!reviewer.data.context.artifactIds.some(id=>[original.id,data.protocolRef.id].includes(id)),
        'BLIND_REVIEW','Material review must precede unblinding and exclude the original/private protocol');
      this.registry.requireCompletedExposure(reviewer.data);
      assertClosedReviewThreadFresh(this.registry,reviewer.data,{before:sequence});
      check(closedBlindReviewTarget(this.store,reviewer.data)?.id===material.id,'BLIND_REVIEW_CONTEXT','Opening requires the actual closed assessment of this attempt');
      const privateActors=[original.payload.producerRunId,data.approval.reviewer.id];
      const privateThreads=new Set(privateActors.flatMap(id=>{
        const run=this.store.get('run',id)?.data;return [run?.providerThreadId,...(run?.inferenceReceipts??[]).map(r=>r.threadId)];
      }));
      check(!privateActors.includes(reviewer.id)&&!privateThreads.has(reviewer.data.providerThreadId)
        &&!(reviewer.data.inferenceReceipts??[]).some(r=>privateThreads.has(r.threadId)),
        'BLIND_REVIEW','Attempt assessment cannot reuse an original-exposed actor or provider thread');
      const proof=review.data.result.checks.flatMap(c=>c.evidence).filter(e=>e.kind==='runtime').some(e=>{
        const observation=this.registry.runtimeReference(e,reviewer.data);
        return observation.kind==='artifact-blind-material'&&observation.detail.artifactId===material.id&&observation.detail.artifactHash===material.payloadHash;
      });
      check(proof,'BLIND_REVIEW','Material review must cite the observed authenticated binding, not only candidate statements');
      const record=this.store.get('blind-seal',replicationId);check(record?.version===1&&record.hash===state.data.sealHash,'BLIND_INTEGRITY','Sealed result changed');
      const seal=this.authority.open(record.data.signed,'blind.result');
      check(seal.replicationId===replicationId&&seal.registrationHash===state.data.registrationHash&&seal.requestHash===data.requestHash,'BLIND_INTEGRITY','Result seal binding changed');
      check(seal.result.status==='RESULT','BLIND_STATE','Acceptance of a faithful UNKNOWN record does not authorize opening the original');
      const openingBinding={replicationId,registrationHash:state.data.registrationHash,sealHash:record.hash,originalRef:data.originalRef,
        materialArtifact:{id:material.id,hash:material.payloadHash},review:ref(review),reviewer:ref(reviewer)};
      if(state.data.state==='SEALED'){
        this.store.put('blind-opening',replicationId,{signed:this.authority.seal('blind.opening',openingBinding)},{expectedVersion:0});
        this.store.put('blind-replication',replicationId,{...state.data,state:'OPENED'},{expectedVersion:state.version});
        this.store.append('blind.original.opened',{replicationId,sealHash:record.hash});
      }else{
        const opening=this.store.get('blind-opening',replicationId);check(opening?.version===1,'BLIND_INTEGRITY','Prior opening is missing or changed');
        const proof=this.authority.open(opening.data.signed,'blind.opening');
        check(canonical(proof)===canonical(openingBinding),
          'BLIND_INTEGRITY','Prior opening is bound to another result');
      }
      return {replicationId,state:'OPENED',protocol:clone(protocol),original:clone(original),replica:clone(seal.result),sealHash:record.hash,
        scope:RECORD_SCOPE,next:'Independent comparison and final claim acceptance remain required; the sealed replicator cannot resume.'};
    });
  }
  compare(replicationId){
    return this.store.transact(()=>{
      // A rule cannot be added as a method argument or inferred from prose
      // after the outcome. Legacy protocols remain valid but lack this lane.
      const {data}=this.registration(replicationId),{protocol}=this.current(data);
      validateComparisonRule(protocol.public.comparison);
      const opened=this.open(replicationId),nodeId=data.planBinding?.comparison.id??'comparison:'+replicationId;
      const recordId='comparison:'+replicationId,existing=this.store.get('blind-comparison',recordId);
      if(existing){
        const binding=this.authority.open(existing.data.signed,'blind.comparison');
        blindComparisonEvidence(this.registry,binding.artifactId);return this.store.get('artifact',binding.artifactId).data;
      }
      const opening=this.store.get('blind-opening',replicationId),binding=this.authority.open(opening.data.signed,'blind.opening');
      const material=blindMaterialEvidence(this.registry,binding.materialArtifact.id);
      const openingSequence=this.registry.committedSequence(opening.type,opening.id,opening.version);
      check(Number.isSafeInteger(openingSequence)&&openingSequence>0,'BLIND_COMPARISON','Opening lacks committed order');
      let original=this.store.get('artifact',opened.original.id);
      while(original){
        const sequence=this.registry.committedSequence(original.type,original.id,original.version);
        check(Number.isSafeInteger(sequence)&&sequence>0,'BLIND_COMPARISON','Original history lacks committed order');
        if(sequence<openingSequence)break;
        original=original.version>1?this.store.get('artifact',original.id,original.version-1):null;
      }
      check(original&&original.data.payloadHash===opened.original.payloadHash,'BLIND_COMPARISON','Exact original did not exist before opening');
      const body=blindComparisonBody(replicationId,opening,original.data,material);
      const run=this.registry.registerRun({missionId:data.missionId,nodeId,mode:'producer',context:{purpose:BLIND_COMPARISON_PURPOSE,
        artifactIds:[material.artifactId,original.id],sourceIds:[],instructionsHash:sha256({schema:'sovereign.blind-oracle.v1',rule:protocol.public.comparison}),producerConversationIncluded:false}});
      const candidate=this.registry.create({missionId:data.missionId,nodeId,producerRunId:run.id,kind:'deterministic-result',
        purpose:BLIND_COMPARISON_PURPOSE,body,criteria:data.planBinding?.comparison.criteria??BLIND_COMPARISON_CRITERIA});
      this.store.put('blind-comparison',recordId,{signed:this.authority.seal('blind.comparison',{replicationId,nodeId,artifactId:candidate.id,
        artifactHash:candidate.payloadHash,opening:ref(opening),original:ref(original),material:ref(this.store.get('artifact',material.artifactId)),run:ref(this.store.get('run',run.id))})},{expectedVersion:0});
      blindComparisonEvidence(this.registry,candidate.id);
      this.store.append('blind.comparison.created',{replicationId,artifactId:candidate.id,artifactHash:candidate.payloadHash});return candidate;
    });
  }
  runReviewed(replicationId,options){return runClosedBlindWorkflow(this,replicationId,options);}
}
