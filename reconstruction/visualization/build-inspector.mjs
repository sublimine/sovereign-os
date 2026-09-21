import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {Store} from '../../factory/lib/store.mjs';
import {missionReport} from '../../factory/lib/report.mjs';
import {getRole} from '../../factory/catalog/index.mjs';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {unpackJsonContext} from '../../factory/lib/context-json-codec.mjs';
import {unpackContext} from '../../factory/lib/context-codec.mjs';
import {exposedArtifacts,projectClosedExperiments,projectRejectedReview} from './closed-projection.mjs';
import {projectControllerEntries,projectSourceRecords,projectMaterialSequence,projectClosedCaseClassification} from './entry-projection.mjs';

const historicalSpecs=[
  {label:'Cartera · aceptada tras recuperar registros de aprobación',directory:'sovereign-portfolio-gates-live-b0zgffSZ'},
  {label:'Cartera · bloqueo de aprobación anterior conservado',directory:'sovereign-portfolio-recovery-live-7NHFBdRo'},
  {label:'Cartera Astra · bloqueo de contexto original',directory:'sovereign-portfolio-live-GVMb9wMM'},
  {label:'Concurrencia de productos puros · cualificación',directory:'sovereign-pure-parallel-live-Ikayye8G'},
  {label:'Contraste de dos fuentes · completado',directory:'sovereign-multisource-live-fXM8DG2h'},
  {label:'Recuperación entre procesos · completada',directory:'sovereign-production-recovery-live-8iIZV7fG'},
  {label:'Recuperación anterior · fallida',directory:'sovereign-production-recovery-live-WUrROCPs'},
  {label:'Coste de tres archivos · referencia',directory:'sovereign-final-coverage-live-jtd854PN/baseline'},
  {label:'Coste de tres archivos · regresión',directory:'sovereign-final-coverage-live-jtd854PN/candidate'},
];
const [output,replace,profile='historical']=process.argv.slice(2);
if(!['historical','adaptive','specialists','closed','qualification','sources'].includes(profile))throw Error('Known snapshot profile required');
const adaptiveSpecs=[
  {label:'Media · entrada cerrada y revisión independiente',directory:'sovereign-closed-entry-live-UndLIqUb/closed-json-mean-direct'},
  {label:'Media · plan completo, incluido rechazo de hash',directory:'sovereign-closed-entry-live-UndLIqUb/closed-json-mean-planned'},
  {label:'Transformación · entrada cerrada',directory:'sovereign-closed-entry-live-UndLIqUb/literal-transform-direct'},
  {label:'Transformación · plan completo',directory:'sovereign-closed-entry-live-UndLIqUb/literal-transform-planned'},
  {label:'Fuentes · sólo decisión de derivación, sin producto',directory:'sovereign-closed-entry-live-UndLIqUb/source-required-direct'},
  {label:'Archivos/pruebas · sólo decisión, sin producto',directory:'sovereign-closed-entry-live-UndLIqUb/file-test-required-direct'},
  {label:'Cálculos ciegos · sólo decisión, sin producto',directory:'sovereign-closed-entry-live-UndLIqUb/blind-products-required-direct'},
  {label:'Petición mixta · sólo decisión, sin producto',directory:'sovereign-closed-entry-live-UndLIqUb/mixed-current-fact-direct'},
  {label:'Catálogo de evidencia · respuesta cerrada',directory:'sovereign-catalog-live-IcWvS5Z8/closed-catalog'},
  {label:'Catálogo de evidencia · adquisición documental',directory:'sovereign-catalog-live-IcWvS5Z8/documentary-catalog'},
  {label:'Catálogo y traza HTTP · nueva adquisición aceptada',directory:'sovereign-catalog-trace-live-BoYUO09A'},
  {label:'Contratos propios · productos correctos, fallo de rol',directory:'sovereign-node-plan-view-live-h53t6RZV',captureProviderRequests:true,
    auditFinding:{status:'ASIGNACIÓN NO CONFORME',roleId:'veritas_04',
      observation:'Los dos jueces recibieron el candidato antes de inferir. La ficha exige réplica sellada antes de abrir el original. Las cuentas correctas y el ACCEPT histórico no acreditan ese método.',
      reviewId:'review:50f4dcb7-3c3e-4947-80a8-65efdcb77977',quote:'This manual review is not a sealed blind replication.',
      document:'reconstruction/design/ROLE-EXECUTION-COMPATIBILITY.md'}},
  {label:'Orden de evidencia · bloqueo bilateral conservado',directory:'sovereign-role-contract-live-MztBjXHC',captureProviderRequests:true,
    auditFinding:{status:'EVIDENCIA FUERA DE SU FRONTERA',target:'gates de los prerrequisitos',
      observation:'Los cálculos pasaron; cada gate exigía también el historial del hermano, que no estaba expuesto. Ambos productores posteriores declararon bloqueo y la integración no empezó. No se han cambiado los criterios ni los juicios originales.',
      reviewId:'review:cbcb890f-1261-4a49-9b40-53e7730ef768',quote:'Missing sibling exposure evidence prevents complete acceptance; it does not establish contamination.',
      document:'reconstruction/verification/ROLE-CONTRACT-RESULTS.md'}},
];
const specialistSpecs=[
  {label:'Asignaciones · tres rechazos y límite estructural conservados',directory:'sovereign-review-boundary-live-Cli4mRSN',captureProviderRequests:true},
  {label:'Especialistas · misión con recuperación registrada',directory:'sovereign-standalone-live-rjsI0udG',captureProviderRequests:true,
    auditReport:'reconstruction/verification/feedback-recovery-b6jLY0q2-audit.json',
    additionalCaptureDirectories:['sovereign-accepted-scopes-recovery-monpYO0G','sovereign-feedback-recovery-b6jLY0q2'],
    historicalOutcomes:['sovereign-standalone-live-rjsI0udG/summary.json','sovereign-accepted-scopes-recovery-monpYO0G/summary.json','sovereign-feedback-recovery-b6jLY0q2/summary.json']},
];
const closedSpecs=[
  {label:'Primer recorrido · UNKNOWN sellado, sin comparación',directory:'planned-blind-live-rB9KdY'},
  {label:'Revisión del mismo UNKNOWN · ACCEPT contradictorio rechazado',directory:'unknown-assessment-live-a1RAAY'},
  {label:'Nuevo recorrido prospectivo · snapshot del registro',directory:'planned-blind-live-xMileM'},
].map(s=>({...s,sourceRoot:resolve(new URL('../verification/runs/',import.meta.url).pathname),closedRecords:true}));
const qualificationSpecs=[{label:'Recorrido integrado · petición, productos y juicios completos',
  directory:'planned-blind-live-ODeAyj',sourceRoot:resolve(new URL('../verification/runs/',import.meta.url).pathname),closedRecords:true}];
