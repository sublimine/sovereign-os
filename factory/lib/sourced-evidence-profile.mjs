import {check,clone,keys,string} from './contracts.mjs';

const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

export const SOURCED_EVIDENCE_PROFILE_SCHEMA='sublimine.sourced-evidence-profile.v1';
export const ES_USED_CAR_LISTING_EVIDENCE_PROFILE_ID='es-used-car-listing-v1';
export const ES_USED_CAR_LISTING_EVIDENCE_PROFILE_V2_ID='es-used-car-listing-v2';

// This is deliberately a very narrow deterministic matcher. It selects a
// known public evidence packet only for the Spanish request class it was
// reviewed for; all neighbouring research questions remain on the ordinary
// sourced route.
export function isEsUsedCarListingPublicFieldsQuestion(value){
  if(typeof value!=='string'||Buffer.byteLength(value,'utf8')>1400)return false;
  const text=value.normalize('NFKC').trim().toLocaleLowerCase('es-ES');
  if(!text||!/\b(?:anuncio|anuncios)\b/u.test(text)
    ||!/\b(?:coche|coches|veh[ií]culo|veh[ií]culos|autom[oó]vil|autom[oó]viles)\b/u.test(text)
    ||!/\b(?:informaci[oó]n|datos?|campos?|deber[ií]a(?:n)?|visible(?:s)?|p[uú]blico)\b/u.test(text))return false;
  const fieldSignals=[
    /\b(?:kilometraje|kil[oó]metros?|km|kms?)\b/u,
    /\b(?:ciudad|ubicaci[oó]n|localizaci[oó]n|provincia)\b/u,
    /\b(?:a[nñ]o|matriculaci[oó]n|primera\s+matriculaci[oó]n)\b/u,
    /\b(?:precio|marca|modelo|combustible|transmisi[oó]n|cambio|estado|fotos?)\b/u,
  ];
  return fieldSignals.filter(pattern=>pattern.test(text)).length>=2;
}

// v1 remains exactly the historical two-source packet.  Do not merge or
// reorder it with later evidence profiles: existing mission bindings carry
// its ordered packet and must remain replayable without reinterpretation.
const ES_USED_CAR_LISTING_V1_SOURCES=freeze([
  {
    key:'public-listing-fields',
    url:'https://ayuda.coches.net/api/v2/help_center/es/articles/7487662867218.json',
    role:'MARKETPLACE_LISTING_FIELDS',
    claimBoundary:'Describes a marketplace field convention only; it is not a legal or universal disclosure rule.',
  },
  {
    key:'prepurchase-verification',
    url:'https://revista.dgt.es/es/tramites/2025/1015-Informe-de-un-vehiculo.shtml',
    role:'PUBLIC_AUTHORITY_VERIFICATION',
    claimBoundary:'Supports pre-purchase verification information; it does not turn every verification datum into a mandatory public ad field.',
  },
]);

// v2 is deliberately a different, small public packet.  It replaces the
// pre-purchase DGT article with two marketplace help articles that answer the
// actual public-listing question: approximate location and how the listing is
// visually represented.  Each URL is an official Coches.net JSON help
// endpoint, fetched once in this declared order.  These are platform facts,
// not a hidden assertion that any field is a universal legal obligation.
const ES_USED_CAR_LISTING_V2_SOURCES=freeze([
  {
    key:'marketplace-listing-core-fields',
    url:'https://ayuda.coches.net/api/v2/help_center/es/articles/7487662867218.json',
    role:'MARKETPLACE_LISTING_FIELDS',
    claimBoundary:'Describes a Coches.net listing field convention only; it is not a legal or universal disclosure rule.',
  },
  {
    key:'listing-location-consistency',
    url:'https://ayuda.coches.net/api/v2/help_center/es/articles/7489165673746.json',
    role:'MARKETPLACE_LOCATION_SAFETY_SIGNAL',
    claimBoundary:'Supports that locations shown in an ad can be checked for consistency as one safety signal; it neither proves fraud nor makes city or province a universal mandatory field.',
  },
  {
    key:'listing-visual-representation',
    url:'https://ayuda.coches.net/api/v2/help_center/es/articles/7488943346578.json',
    role:'MARKETPLACE_VISUAL_REPRESENTATION',
    claimBoundary:'Describes Coches.net photo guidance and publication conditions only; it is not a universal legal rule or a claim about every marketplace.',
  },
]);

