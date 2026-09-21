import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {compactCatalogReview} from '../../factory/lib/review-codec.mjs';
import {getRole} from '../../factory/catalog/index.mjs';
import {Store} from '../../factory/lib/store.mjs';
import {DOCUMENT_URLS,DEVELOPMENT_FILES,DEVELOPMENT_COMMAND} from '../../reconstruction/verification/full-route-cases.mjs';
import {fullRoutePolicy} from '../../reconstruction/verification/full-route-harness.mjs';
import {runFullRouteCaseDurably as runFullRouteCase,readDurableQualificationEffects,
  auditAdaptiveV3QualificationCaseDurably as auditAdaptiveV3QualificationCase,readDurableQualificationRecovery} from './adaptive-v3-qualification-durable.mjs';
import {ADAPTIVE_V3_QUALIFICATION_CASES,ADAPTIVE_V3_SPECIALIST_CHARTER} from '../../reconstruction/verification/adaptive-v3-qualification-cases.mjs';
import {retainAdaptiveV3QualificationBundle,auditAdaptiveV3QualificationBundle} from '../../reconstruction/verification/adaptive-v3-evidence-bundle.mjs';

const runtimeRoot=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const bundleModuleUrl=pathToFileURL(join(runtimeRoot,'reconstruction/verification/adaptive-v3-evidence-bundle.mjs')).href;
const directory=t=>{const path=fs.mkdtempSync(join(tmpdir(),'adaptive-v3-qualification-'));t.after(()=>fs.rmSync(path,{recursive:true,force:true}));return path;};
const unlockTree=path=>{
  const stat=fs.lstatSync(path);
  if(stat.isDirectory()){
    fs.chmodSync(path,0o700);
    for(const entry of fs.readdirSync(path))unlockTree(join(path,entry));
  }else if(!stat.isSymbolicLink())fs.chmodSync(path,0o600);
};
const bundleTarget=t=>{
  const root=fs.mkdtempSync(join(tmpdir(),'adaptive-v3-retained-'));
  t.after(()=>{try{unlockTree(root);}catch{}fs.rmSync(root,{recursive:true,force:true});});
  return join(root,'bundle');
};
const sealBundleTree=path=>{
  const stat=fs.lstatSync(path);
  if(stat.isDirectory()){
    for(const entry of fs.readdirSync(path))sealBundleTree(join(path,entry));
    fs.chmodSync(path,0o500);
  }else if(!stat.isSymbolicLink())fs.chmodSync(path,0o400);
};
const cloneBundle=(t,source)=>{const target=bundleTarget(t);fs.cpSync(source,target,{recursive:true,verbatimSymlinks:true});sealBundleTree(target);return target;};
const evidenceSnapshot=root=>{
  const rows=[];
  const visit=(path,relative)=>{
    const stat=fs.lstatSync(path,{bigint:true}),common={path:relative,mode:stat.mode.toString(),mtimeNs:stat.mtimeNs.toString(),ctimeNs:stat.ctimeNs.toString()};
    if(stat.isSymbolicLink()){
      rows.push({...common,type:'symlink',target:fs.readlinkSync(path)});return;
    }
    if(stat.isDirectory()){
      rows.push({...common,type:'directory'});
      for(const entry of fs.readdirSync(path,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)))
        visit(join(path,entry.name),relative==='.'?entry.name:`${relative}/${entry.name}`);
    }else rows.push({...common,type:'file',bytes:stat.size.toString(),sha256:sha256(fs.readFileSync(path))});
  };
  visit(root,'.');return rows;
};
const {sources:SOURCES_CASE,development:DEVELOPMENT_CASE,recovery:RECOVERY_CASE,specialist:SPECIALIST_CASE}=ADAPTIVE_V3_QUALIFICATION_CASES;
const SOURCE_FIXTURES=Object.freeze({
  [DOCUMENT_URLS.sqlite]:'SQLite fixture documentation: For the purposes of determining duplicate rows, NULL values are considered equal. DISTINCT removes duplicate rows.',
  [DOCUMENT_URLS.postgresql]:'PostgreSQL fixture documentation: NULL values are considered equal for duplicate-row comparison. SELECT DISTINCT removes duplicate rows.'
});
const SOURCE_FIXTURE_ROWS=Object.keys(SOURCE_FIXTURES).sort().map(url=>({url,contentType:'text/plain; charset=utf-8',
  bytes:Buffer.byteLength(SOURCE_FIXTURES[url]),sha256:sha256(SOURCE_FIXTURES[url])}));
const SOURCE_RESPONSE_HASHES=SOURCE_FIXTURE_ROWS.map(({url,contentType,bytes,sha256:hash})=>({url,contentType,bytes,sha256:hash}));
const SOURCE_FIXTURE=Object.freeze({
  schema:'sovereign.source-fixture.v1',transport:'SIMULATED',network:'DISABLED',
  responses:Object.freeze(Object.fromEntries(Object.entries(SOURCE_FIXTURES).map(([url,body])=>[
    url,Object.freeze({body,contentType:'text/plain; charset=utf-8'})
  ])))
});
const SOURCE_FIXTURE_ID=sha256({schema:'sovereign.source-fixture.v1',transport:'SIMULATED',network:'DISABLED',responses:SOURCE_FIXTURE_ROWS});
const sourceQuote=url=>url===DOCUMENT_URLS.sqlite?'NULL values are considered equal':'NULL values are considered equal';

function sourcePlan(request){
  return {requirements:[{id:'r1',text:request,requestQuote:request,
    criteria:[{id:'documented-distinct',text:'Acquire both requested primary documents and make only their bounded documented claims.'}]}],
  nodes:[{id:'deliver',title:'Documented DISTINCT comparison',purpose:'documented-comparison',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],
    requirementIds:['r1'],dependencies:[],method:{id:'two-primary-document-comparison',
      rationale:'Acquire the two fixed primary documents before constructing the bounded comparison.',
      alternatives:['Uncited recollection is prohibited.']},instructions:request,outputKind:'delivery',
    criteria:[{id:'documented-distinct',text:'Bound every factual claim to the exact acquired primary documents.'}],
    tools:['source.fetch'],requiredEffects:[],specialist:null}],finalNodeId:'deliver',
  routingRationale:'The request requires current external evidence, so the signed adaptive-v3 route remains planned.'};
}

