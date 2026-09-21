import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {ArtifactRegistry} from '../../factory/lib/artifacts.mjs';
import {id,sha256} from '../../factory/lib/contracts.mjs';
import {
  EFFICIENCY_COVERAGE_RECORD_TYPE,
  EFFICIENCY_COVERAGE_SCHEMA,
  EFFICIENCY_MEASUREMENT_RECORD_TYPE,
  EFFICIENCY_MEASUREMENT_SCHEMA,
  PREREGISTERED_EFFICIENCY_ARM_SCHEMA,
  PREREGISTERED_EFFICIENCY_EVIDENCE_SCHEMA,
  PREREGISTERED_EFFICIENCY_RESULT_SCHEMA,
  PREREGISTERED_EFFICIENCY_SCHEMA,
  createArtifactRegistryEfficiencyEvidenceAdapter,
  createEfficiencyEvidenceAdapter,
  createPreregisteredEfficiencyComparisonLedger,
  evaluatePreregisteredEfficiencyComparison
} from '../../factory/lib/preregistered-efficiency-comparison.mjs';

const reference=record=>({type:record.type,id:record.id,version:record.version,hash:record.hash});

function fixture(t){
  const store=new Store(':memory:'),authority=new Authority(store),registry=new ArtifactRegistry(store,authority);t.after(()=>store.close());
  const put=(type,id,data)=>store.put(type,id,data,{expectedVersion:0});
  const caseRecord=put('efficiency-case','case:fixture',{question:'Compare the two fixed paths.'});
  const obligations=[
    put('efficiency-obligation','obligation:coverage',{criterion:'every requested output is present'}),
    put('efficiency-obligation','obligation:correctness',{criterion:'the result is independently correct'})
  ];
  const run=(mode,artifacts=[])=>{
    const record=registry.registerRun({missionId:'m',nodeId:'efficiency-fixture',mode,context:{purpose:'answer',artifactIds:artifacts,sourceIds:[],
      instructionsHash:sha256('efficiency fixture instructions'),producerConversationIncluded:false}});
    registry.attachInference(record.id,{status:'completed',threadId:id(`fixture-${mode}-thread`),turnId:id(`fixture-${mode}-turn`)});
    return store.get('run',record.id).data;
  };
  const acceptedArtifact=side=>{
    const producer=run('producer'),candidate=registry.create({missionId:'m',nodeId:'efficiency-fixture',producerRunId:producer.id,kind:'answer',purpose:'answer',
      body:`Measured ${side} fixture result.`,criteria:[{id:'support',text:'Exact fixture support'}]});
    const review=registry.review({artifactId:candidate.id,reviewerRunId:run('reviewer',[candidate.id]).id,result:{artifactHash:candidate.payloadHash,purpose:'answer',decision:'ACCEPT',
      checks:[{criterionId:'support',verdict:'PASS',evidence:[{kind:'artifact',id:candidate.id,hash:candidate.payloadHash,quote:candidate.payload.body}],reason:'Exact fixture body observed.'}],
      findings:[],uncertainty:'Deterministic Factory fixture.'}});
    return {artifact:reference(store.get('artifact',candidate.id)),review:reference(store.get('review',review.reviews.at(-1)))};
  };
  const evidenceAdapter=createArtifactRegistryEfficiencyEvidenceAdapter(registry);
  const ledger=createPreregisteredEfficiencyComparisonLedger(store,{evidenceAdapter});
  const definition={schema:PREREGISTERED_EFFICIENCY_SCHEMA,id:'comparison:fixture',case:reference(caseRecord),obligations:obligations.map(reference),
    metrics:[{id:'provider_calls',kind:'cost',unit:'calls'},{id:'input_bytes',kind:'cost',unit:'bytes'},{id:'end_to_end',kind:'latency',unit:'ms'}]};
  const makeEvidence=(arm,{calls=7,bytes=700,latency=70,quality='PASS',coverage='PASS',unknownMetric=null}={})=>{
    const material=acceptedArtifact(arm),coverageEvidence=obligations.map(obligation=>put(EFFICIENCY_COVERAGE_RECORD_TYPE,`coverage:${arm}:${obligation.id}`,
      {schema:EFFICIENCY_COVERAGE_SCHEMA,arm,obligation:reference(obligation),verdict:coverage}));
    const values={provider_calls:calls,input_bytes:bytes,end_to_end:latency},units={provider_calls:'calls',input_bytes:'bytes',end_to_end:'ms'};
    const measurementEvidence=Object.keys(values).map(metricId=>{
      const data=unknownMetric===metricId
        ?{schema:EFFICIENCY_MEASUREMENT_SCHEMA,arm,metricId,status:'UNKNOWN',unit:units[metricId],reason:`${metricId} was unavailable`}
        :{schema:EFFICIENCY_MEASUREMENT_SCHEMA,arm,metricId,status:'KNOWN',unit:units[metricId],value:values[metricId]};
      return put(EFFICIENCY_MEASUREMENT_RECORD_TYPE,`measurement:${arm}:${metricId}`,data);
    });
    return {quality,coverage,correctness:material.artifact,review:material.review,coverageEvidence:coverageEvidence.map(reference),measurementEvidence:measurementEvidence.map(reference),
      values,units,unknownMetric};
  };
  const arm=(registration,side,evidence)=>({schema:PREREGISTERED_EFFICIENCY_ARM_SCHEMA,registration,arm:side,case:reference(caseRecord),obligations:obligations.map(reference),
    quality:{outcome:evidence.quality,correctnessEvidence:[evidence.correctness],reviewEvidence:[evidence.review],coverage:obligations.map((obligation,index)=>
      ({obligation:reference(obligation),verdict:evidence.coverage,evidence:[evidence.coverageEvidence[index]]}))},
    measurements:Object.keys(evidence.values).map((metricId,index)=>evidence.unknownMetric===metricId
      ?{metricId,status:'UNKNOWN',unit:evidence.units[metricId],reason:`${metricId} was unavailable`,evidence:evidence.measurementEvidence[index]}
      :{metricId,status:'KNOWN',unit:evidence.units[metricId],value:evidence.values[metricId],evidence:evidence.measurementEvidence[index]})});
  return {store,registry,ledger,evidenceAdapter,definition,put,makeEvidence,arm};
}

