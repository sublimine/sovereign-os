import {canonical,check,sha256} from './contracts.mjs';
import {CLOSED_ENTRY_V2,CLOSED_ENTRY_NODE,PURPOSE,CLOSED_ENTRY_CRITERIA,entryContractHash} from './closed-entry-spec.mjs';
import {WORKER_CONTROL} from './learning-service.mjs';
import {CARD_ENCODINGS} from '../catalog/index.mjs';
import {CONTEXT_ENCODINGS,CONTEXT_CODEC_INSTRUCTIONS} from './context-codec.mjs';
import {CONTEXT_JSON_CODEC_INSTRUCTIONS} from './context-json-codec.mjs';
import {SOURCE_CONTEXT_VIEW_INSTRUCTIONS} from './source-context-view.mjs';

export const CLOSED_RESPONSE_CONTRACT='closed-response-production-v1';
/** Controller-owned contract, NOT a catalog role or a specialist authorized by
 * an accepted plan. Full immutable request and independent review stay required. */
export function makeClosedResponseBinding(mission){
  check(mission?.policy?.entryMode===CLOSED_ENTRY_V2&&mission.intentHash===sha256(mission.intent),
    'CLOSED_RESPONSE_BINDING','Closed production requires the explicit v2 mission and intact intent');
  return {schema:'sovereign.closed-response-production.v1',contract:CLOSED_RESPONSE_CONTRACT,
    origin:'trusted-controller-contract',missionId:mission.id,nodeId:CLOSED_ENTRY_NODE,mode:'producer',purpose:PURPOSE,
    intentHash:mission.intentHash,policyHash:sha256(mission.policy),entryMode:CLOSED_ENTRY_V2,entryContractHash:entryContractHash(CLOSED_ENTRY_V2),
    criteriaHash:sha256(CLOSED_ENTRY_CRITERIA),tools:[],artifactIds:[],sourceIds:[],
    responsibility:{input:'The complete immutable user request and frozen eligibility, completeness and correctness criteria. Supplied assertions are not externally verified facts.',
      method:'Identify the exact supplied transformation, composition or checkable closed derivation. Preserve all constraints. Produce only when the entire request is eligible; otherwise request full planning without an attempted partial answer.',
      output:'An answer candidate or a planning handoff, never an accepted product or a synthetic plan.',
      falsifier:'A missing material premise, external empirical claim or required effect, omitted constraint, incorrect derivation or failed eligibility condition.',
      completion:'Candidate submitted to a separate independent reviewer, or unchanged request routed to planning. Never self-accept.',
      limits:'No tools, acquired sources, accepted input artifacts, learned overlays or catalog impersonation. No authority inherited from tools permitted to later planned work.'}};
}

export function isClosedResponseActor(store,run){
  return Boolean(run&&run.mode==='producer'&&run.nodeId===CLOSED_ENTRY_NODE
    &&store.get('mission',run.missionId)?.data.policy?.entryMode===CLOSED_ENTRY_V2);
}

export function isClosedResponseReviewer(store,run){
  return Boolean(run?.mode==='reviewer'&&run.context?.purpose===PURPOSE&&(run.context.artifactIds??[]).some(id=>{
    const candidate=store.get('artifact',id)?.data;
    return candidate?.missionId===run.missionId&&candidate.payload.kind==='closed-response'
      &&store.get('worker-config',candidate.payload.producerRunId)?.data.controllerContract?.contract===CLOSED_RESPONSE_CONTRACT;
  }));
}

export function closedResponseBinding({store,missionId,nodeId,mode,purpose,artifactIds=[],sourceIds=[]}){
  const mission=store.get('mission',missionId)?.data,record=store.get('closed-entry-contract',missionId);
  check(mission?.id===missionId&&nodeId===CLOSED_ENTRY_NODE&&mode==='producer'&&purpose===PURPOSE
    &&artifactIds.length===0&&sourceIds.length===0,'CLOSED_RESPONSE_BINDING','Closed actor scope differs from its controller contract');
  check(!store.get('plan',missionId)&&!store.list('node').some(r=>r.data.missionId===missionId)
    &&!store.list('effect').some(r=>r.data.missionId===missionId),'CLOSED_RESPONSE_BINDING','Closed production cannot follow planned or effectful work');
  const expected=makeClosedResponseBinding(mission);
  check(record?.version===1&&canonical(record.data)===canonical(expected),
    'CLOSED_RESPONSE_BINDING','Missing, changed or re-versioned closed controller contract');
  return expected;
}

export function assertClosedResponseExposure(store,run){
  const binding=closedResponseBinding({store,missionId:run.missionId,nodeId:run.nodeId,mode:run.mode,
    purpose:run.context.purpose,artifactIds:run.context.artifactIds,sourceIds:run.context.sourceIds});
  check(!(run.context.planViews?.length)&&!(run.toolObservations?.length),
    'CLOSED_RESPONSE_BINDING','Closed producer cannot receive plans or tool observations');
  return binding;
}

export function compileClosedResponsePrefix(binding,{mode,purpose,contextEncoding='plain-json',cardEncoding='pretty-json',maxBytes=256*1024}){
  check(binding?.contract===CLOSED_RESPONSE_CONTRACT&&binding.mode===mode&&mode==='producer'&&binding.purpose===purpose,
    'CLOSED_RESPONSE_BINDING','Closed controller compilation scope differs');
  check(CONTEXT_ENCODINGS.includes(contextEncoding)&&CARD_ENCODINGS.includes(cardEncoding),'CONFIG','Unknown closed controller representation');
  const lead='MODE: CLOSED RESPONSE PRODUCER. This is a complete controller-owned production contract, not a catalog role, an accepted plan or an autonomous specialist charter. Apply its responsibility and falsifier to the entire supplied request. No tool authority and no self-acceptance.\n';
  const tail='\n'+WORKER_CONTROL+(contextEncoding!=='plain-json'?'\n'+CONTEXT_CODEC_INSTRUCTIONS:'')
    +(['lossless-json-v2','source-text-v1'].includes(contextEncoding)?'\n'+CONTEXT_JSON_CODEC_INSTRUCTIONS:'')
    +(contextEncoding==='source-text-v1'?'\n'+SOURCE_CONTEXT_VIEW_INSTRUCTIONS:'');
  const pretty=JSON.stringify(binding,null,2);
  check(Buffer.byteLength(lead+pretty+tail)<=maxBytes,'CONTEXT_LIMIT','Complete closed controller prefix exceeds logical budget; nothing truncated');
  return lead+(cardEncoding==='compact-json-v1'?JSON.stringify(binding):pretty)+tail;
}