function sourceReview(exposure,task){
  const artifact=exposure.artifacts.find(item=>item.id===task.candidateId);assert.ok(artifact);
  const evidence=[{kind:'artifact',id:artifact.id,hash:artifact.hash,quote:artifact.payload.body},
    ...exposure.sources.map(source=>({kind:'source',id:source.id,hash:source.hash,quote:source.raw}))];
  return compactCatalogReview({artifactHash:artifact.hash,purpose:artifact.payload.purpose,decision:'ACCEPT',
    checks:task.criteria.map(criterion=>({criterionId:criterion.id,verdict:'PASS',evidence,
      reason:'SIMULATED review exercises independent evidence custody; the content oracle remains outside the provider.'})),
    findings:[],uncertainty:'Simulated provider judgment; source receipt, route, plan, lineage and external finite oracle are checked separately.'},
  task.observedEvidenceCatalog);
}

function sourcesProviderFactory(){
  let calls=0;
  return ()=>({async generate(request){
    calls++;const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);let value;
    assert.equal(exposure.missionIntent,SOURCES_CASE.request);assert(!Object.hasOwn(task,'expected'));
    if(Object.hasOwn(request.schema.properties,'plan')){
      if(!task.inspectedRoleContracts)value={action:'inspect',roleIds:['omega_02','omega_03'],
        reason:'Inspect the full producer and independent reviewer contracts before committing the two-document evidence plan.',plan:null};
      else{
        assert.deepEqual(task.inspectedRoleContracts.cards,['omega_02','omega_03'].map(getRole));
        value={action:'plan',roleIds:[],reason:'',plan:sourcePlan(task.originalRequest)};
      }
    }else if(Object.hasOwn(request.schema.properties,'artifactHash'))value=sourceReview(exposure,task);
    else if(task.step===0)value={action:'tool',tool:'source.fetch',argsJson:JSON.stringify({url:DOCUMENT_URLS.sqlite}),
      body:'',claims:[],method:'acquire-primary-document',reason:'Obtain the first fixed primary document before factual delivery.'};
    else if(task.step===1)value={action:'tool',tool:'source.fetch',argsJson:JSON.stringify({url:DOCUMENT_URLS.postgresql}),
      body:'',claims:[],method:'acquire-primary-document',reason:'Obtain the second fixed primary document before factual delivery.'};
    else{
      const byUrl=new Map(exposure.sources.map(source=>[source.url,source]));
      for(const url of Object.keys(SOURCE_FIXTURES))assert.ok(byUrl.has(url),'Both fixed source receipts must precede delivery');
      const claim=(name,url)=>{const source=byUrl.get(url);return {id:`${name}-distinct`,
        text:`The fixture documentation for ${name} records its bounded DISTINCT behavior.`,kind:'fact',
        sources:[{sourceId:source.id,hash:source.hash,quote:sourceQuote(url)}],basis:[],
        qualifiers:['SIMULATED transport fixture; not a live factual assertion.'],validUntil:null};};
      value={action:'final',tool:'',argsJson:'',method:'two-primary-document-comparison',reason:'Return only the bounded comparison supported by both acquired records.',
        body:JSON.stringify({sqlite:{duplicateRows:'removed',nulls:'equal',url:DOCUMENT_URLS.sqlite,quote:sourceQuote(DOCUMENT_URLS.sqlite)},
          postgresql:{duplicateRows:'removed',nulls:'equal',url:DOCUMENT_URLS.postgresql,quote:sourceQuote(DOCUMENT_URLS.postgresql)},
          scope:'documented-only'}),
        claims:[claim('sqlite',DOCUMENT_URLS.sqlite),claim('postgresql',DOCUMENT_URLS.postgresql)]};
    }
    await request.validate(value);
    return {value,receipt:{kind:'inference',status:'completed',simulation:true,threadId:`sim-v3-sources-${calls}`,
      turnId:`sim-v3-sources-turn-${calls}`,model:request.model,reasoningEffort:request.reasoningEffort,
      contextHash:inferenceRequestHash(request)}};
  },async close(){}});
}

test('adaptive-v3 planned sources row preserves two simulated primary receipts, independent review, external content oracle and no-replay',async t=>{
  const path=directory(t),policy=fullRoutePolicy(SOURCES_CASE,'adaptive-v3-planned');
  assert.deepEqual({preset:policy.preset,entryMode:policy.entryMode,model:policy.model,reasoningEffort:policy.reasoningEffort},
    {preset:'adaptive-v3',entryMode:'planned',model:'gpt-5.6-terra',reasoningEffort:'high'});
  const result=await runFullRouteCase({runtimeRoot,directory:path,spec:SOURCES_CASE,mode:'adaptive-v3-planned',
    providerFactory:sourcesProviderFactory(),sourceFixture:SOURCE_FIXTURE});
  assert.equal(result.structuralPassed,true,JSON.stringify(result));assert.equal(result.passed,false);
  assert.equal(result.actualSubscription,false);assert.equal(result.calls.length,7);
  assert.equal(result.external.passed,true);assert.equal(result.checks.sources,true);assert.equal(result.checks.adaptiveV3,true);
  assert.equal(result.checks.noReplay,true);assert.equal(result.adaptiveV3.afterReentry.passed,true);
  const sourceUse=JSON.parse(fs.readFileSync(join(path,'source-use.json')));
  assert.deepEqual(sourceUse.map(row=>row.url).sort(),Object.keys(SOURCE_FIXTURES).sort());
  const qualification=JSON.parse(fs.readFileSync(join(path,'qualification.json')));
  assert.deepEqual(qualification.fixtureDeclaration,{provider:'SIMULATED',transport:'SIMULATED_FIXTURE',network:'DISABLED',execution:'NOT_USED',
    sourceFixtureId:SOURCE_FIXTURE_ID,sourceUrls:Object.keys(SOURCE_FIXTURES).sort(),sourceResponseHashes:SOURCE_RESPONSE_HASHES,
    scope:'Control-plane fixture classification. SIMULATED provider/transport is not subscription or factual-truth evidence; real local isolated execution, when present, is separately receipt-bound.'});
  const report=JSON.parse(fs.readFileSync(join(path,'report.json')));
  assert.equal(report.adaptiveV3.selectedEntryMode,'planned');assert.equal(report.adaptiveV3.originRecord,null);
  assert.equal(report.adaptiveV3.deterministicCertificationRecord,null);
  const audit=auditAdaptiveV3QualificationCase({directory:path,row:'sources'});
  assert.equal(audit.status,'QUALIFIED_FOR_DECLARED_ROW',JSON.stringify(audit));assert.equal(audit.checks.readOnly,true);
});