test('Store-backed preregistration qualifies only Factory artifact/review evidence in committed order',t=>{
  const f=fixture(t),registration=f.ledger.preregister(f.definition);
  const baseline=f.ledger.recordArm(f.arm(registration,'baseline',f.makeEvidence('baseline')));
  const candidate=f.ledger.recordArm(f.arm(registration,'candidate',f.makeEvidence('candidate',{calls:5,bytes:500,latency:60})));
  const result=evaluatePreregisteredEfficiencyComparison(f.ledger,{schema:PREREGISTERED_EFFICIENCY_EVIDENCE_SCHEMA,registration,baseline,candidate});
  assert.equal(result.schema,PREREGISTERED_EFFICIENCY_RESULT_SCHEMA);assert.equal(result.decision,'PASS');assert.equal(result.efficiencyPass,true);
  assert.deepEqual(result.metrics.map(metric=>metric.relation),['LOWER','LOWER','LOWER']);
  assert.deepEqual(result.savings.map(item=>item.unit),['ms','bytes','calls']);
});

test('generic PASS callbacks are analysis-only and cannot create a qualifying ledger',t=>{
  const f=fixture(t),generic=createEfficiencyEvidenceAdapter({assertCorrectness:()=>true,assertReview:()=>true});
  assert.throws(()=>createPreregisteredEfficiencyComparisonLedger(f.store,{evidenceAdapter:generic}),{code:'EFFICIENCY_EVIDENCE_ADAPTER'});
});

test('a structural or proxied registry cannot reach the material adapter or PASS path',t=>{
  const f=fixture(t);let storeRead=false;
  const structural={get store(){storeRead=true;return f.store;},assertUsable:()=>true,committedSequence:()=>1,reviewProgress:()=>({})};
  assert.throws(()=>createArtifactRegistryEfficiencyEvidenceAdapter(structural),{code:'EFFICIENCY_EVIDENCE_ADAPTER'});
  assert.equal(storeRead,false,'genuine-registry validation must run before .store is observed');
  assert.throws(()=>createArtifactRegistryEfficiencyEvidenceAdapter(new Proxy(f.registry,{})),{code:'EFFICIENCY_EVIDENCE_ADAPTER'});
});

