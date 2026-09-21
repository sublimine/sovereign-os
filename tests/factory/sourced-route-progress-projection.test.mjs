import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {readSourceContextView} from '../../factory/lib/source-context-view.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {compactCatalogReview} from '../../factory/lib/review-codec.mjs';
import {SOURCED_RESPONSE_NODE,SOURCED_RESPONSE_PURPOSE,SOURCED_RESPONSE_DEFER_ONLY_FALLBACK} from '../../factory/lib/sourced-response-spec.mjs';

const later=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const tool=(name,args)=>({action:'tool',tool:name,argsJson:JSON.stringify(args),body:'',claims:[],method:'public-acquisition',reason:''});
const final=(body,claims=[])=>({action:'final',tool:'',argsJson:'',body,claims,method:'source-comparison',reason:''});
const boundaryEvidence=exposure=>{
  const boundaries=(exposure.runtimeObservations??[]).filter(observation=>observation.kind==='sourced-answer-boundary');
  assert.equal(boundaries.length,1,'a sourced progress reviewer receives exactly one signed answer boundary');
  const boundary=boundaries[0];
  return {kind:'runtime',id:boundary.id,hash:boundary.hash,quote:boundary.quoteText};
};

function fixture(t,{deferOnly=false,failProducer=false}={}){
  const directory=fs.mkdtempSync(join(tmpdir(),'sourced-progress-projection-')),
    fetchStarted=later(),fetchRelease=later(),reviewStarted=later(),reviewRelease=later(),
    sourceText='Public synthetic source evidence. PRIVATE_SOURCE_BODY_MUST_NOT_APPEAR_IN_PROGRESS.',
    engine=new FactoryEngine({databasePath:join(directory,'state.sqlite'),workspaceRoot:join(directory,'jobs')});
  engine.workers.maxReviewRepairs=0;
  engine.broker.lookup=async()=>[{address:'8.8.8.8',family:4}];
  engine.broker.transport=async()=>{
    fetchStarted.resolve();await fetchRelease.promise;
    return {remoteAddress:'8.8.8.8',statusCode:200,headers:{'content-type':'text/plain'},body:Buffer.from(sourceText)};
  };
  let calls=0;
  engine.workers.providerFactory=()=>({
    async generate(request){
      const exposure=readSourceContextView(request.input),task=JSON.parse(exposure.task);let value;
      if(task.node?.id===SOURCED_RESPONSE_NODE){
        if(failProducer)value=final('Unsupported synthetic answer.');
        else if(task.step===0)value=tool('source.fetch',{url:'https://example.com/public-synthetic-source'});
        else {
          const source=exposure.sources[0];
          value=final('Synthetic accepted answer.',[{id:'fact:synthetic',text:'The public synthetic source has evidence.',kind:'fact',
            sources:[{sourceId:source.id,hash:source.hash,quote:source.raw}],basis:[],qualifiers:[],validUntil:null}]);
        }
      }else if(task.candidateId){
        reviewStarted.resolve();await reviewRelease.promise;
        const artifact=exposure.artifacts.find(item=>item.id===task.candidateId),evidence=[
          {kind:'artifact',id:artifact.id,hash:artifact.hash,quote:artifact.payload.body},
          ...exposure.sources.map(source=>({kind:'source',id:source.id,hash:source.hash,quote:source.raw}))
        ];
        const boundary=boundaryEvidence(exposure);
        value={artifactHash:artifact.hash,purpose:artifact.payload.purpose,decision:'ACCEPT',
          checks:task.criteria.map(criterion=>({criterionId:criterion.id,verdict:'PASS',evidence:
            ['sourced-eligibility','complete-request','public-listing-audience-v2'].includes(criterion.id)?[...evidence,boundary]:evidence,
            reason:'Synthetic independent source review fixture.'})),findings:[],uncertainty:'Synthetic fixture.'};
      }else throw Error('Unexpected non-sourced test route');
      if(task.candidateId){
        assert.ok(Array.isArray(task.observedEvidenceCatalog),'sourced reviewer uses its sealed compact evidence catalog');
        value=compactCatalogReview(value,task.observedEvidenceCatalog);
      }
      await request.validate(value);calls++;
      return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:`source-progress-${calls}`,
        turnId:'synthetic',model:request.model,reasoningEffort:request.reasoningEffort,contextHash:inferenceRequestHash(request)}};
    },
    async close(){return {processExitObserved:true};}
  });
  const mission=engine.create('Use the public synthetic source to answer the bounded question.',{
    entryMode:'sourced-response-v1',allowedTools:['source.fetch'],...(deferOnly?{sourcedFallback:SOURCED_RESPONSE_DEFER_ONLY_FALLBACK}:{})
  });
  t.after(()=>{engine.close();fs.rmSync(directory,{recursive:true,force:true});});
  return {engine,mission,fetchStarted,fetchRelease,reviewStarted,reviewRelease,sourceText};
}