const DEVELOPMENT_CODE=`export function coalesceRanges(ranges){
  if(!Array.isArray(ranges))throw new TypeError();const copy=[];
  for(const pair of ranges){if(!Array.isArray(pair)||pair.length!==2||![...pair].every(Number.isSafeInteger))throw new TypeError();
    if(pair[0]>pair[1])throw new RangeError();copy.push(pair.map(n=>n===0?0:n));}
  copy.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);const out=[];
  for(const pair of copy){const last=out.at(-1);if(!last||BigInt(pair[0])>BigInt(last[1])+1n)out.push(pair);
    else if(pair[1]>last[1])last[1]=pair[1];}return out;
}`;
const DEVELOPMENT_FILES_CONTENT=Object.freeze({'merge-windows.mjs':DEVELOPMENT_CODE,
  'merge-windows.test.mjs':`import test from 'node:test';import assert from 'node:assert/strict';import {coalesceRanges} from './merge-windows.mjs';test('SYNTHETIC minimal fixture, not sufficient user coverage',()=>assert.deepEqual(coalesceRanges([[1,2],[3,4]]),[[1,4]]));`,
  'README.md':'SYNTHETIC harness fixture. This README does not satisfy real user documentation. Semantic reviews are simulated; never qualify live work.'});
function developmentPlan(request){
  return {requirements:[{id:'r1',text:request,requestQuote:request,
    criteria:[{id:'deliverable',text:'Create only the required files and independently execute the exact required test command.'}]}],
  nodes:[{id:'deliver',title:'Isolated interval implementation',purpose:'development',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],
    requirementIds:['r1'],dependencies:[],method:{id:'sorted-union',rationale:'Develop the bounded interval union under a fixed file and execution contract.',
      alternatives:['Finite-point oracle comparison.']},instructions:request,outputKind:'delivery',
    criteria:[{id:'deliverable',text:'Every file and exact execution obligation must be recorded before independent review.'}],
    tools:[...DEVELOPMENT_CASE.allowedTools],
    requiredEffects:[...DEVELOPMENT_FILES.map(path=>({type:'file',path,command:'',expectedExit:null})),
      {type:'execution',path:'.',command:canonical(DEVELOPMENT_COMMAND),expectedExit:0}],specialist:null}],
  finalNodeId:'deliver',routingRationale:'The deliverable has files and effects, so adaptive-v3 must use the signed planned route.'};
}
function developmentProviderFactory(){
  let calls=0,step=0;
  return ()=>({async generate(request){
    calls++;const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);let value;
    assert.equal(exposure.missionIntent,DEVELOPMENT_CASE.request);
    if(Object.hasOwn(request.schema.properties,'plan')){
      if(!task.inspectedRoleContracts)value={action:'inspect',roleIds:['omega_02','omega_03'],
        reason:'Inspect the full producer and independent reviewer contracts before committing a file-writing plan.',plan:null};
      else{assert.deepEqual(task.inspectedRoleContracts.cards,['omega_02','omega_03'].map(getRole));
        value={action:'plan',roleIds:[],reason:'',plan:developmentPlan(task.originalRequest)};}
    }else if(Object.hasOwn(request.schema.properties,'artifactHash')){
      const artifact=exposure.artifacts.find(item=>item.id===task.candidateId);assert.ok(artifact);
      const evidence=[{kind:'artifact',id:artifact.id,hash:artifact.hash,quote:artifact.payload.body},
        ...exposure.toolObservations.filter(observation=>observation.relation==='OWN_ACTION'&&observation.status==='SUCCEEDED')
          .map(observation=>({kind:'tool',id:observation.id,hash:observation.hash,quote:observation.quoteText}))];
      value=compactCatalogReview({artifactHash:artifact.hash,purpose:artifact.payload.purpose,decision:'ACCEPT',
        checks:task.criteria.map(criterion=>({criterionId:criterion.id,verdict:'PASS',evidence,
          reason:'SIMULATED review exercises separate custody; the isolated post-delivery oracle remains outside the provider.'})),
        findings:[],uncertainty:'Provider is simulated. File receipts, execution receipts, snapshot binding and finite external oracle are independently checked.'},
      task.observedEvidenceCatalog);
    }else{
      const base={tool:'',argsJson:'',body:'',claims:[],method:'sorted-union',reason:''};
      value=step===0?{...base,action:'batch',argsJson:JSON.stringify(Object.entries(DEVELOPMENT_FILES_CONTENT)
        .map(([path,content])=>({tool:'workspace.write',args:{path,content,expectedHash:null}})))}
        :step===1?{...base,action:'batch',argsJson:JSON.stringify([...DEVELOPMENT_FILES.map(path=>({tool:'workspace.read',args:{path}})),
          {tool:'execution.run',args:{argv:DEVELOPMENT_COMMAND,cwd:'.'}}])}
        :{...base,action:'final',body:'Synthetic delivered files for isolated infrastructure validation. Not semantic qualification.'};
      step++;
    }
    await request.validate(value);
    return {value,receipt:{kind:'inference',status:'completed',simulation:true,threadId:`sim-v3-development-${calls}`,
      turnId:`sim-v3-development-turn-${calls}`,model:request.model,reasoningEffort:request.reasoningEffort,
      contextHash:inferenceRequestHash(request)}};
  },async close(){}});
}