test('post-hoc preregistration cannot reuse already committed Factory evidence',t=>{
  const f=fixture(t),early=f.makeEvidence('baseline'),registration=f.ledger.preregister(f.definition);
  assert.throws(()=>f.ledger.recordArm(f.arm(registration,'baseline',early)),{code:'EFFICIENCY_CHRONOLOGY'});
});

test('invented evidence hashes never resolve through the material qualifying API',t=>{
  const f=fixture(t),registration=f.ledger.preregister(f.definition),candidate=f.arm(registration,'candidate',f.makeEvidence('candidate'));
  candidate.measurements[0].evidence.hash='0'.repeat(64);
  assert.throws(()=>f.ledger.recordArm(candidate),{code:'EFFICIENCY_REFERENCE'});
});

test('a facade and one transaction spanning roots through arms cannot manufacture a committed boundary',t=>{
  const f=fixture(t),facade=new Proxy(f.store,{});
  assert.throws(()=>createPreregisteredEfficiencyComparisonLedger(facade,{evidenceAdapter:f.evidenceAdapter}),{code:'EFFICIENCY_COMMIT_BOUNDARY'});
  assert.throws(()=>f.store.transact(()=>{
    const caseRecord=f.put('efficiency-case','case:transaction',{question:'Uncommitted attack case'}),obligation=f.put('efficiency-obligation','obligation:transaction',{criterion:'Uncommitted attack obligation'});
    const registration=f.ledger.preregister({schema:PREREGISTERED_EFFICIENCY_SCHEMA,id:'comparison:transaction',case:reference(caseRecord),obligations:[reference(obligation)],
      metrics:[{id:'cost',kind:'cost',unit:'calls'},{id:'latency',kind:'latency',unit:'ms'}]});
    const evidence=f.makeEvidence('baseline');
    f.ledger.recordArm(f.arm(registration,'baseline',evidence));
  }),{code:'EFFICIENCY_COMMIT_BOUNDARY'});
  assert.equal(f.store.get('efficiency-case','case:transaction'),null);
});

test('unknown measurements and quality loss remain non-PASS after material resolution',t=>{
  const f=fixture(t),registration=f.ledger.preregister(f.definition);
  const baseline=f.ledger.recordArm(f.arm(registration,'baseline',f.makeEvidence('baseline')));
  const candidate=f.ledger.recordArm(f.arm(registration,'candidate',f.makeEvidence('candidate',{unknownMetric:'end_to_end'})));
  const unknown=f.ledger.evaluate({schema:PREREGISTERED_EFFICIENCY_EVIDENCE_SCHEMA,registration,baseline,candidate});
  assert.equal(unknown.decision,'UNKNOWN');assert.equal(unknown.reason,'MEASUREMENT_UNKNOWN');assert.equal(unknown.savings,null);
  const f2=fixture(t),registration2=f2.ledger.preregister(f2.definition);
  const baseline2=f2.ledger.recordArm(f2.arm(registration2,'baseline',f2.makeEvidence('baseline')));
  const candidate2=f2.ledger.recordArm(f2.arm(registration2,'candidate',f2.makeEvidence('candidate',{quality:'FAIL',coverage:'FAIL',calls:1,bytes:1,latency:1})));
  const failed=f2.ledger.evaluate({schema:PREREGISTERED_EFFICIENCY_EVIDENCE_SCHEMA,registration:registration2,baseline:baseline2,candidate:candidate2});
  assert.equal(failed.decision,'FAIL');assert.equal(failed.reason,'QUALITY_OR_COVERAGE_FAILED');
});

test('the legacy nested one-argument form cannot self-certify qualification',()=>{
  assert.throws(()=>evaluatePreregisteredEfficiencyComparison({schema:PREREGISTERED_EFFICIENCY_EVIDENCE_SCHEMA}),{code:'EFFICIENCY_LEDGER'});
});
