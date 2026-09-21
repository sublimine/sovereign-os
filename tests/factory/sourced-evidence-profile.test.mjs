import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {ToolBroker} from '../../factory/tools/broker.mjs';
import {SOURCED_RESPONSE_ACQUISITION_V2,SOURCED_RESPONSE_CRITERIA,SOURCED_RESPONSE_PURPOSE,sourcedResponseContractHash,sourcedResponseNode} from '../../factory/lib/sourced-response-spec.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {makeSourcedResponseBinding} from '../../factory/lib/sourced-response-contract.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {compactCatalogReview} from '../../factory/lib/review-codec.mjs';
import {ES_USED_CAR_LISTING_EVIDENCE_PROFILE_ID,ES_USED_CAR_LISTING_EVIDENCE_PROFILE_V2_ID,isEsUsedCarListingPublicFieldsQuestion,sourcedEvidenceProfileForId,sourcedEvidenceProfileNextSeed} from '../../factory/lib/sourced-evidence-profile.mjs';

const QUESTION='Pregunta, cuales son la informacion clave que deberia tener cada anuncio de coche. Es decir kilometraje, ciudad, año etc… cuales son las que deberian verse para el piblico. Aver que.';
const profile=()=>sourcedEvidenceProfileForId(ES_USED_CAR_LISTING_EVIDENCE_PROFILE_ID);
const SOURCED_BOUNDARY_CRITERIA=new Set(['sourced-eligibility','complete-request','public-listing-audience-v2']);
function compactSourcedReviewerFixture(value,exposure,task,{omitBoundaryCriteria=[]}={}){
  if(!task.candidateId)return value;
  const boundaries=(exposure.runtimeObservations??[]).filter(observation=>observation.kind==='sourced-answer-boundary');
  assert.equal(boundaries.length,1,'a sealed-profile reviewer receives exactly one signed answer boundary');
  assert.ok(Array.isArray(task.observedEvidenceCatalog),'a sealed-profile reviewer receives the closed evidence catalog');
  const boundary=boundaries[0],evidence={kind:'runtime',id:boundary.id,hash:boundary.hash,quote:boundary.quoteText};
  const omissions=new Set(omitBoundaryCriteria);
  const expanded={...value,checks:value.checks.map(checkResult=>SOURCED_BOUNDARY_CRITERIA.has(checkResult.criterionId)
    &&!omissions.has(checkResult.criterionId)
    ?{...checkResult,evidence:[...(checkResult.evidence??[]),evidence]}:checkResult)};
  return compactCatalogReview(expanded,task.observedEvidenceCatalog);
}
const v2Profile=()=>sourcedEvidenceProfileForId(ES_USED_CAR_LISTING_EVIDENCE_PROFILE_V2_ID);
const v2PublicListingBody=[
  '## Identificación y ficha\nMarca, modelo, versión, año o primera matriculación y kilometraje.',
  '## Mecánica y uso\nRecomendación editorial: combustible, cambio, potencia, etiqueta ambiental y equipamiento útil cuando se conozcan.',
  '## Estado e historial\nRecomendación editorial: estado, daños relevantes, mantenimiento, ITV, titulares y garantía cuando corresponda.',
  '## Precio y condiciones\nPrecio total y, como recomendación editorial, financiación, costes y condiciones materiales para comparar.',
  '## Ubicación y contacto\nCiudad y provincia o una zona amplia prudente, con el canal de contacto de la plataforma y sin dirección exacta.',
  '## Fotos y documentación\nFotos actuales del vehículo real; recomendación editorial de facilitar mantenimiento o verificaciones disponibles.',
].join('\n\n');
const sourceExclusiveClaims=(exposure,prefix)=>exposure.sources.map((source,index)=>({
  id:prefix+'-source-'+index,text:'La fuente sellada '+(index+1)+' respalda sólo su propio ámbito declarado.',kind:'fact',
  sources:[{sourceId:source.id,hash:source.hash,quote:source.raw}],basis:[],
  qualifiers:['Synthetic sealed-profile fixture.'],validUntil:null,
}));
function sealedProfileReview(exposure,task,{rawSourceOnlyAudience=false}={}){
  const artifact=exposure.artifacts.find(item=>item.id===task.candidateId),evidence=[
    {kind:'artifact',id:artifact.id,hash:artifact.hash,quote:artifact.payload.body},
    ...exposure.sources.map(source=>({kind:'source',id:source.id,hash:source.hash,quote:source.raw})),
  ];
  const value={artifactHash:artifact.hash,purpose:artifact.payload.purpose,decision:'ACCEPT',checks:task.criteria.map(criterion=>({
    criterionId:criterion.id,verdict:'PASS',evidence,reason:'Synthetic sealed-profile review fixture.',
  })),findings:[],uncertainty:'Synthetic transport only.'};
  if(rawSourceOnlyAudience){
    const audience=value.checks.find(checkResult=>checkResult.criterionId==='public-listing-audience-v2');
    assert.ok(audience,'the v2 profile gives the reviewer its audience-shape criterion');
    audience.evidence=[evidence.find(item=>item.kind==='source')];
  }
  return compactSourcedReviewerFixture(value,exposure,task,{omitBoundaryCriteria:rawSourceOnlyAudience
    ?['public-listing-audience-v2']:[]});
}
function v2ProfileFixture(t,{rawSourceOnlyAudience=false}={}){
  const dir=fs.mkdtempSync(join(tmpdir(),'sublimine-source-profile-v2-review-')),
    engine=new FactoryEngine({databasePath:join(dir,'state.sqlite'),workspaceRoot:join(dir,'jobs')}),
    selected=v2Profile(),fetches=[],reviewerCalls=[];
  let inferenceCount=0;
  t.after(()=>{engine.close();fs.rmSync(dir,{recursive:true,force:true});});
  engine.workers.maxReviewRepairs=0;
  engine.broker.lookup=async()=>[{address:'8.8.8.8',family:4}];
  engine.broker.transport=async request=>{
    fetches.push(request.url.href);
    const index=selected.sources.findIndex(source=>source.url===request.url.href);
    return {remoteAddress:request.address,statusCode:200,headers:{'content-type':'text/plain; charset=utf-8'},
      body:Buffer.from('Synthetic v2 sealed source '+(index+1)+'.')};
  };
  engine.workers.providerFactory=()=>({
    async generate(request){
      const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);let value;
      if(task.node?.id==='sourced-response-entry'){
        value=task.step<selected.sources.length
          ?{action:'tool',tool:'source.fetch',argsJson:JSON.stringify({url:selected.sources[task.step].url}),body:'',claims:[],
            method:'sealed-v2-seed-'+task.step,reason:''}
          :{action:'final',tool:'',argsJson:'',body:v2PublicListingBody,claims:sourceExclusiveClaims(exposure,'v2-public-listing'),
            method:'sealed-v2-public-listing',reason:''};
      }else if(task.candidateId){
        value=sealedProfileReview(exposure,task,{rawSourceOnlyAudience});
        reviewerCalls.push({exposure,task,value});
      }else throw Error('Unexpected v2 sealed-profile task');
      await request.validate(value);
      const call=++inferenceCount;
      return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:'profile-v2-'+call,turnId:'profile-v2-'+call,
        model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
    },
    async close(){return {processExitObserved:true};},
  });
  const mission=engine.create(QUESTION,{entryMode:'sourced-response-v1',sourcedFallback:'defer-only-v1',
    sourcedEvidenceProfile:ES_USED_CAR_LISTING_EVIDENCE_PROFILE_V2_ID});
  return {engine,mission,selected,fetches,reviewerCalls,run:()=>engine.run(mission.id)};
}

