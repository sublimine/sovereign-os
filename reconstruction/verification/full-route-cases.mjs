// Operator-authored calibration cases. Requests are model input; expectations
// stay outside the model context. These are known cases, not a broad holdout.
import {canonical} from '../../factory/lib/contracts.mjs';

export const DOCUMENT_URLS=Object.freeze({sqlite:'https://www.sqlite.org/lang_select.html',
  postgresql:'https://www.postgresql.org/docs/current/queries-select-lists.html'});
export const DEVELOPMENT_FILES=Object.freeze(['README.md','merge-windows.mjs','merge-windows.test.mjs']);
export const DEVELOPMENT_COMMAND=Object.freeze(['node','--test','merge-windows.test.mjs']);

export const FULL_ROUTE_CASES=[{
  id:'orders-last-record',family:'transformation',modes:['adaptive','planned'],allowedTools:[],maxCalls:8,
  request:'Transforma sólo los registros JSON siguientes. Para cada id conserva únicamente su ÚLTIMA aparición en el array (también si cambia cliente o queda cancelled); después filtra status=paid. Agrupa por customer, suma amountCents como enteros y cuenta pedidos retenidos. Incluye únicamente clientes con al menos un pedido paid, incluso si su total es cero. Ordena por customer mediante orden de puntos de código, sin cambiar mayúsculas ni acentos. Devuelve únicamente el array JSON, sin Markdown ni explicación, con exactamente customer, totalCents y orders en cada objeto. No consultes fuentes externas, crees archivos ni ejecutes código.\n'+JSON.stringify([
    {id:'p1',customer:'Zoë',amountCents:499,status:'paid'},
    {id:'p2',customer:'Alicia',amountCents:1250,status:'paid'},
    {id:'p3',customer:'Rui',amountCents:800,status:'pending'},
    {id:'p4',customer:'Alicia',amountCents:175,status:'paid'},
    {id:'p1',customer:'Rui',amountCents:999,status:'paid'},
    {id:'p2',customer:'Alicia',amountCents:1250,status:'cancelled'},
    {id:'p5',customer:'Zoë',amountCents:230,status:'paid'},
    {id:'p6',customer:'Nora',amountCents:900,status:'paid'},
    {id:'p3',customer:'Rui',amountCents:800,status:'paid'},
    {id:'p6',customer:'Nora',amountCents:900,status:'cancelled'},
    {id:'p7',customer:'Alicia',amountCents:0,status:'paid'},
    {id:'p8',customer:'Éva',amountCents:0,status:'paid'}]),
  expected:[{customer:'Alicia',totalCents:175,orders:2},{customer:'Rui',totalCents:1799,orders:2},
    {customer:'Zoë',totalCents:230,orders:1},{customer:'Éva',totalCents:0,orders:1}],
},{
  id:'distinct-two-publishers',family:'sources',modes:['adaptive'],allowedTools:['source.fetch'],maxCalls:12,
  request:`Recupera ahora estas dos páginas primarias: ${DOCUMENT_URLS.sqlite} y ${DOCUMENT_URLS.postgresql}. Para SELECT DISTINCT (no DISTINCT ON ni UNION), determina por separado en SQLite y PostgreSQL si elimina filas duplicadas y si dos NULL se consideran iguales al detectar duplicados. No extrapoles a otros operadores, no afirmes haber probado bases de datos, y no sustituyas la recuperación por conocimiento recordado. Usa sólo esas páginas; no crees archivos ni ejecutes código. Revisa apoyo factual y alcance antes de entregar. Devuelve únicamente un objeto JSON con las claves sqlite, postgresql y scope. Cada motor contiene exactamente duplicateRows (removed, retained o unknown), nulls (equal, different o unknown), url (URL de la página primaria consultada) y quote (un pasaje literal de la fuente recuperada, de 1 a 25 palabras, que respalde el tratamiento de NULL). scope debe ser documented-only. Conserva unknown si la documentación no permite resolverlo; no inventes citas.`,
  expected:{sqlite:{duplicateRows:'removed',nulls:'equal'},postgresql:{duplicateRows:'removed',nulls:'equal'},scope:'documented-only'},
},{
  id:'merge-integer-windows',family:'development',modes:['adaptive'],
  allowedTools:['workspace.list','workspace.read','workspace.write','execution.run'],maxCalls:18,
  request:'Desarrolla en el workspace de la misión exactamente tres archivos: merge-windows.mjs, merge-windows.test.mjs y README.md, sin dependencias externas. Exporta coalesceRanges(ranges) en merge-windows.mjs. ranges es un array denso de pares densos [start,end] de enteros seguros de JavaScript, con start<=end. Cada par representa un intervalo cerrado de enteros. Devuelve un array nuevo de pares nuevos, ordenado por start, con la unión mínima: fusiona solapamientos Y adyacencia (por ejemplo [1,2] y [3,4] producen [1,4]); conserva los huecos. Acepta [] y números negativos; normaliza -0 a 0; no modifiques ni retengas como salida arrays de entrada, aunque estén congelados. Lanza TypeError por tipos, estructura, arrays dispersos, valores no enteros seguros, NaN o infinitos; lanza RangeError por un par válido cuyo start>end. Maneja los extremos MIN_SAFE_INTEGER y MAX_SAFE_INTEGER sin perder precisión. La importación y la función no deben hacer I/O ni ejecutar procesos. Crea pruebas node:test con casos normales, solapamiento, adyacencia, huecos, duplicados, permutaciones, extremos, entradas inválidas e inmutabilidad. Ejecuta exactamente node --test merge-windows.test.mjs desde la raíz de la misión; no basta escribir el comando o simular su salida. README.md explica contrato, uso, complejidad y cómo ejecutar las pruebas. Entrega sólo tras revisión independiente de los tres archivos y repetición independiente de las pruebas sobre la misma versión. No uses web, instalaciones, API, credenciales ni publicaciones.',
  expected:{files:DEVELOPMENT_FILES,command:DEVELOPMENT_COMMAND},
}];

