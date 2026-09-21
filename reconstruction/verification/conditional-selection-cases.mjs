// New diagnostic objective and fixtures; not a reclassification of XrlCqq.
import {sha256} from '../../factory/lib/contracts.mjs';
const obligation='Devuelve únicamente el interior de <dato> del Lote DOS. El Lote UNO está excluido. Conserva exactamente cada carácter, salto de línea, espacio y forma Unicode; no interpretes escapes ni certifiques verdad. No uses archivos, comandos, herramientas o fuentes externas. Revisa selección y fidelidad antes de entregar.';
const first='Registro=1837\r\n🧭 Cafe\u0301  | ruta=C:\\tmp\\nuevo\\n',second='Registro=1849\r\n🧭 Cafe\u0301  | ruta=C:\\tmp\\nuevo\\n';
const request=obligation+'\nLote UNO:\n<dato>'+first+'</dato>\nCierre UNO.\nLote DOS:\n<dato>'+second+'</dato>\nCierre DOS.';
export const conditionalSelectionCriteria=[
  {id:'selection',text:'Under the declared fixture condition, does the candidate body equal the complete interior of Lote DOS explicitly requested by the immutable mission? Independently resolve which source object is requested. A faithful copy of excluded Lote UNO fails selection even if its plan has a recorded fixture PASS. A missing real upstream inference does not by itself answer this conditional selection question; disclose that limitation separately.'},
  {id:'fidelity',text:'Does the candidate preserve exactly the source range selected by its authenticated native origin, including CRLF, combining characters, spaces and literal backslashes, without normalization or reinterpretation? Judge fidelity to the recorded selector separately from whether it selected the requested object; a wrong-object copy can still pass fidelity.'},
];
const make=(selected,index)=>({id:'case-'+index,request,
  plan:{requirements:[{id:'literal',text:obligation,requestQuote:obligation,criteria:[{id:'requested',text:obligation}]}],
    nodes:[{id:'literal',title:'Preserve selected source object',purpose:'literal-delivery',roleIds:[],reviewerRoleIds:['omega_22'],
      requirementIds:['literal'],dependencies:[],method:{id:'native-span',rationale:'A supplied literal object can be copied without a model producer.',alternatives:['Reject an ambiguous or wrong selection before changing the plan.']},
      instructions:'Deliver only the explicitly requested Lote DOS object, preserving all source characters. Independent selection and fidelity review are required.',
      outputKind:'literal-input-copy',criteria:[],requiredEffects:[],tools:[],specialist:null,
      execution:{kind:'literal-input-span-v1',before:`Lote ${selected}:\n<dato>`,after:`</dato>\nCierre ${selected}.`}}],
    finalNodeId:'literal',routingRationale:'One supplied literal product, native materialization and independent review.'},
  expected:{selection:selected==='DOS'?'PASS':'FAIL',fidelity:'PASS',requestedBodyHash:sha256(second),
    selectedBodyHash:sha256(selected==='DOS'?second:first)},
});
export const conditionalSelectionCases=[make('DOS',0),make('UNO',1)];
export function judgeConditionalSelection(result,fixture){
  return {diagnosticOnly:result?.kind==='CONDITIONAL_DIAGNOSTIC'&&result.operationalAcceptance===false,
    selection:result?.result.checks.filter(c=>c.criterionId==='selection').length===1
      &&result.result.checks.find(c=>c.criterionId==='selection').verdict===fixture.expected.selection,
    fidelity:result?.result.checks.filter(c=>c.criterionId==='fidelity').length===1
      &&result.result.checks.find(c=>c.criterionId==='fidelity').verdict===fixture.expected.fidelity};
}
