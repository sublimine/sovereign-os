import {canonical} from '../../factory/lib/contracts.mjs';

export const CATALOG_SOURCE_URLS=Object.freeze([
  'https://www.rfc-editor.org/rfc/rfc2606.txt',
  'https://www.iana.org/domains/reserved'
]);
export const CATALOG_LIVE_CASES=Object.freeze([
  {id:'closed-catalog',allowedTools:[],request:'Transforma sólo este texto aportado: ÁRBOL | mar | árbol | sol. Divide por |, recorta espacios de los extremos, convierte a minúsculas y elimina repetidos conservando el primer orden. Responde únicamente el array JSON de cadenas. No consultes fuentes ni crees archivos ni ejecutes código.'},
  {id:'documentary-catalog',allowedTools:['source.fetch'],request:`Consulta realmente las dos fuentes ${CATALOG_SOURCE_URLS.join(' y ')}. No uses la URL como si fuera su contenido ni presentes recuerdo del modelo como adquisición. Con su contenido responde únicamente un objeto JSON con estas claves: exampleSecondLevel (array con los tres dominios de segundo nivel que enumera la sección 3 de RFC 2606, en ese orden), exampleComAvailableForRegistration (boolean según IANA), ianaReferencesRfc2606 (boolean que indique si la página IANA remite explícitamente a ese RFC), independentCorroborationEstablished (boolean: dos dominios HTTP distintos no bastan para acreditar dos raíces probatorias independientes), provenanceReason (explicación breve en español de la relación normativa observada y sus límites), scope (elige documentary-policy o operational-dns-test según lo realmente comprobado), sourceEvidence (array de exactamente dos objetos {url,quote}, uno por fuente, con cita breve literal de su contenido que respalde las respuestas). No afirmes haber probado DNS operativo, disponibilidad de servicios ni independencia de autores por el solo hecho de consultar dos sitios. No escribas archivos, no ejecutes código y no consultes otras páginas.`}
]);

// External fixture oracle, never supplied to a producer or reviewer. Does not
// certify the prose argument's semantics; those receive a separate reading.
export function assessCatalogAnswer(caseId,body,sources=[]){
  let value;try{value=JSON.parse(body);}catch{return {passed:false,checks:{json:false}};}
  if(caseId==='closed-catalog')return {passed:canonical(value)===canonical(['árbol','mar','sol']),checks:{exactArray:canonical(value)===canonical(['árbol','mar','sol'])}};
  if(caseId!=='documentary-catalog')throw Error('Unknown catalog case');
  const object=value&&typeof value==='object'&&!Array.isArray(value);
  const expectedKeys=['exampleSecondLevel','exampleComAvailableForRegistration','ianaReferencesRfc2606','independentCorroborationEstablished','provenanceReason','scope','sourceEvidence'];
  const evidence=object&&Array.isArray(value.sourceEvidence)?value.sourceEvidence:[];
  const checks={jsonObject:!!object,exactKeys:!!object&&canonical(Object.keys(value).sort())===canonical(expectedKeys.sort()),
    threeDomains:canonical(value?.exampleSecondLevel??null)===canonical(['example.com','example.net','example.org']),
    notRegistrable:value?.exampleComAvailableForRegistration===false,
    explicitReference:value?.ianaReferencesRfc2606===true,
    noFalseIndependence:value?.independentCorroborationEstablished===false,
    documentaryScope:value?.scope==='documentary-policy',
    reasonPresent:typeof value?.provenanceReason==='string'&&value.provenanceReason.trim().length>=20,
    bothExactQuotes:evidence.length===2&&CATALOG_SOURCE_URLS.every(url=>evidence.filter(e=>e?.url===url).length===1)&&evidence.every(e=>e&&canonical(Object.keys(e).sort())===canonical(['quote','url'])&&typeof e.quote==='string'&&e.quote.length>=8&&e.quote.length<=400&&sources.some(s=>s.url===e.url&&s.httpStatus===200&&s.status==='ADMITTED'&&s.raw.includes(e.quote)))};
  return {passed:Object.values(checks).every(Boolean),checks,semanticScope:'Structured values, exact observed quotations and declared limits only. Prose entailment still needs semantic review.'};
}