test('used-car listing v2 is a separate three-seed public product contract and does not rewrite v1',t=>{
  const dir=fs.mkdtempSync(join(tmpdir(),'sublimine-source-profile-v2-'));
  const engine=new FactoryEngine({databasePath:join(dir,'state.sqlite'),workspaceRoot:join(dir,'jobs')});
  t.after(()=>{engine.close();fs.rmSync(dir,{recursive:true,force:true});});
  const v1=sourcedEvidenceProfileForId(ES_USED_CAR_LISTING_EVIDENCE_PROFILE_ID);
  const v2=sourcedEvidenceProfileForId(ES_USED_CAR_LISTING_EVIDENCE_PROFILE_V2_ID);
  assert.equal(v1.acquisition.maxFetchIntents,2);
  assert.equal(v2.acquisition.maxFetchIntents,3);
  assert.deepEqual(v1.sources.map(source=>source.role),['MARKETPLACE_LISTING_FIELDS','PUBLIC_AUTHORITY_VERIFICATION']);
  assert.deepEqual(v2.sources.map(source=>source.role),[
    'MARKETPLACE_LISTING_FIELDS','MARKETPLACE_LOCATION_SAFETY_SIGNAL','MARKETPLACE_VISUAL_REPRESENTATION',
  ]);
  assert.equal(v2.sources.some(source=>source.url.includes('revista.dgt.es')),false);
  assert.equal(v2.answerRequirements.requiredSections.some(section=>section.id==='location'),true);
  assert.equal(v2.answerRequirements.audienceChecks.length,4);
  assert.equal(sourcedEvidenceProfileNextSeed(v2,[]).url,v2.sources[0].url);
  assert.equal(sourcedEvidenceProfileNextSeed(v2,[v2.sources[0].url]).url,v2.sources[1].url);
  assert.equal(sourcedEvidenceProfileNextSeed(v2,[v2.sources[0].url,v2.sources[1].url]).url,v2.sources[2].url);
  assert.equal(sourcedEvidenceProfileNextSeed(v2,v2.sources.map(source=>source.url)),null);
  assert.throws(()=>sourcedEvidenceProfileNextSeed(v2,[v2.sources[1].url]),{code:'SOURCED_EVIDENCE_PROFILE_SEQUENCE'});

  const v1Mission=engine.create(QUESTION,{entryMode:'sourced-response-v1',sourcedEvidenceProfile:ES_USED_CAR_LISTING_EVIDENCE_PROFILE_ID});
  const v2Mission=engine.create(QUESTION,{entryMode:'sourced-response-v1',sourcedEvidenceProfile:ES_USED_CAR_LISTING_EVIDENCE_PROFILE_V2_ID});
  assert.deepEqual(sourcedResponseNode(v1Mission).criteria,SOURCED_RESPONSE_CRITERIA);
  assert.equal(sourcedResponseNode(v2Mission).criteria.at(-1).id,'public-listing-audience-v2');
  assert.notEqual(sourcedResponseContractHash(v1Mission),sourcedResponseContractHash(v2Mission));
  assert.deepEqual(makeSourcedResponseBinding(v2Mission).evidenceProfile.answerRequirements,v2.answerRequirements);
});

