// Project assets are a deliberately narrower input channel than ordinary
// mission files.  The Factory receives a sealed metadata manifest only; raw
// bytes remain in the project vault until a future capability-bound resolver
// is designed and independently qualified.  In particular, this module must
// never turn a local object path, URL, or a binary blob into provider context.
import {canonical,check,clone,digest,identifier,integer,keys,list,sha256,string} from './contracts.mjs';
import {missionInputManifest} from './mission-inputs.mjs';
import {utf8} from '../tools/workspace-files.mjs';

export const SUBLIMINE_ASSET_MANIFEST_SCHEMA='sublimine-asset-manifest-v1';
export const SUBLIMINE_ASSET_MANIFEST_OPTION_SCHEMA='sublimine-factory-asset-manifest-option-v1';
export const SUBLIMINE_ASSET_MANIFEST_INPUT_PATH='assets/manifest.json';
export const SUBLIMINE_ASSET_BINDING_SCHEMA='sublimine-factory-asset-binding-v1';
export const SUBLIMINE_ASSET_BINDING_TYPE='mission-asset-manifest';
export const SUBLIMINE_ASSET_MAX_COUNT=16;
export const SUBLIMINE_ASSET_MAX_BYTES=64*1024*1024;

const ASSET_ID=/^asset:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROJECT_ID=/^project:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEDIA_TYPE=/^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,127}$/;
const integrity=(condition,message)=>check(condition,'ASSET_MANIFEST_INTEGRITY',message);
const admission=(condition,message)=>check(condition,'ASSET_MANIFEST_ADMISSION',message);

const remap=(error,code)=>{
  if(error?.code===code)throw error;
  throw Object.assign(error,{code});
};
const exact=(value,allowed,required=allowed,label='asset manifest')=>keys(value,allowed,required,label);

function asset(value,{code='ASSET_MANIFEST_ADMISSION'}={}){
  const assert=(condition,message)=>check(condition,code,message);
  try{
    exact(value,['assetId','sha256','mediaType','size','filename']);
    string(value.assetId,'asset ID',{max:80});
    digest(value.sha256,'asset SHA-256');
    string(value.mediaType,'asset media type',{max:160});
    integer(value.size,'asset size',{min:1,max:SUBLIMINE_ASSET_MAX_BYTES});
    string(value.filename,'asset filename',{min:1,max:128});
  }catch(error){remap(error,code);}
  assert(ASSET_ID.test(value.assetId),'Asset ID does not have the sealed project-asset form');
  assert(value.mediaType===value.mediaType.trim().toLowerCase()&&MEDIA_TYPE.test(value.mediaType),
    'Asset media type is not canonical');
  assert(!/[\\/]/.test(value.filename),'Asset filename must be a leaf name');
  return {assetId:value.assetId,sha256:value.sha256,mediaType:value.mediaType,size:value.size,filename:value.filename};
}

/** Parse the exact metadata language emitted by the project vault.  It is
 * intentionally not a generic attachment descriptor: host paths, URLs,
 * binary encodings, extraction directives and capabilities are all rejected.
 */
export function normalizeSublimineAssetManifest(value,{code='ASSET_MANIFEST_ADMISSION'}={}){
  const assert=(condition,message)=>check(condition,code,message);
  try{
    exact(value,['schema','projectId','assets']);
    string(value.schema,'asset manifest schema',{max:120});
    string(value.projectId,'asset manifest project ID',{max:80});
    list(value.assets,'asset manifest assets',{min:1,max:SUBLIMINE_ASSET_MAX_COUNT});
  }catch(error){remap(error,code);}
  assert(value.schema===SUBLIMINE_ASSET_MANIFEST_SCHEMA,'Unknown asset manifest schema');
  assert(PROJECT_ID.test(value.projectId),'Asset manifest project ID is invalid');
  const ids=new Set(),assets=value.assets.map(item=>{
    const normalized=asset(item,{code});
    assert(!ids.has(normalized.assetId),'Asset manifest contains a duplicate asset ID');
    ids.add(normalized.assetId);
    return normalized;
  });
  return clone({schema:SUBLIMINE_ASSET_MANIFEST_SCHEMA,projectId:value.projectId,assets});
}