test('adaptive-v3 planned file-and-test row binds recorded effects to a real isolated post-delivery oracle and no-replay',async t=>{
  const path=directory(t),result=await runFullRouteCase({runtimeRoot,directory:path,spec:DEVELOPMENT_CASE,
    mode:'adaptive-v3-planned',providerFactory:developmentProviderFactory()});
  assert.equal(result.structuralPassed,true,JSON.stringify(result));assert.equal(result.passed,false);
  assert.equal(result.actualSubscription,false);assert.equal(result.calls.length,7);
  assert.equal(result.checks.adaptiveV3,true);assert.equal(result.checks.noReplay,true);
  assert.equal(result.external.passed,true);assert.equal(result.external.content.checks,3193);
  assert.equal(result.external.binding.sameSnapshot,true);assert.equal(result.external.unchanged,true);
  const external=JSON.parse(fs.readFileSync(join(path,'external-execution.json')));
  assert.equal(external.simulation,false);assert.equal(external.isolation.scratchRemoved,true);assert.equal(external.isolation.processesTerminated,true);
  const report=JSON.parse(fs.readFileSync(join(path,'report.json'))),execution=readDurableQualificationEffects({directory:path,missionId:result.missionId})
    .filter(effect=>effect.tool==='execution.run');
  assert.equal(report.adaptiveV3.selectedEntryMode,'planned');assert.equal(report.adaptiveV3.originRecord,null);
  assert.equal(report.metrics.integrity,'NOT_ATTESTED');assert.deepEqual(report.effects,[],'Operational effects remain outside the public report boundary');
  assert.equal(execution.length,2);assert.notEqual(execution[0].principalId,execution[1].principalId);
  const reentry=JSON.parse(fs.readFileSync(join(path,'reentry.json')));assert.equal(reentry.material.readLeases.length,3);
  const audit=auditAdaptiveV3QualificationCase({directory:path,row:'development'});
  assert.equal(audit.status,'QUALIFIED_FOR_DECLARED_ROW',JSON.stringify(audit));assert.equal(audit.checks.readOnly,true);
  const reentryPath=join(path,'reentry.json'),original=fs.readFileSync(reentryPath,'utf8'),forged=JSON.parse(original);
  assert.ok(forged.restart.guards.workspaceReads.length>0);
  forged.restart.guards.workspaceReads[0].path='forged-path-that-was-never-validated';
  fs.writeFileSync(reentryPath,JSON.stringify(forged,null,2),{mode:0o600});
  const forgedBefore=evidenceSnapshot(path),forgedAudit=auditAdaptiveV3QualificationCase({directory:path,row:'development'});
  assert.equal(forgedAudit.status,'OBSERVED_NOT_QUALIFIED',JSON.stringify(forgedAudit));
  assert.equal(forgedAudit.error.code,'ADAPTIVE_V3_READ_ONLY_AUDIT',JSON.stringify(forgedAudit));
  assert.equal(forgedAudit.checks.readOnly,true);assert.deepEqual(evidenceSnapshot(path),forgedBefore);
  fs.writeFileSync(reentryPath,original,{mode:0o600});
  // This owner projection was previously unused by the audit.  It is now
  // covered by the pre-reentry Authority receipt, so changing a field that
  // does not affect the finite oracle must still make the row unusable.
  const ownerPath=join(path,'external-execution-owner.json'),ownerOriginal=fs.readFileSync(ownerPath,'utf8'),forgedOwner=JSON.parse(ownerOriginal);
  forgedOwner.scratch=forgedOwner.scratch+'-forged';
  fs.writeFileSync(ownerPath,JSON.stringify(forgedOwner,null,2),{mode:0o600});
  const ownerBefore=evidenceSnapshot(path),ownerAudit=auditAdaptiveV3QualificationCase({directory:path,row:'development'});
  assert.equal(ownerAudit.status,'OBSERVED_NOT_QUALIFIED',JSON.stringify(ownerAudit));
  assert.equal(ownerAudit.error.code,'ADAPTIVE_V3_READ_ONLY_AUDIT',JSON.stringify(ownerAudit));
  assert.equal(ownerAudit.checks.readOnly,true);assert.deepEqual(evidenceSnapshot(path),ownerBefore);
  fs.writeFileSync(ownerPath,ownerOriginal,{mode:0o600});
  const ownerBackup=ownerPath+'.missing';
  fs.renameSync(ownerPath,ownerBackup);
  try{
    const missingBefore=evidenceSnapshot(path),missingAudit=auditAdaptiveV3QualificationCase({directory:path,row:'development'});
    assert.equal(missingAudit.status,'OBSERVED_NOT_QUALIFIED',JSON.stringify(missingAudit));
    assert.equal(missingAudit.error.code,'ADAPTIVE_V3_READ_ONLY_AUDIT',JSON.stringify(missingAudit));
    assert.equal(missingAudit.checks.readOnly,true);assert.deepEqual(evidenceSnapshot(path),missingBefore);
  }finally{fs.renameSync(ownerBackup,ownerPath);}
});

function recoveryPlan(request,{revision=false}={}){
  const method=revision?{id:'independent-reconstruction',
    rationale:'The material rejection showed that the earlier direct synthesis omitted a term, so reconstruct every original term before summing.',
    alternatives:['Rejected unenumerated direct synthesis']}:{id:'direct-synthesis',
    rationale:'Initially synthesize the bounded result directly from the immutable request.',alternatives:['Term-by-term reconstruction']};
  const instructions=revision?`${request} Recompute every original term explicitly before constructing the final bounded result.`:request;
  return {requirements:[{id:'r1',text:request,requestQuote:request,
    criteria:[{id:'sum',text:'The result must account for both original terms exactly once.'}]}],
  nodes:[{id:'deliver',title:'Bounded sum',purpose:'deliver',roleIds:['omega_02'],reviewerRoleIds:['omega_03'],
    requirementIds:['r1'],dependencies:[],method,instructions,outputKind:'delivery',
    criteria:[{id:'sum',text:'The result must account for both original terms exactly once.'}],tools:[],requiredEffects:[],specialist:null}],
  finalNodeId:'deliver',routingRationale:'A material rejection can only trigger the bounded reviewed-method-v1 revision, never an unrecorded retry.'};
}
function recoveryProviderFactory(){
  let calls=0;
  return ()=>({async generate(request){
    calls++;const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);let value;
    assert.equal(exposure.missionIntent,RECOVERY_CASE.request);
    assert.equal(Object.hasOwn(task,'expected'),false,'The independent recovery oracle must not be present in provider context');
    if(Object.hasOwn(request.schema.properties,'plan')){
      if(!task.inspectedRoleContracts)value={action:'inspect',roleIds:['omega_02','omega_03'],
        reason:'Inspect the full producer and independent reviewer contracts before selecting or revising the bounded method.',plan:null};
      else{assert.deepEqual(task.inspectedRoleContracts.cards,['omega_02','omega_03'].map(getRole));
        const plan=recoveryPlan(task.originalRequest,{revision:Boolean(task.previousPlan)});
        assert.equal(JSON.stringify(plan).includes('13'),false,'The recovery plan must not carry the external oracle answer');
        value={action:'plan',roleIds:[],reason:'',plan};}
    }else if(Object.hasOwn(request.schema.properties,'artifactHash')){
      const artifact=exposure.artifacts.find(item=>item.id===task.candidateId);assert.ok(artifact);
      const rejected=task.purpose==='deliver'&&artifact.payload.body==='9';
      const evidence=[{kind:'artifact',id:artifact.id,hash:artifact.hash,quote:artifact.payload.body}];
      value=compactCatalogReview({artifactHash:artifact.hash,purpose:artifact.payload.purpose,decision:rejected?'RETURN':'ACCEPT',
        checks:task.criteria.map(criterion=>({criterionId:criterion.id,verdict:rejected?'FAIL':'PASS',evidence,
          reason:rejected?'SIMULATED material finding: the candidate omitted the second original term.':'SIMULATED independent acceptance of the causally changed method.'})),
        findings:rejected?[{severity:'material',description:'The bounded candidate omitted a required original term.',
          recovery:'Reconstruct every original term explicitly before final synthesis.'}]:[],
        uncertainty:'Simulated review judgment; route, rejection lineage, revised-plan binding and external finite oracle are checked independently.'},
      task.observedEvidenceCatalog);
    }else value={action:'final',tool:'',argsJson:'',claims:[],method:'bounded-sum',reason:'Return the candidate for independent review only.',
      body:task.node.instructions.includes('Recompute every original term explicitly')?'13':'9'};
    await request.validate(value);
    return {value,receipt:{kind:'inference',status:'completed',simulation:true,threadId:`sim-v3-recovery-${calls}`,
      turnId:`sim-v3-recovery-turn-${calls}`,model:request.model,reasoningEffort:request.reasoningEffort,
      contextHash:inferenceRequestHash(request)}};
  },async close(){}});
}