test('sealed used-car profile is admitted only for its deterministic Spanish public question class and freezes seeds into the controller contract',t=>{
  const dir=fs.mkdtempSync(join(tmpdir(),'sublimine-source-profile-'));
  const engine=new FactoryEngine({databasePath:join(dir,'state.sqlite'),workspaceRoot:join(dir,'jobs')});
  t.after(()=>{engine.close();fs.rmSync(dir,{recursive:true,force:true});});
  assert.equal(isEsUsedCarListingPublicFieldsQuestion(QUESTION),true);
  assert.equal(isEsUsedCarListingPublicFieldsQuestion('¿Qué debo comprobar al comprar un coche usado?'),false);

  const mission=engine.create(QUESTION,{entryMode:'sourced-response-v1',sourcedEvidenceProfile:ES_USED_CAR_LISTING_EVIDENCE_PROFILE_ID});
  assert.equal(mission.policy.sourcedEvidenceProfile,ES_USED_CAR_LISTING_EVIDENCE_PROFILE_ID);
  assert.deepEqual(mission.policy.allowedTools,['source.fetch']);
  assert.deepEqual(sourcedResponseNode(mission).tools,['source.fetch']);
  const binding=makeSourcedResponseBinding(mission);
  assert.deepEqual(binding.evidenceProfile.sources.map(source=>[source.key,source.role,source.url]),
    profile().sources.map(source=>[source.key,source.role,source.url]));
  assert.match(binding.evidenceProfile.sources[0].claimBoundary,/not a legal or universal/i);
  const generic=engine.create('¿Qué datos públicos debe tener una oferta sencilla?',
    {entryMode:'sourced-response-v1',allowedTools:['source.search','source.fetch']});
  assert.equal(Object.hasOwn(generic.policy,'sourcedEvidenceProfile'),false);
  assert.notEqual(sourcedResponseContractHash(mission),sourcedResponseContractHash(generic));
  assert.throws(()=>engine.create('¿Qué debo revisar antes de comprar un coche usado?',{
    entryMode:'sourced-response-v1',sourcedEvidenceProfile:ES_USED_CAR_LISTING_EVIDENCE_PROFILE_ID}),
  {code:'SOURCED_EVIDENCE_PROFILE'});
  assert.throws(()=>engine.create(QUESTION,{entryMode:'sourced-response-v1',sourcedEvidenceProfile:ES_USED_CAR_LISTING_EVIDENCE_PROFILE_ID,
    allowedTools:['source.fetch','source.search']}),{code:'SOURCED_EVIDENCE_PROFILE'});
});

test('sealed used-car profile allows only its ordered public fetch seeds and disables source.search at the broker boundary',async t=>{
  const dir=fs.mkdtempSync(join(tmpdir(),'sublimine-source-profile-broker-'));
  const store=new Store(':memory:'),authority=new Authority(store),calls=[];
  const broker=new ToolBroker({store,authority,workspaceRoot:join(dir,'jobs'),lookup:async()=>[{address:'8.8.8.8',family:4}],
    transport:async request=>{calls.push(request.url.href);return {remoteAddress:request.address,statusCode:200,
      headers:{'content-type':'application/json; charset=utf-8'},body:Buffer.from('{"observed":true}')};}});
  t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true});});
  broker.registerWorkspace('mission:profile');
  const selected=profile();
  store.put('mission','mission:profile',{id:'mission:profile',intent:QUESTION,policy:{entryMode:'sourced-response-v1',
    sourcedEvidenceProfile:selected.id,sourcedAcquisition:SOURCED_RESPONSE_ACQUISITION_V2,allowedTools:['source.fetch'],
    model:'gpt-5.6-terra',reasoningEffort:'medium'}},{expectedVersion:0});
  const allowed=selected.sources[0].url;
  const next=selected.sources[1].url;
  const completedFetch=(id,url)=>{
    const args={url},argsHash=sha256(args),receipt=authority.seal('tool.receipt',{id,missionId:'mission:profile',
      principalId:'run:profile',tool:'source.fetch',argsHash,status:'SUCCEEDED',result:{finalUrl:url},
      startedAt:'2026-09-21T00:00:00.000Z',completedAt:'2026-09-21T00:00:01.000Z'});
    store.put('effect',id,{missionId:'mission:profile',principalId:'run:profile',tool:'source.fetch',argsHash,
      state:'SUCCEEDED',startedAt:'2026-09-21T00:00:00.000Z',receipt},{expectedVersion:0});
  };
  await assert.rejects(broker.fetchSource('mission:profile',{url:next},new AbortController().signal,()=>true),
    {code:'SOURCED_EVIDENCE_PROFILE_SEQUENCE'});
  assert.deepEqual(calls,[],'wrong-order seed is blocked before transport');
  const result=await broker.fetchSource('mission:profile',{url:allowed},new AbortController().signal,()=>true);
  assert.equal(result.finalUrl,allowed);assert.deepEqual(calls,[allowed]);
  completedFetch('effect:profile-first',allowed);
  await assert.rejects(broker.fetchSource('mission:profile',{url:allowed},new AbortController().signal,()=>true,()=>{},'effect:profile-repeat'),
    {code:'SOURCED_EVIDENCE_PROFILE_SEQUENCE'});
  assert.deepEqual(calls,[allowed],'duplicate seed is blocked before transport');
  const second=await broker.fetchSource('mission:profile',{url:next},new AbortController().signal,()=>true,()=>{},'effect:profile-second');
  assert.equal(second.finalUrl,next);assert.deepEqual(calls,[allowed,next]);
  completedFetch('effect:profile-second',next);
  await assert.rejects(broker.fetchSource('mission:profile',{url:next},new AbortController().signal,()=>true,()=>{},'effect:profile-after-packet'),
    {code:'SOURCED_EVIDENCE_PROFILE_SEQUENCE'});
  assert.deepEqual(calls,[allowed,next],'no network is allowed after the finite sealed packet');
  await assert.rejects(broker.fetchSource('mission:profile',{url:'https://example.com/not-a-seed'},new AbortController().signal,()=>true),
    {code:'SOURCED_EVIDENCE_PROFILE_SCOPE'});
  assert.deepEqual(calls,[allowed,next]);
  await assert.rejects(broker.searchSource('mission:profile',{query:'anuncios de coche',limit:1},new AbortController().signal,()=>true),
    {code:'SOURCED_EVIDENCE_PROFILE_SCOPE'});
});

