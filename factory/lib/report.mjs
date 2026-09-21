import {check, canonical, clone, instant, sha256} from './contracts.mjs';
import {isInputCopyNode} from './input-copy-contract.mjs';
import {ArtifactRegistry} from './artifacts.mjs';
import {Authority} from './authority.mjs';
import {planningInspectionBudget} from './planning-inspection-budget.mjs';
import {assertPlanningMissionPolicyFrozen} from './planning-response.mjs';
import {assertMissionAdmissionFrozen} from './mission-policy-freeze.mjs';
import {readPublicMissionInputs} from './public-input-projection.mjs';
import {assertAdaptiveV3ClosedEvidence} from './adaptive-v3-deterministic-entry.mjs';
import {assertAdaptiveV3MissionRoute,isAdaptiveV3MissionMarker} from './adaptive-v3-route-contract.mjs';
import {deliveryQuarantineMission,inspectPublicMission,projectPublicMission,quarantinedMission} from './mission-public-projection.mjs';
import {projectPublicSourcedRouteProgress} from './sourced-route-progress-projection.mjs';
import {projectPublicArtifact} from './public-artifact-projection.mjs';
import {readVerifiedPublicTopology} from './public-topology.mjs';
import {readPublicSourceProvenance} from './public-source-provenance.mjs';
import {readPublicMethodRecovery} from './public-method-recovery.mjs';
import {projectMissionActorTelemetry} from './actor-telemetry-projection.mjs';
import {readPublicMissionTrace} from './public-mission-trace.mjs';
import {projectContextDescriptor} from './project-context.mjs';
import {sublimineMissionAssetManifest,sublimineMissionAssetPresence} from './mission-assets.mjs';

// Adaptive-v3 deliberately keeps the selector proof, admission grammar,
// materialization preflight and deterministic certificate out of the public
// reporting surface.  The report is not an alternate trust boundary: callers
// who need to validate those records must use the authenticated contracts.
const ADAPTIVE_V3_ROUTING_SCHEMA='sovereign.adaptive-v3-mission-routing.v1';
const ADAPTIVE_V3_ROUTE_RECORD_TYPE='adaptive-v3-route';
const ADAPTIVE_V3_ORIGIN_RECORD_TYPE='adaptive-v3-origin';
const ADAPTIVE_V3_CERTIFICATION_RECORD_TYPE='adaptive-v3-certification';
const ADAPTIVE_V3_DIRECT_ENTRY_MODE='closed-response-v3';
const ADAPTIVE_V3_PLANNED_ENTRY_MODE='planned';
const ADAPTIVE_V3_PUBLIC_REPORT_SCHEMA='sovereign.adaptive-v3-public-report.v1';
const DIGEST=/^[a-f0-9]{64}$/;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const missionRecord=(record,missionId)=>plain(record?.data)&&record.data.missionId===missionId;

const publicReference=record=>record?{type:record.type,id:record.id,version:record.version,hash:record.hash}:null;
const publicDigest=value=>typeof value==='string'&&DIGEST.test(value)?value:null;
const adaptiveV3Mission=(store,mission,origin=null)=>Boolean(
  isAdaptiveV3MissionMarker(mission)
  ||isAdaptiveV3MissionMarker(origin)
  ||store.get(ADAPTIVE_V3_ROUTE_RECORD_TYPE,mission?.id)?.version
  ||store.get(ADAPTIVE_V3_ROUTE_RECORD_TYPE,mission?.id,1)?.version
);
const publicAdaptiveV3Route=(store,mission,{verifiedDirectFinal=null,verifiedPlannedFinal=null}={})=>{
  const routing=mission.policy?.routing??{};
  const selectedEntryMode=[ADAPTIVE_V3_DIRECT_ENTRY_MODE,ADAPTIVE_V3_PLANNED_ENTRY_MODE].includes(mission.policy?.entryMode)
    ?mission.policy.entryMode:null;
  // A raw final pointer is never enough. The caller supplies a final only
  // after the corresponding delivery evidence has been revalidated; an
  // interrupted/nonterminal route deliberately projects no deliverable.
  const finalArtifact=selectedEntryMode===ADAPTIVE_V3_DIRECT_ENTRY_MODE
    ?verifiedDirectFinal?store.get('artifact',verifiedDirectFinal.id):null
    :selectedEntryMode===ADAPTIVE_V3_PLANNED_ENTRY_MODE&&verifiedPlannedFinal?store.get('artifact',verifiedPlannedFinal.id):null;
  return {
    schema:ADAPTIVE_V3_PUBLIC_REPORT_SCHEMA,
    revision:1,
    selectedEntryMode,
    route:{
      schema:routing.schema===ADAPTIVE_V3_ROUTING_SCHEMA?routing.schema:null,
      revision:routing.revision===1?1:null,
      selectorCatalogHash:publicDigest(routing.selectorCatalogHash),
      decisionHash:publicDigest(routing.decisionHash),
      staticPolicyHash:publicDigest(routing.staticPolicyHash),
      finalPolicyHash:publicDigest(routing.finalPolicyHash),
      record:publicReference(store.get(ADAPTIVE_V3_ROUTE_RECORD_TYPE,mission.id))
    },
    originRecord:publicReference(store.get(ADAPTIVE_V3_ORIGIN_RECORD_TYPE,mission.id)),
    deterministicCertificationRecord:selectedEntryMode===ADAPTIVE_V3_DIRECT_ENTRY_MODE&&finalArtifact
      ?publicReference(store.get(ADAPTIVE_V3_CERTIFICATION_RECORD_TYPE,finalArtifact.id)):null,
    finalArtifact:publicReference(finalArtifact)
  };
};
const publicInstant=value=>{try{instant(value,'event timestamp');return value;}catch{return null;}};
const withSourcedRouteProgress=(store,registry,mission)=>{
  // A report without a caller-supplied Registry can still retain a fixed
  // UNVERIFIED source-route card.  A genuine local registry is required for
  // every positive progress/delivery assertion.
  const progressRegistry=registry instanceof ArtifactRegistry&&registry.store===store?registry:new ArtifactRegistry(store,null);
  const progress=projectPublicSourcedRouteProgress({registry:progressRegistry,store,missionId:mission?.id});
  return progress?{...mission,sourcedRouteProgress:progress}:mission;
};
// A quarantine is intentionally not a general journal browser.  Treat the
// journal's identifiers, kinds and clock output as untrusted record content:
// keeping a fixed kind and a validated timestamp preserves only ordering, not
// a future side channel through a caller-chosen event name or clock value.
const publicTimelineBase=(event,kind='RECORDED_EVENT')=>({
  seq:Number.isSafeInteger(event?.seq)&&event.seq>0?event.seq:null,
  kind,
  at:publicInstant(event?.createdAt)
});
const publicAdaptiveV3TimelineEvent=event=>{
  // Do not copy arbitrary event data: it can contain a selector decision,
  // parsed grammar/proof, preflight descriptor or a certificate payload.  The
  // retained sequence/kind/timestamp still let an operator correlate the
  // public report with the append-only journal.
  const base=publicTimelineBase(event,event.kind==='record.committed'?'record.committed'
    :event.kind==='adaptive-v3.direct.accepted'?'adaptive-v3.direct.accepted':'RECORDED_EVENT');
  // The append-only event chain proves a write happened; it does not prove an
  // arbitrary payload is the current route/origin/certificate or a usable
  // delivery. Record references and artifact IDs are therefore derived by the
  // route/final verifiers elsewhere, never copied from event.data here.
  if(event.kind==='record.committed'&&[ADAPTIVE_V3_ROUTE_RECORD_TYPE,ADAPTIVE_V3_ORIGIN_RECORD_TYPE,ADAPTIVE_V3_CERTIFICATION_RECORD_TYPE].includes(event.data?.type))return base;
  if(event.kind==='adaptive-v3.direct.accepted')return base;
  // Unknown adaptive-v3 event kinds are omitted rather than becoming a future
  // accidental disclosure channel.  Generic mission events remain useful but
  // are reduced to chronology-only form above.
  return event.kind.includes('adaptive-v3')?null:base;
};
// Failed admission is stricter than ordinary adaptive-v3 report redaction:
// no record reference or accepted-artifact pointer remains a public fact.
const publicChronologyEvent=event=>typeof event?.kind==='string'&&event.kind.includes('adaptive-v3')
  ?null:publicTimelineBase(event);