test('adaptive-v3 planned method-recovery row retains the material rejection, accepts a causally different method and never regenerates the rejected output',async t=>{
  const path=directory(t),policy=fullRoutePolicy(RECOVERY_CASE,'adaptive-v3-planned');
  assert.equal(policy.maxNodeAttempts,1);assert.throws(()=>fullRoutePolicy({...RECOVERY_CASE,qualificationMaxNodeAttempts:2},'adaptive-v3-planned'),
    {code:'EXPERIMENT_BOUNDARY'});
  const result=await runFullRouteCase({runtimeRoot,directory:path,spec:RECOVERY_CASE,mode:'adaptive-v3-planned',
    providerFactory:recoveryProviderFactory()});
  assert.equal(result.structuralPassed,true,JSON.stringify(result));assert.equal(result.passed,false);
  assert.equal(result.actualSubscription,false);assert.equal(result.calls.length,10);
  assert.equal(result.external.passed,true);assert.equal(result.checks.adaptiveV3,true);assert.equal(result.checks.noReplay,true);
  const report=JSON.parse(fs.readFileSync(join(path,'report.json')));
  assert.equal(report.adaptiveV3.selectedEntryMode,'planned');assert.equal(report.methodRecovery.rounds.length,1);
  const round=report.methodRecovery.rounds[0];assert.equal(round.status,'INSTALLED_HISTORICALLY');
  assert.equal(round.failures,undefined,'Public recovery progress omits private rejected-product diagnosis');
  const recovery=readDurableQualificationRecovery({directory:path,missionId:result.missionId});
  assert.equal(recovery.integrity,'VERIFIED');assert.equal(recovery.rounds,1);
  assert.equal(recovery.previousMethod,'direct-synthesis');assert.equal(recovery.replacementMethod,'independent-reconstruction');
  const store=new Store(join(path,'state.sqlite'));
  try{
    const artifacts=store.list('artifact').filter(record=>record.data.missionId===result.missionId);
    assert.equal(artifacts.filter(record=>record.data.payload.body==='9').length,1);
    assert.equal(artifacts.filter(record=>record.data.payload.body==='13'&&record.data.status==='ACCEPTED').length,1);
  }finally{store.close();}
  const audit=auditAdaptiveV3QualificationCase({directory:path,row:'recovery'});
  assert.equal(audit.status,'QUALIFIED_FOR_DECLARED_ROW',JSON.stringify(audit));assert.equal(audit.checks.readOnly,true);
});

const SPECIALIST_CHARTER=ADAPTIVE_V3_SPECIALIST_CHARTER;
function specialistPlan(request){
  return {requirements:[{id:'r1',text:request,requestQuote:request,
    criteria:[{id:'result',text:'Return the exact bounded JSON result after the independently reviewed chartered derivation.'}]}],
  nodes:[{id:'derive',title:'Finite local derivation',purpose:'derive',roleIds:[],reviewerRoleIds:['omega_03'],
    requirementIds:['r1'],dependencies:[],method:{id:'enumerate-candidates',rationale:'The accepted charter supplies the finite derivation method.',
      alternatives:['An unchartered catalog role is not permitted.']},instructions:request,outputKind:'delivery',
    criteria:[{id:'result',text:'Return the exact bounded JSON result.'}],tools:[],requiredEffects:[],specialist:SPECIALIST_CHARTER}],
  finalNodeId:'derive',routingRationale:'The specialist is mission-local and must be accepted through the signed planned route before it can receive a producer scope.'};
}
function specialistProviderFactory(){
  let calls=0;
  return ()=>({async generate(request){
    calls++;const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);let value;
    assert.equal(exposure.missionIntent,SPECIALIST_CASE.request);
    if(Object.hasOwn(request.schema.properties,'plan')){
      if(!task.inspectedRoleContracts)value={action:'inspect',roleIds:['omega_03'],
        reason:'Inspect the independent catalog reviewer contract before committing the mission-local specialist charter.',plan:null};
      else{assert.deepEqual(task.inspectedRoleContracts.cards,[getRole('omega_03')]);
        value={action:'plan',roleIds:[],reason:'',plan:specialistPlan(task.originalRequest)};}
    }else if(Object.hasOwn(request.schema.properties,'artifactHash')){
      const artifact=exposure.artifacts.find(item=>item.id===task.candidateId);assert.ok(artifact);
      if(task.purpose==='plan'){
        assert.deepEqual(task.targetRoleContracts.assignments[0].standaloneSpecialist,SPECIALIST_CHARTER);
        assert.deepEqual(task.targetRoleContracts.cards.map(card=>card.id),['omega_03']);
      }
      value=compactCatalogReview({artifactHash:artifact.hash,purpose:artifact.payload.purpose,decision:'ACCEPT',
        checks:task.criteria.map(criterion=>({criterionId:criterion.id,verdict:'PASS',
          evidence:[{kind:'artifact',id:artifact.id,hash:artifact.hash,quote:artifact.payload.body}],
          reason:'SIMULATED review exercises the charter and independent acceptance binding, not specialist competence.'})),
        findings:[],uncertainty:'Provider is simulated. This row qualifies charter custody and authority boundaries only.'},task.observedEvidenceCatalog);
    }else{
      assert.match(request.instructions,/STANDALONE SPECIALIST/);assert.ok(request.instructions.includes(JSON.stringify(SPECIALIST_CHARTER.methods[0])));
      assert.equal(exposure.planViews.length,1);
      value={action:'final',tool:'',argsJson:'',body:JSON.stringify(SPECIALIST_CASE.expected),claims:[],method:'enumerate-candidates',
        reason:'Return the bounded candidate for separate reviewer acceptance.'};
    }
    await request.validate(value);
    return {value,receipt:{kind:'inference',status:'completed',simulation:true,threadId:`sim-v3-specialist-${calls}`,
      turnId:`sim-v3-specialist-turn-${calls}`,model:request.model,reasoningEffort:request.reasoningEffort,
      contextHash:inferenceRequestHash(request)}};
  },async close(){}});
}