test('sealed used-car profile rejects wrong-order and repeated seeds through normal dispatched effects before a second network call',async t=>{
  for(const [kind,requested,expectedFetches] of [
    ['wrong-order',selected=>selected.sources[1].url,[]],
    ['repeat',selected=>selected.sources[0].url,selected=>[selected.sources[0].url]],
  ]){
    const dir=fs.mkdtempSync(join(tmpdir(),'sublimine-source-profile-dispatch-')),
      engine=new FactoryEngine({databasePath:join(dir,'state.sqlite'),workspaceRoot:join(dir,'jobs')}),
      selected=profile(),fetches=[];
    t.after(()=>{engine.close();fs.rmSync(dir,{recursive:true,force:true});});
    engine.broker.lookup=async()=>[{address:'8.8.8.8',family:4}];
    engine.broker.transport=async request=>{
      fetches.push(request.url.href);
      return {remoteAddress:request.address,statusCode:200,headers:{'content-type':'text/plain; charset=utf-8'},body:Buffer.from('sealed source fixture')};
    };
    let calls=0;
    engine.workers.providerFactory=()=>({
      async generate(request){
        const task=JSON.parse(readSourceContextView(request.input).task);
        let value;
        if(task.node?.id==='sourced-response-entry'&&task.step===0)value={action:'tool',tool:'source.fetch',
          argsJson:JSON.stringify({url:kind==='wrong-order'?requested(selected):selected.sources[0].url}),body:'',claims:[],
          method:'sealed-dispatch-'+kind,reason:''};
        else if(task.node?.id==='sourced-response-entry'&&task.step===1)value={action:'tool',tool:'source.fetch',
          argsJson:JSON.stringify({url:requested(selected)}),body:'',claims:[],method:'sealed-dispatch-repeat',reason:''};
        else if(task.node?.id==='sourced-response-entry')value={action:'blocked',tool:'',argsJson:'',body:'',claims:[],
          method:'sealed-stop',reason:'The sealed packet cannot continue after a rejected seed.'};
        else throw Error('Unexpected profile dispatch test task');
        await request.validate(value);
        const call=++calls;
        return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:'profile-dispatch-'+kind+'-'+call,
          turnId:'profile-dispatch-'+kind+'-'+call,model:request.model,reasoningEffort:request.reasoningEffort,
          contextHash:inferenceRequestHash(request)}};
      },
      async close(){return {processExitObserved:true};},
    });
    const mission=engine.create(QUESTION,{entryMode:'sourced-response-v1',sourcedFallback:'defer-only-v1',
      sourcedEvidenceProfile:ES_USED_CAR_LISTING_EVIDENCE_PROFILE_ID});
    await engine.run(mission.id);
    const effects=engine.store.list('effect').map(record=>record.data);
    assert.equal(engine.status(mission.id).mission.status,'NEEDS_DIRECTION');
    assert.deepEqual(fetches,typeof expectedFetches==='function'?expectedFetches(selected):expectedFetches,kind+' transport calls');
    assert.equal(effects.at(-1).receipt.data.result.error.code,'SOURCED_EVIDENCE_PROFILE_SEQUENCE',kind+' rejected at the normal broker effect boundary');
  }
});