// Static shells deliberately contain no actor, request, reservation, record,
// provider-close or budget reference.  In a quarantined report even an ID is
// untrusted data: it can carry arbitrary content and must not become a second
// disclosure channel merely because a diagnostics section exists.
const quarantinedPlanningCleanup=()=>({
  schema:'sovereign.planning-cleanup-report.v1',
  integrity:'UNVERIFIED',
  scope:'Quarantined admission: no planning lifecycle, actor, request, record, provider-close or replacement reference is projected.',
  actors:[]
});
const quarantinedPlanningInspection=()=>({
  integrity:'UNVERIFIED',budget:null,
  scope:'Quarantined admission: no inspection actor, request, response, failure, reservation, budget or replacement authority is projected.',
  actors:[]
});

/** Human-readable, read-only retrieval of recorded evidence, not re-execution. */
export function missionReport(store, missionId, {registry=null}={}) {
  const mission = store.get('mission', missionId)?.data;
  check(mission?.id===missionId,'MISSION_IDENTITY','Mission record key and payload identity differ');
  const missionOrigin=store.get('mission',missionId,1)?.data,
    recordedInspectionCalls=store.list('planning-inspection-call').some(r=>r.data?.missionId===missionId),
    planningAdmissionCandidate=mission.policy?.planningContracts!==undefined||missionOrigin?.policy?.planningContracts!==undefined
      ||mission.policy?.planningCleanupProtocol!==undefined||missionOrigin?.policy?.planningCleanupProtocol!==undefined
      ||recordedInspectionCalls;
  // Determine admission integrity before any policy-selected reporting route.
  // It freezes the full v1 envelope (not merely `policy`) across the whole
  // history, so a temporary field addition cannot become a report channel.
  let admissionVerified=false,hasHistoricalFinalArtifactClaim=false;
  try{({hasHistoricalFinalArtifactClaim}=assertMissionAdmissionFrozen(new ArtifactRegistry(store,null),missionId,{code:'MISSION_ADMISSION_INTEGRITY'}));
    projectContextDescriptor(store,missionId);sublimineMissionAssetManifest(store,missionId);
    admissionVerified=true;
  }catch{}
  // Planning retains its own protocol-shaped error label. The generic freeze
  // above is necessary but not sufficient when a legacy row claims inspection
  // data without a policy admission at all.
  let planningAdmissionVerified=false;
  if(planningAdmissionCandidate){
    try{assertPlanningMissionPolicyFrozen(new ArtifactRegistry(store,null),missionId,{code:'PLANNING_INSPECTION_INTEGRITY'});
      planningAdmissionVerified=true;
    }catch{}
  }
  // Historical admission establishes a stable envelope, not permission to
  // clone arbitrary nested policy/lifecycle JSON into a public report. Gate
  // all policy-driven readers before they inspect raw feature subcontracts.
  const publicMissionAssessment=inspectPublicMission(mission),
    policyProjectionUnverified=!publicMissionAssessment.policyValid,
    lifecycleProjectionUnverified=!publicMissionAssessment.lifecycleValid,
    publicProjectionUnverified=policyProjectionUnverified||lifecycleProjectionUnverified;
  const recordedAdaptiveRoute=store.get(ADAPTIVE_V3_ROUTE_RECORD_TYPE,missionId)
    ??store.get(ADAPTIVE_V3_ROUTE_RECORD_TYPE,missionId,1),
    admissionUnverified=!admissionVerified,
    planningAdmissionUnverified=planningAdmissionCandidate&&!planningAdmissionVerified,
    rawAdaptiveV3=adaptiveV3Mission(store,mission,missionOrigin),
    // This is a capability supplied by the caller.  It is cryptographically
    // checked where a signed v3 route/certificate names an authority; an old
    // ordinary lineage has no retrospective key-binding record, so do not
    // describe this structural boundary as legacy key authentication.
    trustedRegistry=registry instanceof ArtifactRegistry&&registry.store===store&&registry.authority instanceof Authority;
  // A planned/public report remains read-only, yet must verify the signed
  // routing record before it publishes a v3 route. Existing-only Authority
  // opens the already-persisted local key without creating a key or writing
  // state. A completed deterministic delivery remains stricter below: its
  // certificate and invalidation graph require the real ArtifactRegistry.
  let routeAuthority=trustedRegistry?registry.authority:null;
  // FactoryEngine can be configured with a non-default authority key id. Read
  // only the envelope's declared key selector; `Authority.open` still checks
  // it and the MAC, so this is not a trust decision made from mutable data.
  const recordedRouteKeyId=recordedAdaptiveRoute?.data?.signed?.signature?.keyId;
  if(!routeAuthority&&rawAdaptiveV3){try{routeAuthority=new Authority(store,{existingOnly:true,
    ...(typeof recordedRouteKeyId==='string'?{keyId:recordedRouteKeyId}:{})});}catch{}}
  let verifiedDirectFinal=null,verifiedPlannedFinal=null,verifiedDeliveryRegistry=null,plannedFinalUnverified=false,verifiedAdaptiveRoute=null,
    // A route marker inside an already-unverified admission cannot be
    // authenticated or published. Label it explicitly without parsing it.
    adaptiveRouteUnverified=rawAdaptiveV3&&(admissionUnverified||publicProjectionUnverified);
  // A policy marker alone is never enough to publish an adaptive route. The
  // signed v3 route must be revalidated even before completion; otherwise a
  // legacy mission can be made to look like a direct route by writing hashes
  // into a later policy head. Completion keeps its existing hard-fail surface,
  // while a nonterminal unverified marker is quarantined as a report state.
  if(rawAdaptiveV3&&!admissionUnverified&&!publicProjectionUnverified){
    if(!routeAuthority){
      if(mission.status==='COMPLETED')check(false,'ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY',
        'A completed adaptive-v3 report requires a caller-supplied trusted ArtifactRegistry');
      adaptiveRouteUnverified=true;
    }else{
      try{
        verifiedAdaptiveRoute=assertAdaptiveV3MissionRoute(store,routeAuthority,missionId);
        // A direct terminal report cannot use only the route key: it must
        // authenticate the deterministic certificate and invalidation state.
        if(mission.status==='COMPLETED'&&!trustedRegistry
          &&verifiedAdaptiveRoute.decision.selectedEntryMode===ADAPTIVE_V3_DIRECT_ENTRY_MODE){
          check(false,'ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY',
            'A completed direct adaptive-v3 report requires a caller-supplied trusted ArtifactRegistry');
        }
      }
      catch(error){
        if(mission.status==='COMPLETED')throw error;
        adaptiveRouteUnverified=true;
      }
    }
  }
  const reportQuarantined=admissionUnverified||planningAdmissionUnverified||publicProjectionUnverified||adaptiveRouteUnverified,
    adaptiveV3=!reportQuarantined&&verifiedAdaptiveRoute!==null,
    // Any quarantined report is chronology-only. Once a signed adaptive route
    // has ever been recorded, its event namespace also stays redacted even if
    // a later head removes the marker. Otherwise a generic event projection
    // could disclose private policy/selector payloads precisely when the
    // governing admission can no longer be authenticated.
    timelineRedaction=reportQuarantined||rawAdaptiveV3||Boolean(recordedAdaptiveRoute?.version);
  if(adaptiveV3&&mission.status==='COMPLETED'){
    check(typeof mission.finalArtifactId==='string'&&mission.finalArtifactId.length>0,
      'ADAPTIVE_V3_DIRECT_ENTRY_INTEGRITY','A completed adaptive-v3 report requires its accepted final artifact');
    if(verifiedAdaptiveRoute?.decision.selectedEntryMode===ADAPTIVE_V3_DIRECT_ENTRY_MODE){
      // This is intentionally stronger than a duck-typed assertUsable call:
      // the report is a public delivery projection and must independently
      // revalidate the signed origin, candidate, certificate and current
      // accepted state before it exposes even a reference to the final.
      verifiedDirectFinal=assertAdaptiveV3ClosedEvidence(registry,mission.finalArtifactId).artifact;
      verifiedDeliveryRegistry=registry;
    }else if(verifiedAdaptiveRoute?.decision.selectedEntryMode===ADAPTIVE_V3_PLANNED_ENTRY_MODE){
      // A route signature only authenticates selection. It does not accept a
      // product. Reopen the persisted authority in read-only mode when the
      // caller did not supply a registry, then validate the full accepted
      // artifact/review lineage before publishing any final body or pointer.
      // A planned delivery can later be invalidated; that is an ordinary
      // delivery quarantine, never a reason to surface adjacent review quotes
      // or node history through the report.
      const deliveryRegistry=trustedRegistry?registry:new ArtifactRegistry(store,routeAuthority);
      const stored=store.get('artifact',mission.finalArtifactId)?.data;
      try{verifiedPlannedFinal=deliveryRegistry.assertUsable(mission.finalArtifactId,
        {missionId,purpose:stored?.payload?.purpose});
        verifiedDeliveryRegistry=deliveryRegistry;}
      catch{plannedFinalUnverified=true;}
    }
  }
  // Ordinary legacy delivery has no signed route record that binds an
  // authority key to its acceptance lineage.  Do not guess a key from storage
  // (or accept a coincidental default key): an `ArtifactRegistry` capability
  // supplied by the caller is the explicit trust boundary for this historic
  // shape. A mutable final pointer plus an ACCEPTED label is never enough.
  let verifiedLegacyFinal=null,legacyFinalUnverified=false;
  // A retained final pointer is a delivery claim even if somebody has since
  // relabelled the mission as cancelled, paused or running.  Treat that
  // impossible/stale combination as unverified too: otherwise the ordinary
  // report path could disclose its body through entry, review or node fields
  // merely because the lifecycle label stopped saying COMPLETED.
  const legacyDeliveryClaim=!reportQuarantined&&!adaptiveV3&&(mission.status==='COMPLETED'||hasHistoricalFinalArtifactClaim);
  if(legacyDeliveryClaim){
    if(mission.status!=='COMPLETED'||!trustedRegistry
      ||typeof mission.finalArtifactId!=='string'||!mission.finalArtifactId.length){
      legacyFinalUnverified=true;
    }else{
      try{
        const stored=store.get('artifact',mission.finalArtifactId)?.data;
        verifiedLegacyFinal=registry.assertUsable(mission.finalArtifactId,
          {missionId,purpose:stored?.payload?.purpose});
        verifiedDeliveryRegistry=registry;
      }catch{legacyFinalUnverified=true;}
    }
  }
  // A route signature is not a waiver of the delivery boundary.  In
  // particular, a lifecycle-only transition from COMPLETED to a nonterminal
  // state can retain an old final pointer.  Never let its review evidence,
  // nodes, entry response or metrics reconstruct the withheld artifact.
  // Planned v3 also quarantines an invalidated terminal final; direct v3
  // keeps its typed certificate-integrity failure above.
  const adaptiveDeliveryUnverified=adaptiveV3&&(
    mission.status!=='COMPLETED'&&hasHistoricalFinalArtifactClaim
    ||mission.status==='COMPLETED'&&verifiedAdaptiveRoute?.decision.selectedEntryMode===ADAPTIVE_V3_PLANNED_ENTRY_MODE&&plannedFinalUnverified
  ),deliveryUnverified=legacyFinalUnverified||adaptiveDeliveryUnverified;
  const directAdaptiveV3=adaptiveV3&&(verifiedAdaptiveRoute?.decision.selectedEntryMode===ADAPTIVE_V3_DIRECT_ENTRY_MODE
    ||!verifiedAdaptiveRoute&&mission.policy?.entryMode===ADAPTIVE_V3_DIRECT_ENTRY_MODE);
  const adaptiveV3Public=adaptiveV3?publicAdaptiveV3Route(store,mission,{verifiedDirectFinal,
    verifiedPlannedFinal}):null;
  // The append-only journal is an internal recovery log, not a public event
  // membership proof. A row that merely says `missionId` or `runId` can be
  // attacker-created and must not manufacture operational chronology, counts
  // or usage. Public lifecycle chronology is already available through the
  // validated mission history; detailed telemetry requires a future signed
  // attestation chain rather than a generic journal scan.
  if(reportQuarantined){
    const publicMission=withSourcedRouteProgress(store,registry,quarantinedMission(mission,missionOrigin,{admission:admissionUnverified,planningAdmission:planningAdmissionUnverified,
      adaptiveRoute:adaptiveRouteUnverified,policy:policyProjectionUnverified,lifecycle:lifecycleProjectionUnverified}));
    return {
      snapshot:'Historical quarantine: a policy admission or signed route could not be revalidated. Only the version-one mandate, fixed chronology and static quarantine boundary descriptors are projected; lifecycle, delivery, plan, review, source, controller, metric and actor content are withheld.',
      mission:publicMission,plan:null,learning:null,nodes:[],
      ...(planningAdmissionUnverified?{planningCleanup:quarantinedPlanningCleanup(),planningInspection:quarantinedPlanningInspection()}:{}),
      sources:[],reviews:[],effects:[],
      metrics:{integrity:'UNVERIFIED',scope:'No operational counts, usage, actor identifiers, request identifiers or record references are projected from a quarantined mission report.'},
      timeline:[],
      final:null,
    };
  }
  // Unlike adaptive-v3, an ordinary completed mission has no signed route
  // record that tells a read-only reporter which authority capability is
  // entitled to validate its delivery.  A missing/failed caller registry is a
  // delivery quarantine, not a reason to publish adjacent review quotes,
  // entry responses, node history or timeline payloads that could reconstruct
  // the withheld result through another field.
  if(deliveryUnverified){
    return {
      snapshot:'Delivery quarantine: mission admission remains historical, but a retained delivery claim did not pass its required verification boundary. No output-derived projection is published.',
      mission:withSourcedRouteProgress(store,registry,deliveryQuarantineMission(mission)),plan:null,learning:null,nodes:[],sources:[],reviews:[],effects:[],
      // The signed route was already revalidated above. Keep that bounded
      // route descriptor available for an adaptive-v3 operator, but never
      // copy the failed final pointer or any raw delivery/certificate data.
      ...(adaptiveV3Public?{adaptiveV3:adaptiveV3Public}:{}),
      metrics:{integrity:'DELIVERY_UNVERIFIED',scope:'No delivery pointer, body, review evidence, entry response, node history, source, effect, actor or operational count is projected until the retained delivery claim passes its route-specific verification boundary.'},
      timeline:[],
      final:null,
    };
  }
  // A report may describe a current topology only through the accepted plan
  // and its matching current node heads. `store.list('node')` is never a
  // public source: it contains retired, leased and attacker-created rows.
  const topologyRegistry=trustedRegistry?registry:adaptiveV3&&routeAuthority?new ArtifactRegistry(store,routeAuthority):null,
    topology=topologyRegistry?readVerifiedPublicTopology({store,registry:topologyRegistry,mission})
      :{integrity:store.get('plan',missionId)?'UNVERIFIED':'ABSENT',plan:null,nodes:[]},
    plan=topology.integrity==='VERIFIED'?topology.plan:null,
    ordered=topology.integrity==='VERIFIED'?topology.nodes:[];
  // A reviewer-run ID is not an acceptance relation. Detailed review data is
  // withheld until it is projected from an exact usable artifact lineage;
  // this prevents an arbitrary review row from becoming evidence merely by
  // naming a mission run.
  const reviews=[];
  const currentInspection=mission.policy?.planningContracts!==undefined,
    originInspection=missionOrigin?.policy?.planningContracts!==undefined;
  let planningCleanup=null,planningInspection=null;
  if(currentInspection||originInspection){
    planningCleanup={
      schema:'sovereign.planning-cleanup-public-boundary.v1',integrity:'NOT_PROJECTED',actors:[],
      scope:'Planning provider-close rows are private lifecycle custody evidence. Actor, request, response, failure, cleanup, replacement and provider-close details are not projected without a dedicated end-to-end public attestation.'
    };
    // A list of `run` rows is not a planning-inspection lineage. In particular,
    // a later actor can be attacker-created, and its request/cleanup records
    // can contain provider-facing bytes. The budget reader has a dedicated
    // immutable reservation contract, so publish only that independently
    // verified aggregate. Per-actor lifecycle, response and failure views stay
    // private until a separate current-lineage projector exists.
    const inspectionReadable=planningAdmissionVerified&&currentInspection&&originInspection;
    if(!inspectionReadable){
      planningInspection={integrity:'UNVERIFIED',budget:null,
        scope:'Planning-inspection policy no longer matches its version-one admission. No reservation, actor, request, response, failure or replacement data is projected.',
        actors:[]};
    }else{
      try{
        const budget=planningInspectionBudget(new ArtifactRegistry(store,null),missionId);
        planningInspection={integrity:'VERIFIED',budget,
          scope:'Verified aggregate of immutable prospective planning reservations. A reservation is not provider dispatch, response, comprehension, semantic fit, acceptance or replacement authority. Actor, request, response, failure and cleanup data are deliberately not projected.',
          actors:[]};
      }catch{
        planningInspection={integrity:'UNVERIFIED',budget:null,
          scope:'Planning-inspection reservation evidence could not be revalidated. No actor, request, response, failure, cleanup or replacement data is projected.',
          actors:[]};
      }
    }
  }
  // A policy history or signed route that failed admission is not a safe source
  // for adjacent policy-driven projections either. Do not turn a raw mutable
  // head into an apparently authenticated ceiling, route or input transport.
  const inferenceBudget=reportQuarantined?null:(mission.policy?.inferenceBudget!==undefined?{
    integrity:'NOT_PROJECTED',
    scope:'The global inference-reservation ledger is retained for internal enforcement but is not yet a public attestation: generic reservation/run/request rows must first be bound to their exact worker configuration, production contract and request lineage. No capacity, actor, request, operation or usage detail is projected here.'
  }:null);
  const methodRecovery=reportQuarantined?null:readPublicMethodRecovery(store,missionId);
  const inputs=reportQuarantined?null:readPublicMissionInputs(store,missionId);
  const assets=reportQuarantined?null:sublimineMissionAssetPresence(store,missionId);
  // Native sessions are a private controller custody chain. A same-mission
  // session row is not enough to publish its actor, request, transcript,
  // continuation, cleanup or outcome references. The public report exposes
  // only that the immutable policy selected the bounded transport; a future
  // reader may add a dedicated end-to-end attestation rather than reuse rows.
  const nativeInput=!reportQuarantined&&mission.policy?.nativeReadTransport==='native-read-v1'?{
    schema:'sovereign.native-read-public-boundary.v1',integrity:'NOT_PROJECTED',transport:'native-read-v1',actors:[],
    scope:'The bounded native-read transport is selected by the admitted policy. Session, request, transcript, callback, continuation, cleanup, outcome, file path and file bytes remain private until a dedicated end-to-end public attestation exists.'
  }:null;
  const final=reportQuarantined?null:adaptiveV3
    ?mission.status==='COMPLETED'?(directAdaptiveV3?verifiedDirectFinal:verifiedPlannedFinal):null
    :verifiedLegacyFinal;
  // The signed deterministic certificate is intentionally exposed only as a
  // public record reference in adaptiveV3, never as a raw certificate field.
  const publicFinal=final?projectPublicArtifact(final):null;
  const sourceProvenance=final&&verifiedDeliveryRegistry
    ?readPublicSourceProvenance({registry:verifiedDeliveryRegistry,artifact:final})
    :{integrity:final?'UNVERIFIED':'ABSENT',sources:[],
      scope:final?'Delivered-source provenance could not be revalidated. No source metadata or body is projected.'
        :'No verified delivered artifact currently supplies public source provenance.'};
  const publicMission=withSourcedRouteProgress(store,registry,projectPublicMission(mission));
  // This narrow projection receives the explicit trusted Registry capability;
  // never construct it in either quarantine return above or from raw Store
  // rows alone. It has its own request/receipt/provenance verifier.
  const actorTelemetry=trustedRegistry?projectMissionActorTelemetry({store,authority:registry.authority,registry},missionId):null;
  // The signed trace is a distinct public contract. It is available only with
  // the caller's trusted Registry/Authority capability and only after the
  // admission/lifecycle quarantine gates above have passed. It never widens
  // the raw journal or replaces source/review verification.
  const publicTrace=trustedRegistry?readPublicMissionTrace({store,authority:registry.authority,missionId}):null;
  // A final pointer is an externally meaningful delivery claim. Keep it only
  // when this read has independently established the exact usable artifact.
  if(!publicFinal)publicMission.finalArtifactId=null;
  if(deliveryUnverified)publicMission.deliveryIntegrity='UNVERIFIED';
  return {
    snapshot: 'Recorded local evidence only; this report does not re-fetch sources, re-read files or certify current delivery.',
    mission: publicMission, plan: plan===null?null:clone(plan),learning:null,
    ...(topology.integrity==='UNVERIFIED'?{topologyIntegrity:'UNVERIFIED'}:{}),
    ...(adaptiveV3Public?{adaptiveV3:adaptiveV3Public}:{}),
    ...(inputs?{inputs}:{}),
    ...(assets?{assets}:{}),
    ...(inferenceBudget?{inferenceBudget}:{}),
    ...(nativeInput?{nativeInput}:{}),
    ...(methodRecovery?{methodRecovery}:{}),
    ...(planningCleanup?{planningCleanup}:{}),
    ...(planningInspection?{planningInspection}:{}),
    ...(actorTelemetry?{actorTelemetry}:{}),
    ...(publicTrace?{publicTrace}:{}),
    // Entry/controller records carry request and provider-close details. Their
    // independent public contracts are intentionally not inferred from record
    // presence; omit them until their route-specific verifier is consulted.
    nodes: ordered.map(n => ({id:n.id,title:n.spec.title,status:n.status,
      roles:clone(n.spec.roleIds),reviewers:clone(n.spec.reviewerRoleIds),dependencies:clone(n.spec.dependencies),method:clone(n.spec.method),
      ...(n.spec.execution?{execution:clone(n.spec.execution)}:{}),
      ...(n.spec.specialist?{specialist:clone(n.spec.specialist),specialistMode:n.spec.roleIds.length?'supplement':'standalone'}:{}),
      criteria:clone(n.spec.criteria),requiredEffects:clone(n.spec.requiredEffects),artifactId:n.artifactId})),
    sourceProvenance,
    sources:sourceProvenance.sources,
    reviews: reviews.map(r => clone(r.data)),
    // Effect, documentary and learning ledgers hold private arguments,
    // receipts, inputs, selections, evaluator traces and worker identities.
    // They intentionally have no generic public listing; accepted delivery
    // provenance above is the only source-facing public surface.
    effects:[],
    metrics:{
      integrity:'NOT_ATTESTED',
      scope:actorTelemetry
        ?'Generic run, effect and journal rows remain unprojected: matching IDs do not prove actor lineage, dispatch, completion, failure, retry, review, correction or billing. actorTelemetry is a separate reduced local-record projection with its own request/receipt/provenance checks; it is not provider attestation or billed-cost evidence.'
        :'Operational telemetry is intentionally not projected from generic run, effect or journal rows. A matching missionId/runId does not prove actor lineage, dispatch, completion, failure, usage, retry, review, correction or billing. Use the separately verified immutable reservation budgets above for bounded capacity; expose runtime telemetry only through a future signed, end-to-end attestation contract.',
      operationalTelemetry:'NOT_PROJECTED',
      correctionTelemetry:'NOT_PROJECTED',
      usageTelemetry:'NOT_PROJECTED'
    },
    // Mission history is the validated public lifecycle chronology. The raw
    // journal remains an internal audit/recovery log until event membership is
    // bound by an explicit public attestation contract.
    timeline:[],
    final: publicFinal,
  };
}