test('adaptive-v3 planned specialist row binds its exact charter to a zero-tool producer and separate catalog reviewer without re-entry inference',async t=>{
  const path=directory(t),result=await runFullRouteCase({runtimeRoot,directory:path,spec:SPECIALIST_CASE,mode:'adaptive-v3-planned',
    providerFactory:specialistProviderFactory()});
  assert.equal(result.structuralPassed,true,JSON.stringify(result));assert.equal(result.passed,false);
  assert.equal(result.calls.length,5);assert.equal(result.external.passed,true);assert.equal(result.checks.adaptiveV3,true);
  assert.equal(result.checks.scopedEffects,true);assert.equal(result.checks.noReplay,true);
  const store=new Store(join(path,'state.sqlite'));
  try{
    const config=store.list('worker-config').find(record=>record.data.standaloneSpecialist)?.data;assert.ok(config);
    assert.deepEqual(config.roleIds,[]);assert.deepEqual(config.standaloneSpecialist.charter,SPECIALIST_CHARTER);
    assert.equal(config.standaloneSpecialist.nodeId,'derive');assert.equal(config.learnedInstructionVersions.length,0);
    const plan=store.get('plan',result.missionId).data;
    assert.equal(config.standaloneSpecialist.planArtifactId,plan.acceptedPlanArtifactId);
    const effect=store.list('effect').filter(record=>record.data.missionId===result.missionId);assert.equal(effect.length,0);
    const producer=store.list('run').find(record=>record.data.missionId===result.missionId&&record.data.nodeId==='derive'&&record.data.mode==='producer').data;
    const reviewer=store.list('run').find(record=>record.data.missionId===result.missionId&&record.data.nodeId==='review:derive'&&record.data.mode==='reviewer').data;
    assert.notEqual(producer.id,reviewer.id);assert.equal(reviewer.context.producerConversationIncluded,false);
  }finally{store.close();}
  const report=JSON.parse(fs.readFileSync(join(path,'report.json')));
  assert.equal(report.adaptiveV3.selectedEntryMode,'planned');assert.equal(report.nodes[0].specialistMode,'standalone');
  assert.deepEqual(report.nodes[0].specialist,SPECIALIST_CHARTER);
  const beforeAudit=evidenceSnapshot(path);
  assert.equal(fs.existsSync(join(path,'state.sqlite-wal')),false);assert.equal(fs.existsSync(join(path,'state.sqlite-shm')),false);
  const audit=auditAdaptiveV3QualificationCase({directory:path,row:'specialist'});
  assert.equal(audit.status,'QUALIFIED_FOR_DECLARED_ROW',JSON.stringify(audit));assert.equal(audit.checks.readOnly,true);
  assert.deepEqual(evidenceSnapshot(path),beforeAudit);
  assert.equal(fs.existsSync(join(path,'state.sqlite-wal')),false);assert.equal(fs.existsSync(join(path,'state.sqlite-shm')),false);
  fs.writeFileSync(join(path,'state.sqlite-wal'),'uncheckpointed sidecar',{flag:'wx',mode:0o600});
  const sidecarBefore=evidenceSnapshot(path),sidecarAudit=auditAdaptiveV3QualificationCase({directory:path,row:'specialist'});
  assert.equal(sidecarAudit.status,'OBSERVED_NOT_QUALIFIED');assert.equal(sidecarAudit.error.code,'ADAPTIVE_V3_READ_ONLY_AUDIT');
  assert.equal(sidecarAudit.checks.readOnly,true);assert.deepEqual(evidenceSnapshot(path),sidecarBefore);
});

async function retainedSpecialistSource(t){
  const source=directory(t),result=await runFullRouteCase({runtimeRoot,directory:source,spec:SPECIALIST_CASE,mode:'adaptive-v3-planned',
    providerFactory:specialistProviderFactory()});
  assert.equal(result.structuralPassed,true,JSON.stringify(result));
  return source;
}

async function retainedDevelopmentSource(t){
  const source=directory(t),result=await runFullRouteCase({runtimeRoot,directory:source,spec:DEVELOPMENT_CASE,mode:'adaptive-v3-planned',
    providerFactory:developmentProviderFactory()});
  assert.equal(result.structuralPassed,true,JSON.stringify(result));
  return source;
}

test('adaptive-v3 retained bundle survives source deletion and a fresh-process read-only audit only with its externally supplied manifest hash',async t=>{
  const source=await retainedSpecialistSource(t),target=bundleTarget(t),retained=retainAdaptiveV3QualificationBundle({sourceDirectory:source,targetDirectory:target,row:'specialist'});
  assert.equal(retained.terminalStatus,'QUALIFIED_FOR_DECLARED_ROW');assert.equal(fs.existsSync(join(target,'payload','workspace')),true);
  assert.equal(fs.statSync(target).mode&0o777,0o500);assert.equal(fs.statSync(join(target,'payload')).mode&0o777,0o500);
  assert.equal(auditAdaptiveV3QualificationBundle({directory:target,row:'specialist'}).status,'NOT_RUN');
  const wrong=auditAdaptiveV3QualificationBundle({directory:target,row:'specialist',expectedManifestSha256:'0'.repeat(64)});
  assert.equal(wrong.status,'OBSERVED_NOT_QUALIFIED');assert.equal(wrong.error.code,'BUNDLE_EXTERNAL_ANCHOR');
  fs.rmSync(source,{recursive:true,force:true});assert.equal(fs.existsSync(source),false);
  const child=JSON.parse(execFileSync(process.execPath,['--input-type=module','--eval',
    `import {auditAdaptiveV3QualificationBundle as audit} from ${JSON.stringify(bundleModuleUrl)};process.stdout.write(JSON.stringify(audit(${JSON.stringify({directory:target,row:'specialist',expectedManifestSha256:retained.manifestSha256})})));`],
  {cwd:runtimeRoot,encoding:'utf8'}));
  assert.equal(child.status,'QUALIFIED_FOR_DECLARED_ROW',JSON.stringify(child));assert.equal(child.checks.externalAnchor,true);
  assert.equal(child.checks.payload,true);assert.equal(child.checks.workspaceBinding,true);assert.equal(child.checks.verifierInputs,true);assert.equal(child.checks.postClose,true);assert.equal(child.checks.readOnly,true);
});

test('adaptive-v3 retained development bundle carries the exact B workspace snapshot into its post-close audit',async t=>{
  const source=await retainedDevelopmentSource(t),target=bundleTarget(t),retained=retainAdaptiveV3QualificationBundle({sourceDirectory:source,targetDirectory:target,row:'development'});
  assert.equal(retained.terminalStatus,'QUALIFIED_FOR_DECLARED_ROW');
  const audit=JSON.parse(execFileSync(process.execPath,['--input-type=module','--eval',
    `import {auditAdaptiveV3QualificationBundle as audit} from ${JSON.stringify(bundleModuleUrl)};process.stdout.write(JSON.stringify(audit(${JSON.stringify({directory:target,row:'development',expectedManifestSha256:retained.manifestSha256})})));`],
  {cwd:runtimeRoot,encoding:'utf8'}));
  assert.equal(audit.status,'QUALIFIED_FOR_DECLARED_ROW',JSON.stringify(audit));assert.equal(audit.checks.workspaceBinding,true);assert.equal(audit.checks.readOnly,true);
});