test('sealed used-car profile runs end-to-end with only its ordered public seed URLs and no discovery',async t=>{
  const dir=fs.mkdtempSync(join(tmpdir(),'sublimine-source-profile-e2e-')),
    engine=new FactoryEngine({databasePath:join(dir,'state.sqlite'),workspaceRoot:join(dir,'jobs')}),
    selected=profile(),fetches=[],inferences=[];
  let inferenceCount=0;
  t.after(()=>{engine.close();fs.rmSync(dir,{recursive:true,force:true});});
  engine.workers.maxReviewRepairs=0;
  engine.broker.lookup=async()=>[{address:'8.8.8.8',family:4}];
  engine.broker.transport=async request=>{
    fetches.push(request.url.href);
    return {remoteAddress:request.address,statusCode:200,headers:{'content-type':'text/plain; charset=utf-8'},
      body:Buffer.from(request.url.href===selected.sources[0].url
        ?'Marketplace field convention fixture.'
        :'Public authority verification fixture.')};
  };
  engine.workers.providerFactory=()=>({
    async generate(request){
      const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);inferences.push(task);
      let value;
      if(task.node?.id==='sourced-response-entry'){
        if(task.step<selected.sources.length){
          value={action:'tool',tool:'source.fetch',argsJson:JSON.stringify({url:selected.sources[task.step].url}),body:'',claims:[],
            method:'sealed-profile-seed-'+task.step,reason:''};
        }else{
          value={action:'final',tool:'',argsJson:'',body:'Campos públicos y verificación previa quedan distinguidos.',
            claims:exposure.sources.map((source,index)=>({
              id:'profile-source-boundary-'+index,text:'La fuente sellada '+(index+1)+' cubre su ámbito declarado.',kind:'fact',
              // The second source deliberately repeats an identical citation,
              // matching a harmless provider representation seen in the live
              // Terra run. It remains a source-exclusive claim, not a claim
              // that combines the two sealed sources.
              sources:index===1
                ?[{sourceId:source.id,hash:source.hash,quote:source.raw},{sourceId:source.id,hash:source.hash,quote:source.raw}]
                :[{sourceId:source.id,hash:source.hash,quote:source.raw}],basis:[],
              qualifiers:['Simulated end-to-end profile fixture.'],validUntil:null,
            })),method:'profile-sources-then-composition',reason:''};
        }
      }else if(task.candidateId){
        const artifact=exposure.artifacts.find(item=>item.id===task.candidateId),evidence=[
          {kind:'artifact',id:artifact.id,hash:artifact.hash,quote:artifact.payload.body},
          ...exposure.sources.map(source=>({kind:'source',id:source.id,hash:source.hash,quote:source.raw})),
        ];
        value={artifactHash:artifact.hash,purpose:artifact.payload.purpose,decision:'ACCEPT',checks:task.criteria.map(criterion=>({
          criterionId:criterion.id,verdict:'PASS',evidence,reason:'Simulated independent profile review.',
        })),findings:[],uncertainty:'Synthetic transport only.'};
      }else throw Error('Unexpected profile test task');
      value=compactSourcedReviewerFixture(value,exposure,task);
      await request.validate(value);
      const call=++inferenceCount;
      return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:'profile-sim-'+call,turnId:'profile-sim-'+call,
        model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
    },
    async close(){return {processExitObserved:true};},
  });
  const mission=engine.create(QUESTION,{entryMode:'sourced-response-v1',sourcedFallback:'defer-only-v1',
    sourcedEvidenceProfile:ES_USED_CAR_LISTING_EVIDENCE_PROFILE_ID});
  const result=await engine.run(mission.id);
  assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.deepEqual(fetches,selected.sources.map(source=>source.url));
  assert.equal(inferences.some(task=>task.tool==='source.search'),false);
  assert.equal(engine.store.list('effect').every(record=>record.data.tool==='source.fetch'),true);
  const binding=engine.store.get('sourced-response-contract',mission.id).data;
  assert.deepEqual(binding.evidenceProfile.sources.map(source=>source.url),selected.sources.map(source=>source.url));
  assert.deepEqual(engine.status(mission.id).mission.sourcedRouteProgress.acquisition,{
    search:{used:0,limit:0},fetch:{used:2,limit:2},maxSourceBytes:65536,discovery:'SEALED_DISABLED',
  });
});

test('sealed used-car v2 reviewer cites its signed answer boundary and candidate body for the public audience product shape',async t=>{
  const f=v2ProfileFixture(t),result=await f.run();
  assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.deepEqual(f.fetches,f.selected.sources.map(source=>source.url));
  assert.equal(f.reviewerCalls.length,1);
  const reviewer=f.reviewerCalls[0],catalog=reviewer.task.observedEvidenceCatalog;
  assert.equal(catalog.length,5,'the v2 review menu contains its exact candidate, three raw sources, and one boundary');
  assert.deepEqual([...new Set(catalog.map(item=>item.kind))].sort(),['artifact','runtime','source']);
  assert.equal(catalog.some(item=>['tool','tool-history'].includes(item.kind)),false);
  const boundary=reviewer.exposure.runtimeObservations.filter(item=>item.kind==='sourced-answer-boundary');
  assert.equal(boundary.length,1);
  const review= f.engine.store.list('review').find(record=>record.data.artifactId===result.outcome.id)?.data;
  assert.ok(review,'the accepted v2 product has an independent review record');
  const audience=review.result.checks.find(checkResult=>checkResult.criterionId==='public-listing-audience-v2');
  assert.ok(audience.evidence.some(item=>item.kind==='runtime'&&item.id===boundary[0].id&&item.hash===boundary[0].hash),
    'the audience product-shape judgment cites the signed answer boundary');
  assert.ok(audience.evidence.some(item=>item.kind==='artifact'&&item.id===result.outcome.id),
    'the audience product-shape judgment cites an exact candidate-body passage');
});

test('sealed used-car v2 rejects raw source evidence alone for the public audience product shape',async t=>{
  const f=v2ProfileFixture(t,{rawSourceOnlyAudience:true}),result=await f.run();
  assert.equal(result.mission.status,'NEEDS_DIRECTION',JSON.stringify(result.mission.pending));
  const entry=f.engine.store.get('sourced-response-entry',f.mission.id).data;
  assert.equal(entry.status,'FALLBACK');
  assert.equal(entry.disposition.code,'SOURCED_REVIEW_EVIDENCE');
  assert.deepEqual(f.fetches,f.selected.sources.map(source=>source.url),'the failed review does not alter the sealed acquisition packet');
  const rejected=f.engine.store.list('worker-rejected-review');
  assert.equal(rejected.length,1);
  assert.equal(rejected[0].data.code,'SOURCED_REVIEW_EVIDENCE');
  assert.deepEqual(rejected[0].data.response.checks.find(checkResult=>checkResult.criterionId==='public-listing-audience-v2')?.evidenceIds,
    ['e2'],'the rejected response recorded the audience judgment with raw source evidence only');
});

