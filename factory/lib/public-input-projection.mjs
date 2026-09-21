// Public input reporting is deliberately narrower than the controller's
// preparation ledger. The ledger contains private workspace paths and inode
// custody used to protect the worker hand-off; neither is a user-facing input
// fact. This module projects only admission metadata that can be reconstructed
// from the immutable manifest.
import {check,digest,identifier,keys,string} from './contracts.mjs';
import {missionInputContext} from './mission-inputs.mjs';
import {projectContextDescriptor} from './project-context.mjs';
import {sublimineMissionAssetManifestInput} from './mission-assets.mjs';

const PREPARATION_FIELDS=Object.freeze(['missionId','manifestHash','status','scope']);
const EMPTY_PREPARATION=Object.freeze({integrity:'ABSENT',status:'PENDING',manifestHash:null});

function preparationView(store,missionId,manifestHash){
  const record=store.get('input-preparation',missionId);
  if(!record)return {...EMPTY_PREPARATION};
  try{
    check(record.type==='input-preparation'&&record.id===missionId&&record.version===1,
      'PUBLIC_INPUT_PREPARATION','Input preparation record identity changed');
    const data=record.data;
    keys(data,PREPARATION_FIELDS,PREPARATION_FIELDS,'input preparation');
    identifier(data.missionId,'input preparation mission id');
    digest(data.manifestHash,'input preparation manifest hash');
    string(data.scope,'input preparation scope',{max:4000});
    check(data.missionId===missionId&&data.manifestHash===manifestHash&&data.status==='READY',
      'PUBLIC_INPUT_PREPARATION','Input preparation does not bind the admitted manifest');
    return {integrity:'VERIFIED',status:'READY',manifestHash};
  }catch{return {integrity:'UNVERIFIED',status:null,manifestHash:null};}
}

/**
 * Return a stable metadata-only view of explicitly admitted user inputs. A
 * malformed manifest or preparation row is represented as an opaque integrity
 * state; callers never need to fall back to the durable preparation payload.
 */
export function readPublicMissionInputs(store,missionId){
  try{
    const context=missionInputContext(store,missionId);
    if(!context)return null;
    digest(context.manifestHash,'public input manifest hash');
    const projectContext=projectContextDescriptor(store,missionId);
    const assetManifest=sublimineMissionAssetManifestInput(store,missionId);
    const hidden=[projectContext,assetManifest].filter(Boolean);
    if(hidden.length){
      const files=context.files.filter(file=>!hidden.some(privateInput=>file.path===privateInput.path&&file.sha256===privateInput.sha256));
      // The aggregate manifest and preparation commitment bind the excluded
      // controller/private inputs too.  Publishing either would create a
      // stable correlator for project context or asset metadata, so project
      // only ordinary attachments and no aggregate input commitment.
      check(files.length===context.files.length-hidden.length,'PUBLIC_INPUT_PRIVATE_CHANNEL',
        'A protected project input was not represented exactly once in admitted input metadata');
      return {
        integrity:'VERIFIED',
        protocol:context.protocol,
        manifestHash:null,
        files,
        preparation:{integrity:'NOT_PROJECTED',status:null,manifestHash:null},
        scope:'Metadata for ordinary immutable user-supplied input snapshots only. Controller-bound project context and sealed project-asset manifest inputs, including their descriptors, paths, hashes, aggregate manifest commitment, preparation binding, project identity, asset metadata and original bytes, are excluded from public report data.'
      };
    }
    return {
      integrity:'VERIFIED',
      protocol:context.protocol,
      manifestHash:context.manifestHash,
      files:context.files,
      preparation:preparationView(store,missionId,context.manifestHash),
      scope:'Metadata for immutable user-supplied input snapshots only. Original bytes, host provenance, controller workspace paths, file identities and preparation internals are not public report data.'
    };
  }catch{
    return {
      integrity:'UNVERIFIED',protocol:null,manifestHash:null,files:[],
      preparation:{integrity:'UNVERIFIED',status:null,manifestHash:null},
      scope:'Input admission or preparation evidence could not be revalidated. No original bytes, paths, provenance or controller-preparation details are projected.'
    };
  }
}