test('adaptive-v3 retention rejects unclosed source topology yet preserves a completed captured row whose post-close audit is negative',async t=>{
  const source=await retainedSpecialistSource(t);
  for(const sidecar of ['state.sqlite-wal','state.sqlite-shm']){
    const sidecarTarget=bundleTarget(t);fs.writeFileSync(join(source,sidecar),'sidecar',{flag:'wx',mode:0o600});
    assert.throws(()=>retainAdaptiveV3QualificationBundle({sourceDirectory:source,targetDirectory:sidecarTarget,row:'specialist'}),{code:'BUNDLE_SQLITE_SIDECAR'});
    assert.equal(fs.existsSync(sidecarTarget),false);fs.unlinkSync(join(source,sidecar));
  }
  const symlinkTarget=bundleTarget(t);fs.symlinkSync('state.sqlite',join(source,'untrusted-link'));
  assert.throws(()=>retainAdaptiveV3QualificationBundle({sourceDirectory:source,targetDirectory:symlinkTarget,row:'specialist'}),{code:'BUNDLE_SYMLINK'});
  assert.equal(fs.existsSync(symlinkTarget),false);fs.unlinkSync(join(source,'untrusted-link'));
  const reentryPath=join(source,'reentry.json'),reentry=JSON.parse(fs.readFileSync(reentryPath,'utf8'));reentry.restart.freshInstance=false;
  fs.writeFileSync(reentryPath,JSON.stringify(reentry,null,2)+'\n',{mode:0o600});
  const target=bundleTarget(t),retained=retainAdaptiveV3QualificationBundle({sourceDirectory:source,targetDirectory:target,row:'specialist'});
  assert.equal(retained.terminalStatus,'OBSERVED_NOT_QUALIFIED');
  const audit=auditAdaptiveV3QualificationBundle({directory:target,row:'specialist',expectedManifestSha256:retained.manifestSha256});
  assert.equal(audit.status,'OBSERVED_NOT_QUALIFIED',JSON.stringify(audit));assert.equal(audit.checks.payload,true);assert.equal(audit.checks.postClose,true);
});

test('adaptive-v3 retention rejects a workspace changed after B and never creates a bundle from that post-close mutation',async t=>{
  const source=await retainedDevelopmentSource(t),workspace=join(source,'workspace'),missionDirectory=fs.readdirSync(workspace).at(0);
  assert.ok(missionDirectory?.startsWith('mission-'));
  const missionWorkspace=join(workspace,missionDirectory),changed=join(missionWorkspace,'merge-windows.mjs'),original=fs.readFileSync(changed);
  fs.appendFileSync(changed,'\n// post-B mutation must never become retained evidence\n');
  const before=evidenceSnapshot(source),target=bundleTarget(t);
  assert.throws(()=>retainAdaptiveV3QualificationBundle({sourceDirectory:source,targetDirectory:target,row:'development'}),{code:'BUNDLE_WORKSPACE_BINDING'});
  assert.equal(fs.existsSync(target),false);assert.deepEqual(evidenceSnapshot(source),before);
  fs.writeFileSync(changed,original,{mode:0o600});
  const extra=join(missionWorkspace,'post-b-extra.txt');fs.writeFileSync(extra,'unobserved extra',{flag:'wx',mode:0o600});
  const extraBefore=evidenceSnapshot(source),extraTarget=bundleTarget(t);
  assert.throws(()=>retainAdaptiveV3QualificationBundle({sourceDirectory:source,targetDirectory:extraTarget,row:'development'}),{code:'BUNDLE_WORKSPACE_BINDING'});
  assert.equal(fs.existsSync(extraTarget),false);assert.deepEqual(evidenceSnapshot(source),extraBefore);
});

test('adaptive-v3 retention rejects a target nested in its source before reservation and never clobbers an existing target',async t=>{
  const source=await retainedSpecialistSource(t),before=evidenceSnapshot(source),nested=join(source,'retained-bundle');
  assert.throws(()=>retainAdaptiveV3QualificationBundle({sourceDirectory:source,targetDirectory:nested,row:'specialist'}),{code:'BUNDLE_LAYOUT'});
  assert.equal(fs.existsSync(nested),false);assert.deepEqual(evidenceSnapshot(source),before);
  const existing=bundleTarget(t);fs.mkdirSync(existing,{mode:0o700});fs.writeFileSync(join(existing,'sentinel'),'do-not-replace',{mode:0o600});
  assert.throws(()=>retainAdaptiveV3QualificationBundle({sourceDirectory:source,targetDirectory:existing,row:'specialist'}),{code:'BUNDLE_TARGET_EXISTS'});
  assert.equal(fs.readFileSync(join(existing,'sentinel'),'utf8'),'do-not-replace');assert.deepEqual(evidenceSnapshot(source),before);
});