test('sealed used-car v2 replaces an interrupted heading-only presentation final without fetching again or replaying its body',async t=>{
  const dir=fs.mkdtempSync(join(tmpdir(),'sublimine-source-profile-v2-retained-final-')),
    engine=new FactoryEngine({databasePath:join(dir,'state.sqlite'),workspaceRoot:join(dir,'jobs')}),
    selected=v2Profile(),fetches=[],finalBodies=[],recoveryTasks=[];
  const rejectedBody=selected.answerRequirements.requiredSections.map(section=>'## '+section.heading).join('\n');
  let inferenceCount=0;
  t.after(()=>{engine.close();fs.rmSync(dir,{recursive:true,force:true});});
  engine.workers.maxReviewRepairs=0;
  engine.broker.lookup=async()=>[{address:'8.8.8.8',family:4}];
  engine.broker.transport=async request=>{
    fetches.push(request.url.href);
    return {remoteAddress:request.address,statusCode:200,headers:{'content-type':'text/plain; charset=utf-8'},
      body:Buffer.from('Synthetic retained-final source '+(fetches.length)+'.')};
  };
  engine.workers.providerFactory=()=>({
    async generate(request){
      const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);let value;
      if(task.node?.id==='sourced-response-entry'){
        if(exposure.sources.length<selected.sources.length){
          value={action:'tool',tool:'source.fetch',argsJson:JSON.stringify({url:selected.sources[exposure.sources.length].url}),body:'',claims:[],
            method:'retained-v2-seed-'+exposure.sources.length,reason:''};
        }else{
          const body=finalBodies.length===0?rejectedBody:v2PublicListingBody;
          if(finalBodies.length>0){
            recoveryTasks.push(task);
            assert.equal(JSON.stringify(task).includes(rejectedBody),false,'the fresh producer never receives the rejected body');
            assert.equal(task.feedback?.[0]?.code,'SOURCED_EVIDENCE_PROFILE_PRESENTATION');
          }
          finalBodies.push(body);
          value={action:'final',tool:'',argsJson:'',body,claims:sourceExclusiveClaims(exposure,'retained-v2'),
            method:body===rejectedBody?'retained-invalid-presentation':'fresh-v2-presentation',reason:''};
        }
      }else if(task.candidateId)value=sealedProfileReview(exposure,task);
      else throw Error('Unexpected retained-final v2 task');
      await request.validate(value);
      const call=++inferenceCount;
      return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:'profile-retained-v2-'+call,
        turnId:'profile-retained-v2-'+call,model:request.model,reasoningEffort:request.reasoningEffort,
        contextHash:inferenceRequestHash(request)}};
    },
    async close(){return {processExitObserved:true};},
  });
  const mission=engine.create(QUESTION,{entryMode:'sourced-response-v1',sourcedFallback:'defer-only-v1',
    sourcedEvidenceProfile:ES_USED_CAR_LISTING_EVIDENCE_PROFILE_V2_ID});
  assert.equal(selected.answerRequirements.requiredSections.every(section=>rejectedBody.includes('## '+section.heading)),true,
    'the rejected retained body has every required heading but no section content');
  const create=engine.registry.create.bind(engine.registry);let interrupt=true;
  engine.registry.create=args=>{
    if(interrupt&&args.kind==='sourced-response'){
      interrupt=false;
      throw Object.assign(Error('Synthetic interruption after the exact final was retained.'),{code:'QUOTA'});
    }
    return create(args);
  };
  const interrupted=await engine.run(mission.id);
  assert.equal(interrupted.mission.status,'WAITING_QUOTA');
  assert.deepEqual(fetches,selected.sources.map(source=>source.url));
  const before=engine.store.get('sourced-response-entry',mission.id).data,priorRunId=before.runId;
  assert.equal(before.productionAttempts,1);
  assert.equal(engine.store.get('worker-proposal',priorRunId+':proposal:3').data.value.body,rejectedBody,
    'the interrupted response exists only as an exact retained proposal');

  const resumed=await engine.run(mission.id);
  assert.equal(resumed.mission.status,'COMPLETED',JSON.stringify(resumed.mission.pending));
  const entry=engine.store.get('sourced-response-entry',mission.id).data;
  assert.equal(entry.productionAttempts,2);
  assert.deepEqual(entry.runIds,[priorRunId,entry.runId]);
  assert.notEqual(entry.runId,priorRunId);
  assert.deepEqual(fetches,selected.sources.map(source=>source.url),'the replacement reuses only authenticated sealed observations');
  assert.deepEqual(finalBodies,[rejectedBody,v2PublicListingBody]);
  assert.equal(recoveryTasks.length,1);
  const disposition=engine.store.get('producer-final-disposition',priorRunId+':proposal:3').data;
  assert.equal(disposition.disposition,'REJECTED');
  assert.equal(disposition.code,'SOURCED_EVIDENCE_PROFILE_PRESENTATION');
  const replacement=engine.workers.run(entry.runId);
  assert.equal(replacement.context.sourceIds.length,selected.sources.length,'the fresh producer inherits the sealed source observations');
  const artifact=engine.registry.assertUsable(resumed.outcome.id,{missionId:mission.id,purpose:SOURCED_RESPONSE_PURPOSE});
  assert.equal(artifact.payload.producerRunId,entry.runId);
  assert.equal(artifact.payload.body,v2PublicListingBody);
});