/** CLI/adapters pass a parsed manifest plus the hash of the exact UTF-8 file
 * they read.  The Engine then proves that it is the same immutable admitted
 * input rather than trusting an arbitrary side-channel JSON object.
 */
export function normalizeSublimineAssetManifestOption(value,{code='ASSET_MANIFEST_ADMISSION'}={}){
  try{
    exact(value,['schema','inputSha256','manifest']);
    string(value.schema,'asset manifest option schema',{max:160});
    digest(value.inputSha256,'asset manifest input SHA-256');
  }catch(error){remap(error,code);}
  check(value.schema===SUBLIMINE_ASSET_MANIFEST_OPTION_SCHEMA,code,'Unknown asset manifest option schema');
  return {schema:SUBLIMINE_ASSET_MANIFEST_OPTION_SCHEMA,inputSha256:value.inputSha256,
    manifest:normalizeSublimineAssetManifest(value.manifest,{code})};
}

export function parseSublimineAssetManifestBytes(raw,{code='ASSET_MANIFEST_ADMISSION'}={}){
  let parsed;
  try{parsed=JSON.parse(utf8(raw));}
  catch(error){throw Object.assign(error,{code});}
  return normalizeSublimineAssetManifest(parsed,{code});
}

function sourceInput(inputs){
  admission(Array.isArray(inputs)&&inputs.length>0,'Asset manifest requires an explicit captured input manifest');
  const matches=inputs.filter(item=>item?.path===SUBLIMINE_ASSET_MANIFEST_INPUT_PATH);
  admission(matches.length===1,'Asset manifest must be captured exactly once at assets/manifest.json');
  const input=matches[0];
  admission(typeof input.base64==='string'&&typeof input.sha256==='string'&&Number.isSafeInteger(input.bytes),
    'Asset manifest input is not normalized');
  const raw=Buffer.from(input.base64,'base64');
  admission(raw.toString('base64')===input.base64&&raw.length===input.bytes&&sha256(raw)===input.sha256,
    'Asset manifest input bytes do not match their admitted identity');
  return {input:{path:input.path,sha256:input.sha256,bytes:input.bytes},raw};
}

/** Construct a binding before the mission write.  No object bytes are passed
 * into this function: the only admissible source is the exact regular UTF-8
 * manifest already captured through the normal immutable input flow.
 */
export function makeSublimineAssetManifestBinding({missionId,intentHash,inputManifestHash,inputs,assetManifest}={}){
  if(assetManifest===undefined)return null;
  identifier(missionId,'asset manifest mission ID');
  digest(intentHash,'asset manifest intent hash');
  admission(typeof inputManifestHash==='string','Asset manifest requires an immutable captured input manifest');
  try{digest(inputManifestHash,'asset manifest input manifest hash');}catch(error){remap(error,'ASSET_MANIFEST_ADMISSION');}
  const requested=normalizeSublimineAssetManifestOption(assetManifest);
  const {input,raw}=sourceInput(inputs);
  admission(input.sha256===requested.inputSha256,'Asset manifest option does not name the captured input bytes');
  const parsed=parseSublimineAssetManifestBytes(raw);
  admission(canonical(parsed)===canonical(requested.manifest),'Asset manifest option differs from the captured immutable input');
  return clone({schema:SUBLIMINE_ASSET_BINDING_SCHEMA,missionId,intentHash,inputManifestHash,input,
    manifest:parsed,
    scope:'Immutable Sublimine project-asset metadata only. Asset bytes, project-vault paths, URLs, extraction directives, provider context and read capability are absent. A future resolver must be separately capability-bound; this binding does not authorize one.'});
}

