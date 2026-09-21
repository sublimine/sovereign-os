import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough, Writable} from 'node:stream';
import {CodexProvider,ProviderError} from '../../factory/providers/codex.mjs';
import {inferenceRequestHash,instructionProfile} from '../../factory/providers/instruction-profiles.mjs';

// All default tests below use a simulated transport; no model or subscription use.
function simulated(options={}) {
  const calls=[]; let launch; let counter=0;
  const child=new EventEmitter(); child.stdout=new PassThrough(); child.stderr=new PassThrough();
  child.kill=signal=>{ child.killed=true; (child.signals??=[]).push(signal??'SIGTERM'); if(options.ignoreTerm&&signal!=='SIGKILL')return true; queueMicrotask(()=>child.emit('exit',0)); return true; };
  const emit=(m)=>{
    const data=Buffer.from(JSON.stringify(m)+'\n');
    if(options.split) { child.stdout.write(data.subarray(0,7)); child.stdout.write(data.subarray(7)); }
    else child.stdout.write(data);
  };
  const event=(method,params)=>emit({method,params});
  child.stdin=new Writable({write(chunk,encoding,cb){
    const m=JSON.parse(String(chunk)); calls.push(m); cb();
    if (!m.method || m.id===undefined) return;
    queueMicrotask(()=>{
      if (options.handle?.({m,emit,event,child})) return;
      let result={};
      if(m.method==='account/read') result={account:{type:options.auth??'chatgpt',planType:'pro'}};
      if(m.method==='mcpServerStatus/list') result={data:options.inventory??[{name:'node_repl',tools:{},runtimeStatus:m.params.threadId?'disabled':null}],nextCursor:null};
      if(m.method==='thread/start') result={thread:{id:`thread-${++counter}`},model:m.params.model??'gpt-5.6-terra',modelProvider:'openai',reasoningEffort:'high',instructionSources:options.instructions??[],approvalPolicy:'never',sandbox:{type:'readOnly',networkAccess:false}};
      if(m.method==='turn/start') {
        result={turn:{id:`turn-${counter}`}};
        emit({id:m.id,result});
        if(options.hang) return;
        event('item/completed',{threadId:m.params.threadId,turnId:result.turn.id,item:{type:'agentMessage',text:'{"answer":0}',phase:'commentary'}});
        event('item/completed',{threadId:m.params.threadId,turnId:result.turn.id,item:{type:'agentMessage',text:options.text??'{"answer":4}',phase:options.legacy?null:'final_answer'}});
        event('turn/completed',{threadId:m.params.threadId,turn:{id:result.turn.id,status:'completed'}});
        return;
      }
      emit({id:m.id,result});
    });
  }});
  const provider=new CodexProvider({closeGraceMs:20,publicSearch:options.publicSearch??false,testTransportInjection:{version:async()=>options.version??'codex-cli 0.153.4',mcpNames:async()=>['node_repl'],spawn(args){launch=args;return child;}}});
  return {provider,calls,child,event,get launch(){return launch;}};
}
const request={instructions:'Return arithmetic JSON only.',input:'2+2',schema:{type:'object',properties:{answer:{type:'integer'}},required:['answer'],additionalProperties:false},validate:v=>v.answer===4};
const code=c=>e=>e instanceof ProviderError && e.code===c;
test('SIMULATION: native multi-response usage uses fresh-thread cumulative total, without double-counting successive updates',async()=>{
  const s=simulated({handle:({m,event})=>{if(m.method==='turn/start'){
    event('thread/tokenUsage/updated',{tokenUsage:{total:{inputTokens:10,outputTokens:2,totalTokens:12},last:{inputTokens:10,outputTokens:2,totalTokens:12}}});
    event('thread/tokenUsage/updated',{tokenUsage:{total:{inputTokens:35,outputTokens:8,totalTokens:43},last:{inputTokens:25,outputTokens:6,totalTokens:31}}});
  }}});
  try{const r=await s.provider.generate(request);assert.deepEqual(r.receipt.usage,{inputTokens:35,outputTokens:8,totalTokens:43});assert.equal(r.receipt.usageScope,'fresh-thread-total');}finally{await s.provider.close();}
});