export const safeDisplay = value => String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,
  c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

export function formatMissionReport(report) {
  const lines = [`Sublimine Factory · ${report.mission.id}`, `Estado guardado: ${report.mission.status}`,
    'Informe histórico; no equivale a una nueva verificación del estado externo.', '', 'Petición original:', report.mission.intent, '', 'Productos y motivo de sus dependencias:'];
  // Stop before formatting any optional projection.  The JSON quarantine
  // boundary is intentionally mirrored here so a later diagnostics field
  // cannot accidentally turn the human renderer into a side channel.
  if(report.metrics?.integrity==='UNVERIFIED'){
    lines.push('', 'Cuarentena de integridad: la admisión histórica o la ruta firmada no pudo revalidarse.',
      '  Se conserva sólo el mandato v1, cronología fija sin payload y descriptores estáticos de la barrera; no se publican estado operativo, punteros de entrega, plan, revisiones, fuentes, controladores, métricas, uso, actores ni referencias de solicitud.');
    return safeDisplay(lines.join('\n')) + '\n';
  }
  if(report.metrics?.integrity==='DELIVERY_UNVERIFIED'){
    lines.push('', 'Cuarentena de entrega: la admisión histórica se conserva, pero la entrega retenida no superó su frontera de verificación requerida.',
      '  No se publican puntero, cuerpo, respuesta de entrada, revisiones, historial de nodos, fuentes, efectos, actores, métricas ni payload de cronología derivados del resultado.');
    return safeDisplay(lines.join('\n')) + '\n';
  }
  const direction=report.mission.policy?.missionDirection;
  if(direction){
    lines.push('', 'Dirección responsable de misión:', `  Responsable único: ${direction.responsibleRoleId}; riesgo: ${direction.riskLevel}.`,
      `  Cierre: ${direction.closureCriterion.text} (${direction.closureCriterion.evaluation}).`,
      `  Escalado: si ${direction.escalation.trigger}, hacia ${direction.escalation.target}; acción: ${direction.escalation.action}.`);
    for(const selection of direction.roleJustifications)lines.push(`  Rol ${selection.roleId}: ${selection.rationale}`);
  }
  for (const n of report.nodes) {
    lines.push(`${n.id} [${n.status}] ${n.title}`, `  Producción: ${isInputCopyNode(n)?'copia literal nativa (sin inferencia productora)':n.execution?.kind==='closed-blind-comparison-v1'?'comparador determinista (sin inferencia productora)':n.specialistMode==='standalone'?'especialista de misión (sin rol de catálogo)':n.roles.join(', ')} · Revisión: ${n.reviewers.join(', ')}`);
    if(n.execution)lines.push(`  Adaptador: ${n.execution.kind}; ${isInputCopyNode(n)?'selección exacta de la petición; plan y fuente visibles al juez; fidelidad no es verdad.':'dependencias privadas comprobadas por el controlador, no inputRefs del juez.'}`);
    if(n.specialist){
      lines.push(`  Ficha ${n.specialistMode}: ${n.specialist.question}`,`  Aporte esperado: ${n.specialist.expectedBenefit}`);
      for(const method of n.specialist.methods)lines.push(`  Método de especialista: ${method}`);
      lines.push(`  Falsificador: ${n.specialist.falsifier}`,`  Cierre de ficha: ${n.specialist.completion}`);
      for(const execution of n.specialistExecutions??[])lines.push(`  Vinculación ${execution.runId}: plan ${execution.binding.planArtifactId} / ${execution.binding.planArtifactHash}; nodo ${execution.binding.nodeHash}; prefijo ${execution.prefixHash}.`);
    }
    for (const d of n.dependencies) lines.push(`  Depende de ${d.nodeId}: ${d.reason}`);
    lines.push(`  Método: ${n.method.id} — ${n.method.rationale}`);
    for (const c of n.criteria) lines.push(`  Criterio ${c.id} (${c.evaluation ?? 'content'}): ${c.text}`);
  }
  if(report.inputs){
    lines.push('',`Adjuntos originales ${report.inputs.protocol}: ${report.inputs.files.length}; preparación registrada: ${report.inputs.preparation?.status??'PENDIENTE'}.`,
      '  Snapshots aportados por el usuario, no hechos verificados ni productos de agentes. La preparación crea copias privadas.');
    for(const file of report.inputs.files)lines.push(`  ${file.path} · ${file.bytes} bytes · ${file.sha256} · ${file.evidenceStatus}`);
  }
  if(report.assets){
    lines.push('',`Activos de proyecto sellados: ${report.assets.count}; inspección de bytes: no disponible sin un resolvedor de capacidad explícito.`,
      '  La fábrica conserva únicamente una identidad de metadatos inmutable. No publica ni entrega al proveedor nombres, tipos, hashes, proyecto, rutas, URLs ni bytes de los archivos.');
  }
  if(report.planningCleanup){
    lines.push('', 'Cierres de planificación: observación local de la barrera de proveedor; no acredita llamada física, entrega remota, exactly-once, liveness, corrección, aceptación ni permiso de repetición.');
    for(const actor of report.planningCleanup.actors){
      if(!actor.attempts.length){lines.push(`  ${actor.runId}: sin solicitud de planificación registrada.`);continue;}
      for(const attempt of actor.attempts){
        const o=attempt,disposition=o.cleanup.localDisposition?`; disposición local ${o.cleanup.localDisposition}`:'';
        lines.push(`  ${actor.runId} · solicitud ${o.requestHash??'NO_VERIFICABLE'}: origen ${o.origin.state}; cierre ${o.cleanup.state}${disposition}; estado público ${o.publicState}.`);
      }
    }
  }
  if(report.planningInspection){
    // Contract inspection and method revision retain distinct budgets.
    const b=report.planningInspection.budget;
    if(b)lines.push('',`Inspección de fichas ${b.mode}: ${b.reserved}/${b.maxCalls} reservas de planificación; ${b.remaining} disponibles.`,
      '  Reservas no equivalen a respuestas, lectura comprendida ni aceptación; las llamadas de revisión se contabilizan aparte.');
    else lines.push('', 'Inspección de fichas: evidencia o política UNVERIFIED; no se publica presupuesto, respuesta, fallo ni permiso de reemplazo.',
      '  La misión no puede rebajarse a histórica por alterar la política después de su admisión.');
    for(const a of report.planningInspection.actors){
      const current=a.attempts?.at(-1),lifecycle=current?.lifecycle;
      lines.push(`  ${a.runId}: ${a.response?`${a.response.action}; ${a.response.coverage?`cobertura íntegra ${a.response.coverage.complete?'sí':'no'}`:'consulta conservada'}`:a.failure?`inferencia abandonada (${a.failure.code}); finalización remota no confirmada`:lifecycle?`control ${lifecycle.publicState}; origen ${lifecycle.origin.state}, cierre ${lifecycle.cleanup.state}`:a.pendingRequestHash?'respuesta pendiente, sin repetición automática':'sin llamada reservada'}.`);
    }
  }
  if(report.methodRecovery){
    const m=report.methodRecovery;
    if(m.integrity==='VERIFIED'){
      lines.push('',`Revisión de método ${m.mode}: ${m.reservedRounds}/${m.maxRounds} rondas reservadas; ${m.remainingRounds} disponibles.`,
        '  Progreso verificado del protocolo; no es certificado de mejora. Diagnósticos, productos rechazados, métodos, instrucciones y referencias internas permanecen fuera del informe público.');
      for(const r of m.rounds)lines.push(`  Ronda ${r.round}: ${r.status}.`);
    }else lines.push('', 'Revisión de método: evidencia no verificable; no se publican diagnósticos, productos, métodos, instrucciones ni referencias internas.');
  }
  if(report.inferenceBudget){
    const b=report.inferenceBudget;
    if(b.integrity==='UNVERIFIED'||b.integrity==='NOT_PROJECTED')lines.push('', report.actorTelemetry
      ?'Presupuesto de misión: el ledger global no se proyecta como atestación ni capacidad pública. La telemetría reducida de actores, cuando está presente, se verifica por separado y no equivale a coste facturado, calidad ni prueba del proveedor.'
      :'Presupuesto de misión: el ledger interno no se proyecta como atestación pública hasta que cada reserva quede enlazada con su actor, configuración, contrato y solicitud exactos; no se publica capacidad, actor, solicitud, operación ni uso.');
    else lines.push('',`Presupuesto de misión ${b.mode}: ${b.reserved}/${b.maxCalls} reservas; ${b.remaining} disponibles.`,
        `  Actores (incluidos jueces/réplicas): ${b.byKind.worker}; descubrimiento: ${b.byKind.search}.`+
          (b.byKind['native-continuation']!==undefined?` Continuaciones nativas reservadas: ${b.byKind['native-continuation']}.`:''),
        '  Reserva no equivale a llamada ejecutada ni tokens facturados. Caídas y fallos no reinician el techo; las obligaciones pendientes no se rebajan.');
  }
  if(report.nativeInput){
    lines.push('','Lectura nativa acotada: el transporte está admitido, pero sus sesiones, rutas, callbacks, consumos y resultados no se proyectan sin una atestación pública de extremo a extremo.');
  }
  if(report.adaptiveV3){
    const v=report.adaptiveV3,route=v.route,ref=route.record;
    lines.push('',`Ruta adaptive-v3: modo seleccionado ${v.selectedEntryMode??'NO_DISPONIBLE'}; proyección pública ${v.schema} r${v.revision}.`,
      `  Ruta firmada: ${ref?`${ref.type}/${ref.id}@${ref.version} · SHA256 ${ref.hash}`:'NO_REGISTRADA'}; decisión SHA256 ${route.decisionHash??'NO_DISPONIBLE'}.`,
      '  La decisión, gramática/AST, prueba, motivos, política estática, preflight y certificado bruto permanecen fuera de este informe.');
    if(v.deterministicCertificationRecord){
      const certification=v.deterministicCertificationRecord;
      lines.push(`  Certificación determinista registrada: ${certification.type}/${certification.id}@${certification.version} · SHA256 ${certification.hash}. No es una revisión humana ni un juicio factual.`);
    }
  }
  if(report.entry)lines.push('',`Entrada ${report.entry.version}: ${report.entry.status}.`,
    `  Producción: ${report.entry.controllerContract?'contrato propio del controlador '+report.entry.controllerContract:report.entry.roleIds.join(', ')} · Revisión: ${report.entry.reviewerRoleIds.join(', ')}.`,
    '  Ruta cerrada sin plan generado; el juez debe comprobar elegibilidad, petición íntegra y corrección. Una derivación al plan conserva el intento anterior.');
  if(report.boundedEntry)lines.push('',`Entrada ${report.boundedEntry.version}: ${report.boundedEntry.status}.`,
    `  Contrato propio ${report.boundedEntry.controllerContract} · Revisión: ${report.boundedEntry.reviewerRoleIds.join(', ')}.`,
    '  Como máximo una entrada local completa; sin plan generado ni autoridad de escritura/ejecución/red. Relectura propia del juez posterior al candidato; fuera de alcance pasa íntegra al plan.');
  if(report.sourcedEntry)lines.push('',`Entrada ${report.sourcedEntry.version}: ${report.sourcedEntry.status}.`,
    `  Contrato propio ${report.sourcedEntry.controllerContract} · Revisión: ${report.sourcedEntry.reviewerRoleIds.join(', ')}.`,
    '  Adquisición pública antes del candidato; revisión independiente sobre fuentes íntegras y citas de respaldo. Sin plan generado, archivos ni ejecución. Fuera de alcance pasa íntegra al plan.');
  for(const execution of report.controllerExecutions??[])lines.push(`  Contrato ${execution.binding.origin}: ${execution.runId}; prefijo ${execution.prefixHash}.`,
    `  Responsabilidad: ${execution.binding.responsibility.input}`,`  Método: ${execution.binding.responsibility.method}`,
    `  Falsificador: ${execution.binding.responsibility.falsifier}`,`  Cierre: ${execution.binding.responsibility.completion}`,
    '  Productor por inferencia, no copia nativa, rol de catálogo ni especialista autorizado por plan.');
  if(report.metrics?.integrity==='NOT_ATTESTED')lines.push('', report.actorTelemetry
    ?'Telemetría operativa genérica no proyectada: filas de ejecución, efectos y diario no prueban por sí solas actor, dispatch, resultado, uso, reintento, corrección, revisión o facturación. La proyección reducida de actores usa un contrato distinto y sigue sin ser atestación del proveedor ni coste facturado.'
    :'Telemetría operativa no proyectada: filas genéricas de ejecución, efectos y diario no prueban por sí solas actor, dispatch, resultado, uso, reintento, corrección, revisión o facturación. El informe conserva los presupuestos inmutables verificables; una telemetría detallada exigirá una atestación dedicada de extremo a extremo.');
  else lines.push('', `Inferencias de trabajadores: ${report.metrics.dispatched} enviadas; ${report.metrics.completed} completadas; ${report.metrics.failed} fallidas; ${report.metrics.withoutFinalOutcome} sin resultado final registrado.`);
  if(report.sourceProvenance){
    lines.push(`Proveniencia de fuentes entregadas: ${report.sources.length}; integridad ${report.sourceProvenance.integrity}.`,
      '  Sólo se muestran anclajes opacos de fuentes admitidas reclamadas por el producto entregado; URL, texto, cita, recibo y metadatos de adquisición permanecen fuera del informe.');
    for(const source of report.sources)lines.push(`  Fuente ${source.sourceId} · SHA256 ${source.hash}`);
  }
  for (const p of report.mission.pending) lines.push(`Pendiente [${p.code}]${p.nodeId?` · nodo ${p.nodeId}`:''}${p.operationId?` · operación ${p.operationId}`:''}.`);
  if(report.mission.deliveryIntegrity==='UNVERIFIED')lines.push('',
    'Entrega no verificada: el puntero final guardado no superó la revalidación de aceptación; no se publica como resultado.');
  if (report.final) lines.push('', `Último artefacto ${report.final.status}:`, report.final.payload.body);
  return safeDisplay(lines.join('\n')) + '\n';
}