test('sealed used-car profile gives both producer and independent reviewer literal raw source bytes for JSON-wire citations',async t=>{
  const dir=fs.mkdtempSync(join(tmpdir(),'sublimine-source-profile-literal-')),
    engine=new FactoryEngine({databasePath:join(dir,'state.sqlite'),workspaceRoot:join(dir,'jobs')}),selected=profile(),seen=[];
  const rawJson=JSON.stringify({article:{body:'<p style="font-weight: 400;">Campos de anuncio.</p>'}}),jsonQuote='style=\\"font-weight: 400;\\"',
    rawHtml='<p>Antes de comprar un vehículo de segunda mano es aconsejable conocer su estado.</p>',htmlQuote='Antes de comprar un vehículo de segunda mano es aconsejable conocer su estado.';
  assert.ok(rawJson.includes(jsonQuote));assert.equal(JSON.parse(rawJson).article.body.includes(jsonQuote),false);
  let inferenceCount=0;
  t.after(()=>{engine.close();fs.rmSync(dir,{recursive:true,force:true});});
  engine.workers.maxReviewRepairs=0;engine.broker.lookup=async()=>[{address:'8.8.8.8',family:4}];
  engine.broker.transport=async request=>({remoteAddress:request.address,statusCode:200,
    headers:{'content-type':request.url.href===selected.sources[0].url?'application/json':'text/html'},
    body:Buffer.from(request.url.href===selected.sources[0].url?rawJson:rawHtml)});
  engine.workers.providerFactory=()=>({
    async generate(request){
      const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);let value;
      if(task.node?.id==='sourced-response-entry'&&task.step<selected.sources.length){
        value={action:'tool',tool:'source.fetch',argsJson:JSON.stringify({url:selected.sources[task.step].url}),body:'',claims:[],
          method:'sealed-literal-seed-'+task.step,reason:''};
      }else if(task.node?.id==='sourced-response-entry'){
        seen.push('producer');assert.ok(request.input.startsWith('SOVEREIGN_SOURCED_SOURCE_CONTEXT_VIEW_V1\n'));
        assert.ok(request.input.includes(rawJson));assert.match(request.instructions,/parsed JSON value/);
        value={action:'final',tool:'',argsJson:'',body:'Los dos límites de fuente se mantienen separados.',claims:exposure.sources.map((source,index)=>({
          id:'literal-sealed-'+index,text:index===0?'La fuente JSON contiene el atributo de estilo citado.':'La fuente HTML contiene el consejo previo citado.',kind:'fact',
          sources:[{sourceId:source.id,hash:source.hash,quote:index===0?jsonQuote:htmlQuote}],basis:[],
          qualifiers:['Synthetic literal-source profile regression.'],validUntil:null,
        })),method:'sealed-literal-sources',reason:''};
      }else if(task.candidateId){
        seen.push('reviewer');assert.ok(request.input.startsWith('SOVEREIGN_SOURCED_SOURCE_CONTEXT_VIEW_V1\n'));
        assert.ok(request.input.includes(rawJson));assert.match(request.instructions,/parsed JSON value/);
        const artifact=exposure.artifacts.find(item=>item.id===task.candidateId),evidence=[
          {kind:'artifact',id:artifact.id,hash:artifact.hash,quote:artifact.payload.body},
          ...exposure.sources.map((source,index)=>({kind:'source',id:source.id,hash:source.hash,quote:index===0?jsonQuote:htmlQuote})),
        ];
        value={artifactHash:artifact.hash,purpose:artifact.payload.purpose,decision:'ACCEPT',checks:task.criteria.map(criterion=>({
          criterionId:criterion.id,verdict:'PASS',evidence,reason:'Independent synthetic raw literal check.'
        })),findings:[],uncertainty:'Synthetic transport only.'};
      }else throw Error('Unexpected literal profile test task');
      value=compactSourcedReviewerFixture(value,exposure,task);
      await request.validate(value);const call=++inferenceCount;
      return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:'profile-literal-'+call,turnId:'profile-literal-'+call,
        model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
    },async close(){return {processExitObserved:true};},
  });
  const mission=engine.create(QUESTION,{entryMode:'sourced-response-v1',sourcedFallback:'defer-only-v1',
    sourcedEvidenceProfile:ES_USED_CAR_LISTING_EVIDENCE_PROFILE_ID});
  const result=await engine.run(mission.id);assert.equal(result.mission.status,'COMPLETED',JSON.stringify(result.mission.pending));
  assert.deepEqual(seen,['producer','reviewer']);
  const artifact=engine.registry.assertUsable(result.outcome.id,{missionId:mission.id,purpose:SOURCED_RESPONSE_PURPOSE});
  for(const claim of artifact.payload.claims)for(const reference of claim.sources)
    assert.equal(engine.store.get('source',reference.sourceId).data.raw.includes(reference.quote),true);
});