// This is a product-shape contract, not a substitute for source support.  It
// distinguishes an operator recommendation about how a public listing should
// help a buyer from a platform rule, legal requirement, or source-reported
// fact.  The independent reviewer receives this same immutable contract.
const ES_USED_CAR_LISTING_V2_ANSWER_REQUIREMENTS=freeze({
  schema:'sublimine.public-used-car-listing-answer-requirements.v1',
  language:'es',
  format:'MARKDOWN_SECTION_CHECKLIST',
  requiredSections:[
    {id:'identity',heading:'Identificación y ficha',coverage:'Marca, modelo, versión, año o primera matriculación y kilometraje.'},
    {id:'mechanics',heading:'Mecánica y uso',coverage:'Como recomendación editorial claramente etiquetada: combustible, cambio, potencia o prestaciones relevantes, etiqueta ambiental y equipamiento útil cuando el anunciante los conozca.'},
    {id:'condition',heading:'Estado e historial',coverage:'Como recomendación editorial claramente etiquetada: estado real, daños o reparaciones relevantes, mantenimiento, ITV, titulares o garantía cuando corresponda.'},
    {id:'price',heading:'Precio y condiciones',coverage:'Precio total; como recomendación editorial claramente etiquetada, condiciones de financiación si existen y costes o condiciones materiales que alteren la comparación.'},
    {id:'location',heading:'Ubicación y contacto',coverage:'Ciudad y provincia, o zona amplia equivalente, y el canal de contacto habilitado por la plataforma, sin publicar una dirección exacta.'},
    {id:'visual-proof',heading:'Fotos y documentación',coverage:'Fotos actuales del vehículo real; como recomendación editorial, indica también la documentación de mantenimiento o verificaciones que se pueda facilitar.'},
  ],
  editorialBoundary:'La ubicación se presenta como recomendación práctica de orientación para el público, no como obligación legal, universal o afirmación atribuida a una plataforma. No se publica una dirección exacta.',
  sourceBoundary:'Atribuye a una fuente sólo lo que esa fuente permite afirmar. Separa explícitamente campos de plataforma, señales de consistencia, guía fotográfica y recomendaciones editoriales de claridad para el público. Los elementos que las fuentes no describen sólo pueden aparecer bajo una etiqueta explícita de recomendación editorial, nunca como regla de plataforma, obligación legal o hecho universal.',
  audienceChecks:[
    'Incluye expresamente una ubicación aproximada: ciudad y/o provincia, o una zona amplia equivalente cuando sea más prudente.',
    'Separa los campos visibles del anuncio de las comprobaciones que la persona interesada pueda hacer antes de comprar.',
    'Distingue la convención de una plataforma, una recomendación editorial de claridad y una obligación legal.',
    'No afirma que una ubicación discordante pruebe fraude ni que ciudad o provincia sean universalmente obligatorias.',
  ],
});

const ES_USED_CAR_LISTING_PROFILE=freeze({
  schema:SOURCED_EVIDENCE_PROFILE_SCHEMA,
  id:ES_USED_CAR_LISTING_EVIDENCE_PROFILE_ID,
  selection:'deterministic-es-used-car-listing-public-fields-v1',
  discovery:'DISABLED',
  // This is a sealed acquisition envelope, not a generic retry budget.  There
  // are exactly two reviewed public seeds.  A missing or invalid seed is an
  // honest escalation condition; it never authorizes a replacement search or
  // a speculative third URL.
  acquisition:{schema:'sublimine.sealed-source-acquisition.v1',maxSearchIntents:0,maxFetchIntents:2,
    maxSourceBytes:65536,acceptedHttpStatus:'2xx-only'},
  sources:ES_USED_CAR_LISTING_V1_SOURCES,
});

// Keep v1 immutable for already admitted missions.  The richer public answer
// contract is a new named profile, so an old mission's policy hash, source
// packet and replay semantics never change beneath it.
const ES_USED_CAR_LISTING_PROFILE_V2=freeze({
  schema:SOURCED_EVIDENCE_PROFILE_SCHEMA,
  id:ES_USED_CAR_LISTING_EVIDENCE_PROFILE_V2_ID,
  selection:'deterministic-es-used-car-listing-public-fields-v2',
  discovery:'DISABLED',
  acquisition:{schema:'sublimine.sealed-source-acquisition.v1',maxSearchIntents:0,maxFetchIntents:3,
    maxSourceBytes:65536,acceptedHttpStatus:'2xx-only'},
  sources:ES_USED_CAR_LISTING_V2_SOURCES,
  answerRequirements:ES_USED_CAR_LISTING_V2_ANSWER_REQUIREMENTS,
});

const PROFILE_BY_ID=new Map([
  [ES_USED_CAR_LISTING_EVIDENCE_PROFILE_ID,ES_USED_CAR_LISTING_PROFILE],
  [ES_USED_CAR_LISTING_EVIDENCE_PROFILE_V2_ID,ES_USED_CAR_LISTING_PROFILE_V2],
]);

function profileId(value){
  string(value,'sourced evidence profile',{min:1,max:128});
  check(PROFILE_BY_ID.has(value),'SOURCED_EVIDENCE_PROFILE','Unknown sourced evidence profile');
  return value;
}

