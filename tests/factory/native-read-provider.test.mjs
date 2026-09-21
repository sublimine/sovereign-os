import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough,Writable} from 'node:stream';
import {rmSync} from 'node:fs';
import {CodexProvider} from '../../factory/providers/codex.mjs';
import {NATIVE_READ_PROFILE,NATIVE_READ_TOOL_BINDING,NATIVE_READ_TOOLS} from '../../factory/providers/native-read-policy.mjs';
import {inferenceRequestHash,instructionProfile} from '../../factory/providers/instruction-profiles.mjs';
import {createNativeReadTranscript,appendNativeReadFrame,inspectNativeReadTranscript} from '../../factory/providers/native-read-transcript.mjs';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';

const text='\ufeffName;Amount\r\n"A e\u0301 😀";15\r\n',answer={answer:text};
const request={instructions:'Read the named supplied input if eligible and return it literally.',input:'Read inputs/source.txt.',
  schema:{type:'object',properties:{answer:{type:'string'}},required:['answer'],additionalProperties:false},
  model:'gpt-6-astra',reasoningEffort:'ultra',instructionProfile:NATIVE_READ_PROFILE,
  timeoutMs:1000,maxOutputBytes:4096,validate:v=>canonical(v)===canonical(answer)};
const externalRef=type=>({type,id:type+':synthetic',version:1,hash:'a'.repeat(64)});
function fixture(options={}){
  const calls=[],checkpoints=[],metadata=[];let launch;
  let transcript=createNativeReadTranscript({actorId:'run:synthetic',requestHash:options.wrongHash?'b'.repeat(64):inferenceRequestHash(request),
    tool:NATIVE_READ_TOOL_BINDING,limits:{maxCalls:1,maxResultBytes:4096,maxFinalBytes:4096}});
  const append=event=>{transcript=appendNativeReadFrame(transcript,event,transcript.head);checkpoints.push(event.kind);return transcript;};
  const session={checkpoint:()=>transcript,
    bind:binding=>append({kind:'BIND',...binding}),
    prepare:async ({signal,...call})=>{
      append({kind:'CALL',...call});
      if(options.prepare)await options.prepare(signal);
      return append({kind:'PREPARED',callId:call.callId,effectRef:externalRef('effect'),continuationRef:externalRef('native-read-continuation'),
        responseJson:canonical({success:true,contentItems:[{type:'inputText',text}]})});
    },
    dispatch:payload=>{if(options.dispatchError)throw Object.assign(Error('private-controller-detail'),{code:'NATIVE_PERSISTENCE'});return append({kind:'DISPATCH_INTENT',...payload});},
    ack:payload=>append({kind:'ACK',...payload}),
    finish:payload=>{if(options.finishError)throw Error('not retained');return append({kind:'FINISH',...payload});},
    retainOutcome:({value,receipt})=>({valueHash:sha256(value),receiptHash:sha256(receipt)}),
  };
  if(options.asyncBind)session.bind=async binding=>append({kind:'BIND',...binding});
  if(options.changeCheckpoint)options.changeCheckpoint(session,()=>transcript);
  const scope={threadId:'thread-native-1',turnId:'turn-native-1'};
  const item={type:'dynamicToolCall',id:'call-native-1',namespace:NATIVE_READ_TOOL_BINDING.namespace,tool:NATIVE_READ_TOOL_BINDING.name,arguments:{path:'inputs/source.txt'},status:'inProgress'};
  const callback={id:201,method:'item/tool/call',params:{...scope,callId:item.id,namespace:item.namespace,tool:item.tool,arguments:item.arguments}};
  const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();
  child.kill=()=>{queueMicrotask(()=>child.emit('exit',0));return true;};
  const emit=m=>child.stdout.write(JSON.stringify(m)+'\n');const event=(method,params)=>emit({method,params});
  const finish=()=>{
    event('thread/tokenUsage/updated',{...scope,tokenUsage:{total:{inputTokens:80,outputTokens:20,cachedInputTokens:40,totalTokens:100},last:{inputTokens:50,outputTokens:10,totalTokens:60}}});
    event('item/completed',{...scope,item:{type:'agentMessage',text:JSON.stringify(answer),phase:'final_answer'}});
    event('turn/completed',{threadId:scope.threadId,turn:{id:scope.turnId,status:'completed',items:options.terminalItems??[]}});
  };
  child.stdin=new Writable({write(chunk,_enc,done){const m=JSON.parse(String(chunk));calls.push(m);done();queueMicrotask(()=>{
    if(!m.method){
      if(m.id===201&&m.result){
        assert.ok(checkpoints.includes('DISPATCH_INTENT'),'Response must follow controller checkpoint');
        if(options.repeatRequest){emit(callback);return;}
        if(!options.noAck)event('item/completed',{...scope,item:{...item,status:'completed',success:true,contentItems:options.changedAck?[{type:'inputText',text:'wrong'}]:m.result.contentItems}});
        if(options.secondCall)event('item/started',{...scope,item:{...item,id:'second'}});
        finish();
      }
      return;
    }
    if(m.id===undefined)return;
    if(m.method==='initialize')emit({id:m.id,result:{}});
    else if(m.method==='account/read')emit({id:m.id,result:{account:{type:'chatgpt'}}});
    else if(m.method==='mcpServerStatus/list')emit({id:m.id,result:{data:[{name:'fixture_mcp',tools:{},runtimeStatus:'disabled'}],nextCursor:null}});
    else if(m.method==='thread/start')emit({id:m.id,result:{thread:{id:scope.threadId},model:request.model,modelProvider:'openai',reasoningEffort:request.reasoningEffort,instructionSources:[],approvalPolicy:'never',sandbox:{type:'readOnly',networkAccess:false}}});
    else if(m.method==='turn/start'){
      if(!options.earlyEvents)emit({id:m.id,result:{turn:{id:scope.turnId}}});
      event('turn/started',{threadId:scope.threadId,turn:{id:scope.turnId}});
      if(options.earlyEvents)emit({id:m.id,result:{turn:{id:scope.turnId}}});
      if(options.noTool){finish();return;}
      if(!options.noStart)event('item/started',{...scope,item:options.changedStart??item});
      emit(options.mutateCallback?options.mutateCallback(structuredClone(callback)):callback);
    }else throw Error('Unexpected mock method '+m.method);
  });}});
  const provider=new CodexProvider({nativeRead:options.enabled??true,closeGraceMs:20,testTransportInjection:{version:async()=>'codex-cli 0.153.4',mcpNames:async()=>['fixture_mcp'],spawn:args=>{launch=args;return child;}}});
  return {provider,session,calls,checkpoints,metadata,event,get launch(){return launch;},get transcript(){return transcript;},
    run:(overrides={})=>provider.generate({...request,nativeSession:session,onEvent:e=>metadata.push(e),...overrides})};
}
for(const earlyEvents of [false,true])test('SIM native read: byte-exact controller response/ordered transcript and unchanged target, early='+earlyEvents,async()=>{
  const f=fixture({earlyEvents});try{
    const r=await f.run();assert.deepEqual(r.value,answer);assert.equal(r.receipt.toolPolicy,NATIVE_READ_PROFILE);assert.equal(r.receipt.usage.totalTokens,100);
    assert.equal(r.receipt.usageScope,'fresh-thread-total');assert.equal(r.receipt.nativeTranscript.head,f.transcript.head);
    assert.deepEqual(f.checkpoints,['BIND','CALL','PREPARED','DISPATCH_INTENT','ACK','FINISH']);
    assert.equal(inspectNativeReadTranscript(r.nativeTranscript,r.receipt.nativeTranscript.head).phase,'COMPLETED');
    assert.equal(f.calls.filter(c=>c.id===201&&c.result).length,1);
    const start=f.calls.find(c=>c.method==='thread/start').params;assert.deepEqual(start.environments,[]);assert.deepEqual(start.dynamicTools,NATIVE_READ_TOOLS);
    assert.equal(start.model,'gpt-6-astra');assert.equal(start.config.model_reasoning_effort,'ultra');
    assert.ok(f.launch.args.includes('features.code_mode={enabled=false,direct_only_tool_namespaces=["sovereign_workspace"]}'));
    assert.ok(f.launch.args.includes('features.code_mode_host={enabled=false,disable_in_process_fallback=false}'));
    assert.ok(f.launch.args.includes('web_search="disabled"'));assert.ok(f.launch.args.includes('mcp_servers.fixture_mcp.enabled=false'));
    assert.ok(!JSON.stringify(f.metadata).includes(text));
  }finally{assert.equal((await f.provider.close()).processExitObserved,true);}
});
test('SIM native read: no tool still requires fresh bind and retained final',async()=>{
  const f=fixture({noTool:true});try{const r=await f.run();assert.deepEqual(f.checkpoints,['BIND','FINISH']);assert.equal(r.receipt.nativeTranscript.callbackCount,0);}finally{await f.provider.close();}
});
for(const [name,options,overrides]of [
  ['disabled transport',{enabled:false},{}],['ordinary profile',{}, {instructionProfile:'scoped-v1'}],
  ['missing controller',{}, {nativeSession:undefined}],['wrong request hash',{wrongHash:true},{}],['async commit hook',{asyncBind:true},{}],
  ['promise checkpoint',{changeCheckpoint:session=>{session.checkpoint=()=>Promise.reject(Error('private checkpoint failure'));}},{}],
  ['async outcome retention',{changeCheckpoint:session=>{session.retainOutcome=async()=>({});}},{}],
])test('SIM native read rejects before launch: '+name,async()=>{const f=fixture(options);try{await assert.rejects(f.run(overrides));assert.equal(f.launch,undefined);}finally{await f.provider.close();}});
const attacks={
  'foreign thread':{mutateCallback:m=>({...m,params:{...m.params,threadId:'foreign'}})},
  'foreign turn':{mutateCallback:m=>({...m,params:{...m.params,turnId:'foreign'}})},
  'wrong call':{mutateCallback:m=>({...m,params:{...m.params,callId:'other'}})},
  'host request':{mutateCallback:m=>({...m,method:'fs/readFile'})},
  'changed arguments':{mutateCallback:m=>({...m,params:{...m.params,arguments:{path:'different'}}})},
  'no start':{noStart:true},'duplicate request':{repeatRequest:true},'second call':{secondCall:true},
  'altered acknowledgement':{changedAck:true},'missing acknowledgement':{noAck:true},
  'fake terminal tool':{noTool:true,terminalItems:[{type:'dynamicToolCall',id:'forged',namespace:'shell',tool:'exec'}]},
  'dispatch persistence failure':{dispatchError:true},'final persistence failure':{finishError:true},
  'controller changes final payload':{changeCheckpoint:session=>{const finish=session.finish;session.finish=p=>finish({...p,outputJson:canonical({answer:'changed'})});}},
  'controller mutates passed final payload':{changeCheckpoint:session=>{const finish=session.finish;session.finish=p=>{p.outputJson=canonical({answer:'changed'});return finish(p);};}},
  'outcome persistence failure':{changeCheckpoint:session=>{session.retainOutcome=()=>{throw Error('not retained');};}},
  'wrong retained outcome':{changeCheckpoint:session=>{session.retainOutcome=()=>({valueHash:'0'.repeat(64),receiptHash:'0'.repeat(64)});}},
  'promise outcome retention':{changeCheckpoint:session=>{session.retainOutcome=()=>Promise.reject(Error('private retention failure'));}},
};
for(const [name,options]of Object.entries(attacks))test('SIM native read fails closed: '+name,async()=>{const f=fixture(options);try{await assert.rejects(f.run(),e=>['CAPABILITY','PROTOCOL'].includes(e.code));assert.ok(f.calls.filter(c=>c.id===201&&c.result).length<=1);}finally{assert.equal((await f.provider.close()).processExitObserved,true);}});
test('SIM native read cancels pending preparation, sends no response and awaits controller settlement',async()=>{
  let signalSeen=false;const f=fixture({prepare:signal=>new Promise((resolve,reject)=>{signalSeen=true;signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});})});
  try{await assert.rejects(f.run({timeoutMs:60}),{code:'TIMEOUT'});assert.ok(signalSeen);assert.equal(f.calls.filter(c=>c.id===201&&c.result).length,0);assert.equal((await f.provider.close()).processExitObserved,true);}finally{await f.provider.close();}
});
test('SIM native read does not claim cleanup while a controller ignores cancellation',async()=>{
  let release;const f=fixture({prepare:()=>new Promise(resolve=>{release=resolve;})});
  try{
    await assert.rejects(f.run({timeoutMs:60}),{code:'TIMEOUT'});await assert.rejects(f.provider.close(),{code:'CLEANUP_UNCONFIRMED'});
    assert.equal(f.calls.filter(c=>c.id===201&&c.result).length,0);
  }finally{release?.();await new Promise(resolve=>setImmediate(resolve));if(f.launch?.cwd)rmSync(f.launch.cwd,{recursive:true,force:true});}
});
test('native read instruction profile binds base and exact tool schema, separately from prior profiles',()=>{
  const p=instructionProfile(NATIVE_READ_PROFILE);assert.notEqual(p.hash,instructionProfile('scoped-v1').hash);
  assert.notEqual(inferenceRequestHash(request),inferenceRequestHash({...request,instructionProfile:'scoped-v1'}));
  assert.throws(()=>new CodexProvider({nativeRead:true,publicSearch:true}),{code:'PROTOCOL'});
});
