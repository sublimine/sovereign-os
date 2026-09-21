import {canonical} from '../../factory/lib/contracts.mjs';
import {CATALOG_LIVE_CASES,CATALOG_SOURCE_URLS,assessCatalogAnswer} from './catalog-live-cases.mjs';
export const TRACE_CASE=CATALOG_LIVE_CASES.find(c=>c.id==='documentary-catalog');
export const ORACLE_V2_SCOPE='Version 2 removes only the undocumented 400-character quote ceiling of the original external oracle. The user requested a brief literal supporting passage, not a character limit. Exact URL, schema, quote bytes and every structured answer remain checked. Brevity and substantive support require the independent semantic review; quote lengths remain visible. Original oracle result is preserved alongside the reassessment.';
export function assessTraceAnswer(body,sources){
  const original=assessCatalogAnswer(TRACE_CASE.id,body,sources);
  let value;try{value=JSON.parse(body);}catch{return {...original,originalOracle:original,scope:ORACLE_V2_SCOPE};}
  const evidence=Array.isArray(value?.sourceEvidence)?value.sourceEvidence:[];
  const exact=evidence.length===2&&CATALOG_SOURCE_URLS.every(url=>evidence.filter(e=>e?.url===url).length===1)&&evidence.every(e=>e&&canonical(Object.keys(e).sort())===canonical(['quote','url'])&&typeof e.quote==='string'&&e.quote.length>=8&&sources.some(s=>s.url===e.url&&s.httpStatus===200&&s.status==='ADMITTED'&&s.raw.includes(e.quote)));
  const checks={...original.checks,bothExactQuotes:exact};
  return {passed:Object.values(checks).every(v=>v===true),checks,originalOracle:original,quoteLengths:evidence.map(e=>({url:e?.url??null,length:typeof e?.quote==='string'?e.quote.length:null})),scope:ORACLE_V2_SCOPE};
}
