import {CATALOG_CONTROL_INSTRUCTIONS, CARD_ENCODINGS} from '../catalog/index.mjs';
import {WORKER_CONTROL} from './learning-service.mjs';
import {CONTEXT_ENCODINGS, CONTEXT_CODEC_INSTRUCTIONS} from './context-codec.mjs';
import {CONTEXT_JSON_CODEC_INSTRUCTIONS} from './context-json-codec.mjs';
import {SOURCE_CONTEXT_VIEW_INSTRUCTIONS} from './source-context-view.mjs';
import {check, clone, canonical, sha256} from './contracts.mjs';
import {validateSpecialistCharter} from './specialist-charter.mjs';

/** No caller-supplied charter: derive it from the exact currently accepted plan.
 * Empty catalog assignments are permitted only for an execution producer whose
 * complete node and charter already passed independent plan review.
 */
export function standaloneSpecialistBinding({store, registry, missionId, nodeId, mode, purpose, artifactIds}) {
  check(mode === 'producer' && nodeId !== 'planning', 'SPECIALIST_BINDING', 'Standalone specialists cannot replace planning or independent review');
  const record = store.get('plan', missionId)?.data;
  check(record && artifactIds.includes(record.acceptedPlanArtifactId), 'SPECIALIST_BINDING', 'Specialist requires an exposed accepted plan');
  const accepted = registry.assertUsable(record.acceptedPlanArtifactId, {missionId, purpose: 'plan'});
  check(accepted.payload.kind === 'mission-plan' && accepted.payload.nodeId === 'planning'
    && canonical(JSON.parse(accepted.payload.body)) === canonical(record.plan), 'SPECIALIST_BINDING', 'Stored plan differs from its accepted candidate');
  const node = record.plan.nodes.find(n => n.id === nodeId), scheduled = store.get('node', `${missionId}:${nodeId}`)?.data;
  check(node && node.roleIds.length === 0 && node.specialist && node.purpose === purpose
    && scheduled?.missionId === missionId && canonical(scheduled.spec) === canonical(node),
  'SPECIALIST_BINDING', 'Specialist must match the exact accepted scheduled node');
  validateSpecialistCharter(node.specialist);
  return {schema:'sovereign.standalone-specialist.v1', missionId, nodeId, purpose,
    planArtifactId:accepted.id, planArtifactHash:accepted.payloadHash, nodeHash:sha256(node),
    charter:clone(node.specialist),
    scope:'Mission-local producer charter, independently reviewed as part of this exact plan. Not a catalog role, proof of expertise, tool authority, sealed-blind adapter or learned policy. Its candidate still requires separate material acceptance.'};
}

export function compileStandaloneSpecialistPrefix(binding, {purpose, mode, maxBytes=256*1024, contextEncoding='plain-json', cardEncoding='pretty-json', producerContext='full-plan'}) {
  check(binding?.schema === 'sovereign.standalone-specialist.v1' && binding.purpose === purpose && mode === 'producer', 'SPECIALIST_BINDING', 'Invalid standalone compilation scope');
  validateSpecialistCharter(binding.charter);
  check(CONTEXT_ENCODINGS.includes(contextEncoding) && CARD_ENCODINGS.includes(cardEncoding)
    && ['full-plan','node-contract-v1'].includes(producerContext), 'CONFIG', 'Unknown specialist representation');
  const lead = CATALOG_CONTROL_INSTRUCTIONS + '\nMODE: STANDALONE SPECIALIST. No catalog role is assigned. The following JSON is the complete mission-local charter, not a selected catalog card. Apply its scoped methods and falsifier to produce the requested candidate. It confers no authority, acceptance, expertise certificate or implementation of an unavailable protocol. Preserve the exact node criteria, tools, required effects and original user constraints supplied by the runtime. Do not impersonate a catalog facet or declare your own independent acceptance.\n';
  const tail = '\n' + WORKER_CONTROL
    + (contextEncoding !== 'plain-json' ? '\n' + CONTEXT_CODEC_INSTRUCTIONS : '')
    + (['lossless-json-v2','source-text-v1'].includes(contextEncoding) ? '\n' + CONTEXT_JSON_CODEC_INSTRUCTIONS : '')
    + (contextEncoding === 'source-text-v1' ? '\n' + SOURCE_CONTEXT_VIEW_INSTRUCTIONS : '')
    + (producerContext === 'node-contract-v1' ? '\nOnly the complete own node contract and applicable requirements are supplied in planViews, bound separately from the original plan identity. Do not infer unexposed sibling instructions or results. This is structural exposure control, not proof of semantic blindness.' : '');
  const pretty = JSON.stringify(binding, null, 2);
  check(Buffer.byteLength(lead + pretty + tail) <= maxBytes, 'CONTEXT_LIMIT', 'Complete specialist prefix exceeds logical budget; nothing truncated');
  return lead + (cardEncoding === 'compact-json-v1' ? JSON.stringify(binding) : pretty) + tail;
}
