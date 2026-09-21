// A deliberately narrow, Authority-sealed bridge between the one real local
// execution used by the simulated development qualification and its JSON
// projections.  The large streams remain in closed evidence files; this
// record binds them by exact digest before the validation-only re-entry.
import {canonical,check,clone,digest,identifier,integer,keys,sha256,string} from '../../factory/lib/contracts.mjs';
import {validateExecutionArgs,validateExecutionResult,validateExecutionSnapshot} from '../../factory/tools/execution.mjs';

export const ADAPTIVE_V3_EXTERNAL_EXECUTION_RECORD_TYPE='adaptive-v3-external-execution';
export const ADAPTIVE_V3_EXTERNAL_EXECUTION_KIND='adaptive-v3.qualification.external-execution';
export const ADAPTIVE_V3_EXTERNAL_EXECUTION_SCHEMA='sovereign.adaptive-v3.external-execution.v1';

const own=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const same=(left,right)=>canonical(left)===canonical(right);
const ref=record=>{
  check(record&&typeof record.type==='string'&&typeof record.id==='string'&&Number.isSafeInteger(record.version)
    &&typeof record.hash==='string','QUALIFICATION_EXECUTION_EVIDENCE','Missing immutable record reference');
  identifier(record.type,'record type');identifier(record.id,'record id');integer(record.version,'record version',{min:1});digest(record.hash,'record hash');
  return {type:record.type,id:record.id,version:record.version,hash:record.hash};
};

function ownerProjection(owner){
  keys(owner,['unit','scratch','inode','snapshotHash','startedAt','scope']);
  string(owner.unit,'execution owner unit',{max:512});string(owner.scratch,'execution owner scratch',{max:4096});
  integer(owner.inode,'execution owner inode',{min:1});digest(owner.snapshotHash,'execution owner snapshot hash');
  string(owner.startedAt,'execution owner start time',{max:40});string(owner.scope,'execution owner scope',{max:128});
  check(owner.scope==='snapshot-discard','QUALIFICATION_EXECUTION_EVIDENCE','External execution owner has an unexpected scope');
  return {hash:sha256(owner),unit:owner.unit,inode:owner.inode,snapshotHash:owner.snapshotHash,startedAt:owner.startedAt,scope:owner.scope};
}

function snapshotProjection(snapshot){
  validateExecutionSnapshot(snapshot);
  return {hash:snapshot.hash,manifestHash:sha256(snapshot.manifest),filesHash:sha256(snapshot.files)};
}

function executionProjection(execution,owner){
  validateExecutionResult(execution);validateExecutionArgs({argv:execution.argv,cwd:execution.cwd});
  const isolation=execution.isolation,start=isolation?.programStart;
  check(own(isolation)&&own(start),'QUALIFICATION_EXECUTION_EVIDENCE','External execution lacks a launch-isolation projection');
  keys(start,['kind','nonce','snapshotHash','pid']);
  check(start.kind==='sovereign.execution.started.v1'&&typeof start.nonce==='string'&&start.nonce.length>0
    &&Number.isSafeInteger(start.pid)&&start.pid>0,'QUALIFICATION_EXECUTION_EVIDENCE','External program start is malformed');
  string(isolation.unit,'execution isolation unit',{max:512});
  check(execution.snapshotHash===owner.snapshotHash&&start.snapshotHash===owner.snapshotHash&&isolation.unit===owner.unit
    &&execution.startedAt===owner.startedAt&&isolation.unit===`sovereign-exec-${start.nonce}.service`,
  'QUALIFICATION_EXECUTION_EVIDENCE','External execution, launch and durable owner are not one operation');
  return {resultHash:sha256(execution),stdoutHash:sha256(execution.stdout),stderrHash:sha256(execution.stderr),
    isolationHash:sha256(isolation),programStartHash:sha256(start),unit:isolation.unit,
    programStart:clone(start),exitCode:execution.exitCode,startedAt:execution.startedAt,completedAt:execution.completedAt};
}

function acceptedFinal(lineage,finalArtifact){
  check(Array.isArray(lineage)&&lineage.length>0,'QUALIFICATION_EXECUTION_EVIDENCE','Accepted lineage is missing');
  const row=lineage.find(item=>item?.artifactId===finalArtifact.id);
  check(row&&row.artifactHash===finalArtifact.data?.payloadHash&&typeof row.reviewerRunId==='string'&&typeof row.reviewId==='string',
    'QUALIFICATION_EXECUTION_EVIDENCE','Final artifact is not bound to an accepting lineage row');
  return {artifactId:row.artifactId,artifactHash:row.artifactHash,reviewerRunId:row.reviewerRunId,reviewId:row.reviewId};
}

/**
 * Build the compact signed receipt.  It intentionally stores only capped
 * execution metadata and content hashes, never a second copy of stdout,
 * stderr, scratch paths, or model/provider material.  Auditors rebuild this
 * exact projection from SQLite plus the closed JSON evidence.
 */
export function adaptiveV3ExternalExecutionEvidence({missionRecord,finalArtifactRecord,reviewerRunRecord,reviewRecord,lineage,snapshot,execution,owner,oracle}){
  check(missionRecord?.type==='mission'&&missionRecord.data?.finalArtifactId===finalArtifactRecord?.id,
    'QUALIFICATION_EXECUTION_EVIDENCE','External execution is not attached to the completed mission final artifact');
  const final=acceptedFinal(lineage,finalArtifactRecord);
  check(reviewerRunRecord?.type==='run'&&reviewerRunRecord.id===final.reviewerRunId&&reviewerRunRecord.data?.missionId===missionRecord.id,
    'QUALIFICATION_EXECUTION_EVIDENCE','External execution reviewer reference is invalid');
  check(reviewRecord?.type==='review'&&reviewRecord.id===final.reviewId&&reviewRecord.data?.artifactId===finalArtifactRecord.id
    &&reviewRecord.data?.reviewerRunId===reviewerRunRecord.id&&reviewRecord.data?.result?.decision==='ACCEPT',
  'QUALIFICATION_EXECUTION_EVIDENCE','External execution review reference is invalid');
  check(own(oracle)&&typeof oracle.passed==='boolean','QUALIFICATION_EXECUTION_EVIDENCE','External oracle projection is malformed');
  const ownerView=ownerProjection(owner),snapshotView=snapshotProjection(snapshot),executionView=executionProjection(execution,owner);
  check(execution.snapshotHash===snapshotView.hash&&same(execution.manifest,snapshot.manifest),
    'QUALIFICATION_EXECUTION_EVIDENCE','External execution is not bound to the delivered snapshot');
  return {schema:ADAPTIVE_V3_EXTERNAL_EXECUTION_SCHEMA,mission:ref(missionRecord),
    finalArtifact:{record:ref(finalArtifactRecord),payloadHash:finalArtifactRecord.data.payloadHash},
    reviewerRun:ref(reviewerRunRecord),review:ref(reviewRecord),
    lineage:{hash:sha256(lineage),final},snapshot:snapshotView,
    command:{argv:clone(execution.argv),argvHash:sha256(execution.argv),cwd:execution.cwd},
    execution:executionView,owner:ownerView,
    oracle:{hash:sha256(oracle),passed:oracle.passed}};
}
