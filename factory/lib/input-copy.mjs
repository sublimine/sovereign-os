import {canonical,check,clone,sha256} from './contracts.mjs';
import {INPUT_COPY_KIND,isInputCopyNode,isInputCopyArtifact,selectInputCopy,validateInputCopyPlan} from './input-copy-contract.mjs';
import {producerPlanView} from './producer-plan-view.mjs';

const ref=r=>({type:r.type,id:r.id,version:r.version,hash:r.hash});
const same=(a,b)=>canonical(a)===canonical(b);
const context=(node,plan,mission)=>({purpose:node.purpose,artifactIds:[plan.id],sourceIds:[],
  instructionsHash:sha256({schema:'sovereign.literal-input-copy.v1',node}),producerConversationIncluded:false,
  ...(mission.policy.producerContext==='node-contract-v1'?{planViews:[producerPlanView(plan,{missionId:mission.id,nodeId:node.id,intent:mission.intent})]}:{})});
const sequence=(registry,r)=>{const n=registry.committedSequence(r.type,r.id,r.version);
  check(Number.isSafeInteger(n)&&n>0,'INPUT_COPY_INTEGRITY','Native origin requires committed chronological positions');return n;};

export function registerInputCopyRun(registry,missionId,node,{recoverRunId=null}={}){
  const {store,authority}=registry;
  return store.transact(()=>{
    const mission=store.get('mission',missionId,1),current=store.get('mission',missionId),plan=store.get('plan',missionId);
    check(mission&&current&&plan&&mission.data.intentHash===sha256(mission.data.intent)
      &&current.data.intentHash===mission.data.intentHash&&current.data.intent===mission.data.intent&&same(current.data.policy,mission.data.policy),
      'INPUT_COPY_INTEGRITY','Exact immutable mission request required');
    const accepted=store.get('artifact',plan.data.acceptedPlanArtifactId);
    registry.assertUsable(accepted?.id,{missionId,purpose:'plan'});
    const body=JSON.parse(accepted.data.payload.body);validateInputCopyPlan(body,mission.data.intent);
    check(same(body,plan.data.plan)&&same(body.nodes.find(n=>n.id===node.id),node)&&isInputCopyNode(node),
      'INPUT_COPY_PLAN','Native assignment must equal the independently accepted installed node');
    const selection=selectInputCopy(mission.data.intent,node.execution);
    if(recoverRunId){
      // A claimed native origin is itself durable work even when no candidate
      // was committed yet. Revalidate its exact source and prior accepted plan;
      // a stale or foreign origin must fail, never silently acquire a new one.
      assertInputCopyPayload(registry,{missionId,nodeId:node.id,producerRunId:recoverRunId,
        kind:INPUT_COPY_KIND,purpose:node.purpose,body:selection.body,criteria:node.criteria,
        inputRefs:[{artifactId:accepted.id,hash:accepted.data.payloadHash,purpose:'plan'}],
        claims:[],toolReceipts:[],requiredEffects:[],provisional:false});
      return store.get('run',recoverRunId).data;
    }
    const run=registry.registerRun({missionId,nodeId:node.id,mode:'producer',context:context(node,accepted.data,mission.data)});
    const data={schema:'sovereign.literal-input-copy.v1',missionId,nodeId:node.id,run:ref(store.get('run',run.id)),
      mission:ref(mission),planArtifact:ref(accepted),planHash:sha256(body),node:clone(node),selection};
    store.put('input-copy-origin',run.id,{signed:authority.seal('input.copy',data)},{expectedVersion:0});
    return run;
  });
}

