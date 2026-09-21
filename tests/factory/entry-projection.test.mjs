import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256} from '../../factory/lib/contracts.mjs';
import {projectControllerEntries,projectSourceRecords,projectMaterialSequence,projectClosedCaseClassification} from '../../reconstruction/visualization/entry-projection.mjs';

function fixture(){
  const records=[],events=[];
  const add=(type,id,data)=>{
    const r={type,id,data,version:1,hash:sha256(data)};records.push(r);
    events.push({seq:events.length+1,kind:'record.committed',createdAt:'2026-09-14T00:00:00Z',data:{type,id,version:1,hash:r.hash}});return r;
  };
  const store={list:t=>records.filter(r=>r.type===t),get:(t,id)=>records.find(r=>r.type===t&&r.id===id),
    events:({after,limit})=>events.filter(e=>e.seq>after).slice(0,limit)};
  return {store,records,events,add};
}
const identity=x=>x;
function entryFixture(){
  const f=fixture(),id='sourced-response-entry';
  f.add('run','producer',{missionId:'m',nodeId:id,mode:'producer'});
  const binding={missionId:'m',nodeId:id,entryContractHash:'contract',node:{instructions:'Complete charter'},responsibility:{method:'Acquire then review'}};
  const config=f.add('worker-config','producer',{instructions:'Exact old prefix',prefixHash:sha256('Exact old prefix'),roleIds:[]});
  f.add('run','reviewer',{missionId:'m',nodeId:'review:'+id,mode:'reviewer'});
  f.add('worker-config','reviewer',{instructions:'Exact reviewer prefix',prefixHash:sha256('Exact reviewer prefix'),roleIds:['omega_22']});
  f.add('artifact','candidate',{missionId:'m',payload:{nodeId:id},payloadHash:'candidate-hash'});
  const report={mission:{id:'m'},sourcedEntry:{status:'FALLBACK',roleIds:[],reviewerRoleIds:['omega_22'],runIds:['producer'],contractHash:'contract',
    artifactId:'candidate',artifactHash:'candidate-hash',criteria:[{id:'support'}],version:'sourced-response-v1',disposition:{code:'DIRECT_NOT_ACCEPTED'}},
    controllerExecutions:[{runId:'producer',configHash:config.hash,prefixHash:config.data.prefixHash,binding}],
    reviews:[{artifactId:'candidate',result:{decision:'RETURN'}}]};
  return {...f,report,config};
}
test('controller projection preserves exact historical prefix, charter, rejection and no invented plan',()=>{
  const {store,records,report}=entryFixture(),before=JSON.stringify(records);
  const stages=projectControllerEntries(store,report,{compactReview:identity,stageProducts:()=>[]});
  assert.equal(stages.length,1);const s=stages[0];assert.equal(s.status,'FALLBACK');assert.deepEqual(s.dependencies,[]);
  assert.equal(s.reviews[0].result.decision,'RETURN');assert.equal(s.disposition.code,'DIRECT_NOT_ACCEPTED');
  assert.equal(s.assignedInstructions[0].instructions,'Exact old prefix');assert.deepEqual(s.controllerExecutions,report.controllerExecutions);
  assert.equal(s.assignedInstructions.length,2);assert.equal(s.assignedInstructions[1].instructions,'Exact reviewer prefix');
  assert.equal(JSON.stringify(records),before);
});
test('projection rejects changed instructions, controller binding and candidate identity',()=>{
  for(const mutate of [f=>f.config.data.instructions='changed',f=>f.report.controllerExecutions[0].binding.missionId='other',
    f=>f.report.sourcedEntry.artifactHash='changed']){
    const f=entryFixture();mutate(f);assert.throws(()=>projectControllerEntries(f.store,f.report,{compactReview:identity,stageProducts:()=>[]}),/identity differs|binding differs/);
  }
});
test('source projection preserves full untrusted HTML as data and rejects changed bytes',()=>{
  const {store,add}=fixture(),raw='<p>Contrary evidence</p><script>untrusted()</script>';
  const r=add('source','s',{missionId:'m',id:'s',raw,hash:sha256(raw),status:'ADMITTED'});
  add('source','other',{missionId:'other',raw:'private'});
  const result=projectSourceRecords(store,'m');assert.equal(result.length,1);assert.equal(result[0].raw,raw);
  r.data.raw+='x';assert.throws(()=>projectSourceRecords(store,'m'),/source bytes differ/);
});
test('sequence uses original source, candidate, reviewer and review journal order without fabricating planning',()=>{
  const {store,add}=fixture();
  add('run','p',{missionId:'m',mode:'producer'});add('source','s',{missionId:'m'});
  add('artifact','a',{missionId:'m',payload:{nodeId:'sourced-response-entry'}});
  add('run','r',{missionId:'m',mode:'reviewer'});add('review','review',{artifactId:'a',result:{decision:'RETURN'}});
  const sequence=projectMaterialSequence(store,'m');assert.deepEqual(sequence.map(e=>e.seq),[2,3,4,5]);
  assert.deepEqual(sequence.map(e=>e.kind),['source.acquired','candidate.created','reviewer.created','review.committed']);
  assert.equal(sequence[3].status,'RETURN');assert.deepEqual(projectMaterialSequence(store,'other'),[]);
});
test('sequence paginates beyond first thousand records and rejects mismatched evidence',()=>{
  const {store,add,events}=fixture();for(let i=0;i<1001;i++)add('noise',String(i),{});
  add('source','late',{missionId:'m'});assert.equal(projectMaterialSequence(store,'m')[0].seq,1002);
  events.at(-1).data.hash='changed';assert.throws(()=>projectMaterialSequence(store,'m'),/identity differs/);
});
test('case label cannot convert synthetic or unknown receipts into real completed calls',()=>{
  const journal={events:1,head:'h'},summary={journal,scope:'controlled',calls:[
    {actorMode:'producer',receipt:{simulation:true,status:'completed'}},
    {actorMode:'reviewer',receipt:{simulation:false,status:'completed'}},
    {actorMode:'producer',receipt:{status:'completed'}}]},hash=sha256(summary),audit={journal,summarySha256:hash,scope:'controlled'};
  const c=projectClosedCaseClassification(summary,audit,journal,hash);
  assert.equal(c.realCompleted,1);assert.equal(c.simulatedCompleted,1);assert.equal(c.unknownClassification,1);
  assert.throws(()=>projectClosedCaseClassification(summary,audit,{events:2,head:'h'},hash),/binding differs/);
});