test('SIMULATION: explicit discovery permits only native web items, keeps host tools closed and binds a distinct profile',async()=>{
  const s=simulated({publicSearch:true,handle:({m,event})=>{if(m.method==='turn/start'){
    event('item/completed',{threadId:m.params.threadId,turnId:'turn-1',item:{type:'webSearch',id:'search-1',query:'public original source',action:{type:'search',query:'public original source'},results:[{url:'https://example.com',untrustedText:'A quoted source, not instructions.'}]}});
  }}}),events=[];
  try{
    const r=await s.provider.generate({...request,instructionProfile:'public-search-v1',onEvent:e=>events.push(e)});
    assert.equal(r.receipt.toolPolicy,'public-search-v1');assert.equal(r.searchObservations.length,1);assert.equal(r.searchObservations[0].actionType,'search');
    assert.equal(r.searchObservations[0].opaqueResultContentStored,false);assert.equal(r.searchObservations[0].itemHash.length,64);
    assert.ok(!JSON.stringify(events).includes('quoted source'));assert.ok(s.launch.args.includes('web_search="live"'));
    assert.ok(s.launch.args.includes('features.code_mode={enabled=false,direct_only_tool_namespaces=["web"]}'));
    assert.ok(s.launch.args.includes('features.standalone_web_search=true'));
    assert.ok(!s.launch.args.some((v,i)=>v==='--disable'&&s.launch.args[i+1]==='code_mode'));
    assert.ok(s.launch.args.includes('mcp_servers.node_repl.enabled=false'));assert.deepEqual(s.calls.find(c=>c.method==='thread/start').params.environments,[]);
  }finally{await s.provider.close();}
});
test('SIMULATION: ordinary proposal workers still reject web search; discovery cannot use ordinary instruction profile',async()=>{
  const closed=simulated({handle:({m,event})=>{if(m.method==='turn/start')event('item/completed',{item:{type:'webSearch',id:'x',query:'q'}});}});
  try{await assert.rejects(closed.provider.generate(request),{code:'CAPABILITY'});}finally{await closed.provider.close();}
  for(const [options,profile]of [[{publicSearch:true},'scoped-v1'],[{},'public-search-v1']]){
    const s=simulated(options);try{await assert.rejects(s.provider.generate({...request,instructionProfile:profile}),{code:'CAPABILITY'});assert.equal(s.launch,undefined);}finally{await s.provider.close();}
  }
});
test('SIMULATION: discovery rejects shell, MCP and oversized or malformed native search metadata',async()=>{
  for(const item of [{type:'commandExecution'},{type:'mcpToolCall'},{type:'webSearch',id:'x',query:'q',action:{type:'invented'}},{type:'webSearch',id:'x',query:'q'.repeat(9000),action:{type:'search'}}]){
    const s=simulated({publicSearch:true,handle:({m,event})=>{if(m.method==='turn/start')event('item/completed',{threadId:m.params.threadId,turnId:'turn-1',item});}});
    try{await assert.rejects(s.provider.generate({...request,instructionProfile:'public-search-v1'}),e=>['CAPABILITY','PROTOCOL'].includes(e.code));}finally{await s.provider.close();}
  }
});