function bindingShape(value,{code='ASSET_MANIFEST_INTEGRITY'}={}){
  const assert=(condition,message)=>check(condition,code,message);
  try{
    exact(value,['schema','missionId','intentHash','inputManifestHash','input','manifest','scope']);
    string(value.schema,'asset binding schema',{max:160});
    identifier(value.missionId,'asset binding mission ID');
    digest(value.intentHash,'asset binding intent hash');
    digest(value.inputManifestHash,'asset binding input manifest hash');
    exact(value.input,['path','sha256','bytes']);
    string(value.input.path,'asset binding input path',{max:1024});
    digest(value.input.sha256,'asset binding input SHA-256');
    integer(value.input.bytes,'asset binding input bytes',{min:1,max:4*1024*1024});
    string(value.scope,'asset binding scope',{max:2000});
  }catch(error){remap(error,code);}
  assert(value.schema===SUBLIMINE_ASSET_BINDING_SCHEMA,'Unknown asset binding schema');
  assert(value.input.path===SUBLIMINE_ASSET_MANIFEST_INPUT_PATH,'Asset binding input path changed');
  const manifest=normalizeSublimineAssetManifest(value.manifest,{code});
  const scope='Immutable Sublimine project-asset metadata only. Asset bytes, project-vault paths, URLs, extraction directives, provider context and read capability are absent. A future resolver must be separately capability-bound; this binding does not authorize one.';
  assert(value.scope===scope,'Asset binding scope changed');
  return {schema:SUBLIMINE_ASSET_BINDING_SCHEMA,missionId:value.missionId,intentHash:value.intentHash,
    inputManifestHash:value.inputManifestHash,input:{path:value.input.path,sha256:value.input.sha256,bytes:value.input.bytes},manifest,scope};
}

export function commitSublimineAssetManifestBinding(store,mission,binding){
  if(!binding)return null;
  integrity(store?.db?.isTransaction,'Asset manifest admission requires the mission publication transaction');
  const normalized=bindingShape(binding);
  integrity(mission?.id===normalized.missionId&&mission.intentHash===normalized.intentHash
    &&mission.inputManifestHash===normalized.inputManifestHash,'Asset binding differs from frozen mission/input admission');
  integrity(mission.assetManifestBindingHash===sha256(normalized),'Mission does not commit the exact asset manifest binding');
  const manifest=missionInputManifest(store,mission.id);
  integrity(manifest&&sha256(manifest)===normalized.inputManifestHash,'Asset manifest input binding is absent or changed');
  const file=manifest.files.filter(item=>item.path===normalized.input.path&&item.sha256===normalized.input.sha256&&item.bytes===normalized.input.bytes);
  integrity(file.length===1,'Asset manifest does not name exactly one immutable admitted input');
  // A version-17 executor knows this is metadata-only and must not silently
  // treat the manifest as a generic provider-readable attachment.
  store.requireExecutionProtocol(17);
  return store.put(SUBLIMINE_ASSET_BINDING_TYPE,mission.id,normalized,{expectedVersion:0});
}

function missionVersions(store,missionId){
  return store.db.prepare('SELECT version FROM records WHERE type=? AND id=? ORDER BY version')
    .all('mission',missionId).map(row=>store.get('mission',missionId,row.version));
}

/** Revalidate a metadata binding from its immutable input record.  This is a
 * controller-only reader: callers must project a deliberately reduced view
 * rather than passing this object to a provider or public report.
 */