const card=state=>state.mission.sourcedRouteProgress;
const expectedBase=(phase,{search=0,fetch=0,review='NOT_STARTED',anchors=0,delivery='NOT_AVAILABLE'}={})=>({
  schema:'sovereign.sourced-route-progress.v1',revision:1,integrity:'VERIFIED',phase,
  acquisition:{search:{used:search,limit:1},fetch:{used:fetch,limit:4},maxSourceBytes:65536},
  independentReview:{required:true,state:review},verifiedSourceAnchorCount:anchors,delivery:{availability:delivery}
});

test('public sourced-route progress exposes only fixed verified stage counters across admission, acquisition, review and delivery',async t=>{
  const f=fixture(t);
  assert.deepEqual(card(f.engine.status(f.mission.id)),expectedBase('ADMITTED'));
  const running=f.engine.run(f.mission.id);
  await f.fetchStarted.promise;
  assert.deepEqual(card(f.engine.status(f.mission.id)),expectedBase('ACQUIRING',{fetch:1}));
  f.fetchRelease.resolve();
  await f.reviewStarted.promise;
  const pending=card(f.engine.status(f.mission.id));
  assert.deepEqual(pending,expectedBase('CANDIDATE_PENDING_REVIEW',{fetch:1,review:'PENDING'}));
  assert.equal(JSON.stringify(pending).includes(f.sourceText),false,'progress does not expose acquired source bytes');
  assert.equal(JSON.stringify(pending).includes('example.com'),false,'progress does not expose source URLs');
  f.reviewRelease.resolve();
  await running;
  const accepted=card(f.engine.status(f.mission.id));
  assert.deepEqual(accepted,expectedBase('ACCEPTED',{fetch:1,review:'ACCEPTED',anchors:1,delivery:'AVAILABLE'}));
  assert.deepEqual(f.engine.report(f.mission.id).mission.sourcedRouteProgress,accepted,
    'status and report expose the same route-local public card');
  assert.equal(JSON.stringify(accepted).includes(f.sourceText),false,'accepted progress keeps raw source text private');
  assert.equal(JSON.stringify(accepted).includes('example.com'),false,'accepted progress keeps source URL private');
});

test('sealed sourced fallback is projected as escalation without inventing a delivery or review',async t=>{
  const f=fixture(t,{deferOnly:true,failProducer:true});
  // No fetch is attempted for this deliberately unsupported producer output.
  f.fetchRelease.resolve();f.reviewRelease.resolve();
  await f.engine.run(f.mission.id);
  const progress=card(f.engine.status(f.mission.id));
  assert.deepEqual(progress,expectedBase('ESCALATED'));
  assert.equal(f.engine.status(f.mission.id).mission.status,'NEEDS_DIRECTION');
});

test('legacy source-stage escalation remains a source-stage card after a later plan record exists',async t=>{
  const f=fixture(t,{failProducer:true});
  // The legacy source route falls through to planning.  This fixture does not
  // supply a planner response, so the engine records a nonterminal failure
  // after the source-stage FALLBACK; the later plan row stands in only for the
  // normal planning continuation and must not be read as source evidence.
  await f.engine.run(f.mission.id);
  assert.equal(f.engine.store.get('sourced-response-entry',f.mission.id).data.status,'FALLBACK');
  f.engine.store.put('plan',f.mission.id,{missionId:f.mission.id,privatePlannerResidue:'not a public source route field'},
    {expectedVersion:0});
  assert.deepEqual(card(f.engine.status(f.mission.id)),expectedBase('ESCALATED'));
});

test('malformed sourced progress fails closed to a fixed no-leak card',async t=>{
  const f=fixture(t);
  const running=f.engine.run(f.mission.id);await f.fetchStarted.promise;f.fetchRelease.resolve();await f.reviewStarted.promise;f.reviewRelease.resolve();await running;
  const marker='PRIVATE_FORGED_SOURCED_PROGRESS_DIAGNOSTIC';
  const record=f.engine.store.get('sourced-response-entry',f.mission.id);
  f.engine.store.put('sourced-response-entry',f.mission.id,{...record.data,privateDiagnostic:marker},{expectedVersion:record.version});
  const before=f.engine.store.verifyJournal(),status=f.engine.status(f.mission.id),report=f.engine.report(f.mission.id),after=f.engine.store.verifyJournal();
  assert.deepEqual(before,after,'public progress reads remain read-only');
  for(const progress of [card(status),report.mission.sourcedRouteProgress]){
    assert.deepEqual(progress,{schema:'sovereign.sourced-route-progress.v1',revision:1,integrity:'UNVERIFIED',phase:'UNVERIFIED',
      acquisition:{search:{used:0,limit:1},fetch:{used:0,limit:4},maxSourceBytes:65536},
      independentReview:{required:true,state:'UNVERIFIED'},verifiedSourceAnchorCount:0,delivery:{availability:'UNVERIFIED'}});
    assert.equal(JSON.stringify(progress).includes(marker),false,'unverified card does not echo malformed state');
  }
});
