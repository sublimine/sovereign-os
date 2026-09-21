// The oracle is NOT passed to the mission. Reference pages were inspected on
// 2026-09-09; if their acquired contents change, investigate instead of retuning
// an expected answer after seeing the model result.
export const urls=['https://www.sqlite.org/foreignkeys.html','https://www.sqlite.org/compile.html'];
export const request='Contrasta las fuentes primarias https://www.sqlite.org/foreignkeys.html y https://www.sqlite.org/compile.html (sección SQLITE_DEFAULT_FOREIGN_KEYS). Recupera ambas antes de verificar los hechos. Determina si la descripción del estado predeterminado de las claves foráneas contradice realmente la opción de compilación; distingue el caso general, una compilación con SQLITE_DEFAULT_FOREIGN_KEYS=1, la configuración por conexión y el intento de cambiarla dentro de una transacción ya abierta. No confundas dos documentos del mismo proyecto con dos raíces de evidencia demostradas como independientes. No ejecutes SQLite, no crees archivos y no atribuyas a esta VPS un valor que no has medido. Somete el resultado a revisión independiente. Devuelve sólo un objeto JSON en español con estas claves: predeterminado_general (ON, OFF o DESCONOCIDO), compilacion_con_flag_1 (ON, OFF o DESCONOCIDO), ajuste_por_conexion (booleano), cambio_dentro_transaccion (se_aplica, sin_efecto, error o desconocido), relacion_documentos (incompatibles, compatibles_condicionalmente o no_resuelta), independencia_demostrada (booleano), estado_local_medido (booleano), explicacion (texto breve con salvedades) y fuentes (array con una entrada por página, cada una con url y cita literal de como máximo 12 palabras). Conserva las premisas y distingue afirmaciones documentales de inferencias. No inventes observaciones ni autocertifiques la aceptación.';
const expected={predeterminado_general:'OFF',compilacion_con_flag_1:'ON',ajuste_por_conexion:true,cambio_dentro_transaccion:'sin_efecto',
  relacion_documentos:'compatibles_condicionalmente',independencia_demostrada:false,estado_local_medido:false};
const page=url=>{const u=new URL(url);u.hash='';return u.href;};
export function assessMultisourceAnswer(body,sources){
  let answer;try{answer=JSON.parse(body);}catch{return {passed:false,parse:false,reason:'Final body is not the requested JSON object'};}
  if(!answer||Array.isArray(answer)||typeof answer!=='object')return {passed:false,parse:false};
  const exactKeys=JSON.stringify(Object.keys(answer).sort())===JSON.stringify([...Object.keys(expected),'explicacion','fuentes'].sort());
  const fields=Object.fromEntries(Object.entries(expected).map(([k,v])=>[k,answer[k]===v]));
  let citations=false;
  try{citations=Array.isArray(answer.fuentes)&&answer.fuentes.length===urls.length&&urls.every(url=>{
    const entries=answer.fuentes.filter(s=>typeof s.url==='string'&&page(s.url)===url);
    return entries.length===1&&typeof entries[0].cita==='string'&&entries[0].cita.trim().length>0&&entries[0].cita.trim().split(/\s+/u).length<=12
      &&sources.some(source=>page(source.url)===url&&source.raw.includes(entries[0].cita));
  });}catch{/* Unparseable or fabricated citations fail, never become passing evidence. */}
  const explanation=typeof answer.explicacion==='string'&&answer.explicacion.length>=30;
  return {passed:exactKeys&&Object.values(fields).every(Boolean)&&citations&&explanation,parse:true,exactKeys,fields,citations,explanation,
    caveat:'Frozen structured factual checks and exact quotes, not a universal semantic judge. Independent mission review evaluates explanation and coverage.'};
}