// Explicit user-visible boundary, frozen with the case before any dispatch.
FULL_ROUTE_CASES[2].request+=' Sólo puedes listar la raíz, leer o escribir esos tres nombres exactos y ejecutar ese único comando; no crees subdirectorios ni ejecutes comandos auxiliares.';

export function sourceUrlMatches(engine,url){
  if(url===DOCUMENT_URLS[engine])return true;
  if(engine!=='postgresql'||typeof url!=='string')return false;
  try{const u=new URL(url);return u.origin==='https://www.postgresql.org'&&!u.search&&!u.hash
    &&/^\/docs\/[0-9]+\/queries-select-lists\.html$/.test(u.pathname);}catch{return false;}
}

// Call only AFTER JSON.parse has accepted the full grammar. Inspect original
// string/structural tokens because parsed objects have already lost duplicate
// members. Strings consume their escapes atomically; punctuation inside them
// cannot create scopes. A name is a string followed by ':' in valid JSON.
function hasDuplicateObjectNames(text){
  const scopes=[],tokens=/"(?:[^"\\]|\\[\s\S])*"|[{}\[\]]/g;
  for(const match of text.matchAll(tokens)){
    const token=match[0];
    if(token==='{'){scopes.push(new Set());continue;}
    if(token==='['){scopes.push(null);continue;}
    if(token==='}'||token===']'){scopes.pop();continue;}
    let next=match.index+token.length;
    while(/[ \t\r\n]/.test(text[next]??''))next++;
    if(text[next]!==':')continue;
    const names=scopes.at(-1),name=JSON.parse(token);
    if(names.has(name))return true;
    names.add(name);
  }
  return false;
}

/** Content oracle only. Source rows must come from independently verified
 * acquisition records; strings supplied by a producer are not those records.
 * It does not certify routing, real calls, reviews, effects or general truth.
 */
export function gradeRouteContent(spec,body,{sources=[]}={}){
  const fail=reason=>({passed:false,reason});let value;
  try{if(typeof body!=='string')return fail('BODY_MISSING');value=JSON.parse(body);}catch{return fail('BODY_JSON');}
  if(hasDuplicateObjectNames(body))return fail('BODY_DUPLICATE_KEYS');
  if(spec.family==='transformation'){
    try{return {passed:canonical(value)===canonical(spec.expected),reason:'EXACT_TRANSFORMATION'};}
    catch{return fail('NONCANONICAL_TRANSFORMATION');}
  }
  if(spec.family!=='sources')return fail('EXTERNAL_EXECUTION_REQUIRED');
  const exact=(object,keys)=>object!==null&&typeof object==='object'&&!Array.isArray(object)
    &&canonical(Object.keys(object).sort())===canonical([...keys].sort());
  if(!exact(value,['sqlite','postgresql','scope'])||value.scope!==spec.expected.scope)return fail('SOURCE_SCOPE');
  const evidence=[];
  for(const name of ['sqlite','postgresql']){
    const row=value[name];if(!exact(row,['duplicateRows','nulls','url','quote'])
      ||row.duplicateRows!==spec.expected[name].duplicateRows||row.nulls!==spec.expected[name].nulls)return fail('SOURCE_FACT');
    if(typeof row.quote!=='string'||row.quote.trim()!==row.quote||!row.quote||row.quote.split(/\s+/).length>25
      ||!sourceUrlMatches(name,row.url))return fail('SOURCE_CITATION');
    const source=sources.find(s=>sourceUrlMatches(name,s.url)&&s.url===row.url&&typeof s.raw==='string'&&s.raw.includes(row.quote));
    if(!source)return fail('SOURCE_NOT_OBSERVED');
    // A literal occurrence alone is insufficient: the passage must actually
    // contain the documented NULL-equality proposition, not merely its label.
    if(!/\bnull\s+values\s+are\s+considered\s+(?:to\s+be\s+)?equal\b/i.test(row.quote))return fail('SOURCE_PASSAGE_SCOPE');
    evidence.push({engine:name,sourceId:source.id,url:source.url,quote:row.quote});
  }
  return {passed:true,reason:'DOCUMENTED_DISTINCT',evidence};
}
