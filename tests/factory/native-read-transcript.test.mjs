import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
import {Store} from '../../factory/lib/store.mjs';
import {createNativeReadTranscript,appendNativeReadFrame,inspectNativeReadTranscript} from '../../factory/providers/native-read-transcript.mjs';

const hash='a'.repeat(64),other='b'.repeat(64);
const header={actorId:'run:producer',requestHash:hash,tool:{namespace:'sovereign_workspace',name:'read_input',schemaHash:hash},limits:{maxCalls:1,maxResultBytes:1024,maxFinalBytes:1024}};
const binding={threadId:'thread:1',turnId:'turn:1'};
const ref=type=>({type,id:type+':1',version:1,hash});
const responseJson=canonical({success:true,contentItems:[{type:'inputText',text:'\ufeff\r\nAé e\u0301 😀\n'}]});
const events=[
  {kind:'BIND',...binding},
  {kind:'CALL',...binding,callId:'call:1',namespace:header.tool.namespace,tool:header.tool.name,arguments:{path:'input/original.txt'}},
  {kind:'PREPARED',callId:'call:1',effectRef:ref('effect'),continuationRef:ref('native-read-continuation'),responseJson},
  {kind:'DISPATCH_INTENT',callId:'call:1',responseHash:sha256(responseJson)},
  {kind:'ACK',...binding,callId:'call:1',responseJson},
  {kind:'FINISH',...binding,outputJson:canonical({answer:'Exact retained public candidate'})},
];
function chain(count=events.length,h=header,es=events){let t=createNativeReadTranscript(h);for(const e of es.slice(0,count))t=appendNativeReadFrame(t,e,t.head);return t;}
const view=t=>inspectNativeReadTranscript(t,t.head);
const rejected=fn=>assert.throws(fn,e=>['SCHEMA','NATIVE_TRANSCRIPT'].includes(e.code));
test('native transcript: exact ordered bytes, fixed actor and canonical public candidate',()=>{
  const t=chain(),v=view(t);assert.equal(v.phase,'COMPLETED');assert.equal(v.callbackCount,1);
  assert.equal(v.prepared.responseJson,responseJson);assert.equal(v.completion.outputJson,events[5].outputJson);
  assert.equal(v.recovery.disposition,'RETAINED_CANDIDATE_REQUIRES_VALIDATION');assert.equal(v.recovery.mayResend,false);
  assert.equal(t.header.actorId,'run:producer');assert.equal(t.frames.length,6);
});
test('native transcript: no-tool response needs its provider binding, not a fictional callback',()=>{
  const bound=chain(1),t=appendNativeReadFrame(bound,events[5],bound.head);assert.equal(view(t).callbackCount,0);assert.equal(view(t).phase,'COMPLETED');
  rejected(()=>appendNativeReadFrame(chain(0),events[5],chain(0).head));
});
const phases=['CREATED','BOUND','CALLED','PREPARED','DISPATCH_INTENT','ACKNOWLEDGED','COMPLETED'];
for(let count=0;count<=6;count++)test('native transcript: restart at '+phases[count]+' does not authorize resending',()=>{
  const t=chain(count),restored=JSON.parse(JSON.stringify(t)),v=inspectNativeReadTranscript(restored,t.head);
  assert.equal(v.phase,phases[count]);assert.equal(v.recovery.mayResend,false);
  assert.equal(v.callbackCount,count>=2?1:0);
  assert.equal(v.recovery.responseDelivery,count>=5?'PROVIDER_ACKNOWLEDGED_NOT_SEMANTIC_PROOF':count===4?'UNKNOWN':'NO_DISPATCH_INTENT_RECORDED');
});
for(let count=0;count<=5;count++)test('native transcript: abort retains phase/consumption at '+phases[count],()=>{
  const t=chain(count),aborted=appendNativeReadFrame(t,{kind:'ABORT',code:'PROCESS_LOST'},t.head),v=view(aborted);
  assert.equal(v.phase,'ABORTED');assert.equal(v.abort.priorPhase,phases[count]);assert.equal(v.callbackCount,count>=2?1:0);
  if(count===4){assert.equal(v.recovery.disposition,'RECONCILE_DISPATCH');assert.equal(v.recovery.responseDelivery,'UNKNOWN');}
  rejected(()=>appendNativeReadFrame(aborted,events[0],aborted.head));
});
const invalids=[
  ['call before bind',0,events[1]],['duplicate bind',1,events[0]],['duplicate call',2,events[1]],
  ['wrong thread',1,{...events[1],threadId:'other'}],['wrong turn',1,{...events[1],turnId:'other'}],
  ['wrong namespace',1,{...events[1],namespace:'shell'}],['wrong tool',1,{...events[1],tool:'exec'}],
  ['extra path field',1,{...events[1],arguments:{path:'input/original.txt',command:'whoami'}}],
  ['absolute path',1,{...events[1],arguments:{path:'/etc/passwd'}}],['traversal',1,{...events[1],arguments:{path:'a/../b'}}],
  ['missing call',1,events[2]],['wrong prepared call',2,{...events[2],callId:'other'}],
  ['wrong receipt kind',2,{...events[2],effectRef:ref('inference')}],['no reservation',2,{...events[2],continuationRef:null}],
  ['noncanonical wire',2,{...events[2],responseJson:JSON.stringify(JSON.parse(responseJson),null,2)}],
  ['nontext tool response',2,{...events[2],responseJson:canonical({success:true,contentItems:[{type:'inputImage',imageUrl:'data:any'}]})}],
  ['wrong response digest',3,{...events[3],responseHash:other}],['send before prepare',2,events[3]],['duplicate send',4,events[3]],
  ['ack before dispatch',3,events[4]],['foreign ack',4,{...events[4],callId:'other'}],
  ['altered ack bytes',4,{...events[4],responseJson:canonical({success:true,contentItems:[{type:'inputText',text:'altered'}]})}],
  ['duplicate ack',5,events[4]],['final before ack',4,events[5]],['foreign final',5,{...events[5],turnId:'other'}],
  ['duplicate finish',6,events[5]],['unknown event',1,{kind:'ASSUME_DELIVERED'}],['null event',1,null],
];
for(const [name,count,event]of invalids)test('native transcript rejects '+name,()=>{const t=chain(count);rejected(()=>appendNativeReadFrame(t,event,t.head));});
test('native transcript validates byte limits, not UTF16 counts; preserves full Unicode',()=>{
  const n=Buffer.byteLength(responseJson),h={...header,limits:{...header.limits,maxResultBytes:n}};
  assert.equal(view(chain(3,h)).prepared.responseJson,responseJson);
  rejected(()=>chain(3,{...h,limits:{...h.limits,maxResultBytes:n-1}}));
  const e={...events[2],responseJson:canonical({success:true,contentItems:[{type:'inputText',text:'\ud800'}]})};
  const t=chain(2);rejected(()=>appendNativeReadFrame(t,e,t.head));
  rejected(()=>createNativeReadTranscript({...header,limits:{...header.limits,maxCalls:2}}));
});
test('native transcript detaches caller objects and freezes each returned history',()=>{
  const input=structuredClone(header),t=createNativeReadTranscript(input);input.tool.name='exec';assert.equal(t.header.tool.name,'read_input');
  assert.ok(Object.isFrozen(t.header.tool));assert.throws(()=>{t.header.tool.name='exec';});
  const e=structuredClone(events[0]),next=appendNativeReadFrame(t,e,t.head);e.turnId='changed';assert.equal(next.frames[0].event.turnId,binding.turnId);assert.equal(t.frames.length,0);
});
test('native transcript rejects tampering, omitted tail, stale head, reordering and unknown fields',()=>{
  const t=chain();
  for(const mutate of [x=>{x.frames[2].event.responseJson='{}';},x=>{x.frames.pop();},x=>{x.frames[2].seq=7;},x=>{x.frames.reverse();},x=>{x.header.requestHash=other;},x=>{x.extra=true;}]){
    const changed=structuredClone(t);mutate(changed);rejected(()=>inspectNativeReadTranscript(changed,t.head));
  }
  rejected(()=>inspectNativeReadTranscript(t,hash));
  const previous=chain(1);rejected(()=>appendNativeReadFrame(previous,events[1],chain(0).head));
});
test('native transcript accepts failed operation bytes only as data, not as a passing judgment',()=>{
  const response=canonical({success:false,contentItems:[{type:'inputText',text:'READ_FAILED'}]}),es=structuredClone(events);
  es[2].responseJson=response;es[3].responseHash=sha256(response);es[4].responseJson=response;
  const v=view(chain(6,header,es));assert.equal(v.phase,'COMPLETED');assert.equal(v.recovery.disposition,'RETAINED_CANDIDATE_REQUIRES_VALIDATION');assert.ok(v.caveat.includes('no authority'));
});
for(const count of [3,4,5,6])test('REAL isolated process SIGKILL after '+phases[count]+' retains exact checkpoint without inference',()=>{
  const dir=mkdtempSync(join(tmpdir(),'sovereign-native-ledger-')),database=join(dir,'state.sqlite'),module=new URL('../../factory/lib/store.mjs',import.meta.url).href;
  const t=chain(count);
  const script='import {Store} from '+JSON.stringify(module)+';const store=new Store(process.argv[1]);const transcript=JSON.parse(process.argv[2]);store.put("native-lab-checkpoint","native-lab:1",{transcript,expectedHead:transcript.head},{expectedVersion:0});process.kill(process.pid,"SIGKILL");';
  let store;
  try{
    const result=spawnSync(process.execPath,['--input-type=module','-e',script,database,JSON.stringify(t)],{encoding:'utf8',timeout:10000});
    assert.equal(result.error,undefined);assert.equal(result.signal,'SIGKILL');
    store=new Store(database);store.verifyJournal();const r=store.get('native-lab-checkpoint','native-lab:1');
    assert.equal(r.data.expectedHead,t.head);const v=inspectNativeReadTranscript(r.data.transcript,r.data.expectedHead);
    assert.equal(v.phase,phases[count]);assert.equal(v.recovery.mayResend,false);
    assert.equal(store.list('mission').length,0);assert.equal(store.list('effect').length,0);assert.equal(store.list('run').length,0);
    assert.throws(()=>store.put('native-lab-checkpoint','native-lab:1',r.data,{expectedVersion:0}),{code:'VERSION_CONFLICT'});
  }finally{store?.close();rmSync(dir,{recursive:true,force:true});}
});
