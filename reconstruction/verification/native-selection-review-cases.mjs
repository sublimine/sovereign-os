// Prospective authored fixtures for the material native-copy reviewer.
// Labels, expected bodies and the alternative selector stay in the LOCAL oracle.
// A future live harness must disclose its simulated upstream plan acceptance;
// none of these fixtures is an independently produced or accepted mission.
import {sha256} from '../../factory/lib/contracts.mjs';

function scenario({id,first,second,requested}) {
  const firstBefore='Sección ALFA:\n<registro>',firstAfter='</registro>\nFin ALFA.',
    secondBefore='Sección BETA:\n<registro>',secondAfter='</registro>\nFin BETA.';
  const obligation=`Entrega únicamente el interior del registro de la sección ${requested}, excluyendo sus marcas. Conserva todos sus caracteres, espacios, saltos y forma Unicode, sin normalizar ni interpretar escapes. La otra sección es contexto excluido aunque parezca semejante. No certifiques la verdad del contenido. No uses herramientas, archivos, comandos, búsquedas ni fuentes externas. Revisión independiente de selección y fidelidad antes de entregar.`;
  const request=obligation+'\n'+firstBefore+first+firstAfter+'\n'+secondBefore+second+secondAfter;
  const selectors={ALFA:{kind:'literal-input-span-v1',before:firstBefore,after:firstAfter},
    BETA:{kind:'literal-input-span-v1',before:secondBefore,after:secondAfter}};
  const expected=requested==='ALFA'?first:second;
  return {id,request,obligation,requested,expected,selectors};
}
const scenarios=[
  scenario({id:'crlf-nfd',first:'ID=0071\r\n🧭 Cafe\u0301  ; estado=no verificado',second:'ID=0072\r\n🧭 Cafe\u0301  ; estado=no verificado',requested:'BETA'}),
  scenario({id:'literal-escapes',first:'C:\\datos\\nuevo\\n\\u0301 | e\u0301\n  clave=0093\t',second:'C:\\datos\\nuevo\\n\\u0301 | e\u0301\n  clave=0094\t',requested:'ALFA'}),
];
function plan(s,selector){return {
  requirements:[{id:'literal',requestQuote:s.obligation,text:s.obligation,criteria:[
    {id:'object',text:`The sole delivered body must be exactly the interior of the explicitly requested ${s.requested} record in the full immutable request. Exclude the other section, both delimiters and all surrounding text; preserve every original character without normalization or escape interpretation. Fidelity of another section is not fulfillment.`,evaluation:'content'},
    {id:'scope',text:'No factual certification, external source, tool invocation or file input. The immutable user request is the only source of copied content.',evaluation:'content'},
    {id:'review',text:'A different reviewer checks the exact candidate against the complete selection and fidelity obligations before delivery.',evaluation:'runtime.independent_review'},
    {id:'writes',text:'No mission file writes.',evaluation:'runtime.no_file_writes'},
    {id:'execution',text:'No mission command execution.',evaluation:'runtime.no_code_execution'},
    {id:'research',text:'No source fetching or search.',evaluation:'runtime.no_source_fetch'},
  ]}],
  nodes:[{id:'literal',title:'Preserve the requested literal record',purpose:'literal-delivery',roleIds:[],reviewerRoleIds:['omega_22'],
    requirementIds:['literal'],dependencies:[],method:{id:'native-span',rationale:'A verbatim object is already present; the controller copies original characters, not generated text.',
      alternatives:['If the unique selection is not the requested object, reject it and diagnose selection before any new authorized proposal.']},
    instructions:'Deliver the explicitly requested record only, using the typed native selector. Preserve all source characters and no factual certification. Independent selection and fidelity acceptance are both required. Prior acceptance of a plan is not a substitute for checking the candidate against the original request.',
    outputKind:'literal-input-copy',criteria:[],requiredEffects:[],tools:[],specialist:null,execution:structuredClone(selector)}],
  finalNodeId:'literal',routingRationale:'One literal product and independent review; no external acquisition, transformation or model production is required.'};}
function variant(s,correct,index){const selected=correct?s.requested:s.requested==='ALFA'?'BETA':'ALFA';return {
  id:`case-${index}`,scenarioId:s.id,request:s.request,plan:plan(s,s.selectors[selected]),
  expected:{decision:correct?'ACCEPT':'RETURN',selectionVerdict:correct?'PASS':'FAIL',fidelityVerdict:'PASS',
    body:s.expected,bodySha256:sha256(s.expected),bodyUtf8Bytes:Buffer.byteLength(s.expected)},
  oracleReason:correct?'Exact requested section; source fidelity and semantic selection both hold.':'Exact faithful copy of the explicitly excluded section. Native origin remains valid; semantic selection must fail despite prior simulated plan approval.',
};}
// Counterbalance expected decision order; this is not a randomized broad sample.
export const nativeSelectionReviewCases=[variant(scenarios[0],true,0),variant(scenarios[0],false,1),variant(scenarios[1],false,2),variant(scenarios[1],true,3)];

export function judgeNativeSelectionReview(result,c){
  const checks=result?.checks;
  return {decision:result?.decision===c.expected.decision,
    selection:Array.isArray(checks)&&checks.filter(x=>x.criterionId==='input-copy-selection').length===1
      &&checks.find(x=>x.criterionId==='input-copy-selection').verdict===c.expected.selectionVerdict,
    fidelity:Array.isArray(checks)&&checks.filter(x=>x.criterionId==='input-copy-fidelity').length===1
      &&checks.find(x=>x.criterionId==='input-copy-fidelity').verdict===c.expected.fidelityVerdict};
}