test('adaptive-v3 retained bundle rejects byte, SQLite/external/post-close, topology, link, manifest and verifier mutations without writing evidence',async t=>{
  const source=await retainedSpecialistSource(t),baseline=bundleTarget(t),retained=retainAdaptiveV3QualificationBundle({sourceDirectory:source,targetDirectory:baseline,row:'specialist'});
  const verifyMutation=({name,mutate,code,status='OBSERVED_NOT_QUALIFIED',replacementAnchor=false,afterSeal=false})=>{
    const target=cloneBundle(t,baseline);unlockTree(target);if(!afterSeal)mutate(target);
    sealBundleTree(target);if(afterSeal)mutate(target);const anchor=replacementAnchor?sha256(fs.readFileSync(join(target,'manifest.json'))):retained.manifestSha256;
    const before=evidenceSnapshot(target),audit=auditAdaptiveV3QualificationBundle({directory:target,row:'specialist',expectedManifestSha256:anchor});
    assert.equal(audit.status,status,name+': '+JSON.stringify(audit));assert.equal(audit.error.code,code,name+': '+JSON.stringify(audit));
    assert.deepEqual(evidenceSnapshot(target),before,name+': auditor must not write retained evidence');
  };
  verifyMutation({name:'payload JSON',mutate:target=>fs.writeFileSync(join(target,'payload','result.json'),'{}\n',{mode:0o600}),code:'BUNDLE_PAYLOAD_DECLARATION'});
  verifyMutation({name:'payload SQLite',mutate:target=>fs.writeFileSync(join(target,'payload','state.sqlite'),'not sqlite',{mode:0o600}),code:'BUNDLE_PAYLOAD_TOPOLOGY'});
  verifyMutation({name:'external projection',mutate:target=>fs.writeFileSync(join(target,'payload','external-oracle.json'),'{}\n',{mode:0o600}),code:'BUNDLE_PAYLOAD_TOPOLOGY'});
  verifyMutation({name:'post-close audit',mutate:target=>fs.writeFileSync(join(target,'post-close-audit.json'),'{}\n',{mode:0o600}),code:'BUNDLE_POST_CLOSE'});
  verifyMutation({name:'payload extra',mutate:target=>fs.writeFileSync(join(target,'payload','extra.json'),'{}\n',{mode:0o600}),code:'BUNDLE_PAYLOAD_TOPOLOGY'});
  verifyMutation({name:'payload mode',mutate:target=>fs.chmodSync(join(target,'payload','result.json'),0o444),code:'BUNDLE_PAYLOAD_TOPOLOGY',afterSeal:true});
  verifyMutation({name:'top-level root mode',mutate:target=>fs.chmodSync(target,0o700),code:'BUNDLE_TOP_LEVEL_MODE',afterSeal:true});
  verifyMutation({name:'top-level extra',mutate:target=>fs.writeFileSync(join(target,'extra.json'),'{}\n',{mode:0o600}),code:'BUNDLE_TOPOLOGY'});
  verifyMutation({name:'payload dangling symlink',mutate:target=>fs.symlinkSync('does-not-exist',join(target,'payload','outside-link')),code:'BUNDLE_SYMLINK'});
  verifyMutation({name:'payload hardlink',mutate:target=>fs.linkSync(join(target,'payload','result.json'),join(target,'payload','duplicate-result.json')),code:'BUNDLE_HARDLINK'});
  for(const name of ['state.sqlite-wal','state.sqlite-shm'])verifyMutation({name,mutate:target=>fs.writeFileSync(join(target,'payload',name),'sidecar',{mode:0o600}),code:'BUNDLE_SQLITE_SIDECAR'});
  verifyMutation({name:'manifest payload declaration',mutate:target=>{const path=join(target,'manifest.json'),manifest=JSON.parse(fs.readFileSync(path,'utf8'));
    manifest.payload.declared.caseId='forged-case';fs.writeFileSync(path,JSON.stringify(manifest,null,2)+'\n',{mode:0o600});},code:'BUNDLE_PAYLOAD_DECLARATION',replacementAnchor:true});
  verifyMutation({name:'malformed manifest',mutate:target=>{const path=join(target,'manifest.json'),manifest=JSON.parse(fs.readFileSync(path,'utf8'));manifest.schema='not-a-bundle';fs.writeFileSync(path,JSON.stringify(manifest,null,2)+'\n',{mode:0o600});},code:'BUNDLE_MANIFEST',replacementAnchor:true});
  verifyMutation({name:'verifier drift',mutate:target=>{const path=join(target,'manifest.json'),manifest=JSON.parse(fs.readFileSync(path,'utf8')),
    input=manifest.verifierInputs.files.find(file=>file.path==='reconstruction/verification/adaptive-v3-qualification-audit.mjs');assert.ok(input);input.sha256='0'.repeat(64);fs.writeFileSync(path,JSON.stringify(manifest,null,2)+'\n',{mode:0o600});},code:'BUNDLE_VERIFIER_DRIFT',status:'NOT_RUN',replacementAnchor:true});
});

test('adaptive-v3 qualification auditor requires the runtime restart attestation and exact durable re-entry journal without writing evidence',async t=>{
  const path=directory(t),result=await runFullRouteCase({runtimeRoot,directory:path,spec:SPECIALIST_CASE,mode:'adaptive-v3-planned',
    providerFactory:specialistProviderFactory()});
  assert.equal(result.structuralPassed,true,JSON.stringify(result));
  const reentryPath=join(path,'reentry.json'),original=fs.readFileSync(reentryPath,'utf8');
  for(const {name,mutate} of [
    {name:'same-instance attestation',mutate:reentry=>{reentry.restart.freshInstance=false;}},
    {name:'non-facade restart attestation',mutate:reentry=>{reentry.restart.brokerReadOnlyFacade=false;}},
    {name:'missing restart attestation',mutate:reentry=>{delete reentry.restart;}},
    {name:'missing durable journal delta',mutate:reentry=>{delete reentry.journal;}},
  ]){
    const reentry=JSON.parse(original);mutate(reentry);
    fs.writeFileSync(reentryPath,JSON.stringify(reentry,null,2),{mode:0o600});
    const beforeAudit=evidenceSnapshot(path),audit=auditAdaptiveV3QualificationCase({directory:path,row:'specialist'});
    assert.equal(audit.status,'OBSERVED_NOT_QUALIFIED',name+': '+JSON.stringify(audit));
    assert.equal(audit.error.code,'ADAPTIVE_V3_READ_ONLY_AUDIT',name+': '+JSON.stringify(audit));
    assert.equal(audit.checks.readOnly,true,name+': '+JSON.stringify(audit));
    assert.deepEqual(evidenceSnapshot(path),beforeAudit,name+': audit must not modify tampered evidence');
  }
  fs.writeFileSync(reentryPath,original,{mode:0o600});
  const restored=auditAdaptiveV3QualificationCase({directory:path,row:'specialist'});
  assert.equal(restored.status,'QUALIFIED_FOR_DECLARED_ROW',JSON.stringify(restored));
});

test('adaptive-v3 qualification auditor never reconstructs a missing row or creates evidence',t=>{
  const path=directory(t),before=fs.readdirSync(path);
  const audit=auditAdaptiveV3QualificationCase({directory:path,row:'sources'});
  assert.equal(audit.status,'NOT_RUN');assert.deepEqual(fs.readdirSync(path),before);
});

test('adaptive-v3 planned qualification rejects a subscription arm before it can create state or construct a provider',async t=>{
  const path=directory(t);let providers=0;
  await assert.rejects(runFullRouteCase({runtimeRoot,directory:path,spec:SPECIALIST_CASE,mode:'adaptive-v3-planned',simulation:false,
    providerFactory:()=>{providers++;throw Error('Provider construction must be unreachable');}}),{code:'EXPERIMENT_BOUNDARY'});
  assert.equal(providers,0);assert.equal(fs.existsSync(join(path,'state.sqlite')),false);assert.deepEqual(fs.readdirSync(path),[]);
});

test('adaptive-v3 planned sources qualification refuses an absent fixture before a real transport or provider can exist',async t=>{
  const path=directory(t);let providers=0;
  await assert.rejects(runFullRouteCase({runtimeRoot,directory:path,spec:SOURCES_CASE,mode:'adaptive-v3-planned',
    providerFactory:()=>{providers++;throw Error('Provider construction must be unreachable');}}),{code:'EXPERIMENT_BOUNDARY'});
  assert.equal(providers,0);assert.equal(fs.existsSync(join(path,'state.sqlite')),false);assert.deepEqual(fs.readdirSync(path),[]);
});