const sourceSpecs=[
  {label:'Respuesta con fuentes · producción y juez reales · aceptada',directory:'sourced-response-live-xPHjHG'},
  {label:'Contracaso · productor simulado, juez real · rechazado',directory:'sourced-countercase-live-01EeX4'},
].map(s=>({...s,sourceRoot:resolve(new URL('../verification/runs/',import.meta.url).pathname),sourceRecords:true,caseClassification:true}));
const specs=profile==='adaptive'?adaptiveSpecs:profile==='specialists'?specialistSpecs:profile==='closed'?closedSpecs:profile==='qualification'?qualificationSpecs:profile==='sources'?sourceSpecs:historicalSpecs;
if(!output||fs.existsSync(output)&&replace!=='--replace-snapshot')throw Error('New path or explicit --replace-snapshot required');
const prior=fs.existsSync(output)?fs.readFileSync(output):null;
if(prior){const stat=fs.lstatSync(output);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw Error('Replace only a regular owned snapshot');}
const roles={},evidence={},products={},closedRecords={},proofIds=new Map();
const compactReview=r=>({...r,result:{...r.result,checks:r.result.checks.map(({evidence:proofs,...check})=>({...check,evidenceIds:proofs.map(proof=>{
  const key=canonical(proof);if(!proofIds.has(key)){const id='proof-'+proofIds.size;proofIds.set(key,id);evidence[id]=proof;}return proofIds.get(key);
})}))}});
const missions=specs.map(spec=>{
  const stateDir=join(spec.sourceRoot??'/home/cardeex/codex-workspace',spec.directory),databasePath=join(stateDir,'state.sqlite');
  const db=new DatabaseSync(databasePath,{readOnly:true,allowExtension:false,defensive:true});
  const store={db,get:Store.prototype.get,list:Store.prototype.list,events:Store.prototype.events};
  try{
    db.exec('BEGIN'); // Coherent read-only snapshot even while its mission advances.
    const mission=store.list('mission').find(r=>r.data.status==='COMPLETED')??store.list('mission')[0];if(!mission)throw Error('No mission in selected record');
    const journal=Store.prototype.verifyJournal.call(store),report=missionReport(store,mission.id),planRecord=store.get('plan',mission.id);
    const artifacts=store.list('artifact').filter(r=>r.data.missionId===mission.id);
    const plannerRuns=new Set(store.list('run').filter(r=>r.data.missionId===mission.id&&r.data.nodeId==='planning'&&r.data.mode==='producer').map(r=>r.id));
    const progress=store.get('planning-progress',mission.id);
    const planningRecovery=progress?{recordId:progress.id,recordHash:progress.hash,attempts:progress.data.attempts,qualityFailures:progress.data.qualityFailures,
      structuredRejections:store.list('worker-rejected-output').filter(r=>plannerRuns.has(r.data.runId)).map(r=>({recordId:r.id,recordHash:r.hash,...r.data}))}:null;
    const captureDirectories=[stateDir,...(spec.additionalCaptureDirectories??[]).map(d=>join('/home/cardeex/codex-workspace',d))];
    const requestCaptures=spec.captureProviderRequests?captureDirectories.flatMap(d=>fs.readdirSync(d).filter(n=>/^request-\d+\.json$/.test(n)).map(n=>join(d,n))).map(path=>{
      const capture=JSON.parse(fs.readFileSync(path,'utf8'));
      if(capture.requestHash!==inferenceRequestHash(capture.request))throw Error('Captured provider request hash changed');
      const run=store.get('run',capture.runId)?.data;
      // A file can appear after this coherent database snapshot. Include only
      // requests already present in its journal, never guess a future exposure.
      if(!run?.requests?.some(r=>r.requestHash===capture.requestHash))return null;
      const wire=JSON.parse(capture.request.input),input=wire.encoding==='sovereign.lossless-context.v2'?unpackJsonContext(wire):wire.encoding==='sovereign.lossless-context.v1'?unpackContext(wire):wire;
      return {path,capturedAt:capture.capturedAt,runId:capture.runId,requestHash:capture.requestHash,
        completed:run.inferenceReceipts?.some(r=>r.contextHash===capture.requestHash)??false,
        planViews:input.planViews??[],exposedArtifactIds:exposedArtifacts(input),
        runtimeScopes:(input.runtimeObservations??[]).filter(o=>o.kind==='artifact-production-scope').map(o=>({id:o.id,hash:o.hash,detail:JSON.parse(o.quoteText).detail}))};
    }).filter(Boolean):[];
    const producerExposures=nodeId=>store.list('run').filter(r=>r.data.missionId===mission.id&&r.data.mode==='producer'&&r.data.nodeId===nodeId&&r.data.context.planViews?.length).map(record=>{
      const run=record.data,config=store.get('worker-config',run.id)?.data;
      const views=run.context.planViews.map(view=>{
        const origin=store.get('artifact',view.artifactId)?.data;
        if(!origin||origin.payloadHash!==view.artifactHash||sha256(origin.payload)!==view.artifactHash||sha256(view.view)!==view.viewHash)throw Error('Projected contract identity differs');
        const requests=requestCaptures.filter(c=>c.runId===run.id&&c.planViews.some(v=>v.artifactId===view.artifactId));
        if(requests.some(c=>c.planViews.some(v=>v.artifactId===view.artifactId&&canonical(v)!==canonical(view))||c.exposedArtifactIds.includes(view.artifactId)))throw Error('Provider received a different plan projection');
        return {...view,providerRequests:requests.map(({planViews,...capture})=>capture)};
      });
      return {runId:run.id,recordHash:record.hash,contextHash:run.contextHash,producerContext:config?.compilationScope.producerContext??null,
        cardEncoding:config?.compilationScope.cardEncoding??'pretty-json',views};
    });
    const planArtifact=planRecord?store.get('artifact',planRecord.data.acceptedPlanArtifactId)?.data:
      artifacts.filter(a=>a.data.payload.kind==='mission-plan').sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).at(-1)?.data;
    const stageProducts=nodeId=>artifacts.filter(a=>a.data.payload.nodeId===nodeId).map(({data:a})=>{
      products[a.payloadHash]??={id:a.id,hash:a.payloadHash,kind:a.payload.kind,purpose:a.payload.purpose,body:a.payload.body,inputRefs:a.payload.inputRefs};
      return {key:a.payloadHash,status:a.status};
    });
    const material=report.nodes.map(node=>({id:node.id,title:node.title,status:node.status,roleIds:node.roles,reviewerRoleIds:node.reviewers,execution:node.execution??null,
      ...(node.specialist?{specialist:node.specialist,specialistMode:node.specialistMode,specialistExecutions:node.specialistExecutions}:{}),
      dependencies:node.dependencies,method:node.method,criteria:node.criteria,requiredEffects:node.requiredEffects,artifactId:node.artifactId,history:node.history,
      instructions:report.plan?.nodes.find(n=>n.id===node.id)?.instructions??'',
      products:stageProducts(node.id),producerExposures:producerExposures(node.id),
      reviews:report.reviews.filter(r=>artifacts.some(a=>a.id===r.artifactId&&a.data.payload.nodeId===node.id)).map(compactReview)}));
    const planning=planArtifact?{id:'planning',title:'Planificación y revisión del plan',status:planArtifact.status,
      roleIds:['omega_04','omega_05'],reviewerRoleIds:['omega_22'],dependencies:[],
      method:{id:'planificación',rationale:(report.plan??JSON.parse(planArtifact.payload.body)).routingRationale,alternatives:[]},criteria:planArtifact.payload.criteria,requiredEffects:[],products:stageProducts('planning'),
      artifactId:planArtifact.id,history:[],instructions:'',planningRecovery,
      reviews:report.reviews.filter(r=>artifacts.some(a=>a.id===r.artifactId&&a.data.payload.nodeId==='planning')).map(compactReview)}:null;
    const closed=report.entry?{id:'closed-entry',title:'Entrada adaptativa y revisión de elegibilidad',status:report.entry.status,
      roleIds:report.entry.roleIds,reviewerRoleIds:report.entry.reviewerRoleIds,dependencies:[],
      method:{id:report.entry.version,rationale:report.entry.response?.reason??'Sin decisión de entrada completada.',alternatives:['Plan completo sin usar una respuesta descartada como entrada.']},
      criteria:report.entry.criteria,requiredEffects:[],products:stageProducts('closed-entry'),artifactId:report.entry.artifactId,
      history:[],instructions:'Criterios fijados antes de producir. Una derivación no entrega el trabajo: el planificador recibe la petición original, no la respuesta descartada.',
      reviews:report.reviews.filter(r=>r.artifactId===report.entry.artifactId).map(compactReview)}:null;
    const controllerEntries=projectControllerEntries(store,report,{compactReview,stageProducts});
    const stages=[...controllerEntries,...(closed?[closed]:[]),...(planning?[planning]:[]),...material];
    for(const stage of stages)for(const id of [...stage.roleIds,...stage.reviewerRoleIds])roles[id]??=getRole(id);
    if(planning){
      planning.proposedRoleIds=[...new Set(artifacts.filter(a=>a.data.payload.kind==='mission-plan').flatMap(a=>JSON.parse(a.data.payload.body).nodes.flatMap(n=>[...n.roleIds,...n.reviewerRoleIds])))];
      for(const id of planning.proposedRoleIds)roles[id]??=getRole(id);
    }
    const timeline=report.timeline.filter(e=>e.kind.startsWith('blind.')||e.kind.startsWith('node.closed.')||e.kind.startsWith('sourced-entry.')||e.kind.startsWith('bounded-entry.')||['entry.started','entry.fallback','entry.accepted','entry.inference.recovered','planning.attempt','planning.accepted','planning.returned','nodes.parallel.started','node.started','node.review.resumed','node.accepted','node.returned','node.waiting','node.correction.required','worker.final.correction.required','worker.review.correction.required','worker.tool.observed','mission.status'].includes(e.kind));
    if(spec.sourceRecords)timeline.push(...projectMaterialSequence(store,mission.id));
    timeline.sort((a,b)=>a.seq-b.seq);
    const validationFailures=store.list('worker-rejected-review').filter(r=>artifacts.some(a=>a.id===r.data.artifactId)).map(record=>{
      const r=record.data;return spec.closedRecords?projectRejectedReview(store,record):{runId:r.runId,artifactId:r.artifactId,code:r.code,responseHash:r.responseHash,accepted:r.accepted};
    });
    const closedExperiments=spec.closedRecords?projectClosedExperiments(store,mission.id,closedRecords):[];
    const acquisitions=report.effects.filter(e=>e.tool==='source.fetch').map(e=>{
      const effect=store.get('effect',e.id),receipt=effect.data.receipt;
      if(receipt&&sha256(receipt)!==e.receiptHash)throw Error('Receipt differs from report');
      return {...e,completedAt:receipt?.data.completedAt??null,httpTrace:receipt?.data.result?.httpTrace??null};
    });
    let auditFinding=null;
    if(spec.auditFinding){
      const finding=spec.auditFinding,review=store.get('review',finding.reviewId)?.data;
      if(!review?.result.uncertainty.includes(finding.quote))throw Error('Audit quotation must exist in the actual review');
      const document=resolve(new URL('../..',import.meta.url).pathname,finding.document);
      auditFinding={...finding,document,documentHash:sha256(fs.readFileSync(document)),scope:'Auditoría posterior del coordinador; no reescribe los juicios originales ni certifica el mandato.'};
    }
    const historicalOutcomes=(spec.historicalOutcomes??[]).map(p=>{
      const path=join('/home/cardeex/codex-workspace',p),bytes=fs.readFileSync(path),s=JSON.parse(bytes);
      if(s.missionId!==mission.id)throw Error('Historical summary must name the selected mission');
      return {path,hash:sha256(bytes),completedAt:s.completedAt,status:s.status,passed:s.passed,checks:s.checks,pending:s.pending,
        releaseId:s.release.releaseId,completedInferences:s.metrics.completed,totalTokensObserved:s.metrics.providerUsage.byFieldObserved.totalTokens};
    });
    const runtimeTransitions=report.timeline.filter(e=>e.kind==='qualification.resume');
    let oracleAudit=null;
    if(spec.auditReport){
      const path=resolve(new URL('../..',import.meta.url).pathname,spec.auditReport),bytes=fs.readFileSync(path),audit=JSON.parse(bytes);
      if(audit.missionId!==mission.id||audit.final.hash!==report.final?.payloadHash)throw Error('Oracle audit must bind this exact final product');
      oracleAudit={path,hash:sha256(bytes),...audit};
    }
    const caseClassification=spec.caseClassification?projectClosedCaseClassification(
      JSON.parse(fs.readFileSync(join(stateDir,'summary.json'))),JSON.parse(fs.readFileSync(join(stateDir,'post-close-audit.json'))),
      journal,sha256(fs.readFileSync(join(stateDir,'summary.json')))):null;
    return {label:spec.label,stateDir,databasePath,journal,reportHash:sha256(report),mission:report.mission,auditFinding,historicalOutcomes,runtimeTransitions,oracleAudit,caseClassification,
      sourceRecords:spec.sourceRecords?projectSourceRecords(store,mission.id):[],
      stages,entry:report.entry??null,validationFailures,closedExperiments,sources:report.sources,acquisitions,metrics:report.metrics,effects:report.effects,timeline,
      final:report.final?{id:report.final.id,status:report.final.status,hash:report.final.payloadHash,body:report.final.payload.body}:null};
  }finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();}
});
const data={capturedAt:new Date().toISOString(),profile,initialMissionIndex:profile==='specialists'?1:profile==='closed'?2:0,scope:'Historical read-only projections; not live process state or a fresh external verification. Every selected journal verified. Full selected current catalog cards; original reviews retained in source databases.',missions,roles,evidence,products,closedRecords};
const template=fs.readFileSync(new URL('./inspector.fragment.html',import.meta.url),'utf8');
const serialized=JSON.stringify(data).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
if(template.split('@@SOVEREIGN_DATA@@').length!==2)throw Error('One data slot required');
const html=template.replace('@@SOVEREIGN_DATA@@',()=>serialized);
if(Buffer.byteLength(html)>=1000000)throw Error('Inspection exceeds inline byte cap; select fewer executions, never silently omit proof');
if(prior){
  const archive=output+'.'+sha256(prior).slice(0,12)+'.snapshot.html';
  fs.copyFileSync(output,archive,fs.constants.COPYFILE_EXCL);
  if(fs.existsSync(output+'.json'))fs.copyFileSync(output+'.json',archive+'.json',fs.constants.COPYFILE_EXCL);
  if(sha256(fs.readFileSync(output))!==sha256(prior))throw Error('Snapshot changed during projection');
}
fs.writeFileSync(output,html,{flag:prior?'w':'wx',mode:0o600});
const manifest={capturedAt:data.capturedAt,path:resolve(output),sha256:sha256(html),bytes:Buffer.byteLength(html),missions:missions.map(m=>({id:m.mission.id,stateDir:m.stateDir,reportHash:m.reportHash,journal:m.journal})),roleCount:Object.keys(roles).length,uniqueEvidence:Object.keys(evidence).length};
fs.writeFileSync(output+'.json',JSON.stringify(manifest,null,2),{flag:prior?'w':'wx',mode:0o600});process.stdout.write(JSON.stringify(manifest,null,2)+'\n');