/** Recompute the native origin, never infer validity from an adapter label. */
export function assertInputCopyPayload(registry,payload,{current=true}={}){
  const {store,authority}=registry,origin=store.get('input-copy-origin',payload.producerRunId);
  check(origin?.version===1,'INPUT_COPY_INTEGRITY','Exact native origin record required');
  const binding=authority.open(origin.data.signed,'input.copy');
  check(binding.schema==='sovereign.literal-input-copy.v1'&&binding.missionId===payload.missionId
    &&binding.nodeId===payload.nodeId&&binding.run?.id===payload.producerRunId,'INPUT_COPY_INTEGRITY','Native origin belongs to another product');
  const exact=r=>{const record=store.get(r.type,r.id,r.version);check(record&&record.hash===r.hash,'INPUT_COPY_INTEGRITY','Historical native dependency changed');return record;};
  const mission=exact(binding.mission),plan=exact(binding.planArtifact),run=exact(binding.run);
  check(mission.type==='mission'&&mission.version===1&&mission.id===payload.missionId
    &&mission.data.intentHash===sha256(mission.data.intent)&&plan.type==='artifact'&&plan.data.missionId===mission.id
    &&plan.data.status==='ACCEPTED'&&plan.data.payload.nodeId==='planning'&&plan.data.payload.purpose==='plan'
    &&plan.data.payload.kind==='mission-plan'&&plan.data.payloadHash===sha256(plan.data.payload),
    'INPUT_COPY_INTEGRITY','Native origin requires the actual request and prior accepted plan, not an asserted source');
  const planBody=JSON.parse(plan.data.payload.body);validateInputCopyPlan(planBody,mission.data.intent);
  check(sha256(planBody)===binding.planHash&&same(planBody.nodes.find(n=>n.id===payload.nodeId),binding.node)
    &&isInputCopyNode(binding.node),'INPUT_COPY_INTEGRITY','Frozen selection or node contract changed');
  const selection=selectInputCopy(mission.data.intent,binding.node.execution),r=run.data;
  check(same(binding.selection,selection)&&payload.kind===INPUT_COPY_KIND&&payload.purpose===binding.node.purpose
    &&payload.body===selection.body&&same(payload.criteria,binding.node.criteria)
    &&same(payload.inputRefs,[{artifactId:plan.id,hash:plan.data.payloadHash,purpose:'plan'}])
    &&payload.claims.length===0&&payload.toolReceipts.length===0&&payload.requiredEffects.length===0&&!payload.provisional,
    'INPUT_COPY_INTEGRITY','Native candidate altered its complete body, source, criteria or epistemic boundary');
  check(run.type==='run'&&run.version===1&&r.id===payload.producerRunId&&r.missionId===mission.id&&r.nodeId===payload.nodeId
    &&r.mode==='producer'&&same(r.context,context(binding.node,plan.data,mission.data))&&r.contextHash===sha256(r.context)
    &&r.providerThreadId===null&&!(r.contextHistory?.length)&&!(r.requests?.length)&&!r.inferenceReceipt
    &&!(r.inferenceReceipts?.length)&&!(r.toolObservations?.length)&&!(r.runtimeObservations?.length),
    'INPUT_COPY_INTEGRITY','Literal-copy producer must be a fresh native identity, not a reused inference or actor');
  const chronology={mission:sequence(registry,mission),plan:sequence(registry,plan),run:sequence(registry,run),origin:sequence(registry,origin)};
  check(chronology.mission<chronology.plan&&chronology.plan<chronology.run&&chronology.run<chronology.origin,
    'INPUT_COPY_INTEGRITY','Copy selection must follow independent plan acceptance');
  if(current){
    const now=store.get('mission',mission.id)?.data,installed=store.get('plan',mission.id)?.data;
    check(now?.intentHash===mission.data.intentHash&&now.intent===mission.data.intent&&same(now.policy,mission.data.policy)
      &&installed?.acceptedPlanArtifactId===plan.id&&sha256(installed.plan)===binding.planHash
      &&store.get('run',run.id)?.version===1&&store.get('run',run.id)?.hash===run.hash
      &&!store.list('effect').some(e=>e.data.principalId===run.id),
      'INPUT_COPY_INTEGRITY','Native source, installed plan, identity or operation history changed');
    registry.assertUsable(plan.id,{missionId:mission.id,purpose:'plan'});
  }
  return {binding,selection,chronology,records:{origin:ref(origin),mission:ref(mission),plan:ref(plan),run:ref(run)}};
}

export function materializeInputCopy(registry,runId){
  const {store,authority}=registry;
  return store.transact(()=>{
    const existing=store.list('artifact').filter(r=>r.data.payload.producerRunId===runId);
    check(existing.length<=1,'INPUT_COPY_INTEGRITY','Native producer has multiple candidates');
    if(existing.length){inputCopyEvidence(registry,existing[0].id);return existing[0].data;}
    const origin=store.get('input-copy-origin',runId);
    check(origin?.version===1,'INPUT_COPY_INTEGRITY','No registered native copy');
    const b=authority.open(origin.data.signed,'input.copy'),plan=store.get('artifact',b.planArtifact.id,b.planArtifact.version).data;
    const artifact=registry.create({missionId:b.missionId,nodeId:b.nodeId,producerRunId:runId,kind:INPUT_COPY_KIND,
      purpose:b.node.purpose,body:selectInputCopy(store.get('mission',b.missionId,1).data.intent,b.node.execution).body,
      criteria:b.node.criteria,inputRefs:[{artifactId:plan.id,hash:plan.payloadHash,purpose:'plan'}]});
    inputCopyEvidence(registry,artifact.id);
    store.append('input.copy.materialized',{missionId:b.missionId,nodeId:b.nodeId,runId,artifactId:artifact.id,
      artifactHash:artifact.payloadHash,bodySha256:sha256(artifact.payload.body),producerInference:false});
    return artifact;
  });
}

export function inputCopyEvidence(registry,artifactId,{current=true}={}){
  const {store}=registry,candidate=store.get('artifact',artifactId,1),artifact=candidate?.data;
  check(isInputCopyArtifact(artifact)&&artifact.payloadHash===sha256(artifact.payload),
    'INPUT_COPY_INTEGRITY','Exact native candidate creation record required');
  const proof=assertInputCopyPayload(registry,artifact.payload,{current}),created=sequence(registry,candidate);
  check(proof.chronology.origin<created,'INPUT_COPY_INTEGRITY','Native origin must precede candidate creation');
  if(current){const now=store.get('artifact',artifactId)?.data;
    check(now?.payloadHash===artifact.payloadHash&&['CANDIDATE','RETURNED','ACCEPTED'].includes(now.status),
      'INPUT_COPY_INTEGRITY','Native candidate changed or was invalidated');}
  return {artifactId,artifactHash:artifact.payloadHash,...proof,chronology:{...proof.chronology,candidate:created},
    records:{...proof.records,candidate:ref(candidate)},
    scope:'Exact native copy of a uniquely selected substring from this immutable mission request, selected in an independently accepted prior plan. No producer inference, normalization, calculation or external acquisition. Inspect requestQuote in its full user context and the complete selection: matching bytes do not prove correct selection or factual truth. Downstream factual claims require their own evidence; this product has no certified claims.'};
}