test('SIMULATION: structured final message, isolated requests, metadata-only events and fresh threads',async()=>{
  const s=simulated({split:true}); const events=[];
  try {
    const a=await s.provider.generate({...request,model:'gpt-5.6-terra',reasoningEffort:'high',onEvent:e=>events.push(e)});
    const b=await s.provider.generate(request);
    assert.deepEqual(a.value,{answer:4}); assert.equal(a.receipt.kind,'inference'); assert.equal(a.receipt.simulation,true);
    assert.notEqual(a.receipt.threadId,b.receipt.threadId); assert.equal(a.receipt.contextHash.length,64);
    for(const c of s.calls.filter(x=>x.method==='thread/start')) {assert.deepEqual(c.params.environments,[]);assert.deepEqual(c.params.dynamicTools,[]);assert.equal(c.params.ephemeral,true);}
    for(const c of s.calls.filter(x=>x.method==='turn/start')) assert.deepEqual(c.params.outputSchema,request.schema);
    assert.ok(s.launch.args.includes('mcp_servers.node_repl.enabled=false'));
    assert.ok(s.launch.args.includes('features.code_mode_host={enabled=false,disable_in_process_fallback=false}'));
    assert.ok(s.launch.args.includes('features.standalone_web_search=false'));
    assert.ok(events.every(e=>!('text' in e)));
  } finally {await s.provider.close();}
});
test('SIMULATION: legacy phase uses last complete assistant message',async()=>{const s=simulated({legacy:true});try{assert.equal((await s.provider.generate(request)).value.answer,4);}finally{await s.provider.close();}});
test('SIMULATION: late previous-thread final before new thread response cannot become the new answer',async()=>{
  let starts=0;const s=simulated({handle:({m,event,emit})=>{
    if(m.method==='thread/start'&&++starts===2)
      event('item/completed',{threadId:'thread-1',turnId:'turn-1',item:{type:'agentMessage',text:'{"answer":99}',phase:'final_answer'}});
    if(m.method==='turn/start'&&starts===2){
      emit({id:m.id,result:{turn:{id:'turn-2'}}});
      event('turn/completed',{threadId:m.params.threadId,turn:{id:'turn-2',status:'completed'}});return true;
    }
  }});
  try{await s.provider.generate(request);await assert.rejects(s.provider.generate({...request,validate:()=>true}),code('PROTOCOL'));}
  finally{await s.provider.close();}
});
test('SIMULATION: item turn identity received before turn response must match that response',async()=>{
  const s=simulated({handle:({m,event,emit})=>{if(m.method==='turn/start'){
    event('item/completed',{threadId:m.params.threadId,turnId:'another-turn',item:{type:'agentMessage',text:'{"answer":4}',phase:'final_answer'}});
    emit({id:m.id,result:{turn:{id:'turn-1'}}});
    event('turn/completed',{threadId:m.params.threadId,turn:{id:'turn-1',status:'completed'}});return true;
  }}});
  try{await assert.rejects(s.provider.generate(request),code('PROTOCOL'));}finally{await s.provider.close();}
});
test('SIMULATION: conflicting early item turn identities cannot blend into one accepted answer',async()=>{
  const s=simulated({handle:({m,event,emit})=>{if(m.method==='turn/start'){
    for(const turnId of ['turn-1','other'])event('item/started',{threadId:m.params.threadId,turnId,item:{type:'reasoning'}});
    emit({id:m.id,result:{turn:{id:'turn-1'}}});
    event('item/completed',{threadId:m.params.threadId,turnId:'turn-1',item:{type:'agentMessage',text:'{"answer":4}',phase:'final_answer'}});
    event('turn/completed',{threadId:m.params.threadId,turn:{id:'turn-1',status:'completed'}});return true;
  }}});
  try{await assert.rejects(s.provider.generate(request),code('PROTOCOL'));}finally{await s.provider.close();}
});
test('SIMULATION: valid same-turn events may arrive before the turn response',async()=>{
  const s=simulated({handle:({m,event,emit})=>{if(m.method==='turn/start'){
    event('item/started',{threadId:m.params.threadId,turnId:'turn-1',item:{type:'reasoning'}});
    event('item/completed',{threadId:m.params.threadId,turnId:'turn-1',item:{type:'agentMessage',text:'{"answer":4}',phase:'final_answer'}});
    event('turn/completed',{threadId:m.params.threadId,turn:{id:'turn-1',status:'completed'}});
    emit({id:m.id,result:{turn:{id:'turn-1'}}});return true;
  }}});
  try{assert.equal((await s.provider.generate(request)).value.answer,4);}finally{await s.provider.close();}
});
test('SIMULATION: pre-turn usage from an earlier request is not charged to the new receipt',async()=>{
  let starts=0;const s=simulated({handle:({m,event})=>{
    if(m.method==='thread/start'&&++starts===2)
      event('thread/tokenUsage/updated',{threadId:'thread-1',tokenUsage:{total:{totalTokens:999999}}});
  }});
  try{await s.provider.generate(request);const r=await s.provider.generate(request);assert.equal(r.receipt.usage,undefined);}
  finally{await s.provider.close();}
});
for(const [name,params]of [
  ['empty turn identifier',{turnId:''}],['numeric turn identifier',{turnId:9}],
  ['null turn identifier',{turnId:null}],['contradictory nested turn identifier',{turnId:'turn-1',turn:{id:'turn-2'}}],
  ['foreign thread',{threadId:'foreign-thread',turnId:'turn-1'}]
])test('SIMULATION: early event rejects '+name,async()=>{
  const s=simulated({handle:({m,event})=>{if(m.method==='turn/start')
    event('item/started',{threadId:m.params.threadId,...params,item:{type:'reasoning'}});
  }});
  try{await assert.rejects(s.provider.generate(request),code('PROTOCOL'));}finally{await s.provider.close();}
});
test('SIMULATION: native search cannot be attributed before its scoped turn starts',async()=>{
  const s=simulated({publicSearch:true,handle:({m,event})=>{if(m.method==='thread/start')
    event('item/completed',{threadId:'previous-thread',turnId:'previous-turn',item:{type:'webSearch',id:'old',query:'previous query',action:{type:'search'}}});
  }});
  try{await assert.rejects(s.provider.generate({...request,instructionProfile:'public-search-v1'}),code('PROTOCOL'));
    assert.equal(s.calls.filter(c=>c.method==='turn/start').length,0);
  }finally{await s.provider.close();}
});
test('SIMULATION: explicit scoped base is wire-bound and cannot share a default-profile receipt',async()=>{
  const s=simulated();
  try {
    const initial=await s.provider.generate(request), scoped=await s.provider.generate({...request,instructionProfile:'scoped-v1'});
    const starts=s.calls.filter(c=>c.method==='thread/start');
    assert.equal(starts[0].params.baseInstructions,undefined);
    assert.equal(starts[1].params.baseInstructions,instructionProfile('scoped-v1').baseInstructions);
    assert.notEqual(initial.receipt.contextHash,scoped.receipt.contextHash);
    assert.equal(scoped.receipt.contextHash,inferenceRequestHash({...request,instructionProfile:'scoped-v1'}));
    assert.equal(scoped.receipt.instructionProfile.hash,instructionProfile('scoped-v1').hash);
    assert.deepEqual(starts[1].params.environments,[]);assert.equal(starts[1].params.approvalPolicy,'never');
  } finally {await s.provider.close();}
});
test('SIMULATION: unknown instruction profile fails before launching a provider',async()=>{
  const s=simulated();try{await assert.rejects(s.provider.generate({...request,instructionProfile:'invented'}),{code:'PROVIDER_PROFILE'});assert.equal(s.launch,undefined);}finally{await s.provider.close();}
});
test('SIMULATION: streaming output cap rejects before a final item; progress contains counts, never text',async()=>{
  const events=[],s=simulated({handle:({m,event})=>{if(m.method==='turn/start'){
    event('item/agentMessage/delta',{delta:'private-output-fixture'});
    event('item/agentMessage/delta',{delta:'x'.repeat(64)});return true;
  }}});
  try{await assert.rejects(s.provider.generate({...request,maxOutputBytes:32,onEvent:e=>events.push(e)}),code('PROTOCOL'));
    const progress=events.find(e=>e.type==='provider.progress');assert.equal(progress.agentOutputBytes,22);
    assert.ok(!JSON.stringify(events).includes('private-output-fixture'));
  }finally{await s.provider.close();}
});
test('SIMULATION: close confirms exit and escalates only its own unresponsive process',async()=>{
  const s=simulated({ignoreTerm:true});await s.provider.generate(request);
  const first=await s.provider.close();assert.equal(first.processExitObserved,true);assert.deepEqual(s.child.signals,['SIGTERM','SIGKILL']);
  assert.deepEqual(await s.provider.close(),first);assert.deepEqual(s.child.signals,['SIGTERM','SIGKILL']);
});
test('SIMULATION: many small protocol frames do not exhaust an unrelated small answer budget',async()=>{
  const s=simulated({handle:({m,event})=>{if(m.method==='turn/start')for(let i=0;i<1500;i++)event('thread/tokenUsage/updated',{tokenUsage:{last:{inputTokens:12,outputTokens:3}}});}});
  try{const r=await s.provider.generate({...request,maxOutputBytes:128});assert.equal(r.value.answer,4);assert.ok(r.receipt.transport.wireBytes>65536);assert.ok(r.receipt.transport.completedMessageBytes<128);}
  finally{await s.provider.close();}
});
test('SIMULATION: independent protocol cap still stops a notification flood',async()=>{
  const s=simulated({handle:({m,event})=>{if(m.method==='turn/start'){for(let i=0;i<1500;i++)event('thread/tokenUsage/updated',{tokenUsage:{last:{inputTokens:12}}});return true;}}});
  try{await assert.rejects(s.provider.generate({...request,maxProtocolBytes:65536}),e=>e.code==='PROTOCOL'&&e.message==='Generation protocol byte limit exceeded');}
  finally{await s.provider.close();}
});
for(const [name,opts,expected] of [
  ['version mismatch',{version:'codex-cli 0.153.5'},'CAPABILITY'],
  ['API auth rejected',{auth:'apiKey'},'AUTH'],
  ['loaded instructions rejected',{instructions:['/fixture/AGENTS.md']},'CAPABILITY'],
  ['unknown MCP rejected',{inventory:[{name:'other',tools:{}}]},'CAPABILITY'],
  ['MCP tools rejected',{inventory:[{name:'node_repl',tools:{exec:{}}}]},'CAPABILITY'],
  ['invalid final JSON',{text:'not JSON'},'PROTOCOL'],
  ['schema mismatch',{text:'{"answer":5}'},'PROTOCOL'],
]) test(`SIMULATION: ${name}`,async()=>{const s=simulated(opts);try{await assert.rejects(s.provider.generate(request),code(expected));}finally{await s.provider.close();}});
test('SIMULATION: rejects output over caller byte budget',async()=>{const s=simulated();try{await assert.rejects(s.provider.generate({...request,maxOutputBytes:5}),code('PROTOCOL'));}finally{await s.provider.close();}});
test('SIMULATION: unexpected server request denied and process killed',async()=>{
  const s=simulated({handle:({m,emit})=>{if(m.method==='turn/start'){emit({id:'server-1',method:'item/tool/call',params:{}});return true;}}});
  try{await assert.rejects(s.provider.generate(request),code('CAPABILITY'));assert.ok(s.calls.some(c=>c.id==='server-1'&&c.error));assert.equal(s.child.killed,true);}finally{await s.provider.close();}
});
test('SIMULATION: tool item never becomes accepted completion',async()=>{
  const s=simulated({handle:({m,event})=>{if(m.method==='turn/start'){event('item/started',{item:{type:'commandExecution'}});return true;}}});
  try{await assert.rejects(s.provider.generate(request),code('CAPABILITY'));}finally{await s.provider.close();}
});
test('SIMULATION: quota error is typed and raw message redacted',async()=>{
  const s=simulated({handle:({m,emit})=>{if(m.method==='turn/start'){emit({id:m.id,error:{code:429,message:'quota secret_token_EXAMPLE'}});return true;}}});
  try{await assert.rejects(s.provider.generate(request),e=>e.code==='QUOTA'&&!e.message.includes('secret'));}finally{await s.provider.close();}
});
test('SIMULATION: provider-owned transient retry is not killed before subsequent successful completion',async()=>{
  const events=[],s=simulated({handle:({m,event})=>{if(m.method==='turn/start')event('error',{willRetry:true,error:{message:'sensitive fixture never logged',codexErrorInfo:{responseStreamDisconnected:{httpStatusCode:502}}}});}});
  try{assert.equal((await s.provider.generate({...request,onEvent:e=>events.push(e)})).value.answer,4);
    assert.ok(events.some(e=>e.type==='provider.retry'&&e.code==='TRANSIENT_PROVIDER'&&e.httpStatusCode===502));
    assert.ok(!JSON.stringify(events).includes('sensitive fixture'));
  }finally{await s.provider.close();}
});
test('SIMULATION: terminal transport failure retains only finite typed metadata and measured byte counts',async()=>{
  const s=simulated({handle:({m,event})=>{if(m.method==='turn/start'){event('error',{willRetry:false,error:{message:'private-path-fixture',codexErrorInfo:{responseTooManyFailedAttempts:{httpStatusCode:null}}}});return true;}}});
  try{await assert.rejects(s.provider.generate(request),e=>e.code==='TRANSIENT_PROVIDER'&&e.diagnostics.providerCategory==='responseTooManyFailedAttempts'&&e.diagnostics.wireBytes>0&&!JSON.stringify(e).includes('private-path-fixture'));}
  finally{await s.provider.close();}
});
test('SIMULATION: retry flag cannot suppress a policy error',async()=>{
  const s=simulated({handle:({m,event})=>{if(m.method==='turn/start'){event('error',{willRetry:true,error:{message:'fixture',codexErrorInfo:'misalignmentPolicyViolation'}});return true;}}});
  try{await assert.rejects(s.provider.generate(request),code('CAPABILITY'));}finally{await s.provider.close();}
});
test('SIMULATION: timeout kills process and settles generation',async()=>{const s=simulated({hang:true});try{await assert.rejects(s.provider.generate({...request,timeoutMs:30}),code('TIMEOUT'));assert.equal(s.child.killed,true);}finally{await s.provider.close();}});
test('SIMULATION: cancellation kills process and settles pending requests',async()=>{const s=simulated({hang:true});const controller=new AbortController();try{const result=s.provider.generate({...request,signal:controller.signal});setTimeout(()=>controller.abort(),25);await assert.rejects(result,code('CANCELLED'));}finally{await s.provider.close();}});
test('SIMULATION: pre-aborted request does not launch transport',async()=>{const s=simulated();const c=new AbortController();c.abort();try{await assert.rejects(s.provider.generate({...request,signal:c.signal}),code('CANCELLED'));assert.equal(s.launch,undefined);}finally{await s.provider.close();}});
test('SIMULATION: partial line plus process exit is failure',async()=>{
  const s=simulated({handle:({m,child})=>{if(m.method==='turn/start'){child.stdout.write('{"id":');child.emit('exit',1);return true;}}});
  try{await assert.rejects(s.provider.generate(request),code('PROTOCOL'));}finally{await s.provider.close();}
});
test('SIMULATION: concurrent calls cannot share active session',async()=>{const s=simulated({hang:true});try{const a=s.provider.generate({...request,timeoutMs:30});await assert.rejects(s.provider.generate(request),code('CAPABILITY'));await assert.rejects(a,code('TIMEOUT'));}finally{await s.provider.close();}});
test('SIMULATION: cancellation while asynchronous validator runs never returns a receipt',async()=>{
  const s=simulated();const c=new AbortController();
  try{await assert.rejects(s.provider.generate({...request,signal:c.signal,validate:async()=>{c.abort();await Promise.resolve();return true;}}),code('CANCELLED'));}finally{await s.provider.close();}
});
test('SIMULATION: timeout settles even if caller validator never settles',async()=>{
  const s=simulated();
  try{await assert.rejects(s.provider.generate({...request,timeoutMs:30,validate:()=>new Promise(()=>{})}),code('TIMEOUT'));}finally{await s.provider.close();}
});
test('SIMULATION: effect delta rejected without corresponding started item',async()=>{
  const s=simulated({handle:({m,event})=>{if(m.method==='turn/start'){event('item/commandExecution/outputDelta',{delta:'synthetic'});return true;}}});
  try{await assert.rejects(s.provider.generate(request),code('CAPABILITY'));}finally{await s.provider.close();}
});
test('SIMULATION: effect hidden in completed turn rejected',async()=>{
  const s=simulated({handle:({m,emit,event})=>{if(m.method==='turn/start'){emit({id:m.id,result:{turn:{id:'turn-1'}}});event('turn/completed',{threadId:m.params.threadId,turn:{id:'turn-1',status:'completed',items:[{type:'fileChange'}]}});return true;}}});
  try{await assert.rejects(s.provider.generate(request),code('CAPABILITY'));}finally{await s.provider.close();}
});
test('SIMULATION: invalid protocol line is fatal',async()=>{
  const s=simulated({handle:({m,child})=>{if(m.method==='turn/start'){child.stdout.write('not-json\n');return true;}}});
  try{await assert.rejects(s.provider.generate(request),code('PROTOCOL'));}finally{await s.provider.close();}
});
test('SIMULATION: explicit final ambiguity is rejected',async()=>{
  const s=simulated({handle:({m,emit,event})=>{if(m.method==='turn/start'){
    emit({id:m.id,result:{turn:{id:'turn-1'}}});
    for(let i=0;i<2;i++)event('item/completed',{threadId:m.params.threadId,item:{type:'agentMessage',text:'{"answer":4}',phase:'final_answer'}});
    event('turn/completed',{threadId:m.params.threadId,turn:{id:'turn-1',status:'completed'}});return true;
  }}});
  try{await assert.rejects(s.provider.generate(request),code('PROTOCOL'));}finally{await s.provider.close();}
});
test('LIVE OPT-IN: official ChatGPT arithmetic inference, no tools',{skip:process.env.SOVEREIGN_CODEX_LIVE_SMOKE!=='1',timeout:180000},async()=>{
  const p=new CodexProvider();try{const r=await p.generate({...request,timeoutMs:150000});assert.equal(r.value.answer,4);assert.equal(r.receipt.simulation,false);assert.equal(r.receipt.kind,'inference');}finally{await p.close();}
});