test('sealed used-car profile falls back on its coverage gate, not SCHEMA, when one admitted 2xx source body is empty',async t=>{
  const dir=fs.mkdtempSync(join(tmpdir(),'sublimine-source-profile-empty-')),
    engine=new FactoryEngine({databasePath:join(dir,'state.sqlite'),workspaceRoot:join(dir,'jobs')}),selected=profile(),seen=[],supported='Nonempty sealed second-source fixture.';
  let inferenceCount=0;
  t.after(()=>{engine.close();fs.rmSync(dir,{recursive:true,force:true});});
  engine.broker.lookup=async()=>[{address:'8.8.8.8',family:4}];
  engine.broker.transport=async request=>({remoteAddress:request.address,statusCode:200,
    headers:{'content-type':'text/plain; charset=utf-8'},body:request.url.href===selected.sources[0].url?Buffer.alloc(0):Buffer.from(supported)});
  engine.workers.providerFactory=()=>({
    async generate(request){
      const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);let value;
      if(task.node?.id==='sourced-response-entry'&&task.step<selected.sources.length){
        if(task.step===1){
          seen.push('producer-after-empty');assert.ok(request.input.startsWith('SOVEREIGN_SOURCED_SOURCE_CONTEXT_VIEW_V1\n'));
          assert.equal(exposure.sources[0].raw,'');assert.equal(exposure.sources[0].hash,sha256(''));
        }
        value={action:'tool',tool:'source.fetch',argsJson:JSON.stringify({url:selected.sources[task.step].url}),body:'',claims:[],
          method:'sealed-empty-seed-'+task.step,reason:''};
      }else if(task.node?.id==='sourced-response-entry'){
        seen.push('producer-final');assert.ok(request.input.startsWith('SOVEREIGN_SOURCED_SOURCE_CONTEXT_VIEW_V1\n'));
        assert.equal(exposure.sources[0].raw,'');const source=exposure.sources.find(item=>item.raw===supported);
        value={action:'final',tool:'',argsJson:'',body:'La segunda fuente no vacía queda citada; la respuesta vacía permanece registrada.',
          claims:[{id:'only-nonempty-source',text:'La fuente no vacía contiene el literal citado.',kind:'fact',
            sources:[{sourceId:source.id,hash:source.hash,quote:supported}],basis:[],
            qualifiers:['Fixture de regresión para 2xx vacío.'],validUntil:null}],method:'sealed-empty-coverage',reason:''};
      }else throw Error('The profile coverage gate must stop before reviewer dispatch');
      await request.validate(value);const call=++inferenceCount;
      return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:'profile-empty-'+call,turnId:'profile-empty-'+call,
        model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
    },async close(){return {processExitObserved:true};},
  });
  const mission=engine.create(QUESTION,{entryMode:'sourced-response-v1',sourcedFallback:'defer-only-v1',
    sourcedEvidenceProfile:ES_USED_CAR_LISTING_EVIDENCE_PROFILE_ID});
  await engine.run(mission.id);
  const status=engine.status(mission.id),entry=engine.store.get('sourced-response-entry',mission.id).data;
  assert.equal(status.mission.status,'NEEDS_DIRECTION');assert.equal(entry.status,'FALLBACK');
  assert.equal(entry.disposition.code,'SOURCED_EVIDENCE_PROFILE_COVERAGE');assert.deepEqual(seen,['producer-after-empty','producer-final']);
  const admitted=engine.store.list('source').map(record=>record.data);assert.equal(admitted[0].raw,'');assert.equal(admitted[0].hash,sha256(''));
  assert.equal(admitted[1].raw,supported);
});

test('sealed used-car profile rejects a claim that combines both seed source IDs',async t=>{
  const dir=fs.mkdtempSync(join(tmpdir(),'sublimine-source-profile-combined-')),
    engine=new FactoryEngine({databasePath:join(dir,'state.sqlite'),workspaceRoot:join(dir,'jobs')}),
    selected=profile(),fetches=[];
  let inferenceCount=0;
  t.after(()=>{engine.close();fs.rmSync(dir,{recursive:true,force:true});});
  engine.broker.lookup=async()=>[{address:'8.8.8.8',family:4}];
  engine.broker.transport=async request=>{
    fetches.push(request.url.href);
    return {remoteAddress:request.address,statusCode:200,headers:{'content-type':'text/plain; charset=utf-8'},
      body:Buffer.from(request.url.href===selected.sources[0].url
        ?'Marketplace field convention fixture.'
        :'Public authority verification fixture.')};
  };
  engine.workers.providerFactory=()=>({
    async generate(request){
      const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);let value;
      if(task.node?.id==='sourced-response-entry'&&task.step<selected.sources.length){
        value={action:'tool',tool:'source.fetch',argsJson:JSON.stringify({url:selected.sources[task.step].url}),body:'',claims:[],
          method:'sealed-profile-seed-'+task.step,reason:''};
      }else if(task.node?.id==='sourced-response-entry'){
        value={action:'final',tool:'',argsJson:'',body:'Una respuesta no puede mezclar las fronteras de las dos fuentes selladas.',
          claims:[{id:'combined-sealed-boundaries',text:'Esta claim mezcla dos fuentes distintas.',kind:'fact',
            sources:exposure.sources.map(source=>({sourceId:source.id,hash:source.hash,quote:source.raw})),basis:[],
            qualifiers:['Simulated combined-source regression fixture.'],validUntil:null}],
          method:'combined-sealed-sources',reason:''};
      }else throw Error('Unexpected combined-source profile test task');
      await request.validate(value);
      const call=++inferenceCount;
      return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:'profile-combined-'+call,
        turnId:'profile-combined-'+call,model:request.model,reasoningEffort:request.reasoningEffort,
        contextHash:inferenceRequestHash(request)}};
    },
    async close(){return {processExitObserved:true};},
  });
  const mission=engine.create(QUESTION,{entryMode:'sourced-response-v1',sourcedFallback:'defer-only-v1',
    sourcedEvidenceProfile:ES_USED_CAR_LISTING_EVIDENCE_PROFILE_ID});
  await engine.run(mission.id);
  const status=engine.status(mission.id),entry=engine.store.get('sourced-response-entry',mission.id).data;
  assert.equal(status.mission.status,'NEEDS_DIRECTION');
  assert.equal(entry.status,'FALLBACK');
  assert.equal(entry.disposition.code,'SOURCED_EVIDENCE_PROFILE_COVERAGE');
  assert.deepEqual(fetches,selected.sources.map(source=>source.url));
  assert.equal(engine.store.list('artifact').length,0,'combined-source candidate is never admitted to review');
});
