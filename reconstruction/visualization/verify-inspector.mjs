import * as fs from 'node:fs';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require('/home/cardeex/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const [url,directory,sourcePath]=process.argv.slice(2);
const source=sourcePath?fs.readFileSync(sourcePath,'utf8'):null;
const sourceHash=source?createHash('sha256').update(source).digest('hex'):null;
if(!url?.startsWith('http://127.0.0.1:')||!directory||fs.readdirSync(directory).length)throw Error('Own loopback preview and new empty QA directory required');
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome'}),errors=[],observations=[];
let completedQualification=false;
try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  const frame=page.frames().find(f=>f.parentFrame());assert.ok(frame);
  await frame.locator('[data-field="stage-detail"] h3').first().waitFor();
  if(source){
    const expected=source.match(/<script type="application\/json" id="sovereign-proof-data">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(expected);assert.equal(await frame.locator('#sovereign-proof-data').textContent(),expected,'Preview must serve the exact current snapshot, not a previous render');
  }
  const mission=frame.locator('[data-field="mission"]');
  const profile=await frame.evaluate(()=>JSON.parse(document.getElementById('sovereign-proof-data').textContent).profile??'historical');
  const count=profile==='adaptive'?13:profile==='specialists'||profile==='sources'?2:profile==='closed'?3:profile==='qualification'?1:9;assert.equal(await mission.locator('option').count(),count);
  if(count===1)assert.equal(await mission.isVisible(),false,'A single recorded execution needs no picker');
  if(profile==='specialists')assert.equal(await mission.inputValue(),'1','Open the current recovered mission first, retaining prior failure as another selection');
  if(profile==='closed')assert.equal(await mission.inputValue(),'2','New qualification must stay separate from preserved failed attempts');
  for(let i=0;i<count;i++){
    if(count>1)await mission.selectOption(String(i));
    const metrics=await frame.locator('[data-field="metrics"]').innerText();
    const id=await frame.locator('[data-field="mission-id"]').innerText();
    assert.match(id,/^mission:/);assert.ok(await frame.locator('[data-field="stage"] option').count());
    if(profile==='historical'){
      if(i===0||i===3)assert.match(metrics,/COMPLETED/);
      if(i===1||i===2)assert.match(metrics,/WAITING_CAPABILITY/);
      if(i===6)assert.match(metrics,/CANCELLED/);
      if(i===7)assert.match(metrics,/138\.023/);
      if(i===8)assert.match(metrics,/233\.447/);
    }else if(profile==='adaptive'){
      if(i<4||i===8||i===10||i===11)assert.match(metrics,/COMPLETED/);
      if(i===9)assert.match(metrics,/WAITING_CAPABILITY/);
      if(i===10)assert.match(metrics,/124\.663/);
      if(i===12){assert.match(metrics,/WAITING_CAPABILITY/);assert.match(metrics,/149\.204/);assert.match(metrics,/2 juicios RETURN\/UNKNOWN/);}
      if(i>=4&&i<=7)assert.match(metrics,/PAUSED/);
      if(i===0)assert.match(metrics,/19\.760/);
      if(i===1)assert.match(metrics,/78\.920/);
    }else if(profile==='specialists'){
      if(i===0){assert.match(metrics,/NEEDS_DIRECTION/);assert.match(metrics,/3 juicios RETURN\/UNKNOWN/);}
      if(i===1)assert.match(metrics,/COMPLETED/);
    }else if(profile==='sources'){
      assert.match(metrics,i===0?/COMPLETED/:/PAUSED/);
      assert.match(await frame.locator('[data-field="case-classification"]').innerText(),i===0?/3 llamadas reales · 0 simuladas/:/1 llamadas reales · 2 simuladas/);
      assert.equal(await frame.locator('[data-field="stage"] option').count(),1,'Neither source case executed a plan');
    }else if(profile==='closed'||profile==='qualification'){
      if(profile==='closed'&&i<2)assert.match(metrics,/NEEDS_DIRECTION/);
      const recordedStatus=await frame.evaluate(i=>JSON.parse(document.getElementById('sovereign-proof-data').textContent).missions[i].mission.status,i);
      assert.ok(metrics.includes(recordedStatus),'Status is the exact snapshot, not inferred from the qualification label');
    }
    const buttons=frame.locator('[data-field="graph"] button');
    assert.equal(await buttons.count(),await frame.locator('[data-field="stage"] option').count());
    if(profile==='sources')assert.equal(await frame.locator('[data-field="graph"]').isVisible(),false,'A single entry does not need a one-node diagram');
    else await buttons.first().click();
    assert.equal(await frame.locator('[data-field="stage"]').inputValue(),'0');
    assert.equal(await buttons.first().getAttribute('aria-pressed'),'true');
    if(profile==='adaptive'&&[0,2,4,5,6,7,8].includes(i))assert.equal(await frame.locator('[data-field="graph"] svg path').count(),0,'Direct decision must not acquire an invented plan dependency');
    observations.push({selection:i,id,metrics});
  }
  if(profile==='sources'){
    const snapshots=await frame.evaluate(()=>JSON.parse(document.getElementById('sovereign-proof-data').textContent).missions);
    for(const [i,s]of snapshots.entries()){
      assert.equal(s.stages.length,1);const stage=s.stages[0];assert.equal(stage.id,'sourced-response-entry');
      assert.deepEqual(stage.roleIds,[]);assert.deepEqual(stage.reviewerRoleIds,['omega_22']);
      assert.equal(stage.assignedInstructions.length,2);assert.equal(stage.controllerExecutions.length,1);
      for(const c of stage.assignedInstructions)assert.equal(createHash('sha256').update(c.instructions).digest('hex'),c.prefixHash);
      assert.equal(s.sourceRecords.length,1);const raw=s.sourceRecords[0];
      assert.equal(createHash('sha256').update(raw.raw).digest('hex'),raw.hash);assert.equal(Buffer.byteLength(raw.raw),42143);
      const seq=kind=>s.timeline.filter(e=>e.kind===kind);
      for(const kind of ['source.acquired','candidate.created','reviewer.created','review.committed'])assert.equal(seq(kind).length,1);
      assert.ok(seq('source.acquired')[0].seq<seq('candidate.created')[0].seq);
      assert.ok(seq('candidate.created')[0].seq<seq('reviewer.created')[0].seq);
      assert.ok(seq('reviewer.created')[0].seq<seq('review.committed')[0].seq);
      assert.equal(stage.reviews[0].result.decision,i===0?'ACCEPT':'RETURN');
      assert.equal(stage.status,i===0?'ACCEPTED':'FALLBACK');
      if(i===0)assert.deepEqual(JSON.parse(s.final.body),{lectura_y_escritura_simultaneas:true,maximo_escritores_simultaneos:1,wal_en_sistema_de_archivos_de_red:false,fuente:'https://www.sqlite.org/wal.html'});
      else {assert.equal(s.final,null);assert.equal(stage.disposition.code,'DIRECT_NOT_ACCEPTED');
        assert.equal(stage.reviews[0].result.checks.find(c=>c.criterionId==='source-support').verdict,'FAIL');}
      await mission.selectOption(String(i));
      assert.equal(await frame.locator('[data-field="material-sequence"]').isVisible(),true);
      assert.match(await frame.locator('[data-field="material-sequence"]').innerText(),/Fuente adquirida/);
      assert.match(await frame.locator('[data-field="material-sequence"]').innerText(),i===0?/Entrada aceptada/:/Derivación al plan · sin entrega/);
      await frame.locator('summary').filter({hasText:'Secuencia realmente registrada'}).click();
      assert.match(await frame.locator('[data-field="timeline"]').innerText(),/Fuente adquirida/);
      assert.match(await frame.locator('[data-field="timeline"]').innerText(),/Candidato producido/);
      assert.match(await frame.locator('[data-field="timeline"]').innerText(),/Dictamen registrado/);
      await frame.locator('summary').filter({hasText:'Secuencia realmente registrada'}).click();
      await frame.locator('summary').filter({hasText:/^Fichas:/}).click();
      await frame.locator('summary').filter({hasText:'Producción · contrato propio del controlador'}).click();
      await frame.locator('summary').filter({hasText:'Contrato propio íntegro registrado · no es un rol del catálogo'}).click();
      assert.match(await frame.locator('[data-field="controller-charter"]').innerText(),/sovereign.sourced-response-production.v1/);
      await frame.locator('summary').filter({hasText:/^Instrucciones históricas recibidas:/}).click();
      await frame.locator('[data-field="assigned-instructions"] > details > summary').filter({hasText:/^reviewer/}).click();
      assert.match(await frame.locator('[data-field="assigned-instructions"]').innerText(),/omega_22/);
      await page.setViewportSize({width:360,height:1100});
      const bounds=await frame.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(bounds.scroll<=bounds.width+1);
    }
    await mission.selectOption('0');
    observations.push({sourceChronologyVerified:true,fullRawBytesPerCase:42143,historicalInstructionHashesVerified:true,
      controlledProducerNotCountedAsReal:true,rejectedCaseNoDelivery:true});
  }
  if(profile==='qualification'){
    const snapshot=await frame.evaluate(()=>JSON.parse(document.getElementById('sovereign-proof-data').textContent).missions[0]);
    if(snapshot.mission.id==='mission:38c9896a-e45c-4b5d-94d7-cecad1de43ba'){
      assert.ok(snapshot.stages.find(s=>s.id==='planning').reviews.some(r=>r.result.decision==='RETURN'),'Failed first plan remains visible');
      assert.ok(snapshot.stages.find(s=>s.id==='planning').reviews.some(r=>r.result.decision==='ACCEPT'),'Corrected plan is distinct, not a rewritten rejection');
      const original=snapshot.stages.find(s=>s.id==='original');
      assert.deepEqual(original.roleIds,[]);assert.equal(original.specialistMode,'standalone');
      assert.ok(original.specialistExecutions.every(e=>JSON.stringify(e.binding.charter)===JSON.stringify(original.specialist)));
    }else{
      assert.equal(snapshot.mission.id,'mission:52a897d8-2de4-47f3-a971-5f7675dd9229');completedQualification=true;
      assert.equal(snapshot.mission.status,'COMPLETED');assert.equal(snapshot.stages.length,5);
      assert.ok(snapshot.stages.every(s=>s.status==='ACCEPTED'&&s.reviews.length===1&&s.reviews[0].result.decision==='ACCEPT'));
      assert.deepEqual(snapshot.stages.find(s=>s.id==='original').roleIds,['sigma_08']);
      const comparison=snapshot.stages.find(s=>s.id==='comparison');
      assert.equal(comparison.reviews[0].result.checks.length,24);assert.ok(comparison.reviews[0].result.checks.every(c=>c.verdict==='PASS'));
      assert.equal(snapshot.final.hash,'0c9fd2e175ca920ca6df876c88c33223bccafd498efa731f8ecc360d295737fa');
      const report=JSON.parse(snapshot.final.body);assert.equal(report.original.body,'62');assert.equal(report.replica.result,'61');
      assert.equal(report.comparison.outcome,'MISMATCH');assert.equal(report.comparison.calculation.absoluteDistance,'1');
      assert.equal(snapshot.metrics.dispatched,9);assert.equal(snapshot.metrics.providerUsage.byFieldObserved.totalTokens,296453);
      assert.equal(snapshot.validationFailures.length,0);
    }
    assert.equal(snapshot.stages.find(s=>s.id==='comparison').execution.kind,'closed-blind-comparison-v1');
    assert.equal(snapshot.effects.length,0);
    observations.push({qualificationSnapshot:true,completedQualification,recordedStatus:snapshot.mission.status,finalPresent:!!snapshot.final});
  }
  if(profile==='closed'){
    await mission.selectOption('0');
    await frame.locator('[data-field="closed-section"] > summary').click();
    await frame.locator('[data-field="closed-experiments"] > details > summary').click();
    await frame.locator('[data-field="closed-experiments"] summary').filter({hasText:/^Entrada pública exacta/}).click();
    await frame.locator('[data-field="closed-experiments"] summary').filter({hasText:/^Resultado sellado íntegro/}).click();
    const historical=await frame.locator('[data-field="closed-experiments"]').innerText();
    assert.match(historical,/sovereign\.blind-input\.v1/);assert.match(historical,/"status": "UNKNOWN"/);
    assert.match(historical,/"result": ""/);assert.match(historical,/Apertura registrada\s+false/);
    const snapshots=await frame.evaluate(()=>{const d=JSON.parse(document.getElementById('sovereign-proof-data').textContent);return d.missions.slice(0,2).map(m=>({
      experiment:m.closedExperiments[0],seal:m.closedExperiments[0].records.map(k=>d.closedRecords[k]).find(r=>r.type==='blind-seal'),
      rejected:m.validationFailures,reviewIds:m.stages.flatMap(s=>s.reviews.map(r=>r.reviewerRunId))}));});
    assert.equal(snapshots[0].seal.hash,snapshots[1].seal.hash,'Extension must retain the same exact historical seal');
    assert.equal(snapshots[1].experiment.openingRecorded,false);
    assert.equal(snapshots[1].rejected.length,1);const rejection=snapshots[1].rejected[0];
    assert.equal(rejection.code,'FAILED_GATE');assert.equal(rejection.expanded.decision,'ACCEPT');
    assert.ok(rejection.expanded.findings.some(f=>f.severity==='material'));
    assert.ok(!snapshots[1].reviewIds.includes(rejection.runId),'Rejected ACCEPT cannot appear as an admitted semantic judgment');
    await mission.selectOption('1');
    await frame.locator('[data-field="stage"]').selectOption('3');
    assert.match(await frame.locator('[data-field="stage-detail"]').innerText(),/Prerrequisito privado del controlador/);
    await frame.locator('[data-field="stage-detail"] > details').filter({has:frame.locator('summary',{hasText:/^Respuestas de revisión rechazadas/})}).first().locator('summary').first().click();
    await frame.locator('[data-field="rejected-reviews"] > details > summary').click();
    await frame.locator('[data-field="rejected-reviews"] summary').filter({hasText:/^Respuesta original íntegra/}).click();
    await frame.locator('[data-field="rejected-reviews"] summary').filter({hasText:/^Expansión verificable/}).click();
    const rejectionText=await frame.locator('[data-field="rejected-reviews"]').innerText();
    assert.match(rejectionText,/"decision": "ACCEPT"/);assert.match(rejectionText,/"severity": "material"/);
    assert.match(rejectionText,/no es un juicio admitido/);assert.match(rejectionText,/"quote":/);
    await page.setViewportSize({width:360,height:1100});
    const expandedBounds=await frame.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(expandedBounds.scroll<=expandedBounds.width+1,'Complete rejected review must fit at 360px');
    await frame.locator('[data-field="closed-section"] > summary').click();
    observations.push({closedRecords:2,sameHistoricalSeal:true,rejectedAcceptPreserved:true,expandedRejectionFits360:true});
  }
  if(profile==='adaptive'){
    await mission.selectOption('12');
    assert.match(await frame.locator('[data-field="audit-finding"]').innerText(),/EVIDENCIA FUERA DE SU FRONTERA/);
    await frame.locator('[data-field="audit-finding"] summary').click();
    assert.match(await frame.locator('[data-field="audit-finding"]').innerText(),/Missing sibling exposure evidence/);
    await frame.locator('[data-field="stage"]').selectOption('1');
    await frame.locator('[data-field="stage-detail"] > details').filter({has:frame.locator('summary',{hasText:/^Juicios conservados:/})}).first().locator('summary').first().click();
    await frame.locator('[data-field="stage-detail"] summary').filter({hasText:/^RETURN · /}).first().click();
    await frame.locator('[data-field="stage-detail"] summary').filter({hasText:/^UNKNOWN · separation$/}).click();
    assert.match(await frame.locator('[data-field="stage-detail"]').innerText(),/Bilateral non-consumption/);
    await frame.locator('[data-field="stage"]').selectOption('3');
    assert.match(await frame.locator('[data-field="stage-detail"] h3').first().innerText(),/PENDING/);
    assert.match(await frame.locator('[data-field="stage-detail"]').innerText(),/Entrada requerida por el plan/);
    assert.doesNotMatch(await frame.locator('[data-field="stage-detail"]').innerText(),/Entrada aceptada/);
    assert.equal(await frame.locator('[data-field="stage-detail"] summary').filter({hasText:/^ACCEPT · /}).count(),0,'Pending integrator cannot acquire an invented approval');
    await mission.selectOption('9');
    const disclosure=frame.locator('details').filter({has:frame.locator('summary',{hasText:/^Recorridos HTTP registrados$/})});
    await disclosure.locator('summary').first().click();
    await mission.selectOption('11');
    assert.match(await frame.locator('[data-field="audit-finding"]').innerText(),/ASIGNACIÓN NO CONFORME/);
    await frame.locator('[data-field="audit-finding"] summary').click();
    assert.match(await frame.locator('[data-field="audit-finding"]').innerText(),/This manual review is not a sealed blind replication/);
    const viewDisclosure=frame.locator('[data-field="stage-detail"] > details').filter({has:frame.locator('summary',{hasText:/^Contexto de producción:/})});
    await viewDisclosure.locator('summary').first().click();
    const producers=frame.locator('[data-field="producer-exposures"] > details');assert.ok(await producers.count()>0);
    await producers.last().locator('summary').first().click();
    await producers.last().locator('summary').filter({hasText:'Contrato íntegro recibido por este productor'}).first().click();
    assert.match(await producers.last().innerText(),/sovereign\.node-contract\.v1/);
    assert.match(await producers.last().innerText(),/"isFinalProduct": true/);
    await producers.last().locator('summary').filter({hasText:/^Solicitudes capturadas antes del proveedor:/}).first().click();
    const actual=await producers.last().innerText();assert.match(actual,/"completed": true/);assert.match(actual,/requestHash/);
    const views=await frame.evaluate(()=>{
      const m=JSON.parse(document.getElementById('sovereign-proof-data').textContent).missions[11];
      return m.stages.flatMap(s=>(s.producerExposures??[]).flatMap(p=>p.views));
    });
    assert.ok(views.length>=3);assert.ok(views.every(v=>v.providerRequests.length>0&&v.providerRequests.every(r=>!r.exposedArtifactIds.includes(v.artifactId))));
    observations.push({planViews:views.length,capturedRequests:views.reduce((n,v)=>n+v.providerRequests.length,0),projectionDisclosure:true});
    await page.setViewportSize({width:360,height:1100});
    const projectionBounds=await frame.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(projectionBounds.scroll<=projectionBounds.width+1,'Expanded actual contract must fit at 360px');
    await mission.selectOption('9');
    await frame.locator('[data-field="acquisitions"] > details > summary').first().click();
    assert.match(await frame.locator('[data-field="acquisitions"]').innerText(),/Sin traza HTTP completa/);
    await mission.selectOption('10');
    const traces=frame.locator('[data-field="acquisitions"] > details');assert.equal(await traces.count(),2);
    for(let i=0;i<2;i++)await traces.nth(i).locator('summary').first().click();
    assert.equal(await frame.locator('[data-field="acquisitions"] li').count(),2);
    assert.match(await traces.first().innerText(),/rfc-editor\.org\/rfc\/rfc2606\.txt/);
    assert.match(await traces.last().innerText(),/iana\.org\/domains\/reserved/);
    for(let i=0;i<2;i++)assert.match(await traces.nth(i).innerText(),/"status": 200/);
    await disclosure.locator('summary').first().click();
  }
  if(profile==='specialists'){
    await mission.selectOption('0');
    assert.equal(await frame.locator('[data-field="stage"] option').count(),1,'Rejected plans cannot acquire invented material nodes');
    const disclose=label=>frame.locator('[data-field="stage-detail"] > details').filter({has:frame.locator('summary',{hasText:label})}).first().locator('summary').first();
    await disclose(/^Intentos de planificación/).click();
    assert.match(await frame.locator('[data-field="planning-recovery"]').innerText(),/SCHEMA/);
    assert.equal(await frame.locator('[data-field="planning-recovery"] summary').filter({hasText:'Propuesta íntegra rechazada'}).count(),1);
    await disclose(/^Juicios conservados:/).click();
    assert.equal(await frame.locator('[data-field="stage-detail"] summary').filter({hasText:/^RETURN · /}).count(),3,'Every original plan rejection must be retained');
    await mission.selectOption('1');
    for(const index of ['1','2']){
      await frame.locator('[data-field="stage"]').selectOption(index);
      await disclose(/^Fichas:/).click();
      await frame.locator('[data-field="stage-detail"] summary').filter({hasText:'Especialista de misión · sin rol de catálogo'}).click();
      const own=frame.locator('[data-field="specialist-charter"]');
      assert.match(await own.innerText(),/Métodos/);assert.match(await own.innerText(),/Falsificador/);
      await own.locator('summary').filter({hasText:'Ficha propia íntegra'}).click();
      await own.locator('summary').filter({hasText:/^Vinculaciones registradas de ejecución:/}).click();
      assert.match(await own.innerText(),/sovereign\.standalone-specialist\.v1/);
      assert.match(await own.innerText(),/planArtifactHash/);
      const exact=await frame.evaluate(index=>{const d=JSON.parse(document.getElementById('sovereign-proof-data').textContent),s=d.missions[1].stages[Number(index)];return {roles:s.roleIds.length,executions:s.specialistExecutions.length,exact:s.specialistExecutions.every(e=>JSON.stringify(e.binding.charter)===JSON.stringify(s.specialist))};},index);
      assert.deepEqual(exact,{roles:0,executions:1,exact:true});
    }
    await frame.locator('[data-field="stage"]').selectOption('3');
    const scopes=await frame.evaluate(()=>{const s=JSON.parse(document.getElementById('sovereign-proof-data').textContent).missions[1].stages[3];return s.producerExposures.flatMap(p=>p.views.flatMap(v=>v.providerRequests.map(r=>({path:r.path,count:r.runtimeScopes.length,feedbackCoverage:r.runtimeScopes.flatMap(x=>x.detail.attempts.flatMap(a=>a.requests.map(q=>q.producerInput?.coverage??'NOT_RETAINED')))}))));});
    assert.ok(scopes.some(r=>r.path.includes('standalone-live-rjsI0udG')&&r.count===0),'The blocked original request must retain its missing histories');
    assert.ok(scopes.some(r=>r.path.includes('recovery-monpYO0G')&&r.count===2),'Recovered integration must show both actual parent histories');
    assert.ok(scopes.some(r=>r.path.includes('feedback-recovery-b6jLY0q2')&&r.count===2&&r.feedbackCoverage.length===2&&r.feedbackCoverage.every(x=>x==='RECORDED')),'Second recovery must show the actual public feedback coverage');
    await frame.locator('[data-field="recovery-section"] > summary').click();
    const records=frame.locator('[data-field="recovery-records"] > details');assert.equal(await records.count(),6);
    for(let i=0;i<6;i++)await records.nth(i).locator('summary').first().click();
    const history=await frame.locator('[data-field="recovery-records"]').innerText();
    assert.match(history,/WAITING_CAPABILITY/);assert.match(history,/COMPLETED/);assert.match(history,/qualification.resume/);assert.match(history,/"exactHistoricalGates": true/);
    await page.setViewportSize({width:360,height:1100});
    const bounds=await frame.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(bounds.scroll<=bounds.width+1);
    await frame.locator('[data-field="recovery-section"] > summary').click();
    observations.push({standaloneCharters:2,unchangedRootExecutions:2,planningRejections:3,structuralRejections:1,recoveryScopeDisclosure:scopes});
  }
  if(count>1)await mission.selectOption(profile==='adaptive'?'12':profile==='specialists'?'1':profile==='closed'?'2':'0');
  for(const width of [736,360])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:1100});await page.emulateMedia({colorScheme:theme});
    const bounds=await frame.evaluate(()=>{
      const root=document.getElementById('sovereign-proof-inspector');
      return {width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,rootWidth:root.getBoundingClientRect().width,height:root.scrollHeight};
    });
    assert.ok(bounds.scrollWidth<=bounds.width+1,JSON.stringify({width,theme,...bounds}));
    await page.locator('iframe').evaluate((iframe,height)=>{iframe.style.height=(height+64)+'px';},bounds.height);
    // Paint the whole iframe, not only the initially visible 1100px portion.
    await page.setViewportSize({width,height:Math.ceil(bounds.height+128)});
    await frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.screenshot({path:join(directory,`${width}-${theme}.png`),fullPage:true});
    observations.push({width,theme,bounds});
  }
  if(count>1)await mission.selectOption(profile==='adaptive'||profile==='sources'?'0':profile==='specialists'?'1':profile==='closed'?'0':'4');
  if(profile==='closed')await frame.locator('[data-field="stage"]').selectOption('1');
  if(profile==='qualification'){
    await frame.locator('[data-field="stage"]').selectOption(completedQualification?'4':'0');
    await frame.locator('[data-field="stage-detail"] > details').filter({has:frame.locator('summary',{hasText:/^Juicios conservados:/})}).first().locator('summary').first().click();
    if(completedQualification){
      await frame.locator('[data-field="stage-detail"] summary').filter({hasText:/^ACCEPT · /}).first().click();
      assert.equal(await frame.locator('[data-field="stage-detail"] summary').filter({hasText:/^PASS · /}).count(),24);
      await frame.locator('[data-field="stage-detail"] summary').filter({hasText:/^PASS · req.r_isolation.bilateral_closed_exposure/}).click();
      assert.match(await frame.locator('[data-field="stage-detail"]').innerText(),/Inspeccioné ambas solicitudes completas retenidas/);
    }else{
      await frame.locator('[data-field="stage-detail"] summary').filter({hasText:/^RETURN · /}).first().click();
      await frame.locator('[data-field="stage-detail"] summary').filter({hasText:/^FAIL · capability-fit/}).first().click();
      assert.match(await frame.locator('[data-field="stage-detail"]').innerText(),/omega_23/);
    }
    // The original stage has the actual assigned reviewer. The plan also has
    // proposed cards in a different collapsed group; never force-click those.
    await frame.locator('[data-field="stage"]').selectOption('1');
  }
  // Exercise deep drill-down rather than judging only the collapsed overview.
  await frame.locator('[data-field="stage-detail"] > details').filter({has:frame.locator('summary',{hasText:/^Fichas:/})}).first().locator('summary').first().click();
  const roles=frame.locator('[data-field="stage-detail"] details').filter({has:frame.locator('summary',{hasText:profile==='historical'?/^omega_11/:/^omega_22/})});
  await roles.last().locator('summary').first().click();
  assert.ok((await frame.locator('[data-field="stage-detail"]').innerText()).includes('Métodos'));
  await roles.last().locator('summary').filter({hasText:'Ficha íntegra y metadatos de procedencia'}).first().click();
  assert.ok((await frame.locator('[data-field="stage-detail"]').innerText()).includes('sourceRefs'));
  await frame.locator('[data-field="stage-detail"] > details').filter({has:frame.locator('summary',{hasText:/^Juicios conservados:/})}).first().locator('summary').first().click();
  const review=frame.locator('[data-field="stage-detail"] summary').filter({hasText:/^ACCEPT · /}).first();await review.click();
  await frame.locator('[data-field="stage-detail"] summary').filter({hasText:/^PASS · /}).first().click();
  await frame.locator('[data-field="stage-detail"] summary').filter({hasText:/^Prueba /}).first().click();
  assert.ok((await frame.locator('[data-field="stage-detail"]').innerText()).includes('SHA256'));
  const deep=await frame.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(deep.scroll<=deep.width+1);
  // Standalone mock of host follow-up API: no real message or mission is created.
  await frame.evaluate(()=>{window.__qaFollowUps=[];window.openai={sendFollowUpMessage:async message=>{window.__qaFollowUps.push(message);}};});
  await frame.locator('[data-field="investigate"]').click();
  const calls=await frame.evaluate(()=>window.__qaFollowUps);assert.equal(calls.length,1);assert.match(calls[0].prompt,/sólo en lectura/);assert.match(calls[0].prompt,/No inicies una misión/);
  assert.deepEqual(errors,[]);
  const result={capturedAt:new Date().toISOString(),passed:true,profile,count,sourcePath:sourcePath??null,sourceHash,scope:'Real headless Chrome against a loopback preview; every selected record, route selection, light/dark and 736/360 px, deep proof/full-role disclosure, no horizontal overflow and a mocked host follow-up. No live chat message or mission creation.',observations,errors};
  fs.writeFileSync(join(directory,'summary.json'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});process.stdout.write(JSON.stringify(result,null,2)+'\n');
}finally{await browser.close();}