export function sublimineMissionAssetManifest(store,missionId){
  identifier(missionId,'asset manifest mission ID');
  const current=store.get('mission',missionId),origin=store.get('mission',missionId,1),record=store.get(SUBLIMINE_ASSET_BINDING_TYPE,missionId);
  const originHas=Object.hasOwn(origin?.data??{},'assetManifestBindingHash');
  const currentHas=Object.hasOwn(current?.data??{},'assetManifestBindingHash');
  if(!originHas&&!currentHas&&!record)return null;
  // Version 17 is the fail-closed reader boundary for this feature.  A
  // tampered/downgraded database header must not make a new executor treat
  // the sealed manifest like an ordinary UTF-8 attachment.
  integrity(store.db.prepare('PRAGMA user_version').get().user_version===17,
    'Asset manifest requires its version-17 execution protocol');
  integrity(current?.data?.id===missionId&&origin?.version===1&&origin.data?.id===missionId,
    'Asset manifest requires the exact current mission and version-one admission');
  integrity(originHas&&currentHas&&typeof origin.data.assetManifestBindingHash==='string'
    &&origin.data.assetManifestBindingHash===current.data.assetManifestBindingHash,
    'Asset manifest mission commitment was added, removed or changed after admission');
  digest(origin.data.assetManifestBindingHash,'asset manifest binding hash');
  const versions=missionVersions(store,missionId);
  integrity(versions.length>0&&versions.every(item=>item?.data?.assetManifestBindingHash===origin.data.assetManifestBindingHash),
    'Asset manifest mission commitment changed in historical lifecycle');
  integrity(record?.type===SUBLIMINE_ASSET_BINDING_TYPE&&record.id===missionId&&record.version===1
    &&store.get(SUBLIMINE_ASSET_BINDING_TYPE,missionId,1)?.hash===record.hash,
    'Asset manifest binding record is missing, replaced or re-versioned');
  const binding=bindingShape(record.data);
  integrity(sha256(binding)===origin.data.assetManifestBindingHash,'Asset manifest record differs from frozen mission commitment');
  integrity(binding.missionId===missionId&&binding.intentHash===origin.data.intentHash&&binding.intentHash===current.data.intentHash
    &&binding.inputManifestHash===origin.data.inputManifestHash&&binding.inputManifestHash===current.data.inputManifestHash,
    'Asset manifest binding differs from immutable mission/input identity');
  const manifest=missionInputManifest(store,missionId);
  integrity(manifest&&sha256(manifest)===binding.inputManifestHash,'Asset manifest input manifest integrity failed');
  const files=manifest.files.filter(file=>file.path===binding.input.path&&file.sha256===binding.input.sha256&&file.bytes===binding.input.bytes);
  integrity(files.length===1,'Asset manifest input is not represented exactly once');
  const blob=store.get('mission-input-bytes',files[0].record.id,1);
  integrity(blob?.data?.missionId===missionId&&blob.data.path===binding.input.path&&typeof blob.data.base64==='string',
    'Asset manifest input bytes are missing or changed');
  const raw=Buffer.from(blob.data.base64,'base64');
  integrity(raw.toString('base64')===blob.data.base64&&raw.length===binding.input.bytes&&sha256(raw)===binding.input.sha256,
    'Asset manifest input bytes fail their sealed identity');
  const parsed=parseSublimineAssetManifestBytes(raw,{code:'ASSET_MANIFEST_INTEGRITY'});
  integrity(canonical(parsed)===canonical(binding.manifest),'Asset manifest parsed metadata differs from sealed binding');
  return clone(binding);
}

/** Private descriptor used only to exclude the manifest from generic input
 * surfaces.  It intentionally returns no project identity or asset metadata.
 */
export function sublimineMissionAssetManifestInput(store,missionId){
  const binding=sublimineMissionAssetManifest(store,missionId);
  return binding?clone(binding.input):null;
}

/** A reduced status suitable for a provider-safe capability flag or public
 * report.  It never carries projectId, filenames, media types, hashes or raw
 * bytes.  `inspect` deliberately states the current honest limitation.
 */
export function sublimineMissionAssetPresence(store,missionId){
  const binding=sublimineMissionAssetManifest(store,missionId);
  return binding?{present:true,count:binding.manifest.assets.length,
    inspect:'UNAVAILABLE_NO_CAPABILITY_BOUND_RESOLVER',
    scope:'Immutable project assets are attached to this mission, but this Factory version has no byte-reading or extraction capability for them.'}:null;
}
