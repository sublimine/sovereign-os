// Frozen planning-only qualification. These requests are benchmark data, not
// production instructions. Gold expectations never enter the model's context.
import {canonical} from '../../factory/lib/contracts.mjs';
export const ROUTING_CASES=[
  {id:'closed-arithmetic',request:'Calcula la media aritmética de 12, 7 y 5 y explica brevemente la operación. No consultes fuentes externas, no crees archivos y no ejecutes código.',
    allowedTools:[],criticalQuotes:['media aritmética de 12, 7 y 5','No consultes fuentes externas','no crees archivos','no ejecutes código'],
    gold:{maxNodes:1,minNodes:1,sourceFetch:false,files:[],execution:null},
    rationale:'One closed calculation and its explanation share inputs and acceptance; no distinct intermediate product or effect is requested.'},
  {id:'bounded-source-question',request:'Lee https://www.sqlite.org/foreignkeys.html y dime si las claves foráneas están activadas por defecto en la configuración normal que describe esa página y cómo se activan por conexión. Cita pasajes exactos, conserva las condiciones y distingue la documentación de una prueba ejecutada. No ejecutes código ni crees archivos.',
    allowedTools:['source.fetch'],criticalQuotes:['Lee https://www.sqlite.org/foreignkeys.html','cómo se activan por conexión','Cita pasajes exactos','conserva las condiciones','distingue la documentación de una prueba ejecutada','No ejecutes código ni crees archivos'],
    gold:{maxNodes:1,minNodes:1,sourceFetch:true,files:[],execution:null},
    rationale:'Reading the named source precedes the factual candidate within one product. An extra product just to repeat the fetched source or announce acceptance is not necessary.'},
  {id:'small-tested-module',request:'Crea únicamente stats.mjs y stats.test.mjs. Exporta desde stats.mjs una función mean que acepte un array no vacío de números finitos y devuelva su media; rechaza con TypeError cualquier entrada fuera de ese dominio, incluido un array vacío. No añadas dependencias ni consultes la red. Incluye pruebas de entradas válidas e inválidas en stats.test.mjs y ejecútalas con node --test stats.test.mjs. Entrega ambos archivos después de una revisión independiente de su contenido y del resultado de las pruebas.',
    allowedTools:['workspace.write','workspace.read','workspace.list','execution.run'],
    criticalQuotes:['Crea únicamente stats.mjs y stats.test.mjs','un array no vacío de números finitos','TypeError','incluido un array vacío','No añadas dependencias ni consultes la red','node --test stats.test.mjs','revisión independiente'],
    gold:{maxNodes:1,minNodes:1,sourceFetch:false,files:['stats.mjs','stats.test.mjs'],execution:['node','--test','stats.test.mjs']},
    rationale:'Implementation and supplied tests can be one frozen file product with a separate reviewer/rerun. This is not a request for independent blind test generation.'},
  {id:'blind-protocol-integration',request:'Diseña un protocolo en memoria para reservar una plaza con capacidad uno: reserve(id), confirm(id) y cancel(id). Decide explícitamente las reglas de repetición y de conflicto entre identificadores. Necesito dos productos previos independientes: una especificación de estados e invariantes y, sin ver esa especificación, un conjunto de escenarios adversarios con resultados esperados derivados sólo de esta petición. Cada producto previo debe ser revisado antes de usarlo. Después compara ambos productos aceptados, identifica sus desacuerdos y produce una especificación integrada que conserve los contraejemplos sin afirmar que se ha ejecutado software. No crees archivos, no ejecutes código ni consultes fuentes externas.',
    allowedTools:[],criticalQuotes:['capacidad uno','reserve(id), confirm(id) y cancel(id)','reglas de repetición y de conflicto','dos productos previos independientes','sin ver esa especificación','resultados esperados derivados sólo de esta petición','Cada producto previo debe ser revisado antes de usarlo','identifica sus desacuerdos','conserve los contraejemplos','sin afirmar que se ha ejecutado software','No crees archivos, no ejecutes código ni consultes fuentes externas'],
    gold:{minNodes:3,maxNodes:null,sourceFetch:false,files:[],execution:null,independentParents:true},
    rationale:'The author explicitly requires two blind independent products accepted before their comparison. A single producer or sequential contaminated dependency violates that requirement.'},
];
function quoteCovered(request,requirements,needle){
  const begin=request.indexOf(needle);if(begin<0)return false;
  const covered=new Set();
  for(const r of requirements){if(typeof r.requestQuote!=='string'||!r.requestQuote)continue;
    // Quotes need unique positional attribution here; these requests have no
    // repeated critical clauses, so ambiguity is a failure rather than a guess.
    const at=request.indexOf(r.requestQuote);if(at<0||request.indexOf(r.requestQuote,at+1)>=0)continue;
    for(let i=Math.max(at,begin);i<Math.min(at+r.requestQuote.length,begin+needle.length);i++)covered.add(i);
  }
  return covered.size===needle.length;
}
export function gradeRouting(caseSpec,plan){
  if(!plan)return {passed:false,checks:{acceptedPlanPresent:false},uncoveredQuotes:[...caseSpec.criticalQuotes],scope:'No plan available; not delivery.'};
  const nodes=plan.nodes,tools=[...new Set(nodes.flatMap(n=>n.tools))].sort();
  const effects=nodes.flatMap(n=>n.requiredEffects),files=[...new Set(effects.filter(e=>e.type==='file').map(e=>e.path))].sort();
  const executions=effects.filter(e=>e.type==='execution');
  const exactCommand=e=>{try{return canonical(JSON.parse(e.command))===canonical(caseSpec.gold.execution);}catch{return false;}};
  const missing=caseSpec.criticalQuotes.filter(q=>!quoteCovered(caseSpec.request,plan.requirements,q));
  const checks={acceptedPlanPresent:true,
    proportionalProductCount:nodes.length>=caseSpec.gold.minNodes&&(caseSpec.gold.maxNodes===null||nodes.length<=caseSpec.gold.maxNodes),
    authorityPreserved:tools.every(t=>caseSpec.allowedTools.includes(t)),
    sourceAcquisitionPlanned:tools.includes('source.fetch')===caseSpec.gold.sourceFetch,
    exactRequestedFileSet:canonical(files)===canonical([...caseSpec.gold.files].sort()),
    exactRequiredExecution:caseSpec.gold.execution===null?executions.length===0:executions.length>0&&executions.every(e=>e.path==='.'&&e.expectedExit===0&&exactCommand(e)),
    literalCriticalClausesCovered:missing.length===0};
  if(caseSpec.gold.independentParents){
    const byId=new Map(nodes.map(n=>[n.id,n]));
    const ancestors=node=>{const seen=new Set();const visit=n=>{for(const d of n.dependencies){if(seen.has(d.nodeId))continue;seen.add(d.nodeId);visit(byId.get(d.nodeId));}};visit(node);return seen;};
    const final=byId.get(plan.finalNodeId),parents=final?ancestors(final):new Set();
    const roots=nodes.filter(n=>n.dependencies.length===0&&parents.has(n.id));
    checks.distinctBlindUpstreamProducts=roots.length>=2;
  }
  return {passed:Object.values(checks).every(Boolean),checks,uncoveredQuotes:missing,
    chosen:{nodeCount:nodes.length,tools,files,executionCount:executions.length,
      nodes:nodes.map(n=>({id:n.id,purpose:n.purpose,roleIds:n.roleIds,reviewerRoleIds:n.reviewerRoleIds,dependencies:n.dependencies,method:n.method,specialist:n.specialist}))},
    scope:'Planning structure, quoted request coverage and declared effects only. Literal coverage does not prove substantive criteria or role fitness; full semantic audit remains required. No product execution or general optimality claim.'};
}