export function sourcedEvidenceProfileForId(value){
  if(value===undefined||value===null)return null;
  return clone(PROFILE_BY_ID.get(profileId(value)));
}

export function sourcedEvidenceProfileForPolicy(policy){
  if(!policy||typeof policy!=='object'||!Object.hasOwn(policy,'sourcedEvidenceProfile'))return null;
  return sourcedEvidenceProfileForId(policy.sourcedEvidenceProfile);
}

export function sourcedEvidenceProfileForMission(mission){
  return sourcedEvidenceProfileForPolicy(mission?.policy);
}

/**
 * Return the profile-owned acquisition envelope.  It lives with the profile
 * because the zero-discovery/two-seed boundary is part of the evidence
 * selection itself, not a mutable worker preference.
 */
export function sourcedEvidenceProfileAcquisition(profile){
  if(profile===null||profile===undefined)return null;
  const selected=sourcedEvidenceProfileForId(profile.id);
  return clone(selected.acquisition);
}

export function assertSourcedEvidenceProfileAdmission({id,intent,entryMode,allowedTools}){
  const profile=sourcedEvidenceProfileForId(id);
  if(profile===null)return null;
  check(entryMode==='sourced-response-v1','SOURCED_EVIDENCE_PROFILE','A sealed evidence profile requires sourced-response-v1');
  check(isEsUsedCarListingPublicFieldsQuestion(intent),'SOURCED_EVIDENCE_PROFILE','This evidence profile is not eligible for the immutable public question');
  if(allowedTools!==undefined){
    keys({allowedTools},['allowedTools']);
    check(Array.isArray(allowedTools)&&allowedTools.length===1&&allowedTools[0]==='source.fetch',
      'SOURCED_EVIDENCE_PROFILE','This evidence profile fixes source.fetch as its only tool');
  }
  return profile;
}

export function assertSourcedEvidenceProfileMission(mission){
  const profile=sourcedEvidenceProfileForMission(mission);
  if(profile===null)return null;
  check(mission?.policy?.entryMode==='sourced-response-v1'
    &&isEsUsedCarListingPublicFieldsQuestion(mission.intent)
    &&Array.isArray(mission.policy.allowedTools)
    &&mission.policy.allowedTools.length===1&&mission.policy.allowedTools[0]==='source.fetch',
  'SOURCED_EVIDENCE_PROFILE','Sealed evidence profile mission policy changed or exceeds its source authority');
  return profile;
}

export function sourcedEvidenceProfileBinding(profile){
  if(profile===null||profile===undefined)return null;
  const selected=sourcedEvidenceProfileForId(profile.id);
  return {
    schema:selected.schema,
    id:selected.id,
    selection:selected.selection,
    discovery:selected.discovery,
    acquisition:clone(selected.acquisition),
    sources:selected.sources.map(source=>({
      key:source.key,
      url:source.url,
      role:source.role,
      claimBoundary:source.claimBoundary,
    })),
    ...(selected.answerRequirements?{answerRequirements:clone(selected.answerRequirements)}:{}),
  };
}

export function sourcedEvidenceProfileAnswerRequirements(profile){
  if(profile===null||profile===undefined)return null;
  const selected=sourcedEvidenceProfileForId(profile.id);
  return selected.answerRequirements?clone(selected.answerRequirements):null;
}

export function sourcedEvidenceProfileAllowsUrl(profile,value){
  if(profile===null||profile===undefined)return true;
  const selected=sourcedEvidenceProfileForId(profile.id);
  let url;
  try{url=new URL(value).href;}catch{return false;}
  return selected.sources.some(source=>source.url===url);
}

/**
 * The sealed profile is a finite ordered packet, rather than an allow-list
 * that can be sampled in arbitrary order.  The broker supplies only already
 * completed source URLs here; this helper fails closed on a gap, duplicate or
 * foreign value and returns the one next seed (or null after the packet).
 */
export function sourcedEvidenceProfileNextSeed(profile,completedUrls=[]){
  if(profile===null||profile===undefined)return null;
  const selected=sourcedEvidenceProfileForId(profile.id);
  check(Array.isArray(completedUrls)&&completedUrls.length<=selected.sources.length,
    'SOURCED_EVIDENCE_PROFILE_SEQUENCE','Sealed source history exceeds its finite packet');
  completedUrls.forEach((value,index)=>{
    let normalized;
    try{normalized=new URL(value).href;}catch{check(false,'SOURCED_EVIDENCE_PROFILE_SEQUENCE','Sealed source history has an invalid URL');}
    check(normalized===selected.sources[index].url,'SOURCED_EVIDENCE_PROFILE_SEQUENCE',
      'Sealed sources must complete once and in their declared order');
  });
  return selected.sources[completedUrls.length]??null;
}
