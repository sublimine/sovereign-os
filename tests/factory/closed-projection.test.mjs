import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256} from '../../factory/lib/contracts.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {compactCatalogReview} from '../../factory/lib/review-codec.mjs';
import {exposedArtifacts,projectClosedExperiments,projectRejectedReview} from '../../reconstruction/visualization/closed-projection.mjs';

function fixture(){
  const records=[];
  const add=(type,id,data)=>{const record={type,id,data,version:1,hash:sha256(data),createdAt:'2026-09-12T00:00:00.000Z'};records.push(record);return record;};
  const store={list:type=>records.filter(r=>r.type===type),get:(type,id)=>records.find(r=>r.type===type&&r.id===id)};
  return {records,add,store};
}
test('closed presentation distinguishes an absent ordinary artifacts field from malformed input',()=>{
  assert.deepEqual(exposedArtifacts({schema:'sovereign.blind-input.v1',replicationId:'r',publicProtocol:{}}),[]);
  assert.deepEqual(exposedArtifacts({artifacts:[{id:'a'}]}),['a']);
  assert.throws(()=>exposedArtifacts({schema:'unknown'}),/Unrecognized ordinary/);
  assert.throws(()=>exposedArtifacts({schema:'sovereign.blind-input.v1',replicationId:'r',publicProtocol:{},privateOriginal:'62'}),/Unexpected closed/);
});
test('closed projection preserves UNKNOWN and private records without inventing an opening or model exposure',()=>{
  const {store,add,records}=fixture(),input={schema:'sovereign.blind-input.v1',replicationId:'replica:1',publicProtocol:{question:'Q'}};
  const request={instructions:'Complete public role',input:JSON.stringify(input),schema:{type:'object'},model:'fixture',reasoningEffort:'high'},requestHash=inferenceRequestHash(request);
  const registration=add('blind-registration','replica:1',{signed:{data:{missionId:'mission:1',runId:'run:1',requestHash,requestJson:JSON.stringify(request),originalRef:{id:'private:1'}}}});
  const result={status:'UNKNOWN',result:'',unknowns:['Unavailable prerequisite']};
  const seal=add('blind-seal','replica:1',{signed:{data:{registrationHash:registration.hash,requestHash,result}}});
  add('blind-replication','replica:1',{registrationHash:registration.hash,sealHash:seal.hash,state:'INCONCLUSIVE'});
  add('run','run:1',{nodeId:'attempt',requests:[{requestHash}],inferenceReceipts:[{contextHash:requestHash}]});
  const before=JSON.stringify(records),pool={},[projection]=projectClosedExperiments(store,'mission:1',pool);
  assert.deepEqual(projection.publicInput,input);assert.deepEqual(projection.result,result);
  assert.equal(projection.openingRecorded,false);assert.equal(projection.requestCompleted,true);assert.equal(projection.state,'INCONCLUSIVE');
  assert.equal(pool[registration.hash].data.signed.data.originalRef.id,'private:1');
  assert.equal(JSON.stringify(projection.publicInput).includes('private:1'),false);
  assert.equal(JSON.stringify(records),before,'Presentation is read-only');
  store.get('blind-replication','replica:1').data.sealHash='changed';
  assert.throws(()=>projectClosedExperiments(store,'mission:1',{}),/seal identity/);
});
test('rejected ACCEPT plus material finding expands exact citations without becoming an admitted review',()=>{
  const {store,add}=fixture(),hash=sha256('artifact'),catalog=[{sourceKey:'o1',kind:'artifact',id:'artifact:1',hash}];
  const expanded={artifactHash:hash,purpose:'assessment',decision:'ACCEPT',checks:[{criterionId:'c1',verdict:'PASS',reason:'Faithful record',evidence:[{kind:'artifact',id:'artifact:1',hash,quote:'UNKNOWN'}]}],findings:[{severity:'material',description:'Upstream defect',recovery:'Preserve'}],uncertainty:'No result'};
  const response=compactCatalogReview(expanded,catalog),responseHash=sha256(response);
  add('worker-review-encoding','encoding:1',{runId:'run:1',artifactId:'artifact:1',encoding:'evidence-catalog-v1',rawResponse:response,rawResponseHash:responseHash,observedCatalog:catalog,expandedResponseHash:sha256(expanded)});
  const record=add('worker-rejected-review','rejected:1',{runId:'run:1',artifactId:'artifact:1',code:'FAILED_GATE',payloadCaptured:true,response,responseHash,accepted:false});
  const projected=projectRejectedReview(store,record);
  assert.deepEqual(projected.expanded,expanded);assert.equal(projected.accepted,false);assert.match(projected.disposition,/NOT a committed/);
  assert.equal(projected.expanded.decision,'ACCEPT');assert.equal(projected.expanded.findings[0].severity,'material');
  record.data.responseHash='changed';assert.throws(()=>projectRejectedReview(store,record),/response hash differs/);
});
test('uncaptured or unexpandable rejected responses stay explicit rather than invented',()=>{
  const {store,add}=fixture();
  const missing=add('worker-rejected-review','rejected:1',{payloadCaptured:false,response:null,responseHash:null});
  assert.equal(projectRejectedReview(store,missing).expanded,null);
  const response={invalid:'original response'},raw=add('worker-rejected-review','rejected:2',{payloadCaptured:true,response,responseHash:sha256(response)});
  const projected=projectRejectedReview(store,raw);assert.deepEqual(projected.response,response);assert.equal(projected.expanded,null);assert.match(projected.disposition,/No exact codec/);
});
