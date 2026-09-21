import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp, readFile, lstat, rm} from 'node:fs/promises';
import {tmpdir, homedir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {instructionProfile as resolveProfile, inferenceRequestHash} from './instruction-profiles.mjs';
import {canonical,clone,sha256} from '../lib/contracts.mjs';
import {NATIVE_READ_PROFILE,NATIVE_READ_TOOLS,NATIVE_READ_TOOL_BINDING} from './native-read-policy.mjs';
import {inspectNativeReadTranscript} from './native-read-transcript.mjs';

const exec = promisify(execFile);
const DISABLED = ['shell_tool','unified_exec','code_mode','code_mode_host','code_mode_only','apps','plugins','hooks','multi_agent','multi_agent_v2','browser_use','computer_use','image_generation','view_image','deferred_executor','tool_suggest','memories','goals'];
const SAFE_ITEMS = new Set(['userMessage','agentMessage','reasoning']);
const DEFAULT_CODEX_BIN = process.env.SUBLIMINE_CODEX_BIN || process.env.CODEX_BIN || 'codex';
export class ProviderError extends Error {
  constructor(code, message) { super(message); this.name = 'ProviderError'; this.code = code; }
}
const error = (code, message) => new ProviderError(code, message);
function remoteError(raw) {
  // Preserve only the installed protocol's finite categories and HTTP integers.
  // Never propagate server prose, paths, prompts or credentials.
  const allowed=new Set(['contextWindowExceeded','sessionBudgetExceeded','usageLimitExceeded','rateLimitExceeded','serverOverloaded','cyberPolicy','misalignmentPolicyViolation','internalServerError','unauthorized','badRequest','threadRollbackFailed','sandboxError','other','httpConnectionFailed','responseStreamConnectionFailed','responseStreamDisconnected','responseTooManyFailedAttempts','activeTurnNotSteerable']);
  const info=raw?.codexErrorInfo??raw?.data?.codexErrorInfo;
  const variant=typeof info==='string'?info:info&&typeof info==='object'&&Object.keys(info).length===1?Object.keys(info)[0]:null;
  const category=allowed.has(variant)?variant:null;
  const status=info&&typeof info==='object'?info[variant]?.httpStatusCode:null;
  const httpStatusCode=Number.isInteger(status)&&status>=100&&status<=599?status:null;
  const classified=(code,message)=>Object.assign(error(code,message),{diagnostics:{providerCategory:category,httpStatusCode}});
  if(category==='contextWindowExceeded'||category==='sessionBudgetExceeded')return classified('CONTEXT_LIMIT','Provider context or session budget exceeded');
  if(['usageLimitExceeded','rateLimitExceeded'].includes(category)||httpStatusCode===429)return classified('QUOTA','Provider quota or rate limit reached');
  if(category==='unauthorized'||[401,403].includes(httpStatusCode))return classified('AUTH','ChatGPT authentication unavailable');
  if(['cyberPolicy','misalignmentPolicyViolation','sandboxError'].includes(category))return classified('CAPABILITY','Provider policy or sandbox requires attention');
  if(['serverOverloaded','internalServerError','httpConnectionFailed','responseStreamConnectionFailed','responseStreamDisconnected','responseTooManyFailedAttempts'].includes(category)
    &&(httpStatusCode===null||httpStatusCode>=500))return classified('TRANSIENT_PROVIDER','Provider connection or service interrupted');
  if(category)return classified('PROTOCOL','Provider request failed');
  // Legacy responses without typed metadata retain redacted classification.
  const text = JSON.stringify(raw ?? {}).toLowerCase();
  if (/quota|rate.?limit|usage.?limit|429|limitexceeded/.test(text)) return classified('QUOTA','Provider quota or rate limit reached');
  if (/unauth|authentication|login|401|403/.test(text)) return classified('AUTH','ChatGPT authentication unavailable');
  return classified('PROTOCOL','Provider request failed');
}
function cleanEnv() {
  return Object.fromEntries(['HOME','PATH','CODEX_HOME','XDG_CONFIG_HOME','XDG_DATA_HOME','XDG_RUNTIME_DIR','LANG','SSL_CERT_FILE','SSL_CERT_DIR'].filter(k => process.env[k] !== undefined).map(k => [k,process.env[k]]));
}
function flags(names,publicSearch=false,nativeRead=false) {
  // CLI --disable code_mode becomes a final boolean override; it would erase
  // the structured enabled=false + direct-only web policy below.
  return [...DISABLED.filter(f=>!((publicSearch||nativeRead)&&f==='code_mode')).flatMap(f => ['--disable',f]), ...[
    'features.code_mode_host={enabled=false,disable_in_process_fallback=false}',
    'agents.enabled=false','notify=[]',publicSearch?'web_search="live"':'web_search="disabled"',
    ...(publicSearch?['features.standalone_web_search=true','features.code_mode={enabled=false,direct_only_tool_namespaces=["web"]}']:['features.standalone_web_search=false']),
    'forced_login_method="chatgpt"','model_provider="openai"',
    ...(nativeRead?['features.code_mode={enabled=false,direct_only_tool_namespaces=["sovereign_workspace"]}']:[]),
    ...names.map(n => `mcp_servers.${n}.enabled=false`),
  ].flatMap(v => ['-c',v])];
}

// Deliberately not a permissive TOML parser. Unsupported MCP syntax fails closed.
// Only server names leave this function; no transport arguments/env/header values.
async function discoverNames(files) {
  const names = new Set();
  for (const file of files) {
    let info;
    try { info = await lstat(file); } catch (e) { if (e.code === 'ENOENT') continue; throw error('CAPABILITY','Cannot inspect configuration metadata'); }
    if (!info.isFile() || info.size > 1024 * 1024) throw error('CAPABILITY','Unsupported configuration file');
    const contents = await readFile(file,'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('mcp_servers')) continue;
      const m = trimmed.match(/^\[mcp_servers\.([A-Za-z0-9_-]+)(?:\.[A-Za-z0-9_-]+)*\]\s*(?:#.*)?$/);
      if (!m) throw error('CAPABILITY','Unsupported MCP configuration syntax; explicit metadata audit required');
      names.add(m[1]);
    }
  }
  return [...names].sort();
}

/** Official ChatGPT app-server inference client. Not a tool executor or OS sandbox. */
export class CodexProvider {
  #options; #child; #pending = new Map(); #nextId = 0; #buffer = Buffer.alloc(0);
  #fatal; #active; #starting; #started = false; #closed = false; #directory; #names = [];
  #exitObserved = false; #exitWait; #resolveExit; #closing;
  #nativeTasks = new Set();
  constructor({codexPath=DEFAULT_CODEX_BIN,expectedVersion='0.153.4',testTransportInjection,closeGraceMs=2000,publicSearch=false,nativeRead=false}={}) {
    if (!Number.isSafeInteger(closeGraceMs) || closeGraceMs < 1 || closeGraceMs > 10000) throw error('PROTOCOL','Invalid close deadline');
    if(typeof publicSearch!=='boolean')throw error('PROTOCOL','Public search policy must be explicit trusted configuration');
    if(typeof nativeRead!=='boolean'||nativeRead&&publicSearch)throw error('PROTOCOL','Native reading requires its separate trusted transport');
    this.#options = {codexPath,expectedVersion,testTransportInjection,closeGraceMs,publicSearch,nativeRead};
  }
  async start() {
    if (this.#closed) throw error('CANCELLED','Provider is closed');
    if (this.#fatal) throw this.#fatal;
    if (this.#started) return this.health();
    if (this.#starting) return this.#starting;
    this.#starting = this.#start();
    return this.#starting;
  }
  async #start() {
    const injection = this.#options.testTransportInjection;
    try {
      const version = injection ? await injection.version() : (await exec(this.#options.codexPath,['--version'],{env:cleanEnv(),timeout:10000,maxBuffer:4096})).stdout.trim();
      if (version !== `codex-cli ${this.#options.expectedVersion}`) throw error('CAPABILITY','Installed Codex version does not match audited version');
      this.#directory = await mkdtemp(path.join(tmpdir(),'sovereign-provider-'));
      const home = process.env.CODEX_HOME || path.join(homedir(),'.codex');
      this.#names = injection ? await injection.mcpNames() : await discoverNames([
        '/etc/codex/config.toml',path.join(home,'config.toml'),
        '/.codex/config.toml',path.join(tmpdir(),'.codex/config.toml'),
      ]);
      if (this.#fatal || this.#closed) throw this.#fatal ?? error('CANCELLED','Provider closed');
      if (!Array.isArray(this.#names) || this.#names.some(n => !/^[A-Za-z0-9_-]+$/.test(n))) throw error('CAPABILITY','Invalid MCP metadata');
      const args = ['app-server','--stdio',...flags(this.#names,this.#options.publicSearch,this.#options.nativeRead)];
      this.#exitWait = new Promise(resolve => { this.#resolveExit = resolve; });
      this.#child = injection ? injection.spawn({args,cwd:this.#directory}) : spawn(this.#options.codexPath,args,{cwd:this.#directory,env:cleanEnv(),stdio:['pipe','pipe','pipe']});
      this.#child.stdout.on('data', chunk => this.#receive(chunk));
      this.#child.stderr.on('data', () => {}); // Drain without logging or persisting secrets.
      this.#child.on('error', () => {
        if (!this.#child.pid && !injection) { this.#exitObserved = true; this.#resolveExit(); }
        this.#fail(error('PROTOCOL','Provider process failed'));
      });
      this.#child.on('exit', () => {
        this.#exitObserved = true; this.#resolveExit();
        this.#fail(error('PROTOCOL',this.#buffer.length ? 'Provider exited with partial protocol data' : 'Provider process exited'));
      });
      this.#child.stdin.on('error', () => this.#fail(error('PROTOCOL','Provider input closed')));
      await this.#call('initialize',{clientInfo:{name:'sovereign_factory',version:'0.1.0'},capabilities:{experimentalApi:true}});
      this.#send({method:'initialized',params:{}});
      await this.#account();
      await this.#inventory();
      this.#started = true;
      return this.health();
    } catch (e) {
      this.#fail(e instanceof ProviderError ? e : error('CAPABILITY','Provider initialization failed'));
      throw this.#fatal;
    }
  }
  #send(message) {
    if (this.#fatal) throw this.#fatal;
    this.#child.stdin.write(JSON.stringify(message)+'\n');
  }
  #call(method,params) {
    if (this.#fatal) return Promise.reject(this.#fatal);
    return new Promise((resolve,reject) => {
      const id = ++this.#nextId;
      const timer = setTimeout(() => this.#fail(error('TIMEOUT','Provider request timed out')),20000);
      this.#pending.set(id,{resolve,reject,timer});
      try { this.#send({id,method,params}); } catch(e) { this.#fail(e); }
    });
  }
  #fail(e) {
    if (this.#fatal) return;
    if(this.#active)e.diagnostics={...(e.diagnostics??{}),wireBytes:this.#active.wireBytes,agentOutputBytes:this.#active.streamedOutputBytes??0};
    this.#fatal = e;
    this.#active?.callbackAbort?.abort();
    for (const p of this.#pending.values()) { clearTimeout(p.timer); p.reject(e); }
    this.#pending.clear();
    this.#active?.reject(e);
    if (!this.#exitObserved) this.#child?.kill();
  }
  #receive(chunk) {
    if (this.#fatal) return;
    if (this.#active) {
      this.#active.wireBytes += Buffer.byteLength(chunk);
      // JSON event envelopes and progress notifications are not answer bytes.
      // Independent caps retain both protections without conflating their units.
      if (this.#active.wireBytes > this.#active.maxProtocolBytes) return this.#fail(error('PROTOCOL','Generation protocol byte limit exceeded'));
    }
    this.#buffer = Buffer.concat([this.#buffer,Buffer.from(chunk)]);
    if (this.#buffer.length > 4 * 1024 * 1024) return this.#fail(error('PROTOCOL','Protocol frame limit exceeded'));
    let pos;
    while ((pos = this.#buffer.indexOf(10)) >= 0) {
      const line = this.#buffer.subarray(0,pos).toString('utf8');
      this.#buffer = this.#buffer.subarray(pos+1);
      if (!line.trim()) continue;
      let m;
      try { m = JSON.parse(line); } catch { return this.#fail(error('PROTOCOL','Invalid protocol JSON')); }
      try { this.#message(m); } catch (e) { return this.#fail(e instanceof ProviderError ? e : error('PROTOCOL','Malformed provider event')); }
    }
  }
  #message(m) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) throw error('PROTOCOL','Malformed protocol envelope');
    if(m.id!==undefined&&m.method==='item/tool/call'&&this.#options.nativeRead){this.#nativeRequest(m);return;}
    if (m.id !== undefined && m.method) {
      this.#send({id:m.id,error:{code:-32601,message:'This inference client denies all server requests'}});
      throw error('CAPABILITY','Unexpected provider server request denied');
    }
    if (m.id !== undefined) {
      const p = this.#pending.get(m.id);
      if (!p) throw error('PROTOCOL','Unknown provider response');
      clearTimeout(p.timer); this.#pending.delete(m.id);
      m.error ? p.reject(remoteError(m.error)) : p.resolve(m.result);
      return;
    }
    if (typeof m.method !== 'string') throw error('PROTOCOL','Missing protocol method');
    const p = m.params ?? {};
    if (/^item\/(commandExecution|fileChange|mcpToolCall|dynamicToolCall|imageGeneration|collab)/.test(m.method)
      ||m.method.startsWith('item/webSearch')&&!this.#options.publicSearch) throw error('CAPABILITY','Unexpected tool event');
    if ((m.method === 'item/started' || m.method === 'item/completed') && !this.#safeItem(p.item?.type)) throw error('CAPABILITY','Unexpected tool or effect item');
    if (m.method === 'mcpServer/startupStatus/updated' && ['starting','ready'].includes(p.status)) throw error('CAPABILITY','MCP startup is forbidden');
    const a = this.#active;
    if (!a){if(p.item?.type==='webSearch')throw error('CAPABILITY','Search outside a scoped request');return;}
    // A fresh thread cannot have turn items before we request its only turn.
    // Acknowledgements and notifications can share a transport frame, so bind
    // an early event's turn ID now and reconcile it with the RPC response later.
    const turnEvent=m.method.startsWith('item/')||m.method.startsWith('turn/');
    if(turnEvent&&!a.turnRequested)throw error('PROTOCOL','Turn event before turn request');
    if(m.method==='thread/tokenUsage/updated'&&!a.turnRequested)return;
    if (p.threadId && a.threadId && p.threadId !== a.threadId) throw error('PROTOCOL','Unexpected thread event');
    if (p.turnId && a.turnId && p.turnId !== a.turnId) throw error('PROTOCOL','Unexpected turn event');
    if(turnEvent){
      for(const id of [p.turnId,p.turn?.id])if(id!==undefined){
        if(typeof id!=='string'||!id||(a.turnId&&id!==a.turnId))throw error('PROTOCOL','Invalid turn event identifier');
        a.turnId=id;
      }
      if(a.native&&a.turnId)this.#nativeBind(a);
    }
    if((m.method==='item/started'||m.method==='item/completed')&&p.item?.type==='dynamicToolCall')this.#nativeItem(m.method,p);
    if(m.method==='item/completed'&&p.item?.type==='webSearch'){
      const item=p.item,actionType=item.action?.type??'unspecified';
      if(typeof item.id!=='string'||!item.id||item.id.length>256||typeof item.query!=='string'||item.query.length>8192
        ||!['search','openPage','findInPage','unspecified'].includes(actionType))throw error('PROTOCOL','Malformed native search metadata');
      const itemHash=createHash('sha256').update(JSON.stringify(item)).digest('hex');
      const prior=a.searchObservations.find(o=>o.id===item.id);
      if(prior&&prior.itemHash!==itemHash)throw error('PROTOCOL','Native search item changed');
      if(!prior){
        if(a.searchObservations.length>=16)throw error('CAPABILITY','Native search observation cap exceeded');
        a.searchObservations.push({id:item.id,query:item.query,actionType,itemHash,opaqueResultContentStored:false});
      }
    }
    if (m.method === 'error') {
      const failure=remoteError(p.error);
      if(p.willRetry===true&&['TRANSIENT_PROVIDER','QUOTA'].includes(failure.code)){
        a.onEvent?.({type:'provider.retry',code:failure.code,...failure.diagnostics});return;
      }
      throw failure;
    }
    if (m.method === 'thread/tokenUsage/updated' && p.tokenUsage) {
      // Each generate uses a new ephemeral thread with one turn. Total counts
      // include all model responses around native search; last omits earlier
      // responses. Do not add successive cumulative notifications together.
      const usage=p.tokenUsage.total??p.tokenUsage.last;
      if(usage){a.usage = Object.fromEntries(['inputTokens','outputTokens','cachedInputTokens','cacheWriteInputTokens','reasoningOutputTokens','totalTokens'].filter(k => Number.isSafeInteger(usage[k]) && usage[k] >= 0).map(k => [k,usage[k]]));
        a.usageScope=p.tokenUsage.total?'fresh-thread-total':'last-response-only';}
    }
    if (m.method === 'item/agentMessage/delta' && typeof p.delta === 'string') {
      a.streamedOutputBytes = (a.streamedOutputBytes ?? 0) + Buffer.byteLength(p.delta);
      if (a.streamedOutputBytes > a.maxOutputBytes) throw error('PROTOCOL','Streamed output limit exceeded');
      if (!a.lastProgressAt || Date.now() - a.lastProgressAt >= 5000) {
        a.lastProgressAt = Date.now();
        a.onEvent?.({type:'provider.progress',agentOutputBytes:a.streamedOutputBytes,...(a.usage?{usage:{...a.usage}}:{})});
      }
    }
    if (m.method === 'item/completed' && p.item.type === 'agentMessage') {
      if (typeof p.item.text !== 'string') throw error('PROTOCOL','Missing assistant message text');
      a.bytes += Buffer.byteLength(p.item.text);
      if (a.bytes > a.maxOutputBytes) throw error('PROTOCOL','Output limit exceeded');
      a.messages.push({text:p.item.text,phase:p.item.phase});
    }
    if (m.method === 'turn/completed') {
      if (p.turn?.items?.some(i => !this.#safeItem(i.type))) throw error('CAPABILITY','Unexpected tool in completed turn');
      if(a.native){
        if(a.native.item&&!a.native.item.completed)throw error('PROTOCOL','Native turn ended before callback acknowledgement');
        const items=p.turn?.items?.filter(i=>i.type==='dynamicToolCall')??[];
        if(items.length>1||items.some(i=>!this.#nativeCompletedMatches(a,i)))throw error('PROTOCOL','Unproven native tool in terminal summary');
      }
      if (!p.turn?.id || (a.turnId && p.turn.id !== a.turnId)) throw error('PROTOCOL','Invalid completed turn');
      a.turnId = p.turn.id;
      if (p.turn.status !== 'completed') throw p.turn.status === 'interrupted' ? error('CANCELLED','Provider turn interrupted') : remoteError(p.turn.error);
      a.resolve();
    }
    // Callback deliberately receives metadata, never raw text, reasoning or server errors.
    a.onEvent?.({type:m.method,...(p.item ? {itemType:p.item.type} : {})});
  }
  #safeItem(type){return SAFE_ITEMS.has(type)||this.#options.publicSearch&&type==='webSearch'||this.#options.nativeRead&&type==='dynamicToolCall';}
  #nativeAdvance(a,next,kinds){
    const prior=a.native.transcript,t=clone(next),state=inspectNativeReadTranscript(t,t.head),added=t.frames.slice(prior.frames.length);
    if(canonical(t.header)!==canonical(prior.header)||t.frames.length!==prior.frames.length+kinds.length
      ||canonical(t.frames.slice(0,prior.frames.length))!==canonical(prior.frames)
      ||added.some((f,i)=>f.event.kind!==kinds[i]))throw error('PROTOCOL','Native controller transcript does not extend the exact checkpoint');
    a.native.transcript=t;a.native.state=state;return state;
  }
  #nativeRecord(a,method,payload,kinds){
    const expected=clone(payload),next=a.native.session[method](clone(payload));
    if(next?.then){const task=Promise.resolve(next).catch(()=>{});this.#nativeTasks.add(task);task.finally(()=>this.#nativeTasks.delete(task));throw error('PROTOCOL','Native checkpoint transitions must commit synchronously');}
    if(kinds.length!==1||canonical(next?.frames?.at(-1)?.event??null)!==canonical({kind:kinds[0],...expected}))throw error('PROTOCOL','Native checkpoint changed the observed event payload');
    return this.#nativeAdvance(a,next,kinds);
  }
  #nativeBind(a){
    if(!a.threadId||!a.turnId)throw error('PROTOCOL','Native binding lacks provider identity');
    if(a.native.state.phase==='CREATED')this.#nativeRecord(a,'bind',{threadId:a.threadId,turnId:a.turnId},['BIND']);
    if(a.native.state.binding.threadId!==a.threadId||a.native.state.binding.turnId!==a.turnId)throw error('PROTOCOL','Native controller changed provider identity');
  }
  #nativeScope(p){
    const a=this.#active;
    if(!a?.native||!a.turnRequested||!a.threadId||!a.turnId||p.threadId!==a.threadId||p.turnId!==a.turnId)throw error('PROTOCOL','Native callback is outside its bound turn');
    return a;
  }
  #nativeTool(item){
    return item?.namespace===NATIVE_READ_TOOL_BINDING.namespace&&item.tool===NATIVE_READ_TOOL_BINDING.name
      &&typeof item.id==='string'&&item.id.length>0&&item.id.length<=256
      &&item.arguments&&typeof item.arguments==='object'&&!Array.isArray(item.arguments)
      &&Object.keys(item.arguments).length===1&&typeof item.arguments.path==='string'&&item.arguments.path.isWellFormed()
      &&Buffer.byteLength(item.arguments.path)<=4096;
  }
  #nativeCompletedMatches(a,item){
    const c=a.native.item;
    return c?.completed&&this.#nativeTool(item)&&item.id===c.id&&canonical(item.arguments)===canonical(c.arguments)
      &&item.status===(c.response.success?'completed':'failed')&&item.success===c.response.success
      &&canonical(item.contentItems??null)===canonical(c.response.contentItems);
  }
  #nativeItem(method,p){
    const a=this.#nativeScope(p),item=p.item;
    if(!this.#nativeTool(item))throw error('CAPABILITY','Unexpected native read tool or arguments');
    if(method==='item/started'){
      if(a.native.item||item.status!=='inProgress')throw error('CAPABILITY','Native read callback limit or lifecycle violated');
      a.native.item={id:item.id,arguments:clone(item.arguments),requested:false,completed:false,response:null};
      return;
    }
    const c=a.native.item;
    if(!c?.response||c.completed||item.id!==c.id||canonical(item.arguments)!==canonical(c.arguments)
      ||item.status!==(c.response.success?'completed':'failed')||item.success!==c.response.success
      ||canonical(item.contentItems??null)!==canonical(c.response.contentItems))throw error('PROTOCOL','Native response acknowledgement changed');
    this.#nativeRecord(a,'ack',{threadId:a.threadId,turnId:a.turnId,callId:c.id,responseJson:canonical(c.response)},['ACK']);
    c.completed=true;
  }
  #nativeRequest(m){
    let a,c;
    try{
      if(!(Number.isSafeInteger(m.id)||typeof m.id==='string'&&m.id.length>0&&m.id.length<=256))throw error('PROTOCOL','Invalid native request identifier');
      a=this.#nativeScope(m.params??{});c=a.native.item;const p=m.params;
      if(!c||c.requested||c.id!==p.callId||p.namespace!==NATIVE_READ_TOOL_BINDING.namespace||p.tool!==NATIVE_READ_TOOL_BINDING.name
        ||canonical(p.arguments)!==canonical(c.arguments))throw error('CAPABILITY','Native callback request was not admitted');
      c.requested=true;
    }catch(e){this.#send({id:m.id,error:{code:-32601,message:'Native read request denied'}});throw e;}
    const task=(async()=>{
      try{
        const next=await a.native.session.prepare({threadId:a.threadId,turnId:a.turnId,callId:c.id,namespace:NATIVE_READ_TOOL_BINDING.namespace,
          tool:NATIVE_READ_TOOL_BINDING.name,arguments:clone(c.arguments),signal:a.callbackAbort.signal});
        if(this.#fatal||a.callbackAbort.signal.aborted)throw this.#fatal??error('CANCELLED','Native read cancelled before response');
        const prepared=this.#nativeAdvance(a,next,['CALL','PREPARED']);
        if(prepared.call.callId!==c.id||canonical(prepared.call.arguments)!==canonical(c.arguments))throw error('PROTOCOL','Native controller prepared another callback');
        this.#nativeRecord(a,'dispatch',{callId:c.id,responseHash:prepared.prepared.responseHash},['DISPATCH_INTENT']);
        c.response=JSON.parse(prepared.prepared.responseJson);
        this.#send({id:m.id,result:c.response});
      }catch(e){
        const failure=e instanceof ProviderError?e:error('CAPABILITY','Native read controller rejected or failed the callback');
        if(!(e instanceof ProviderError)&&typeof e?.code==='string'&&/^[A-Z_]+$/.test(e.code))failure.diagnostics={controllerCode:e.code};
        this.#fail(failure);
      }
    })();
    this.#nativeTasks.add(task);task.finally(()=>this.#nativeTasks.delete(task)).catch(()=>{});
  }
  async #account() {
    const r = await this.#call('account/read',{refreshToken:false});
    if (r.account?.type !== 'chatgpt') throw error('AUTH','A ChatGPT subscription login is required; API fallback is forbidden');
    return {authentication:'chatgpt',planType:r.account.planType ?? null};
  }
  async #inventory(threadId) {
    let cursor; const seen = new Set();
    for (let page = 0; page < 100; page++) {
      const r = await this.#call('mcpServerStatus/list',{detail:'toolsAndAuthOnly',limit:100,...(cursor ? {cursor} : {}),...(threadId ? {threadId} : {})});
      if (!Array.isArray(r.data)) throw error('PROTOCOL','Invalid MCP inventory');
      for (const s of r.data) {
        if (!this.#names.includes(s.name) || !s.tools || Object.keys(s.tools).length || (s.runtimeStatus && s.runtimeStatus !== 'disabled' && s.runtimeStatus !== 'notStarted')) throw error('CAPABILITY','MCP closure could not be verified');
        seen.add(s.name);
      }
      if (!r.nextCursor) return [...seen];
      if (r.nextCursor === cursor) throw error('PROTOCOL','Repeated inventory cursor');
      cursor = r.nextCursor;
    }
    throw error('PROTOCOL','MCP inventory page limit exceeded');
  }
  async health() {
    if (!this.#started) return this.start();
    const account = await this.#account();
    return {ready:!this.#fatal,version:this.#options.expectedVersion,...account,mcpDisabled:[...this.#names],simulation:Boolean(this.#options.testTransportInjection)};
  }
  async models() {
    await this.start();
    const r = await this.#call('model/list',{limit:100});
    if (!Array.isArray(r.data)) throw error('PROTOCOL','Invalid model inventory');
    return r.data.map(m => ({id:m.id,model:m.model,defaultReasoningEffort:m.defaultReasoningEffort,supportedReasoningEfforts:m.supportedReasoningEfforts?.map(x => x.reasoningEffort)}));
  }
  async publicSearchConfiguration() {
    if(!this.#options.publicSearch)throw error('CAPABILITY','This provider is not configured for search');
    await this.start();
    const response=await this.#call('config/read',{cwd:this.#directory,includeLayers:false});
    const capabilities=await this.#call('modelProvider/capabilities/read',{});
    // Select only nonsecret capability fields. Never expose the rest of config.
    const features=response.config?.features??{},codeMode=features.code_mode,host=features.code_mode_host;
    return {webSearch:response.config?.web_search??null,
      standaloneWebSearch:features.standalone_web_search===true,
      codeModeDisabled:codeMode===false||codeMode?.enabled===false,
      directWebOnly:Array.isArray(codeMode?.direct_only_tool_namespaces)&&codeMode.direct_only_tool_namespaces.length===1&&codeMode.direct_only_tool_namespaces[0]==='web',
      codeModeHostDisabled:host===false||host?.enabled===false,
      capabilities:{webSearch:capabilities.webSearch===true,namespaceTools:capabilities.namespaceTools===true}};
  }
  async generate({instructions,input,schema,validate,model,reasoningEffort,instructionProfile,nativeSession,signal,onEvent,timeoutMs=120000,maxOutputBytes=256*1024,maxProtocolBytes=64*1024*1024}={}) {
    if (this.#active) throw error('CAPABILITY','Concurrent generation requires separate provider instances');
    if (typeof instructions !== 'string' || typeof input !== 'string' || !schema || typeof schema !== 'object' || typeof validate !== 'function') throw error('PROTOCOL','Instructions, input, schema and validator are required');
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 3600000 || !Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > 4*1024*1024) throw error('PROTOCOL','Invalid generation limits');
    if (!Number.isSafeInteger(maxProtocolBytes) || maxProtocolBytes < 65536 || maxProtocolBytes > 64*1024*1024) throw error('PROTOCOL','Invalid protocol byte limit');
    if (signal?.aborted) throw error('CANCELLED','Generation cancelled');
    const profile = resolveProfile(instructionProfile);
    if(this.#options.nativeRead!==(profile.id===NATIVE_READ_PROFILE)||this.#options.nativeRead!==Boolean(nativeSession))throw error('CAPABILITY','Native reading requires its dedicated profile and controller session');
    if(this.#options.publicSearch!==(profile.id==='public-search-v1'))throw error('CAPABILITY','Search requires its separate trusted transport and instruction profile');
    let resolve,reject,interrupt;
    const interrupted = new Promise((_,no) => { interrupt=no; });
    interrupted.catch(() => {});
    const done = new Promise((yes,no) => { resolve=yes; reject=e=>{no(e);interrupt(e);}; });
    done.catch(() => {});
    const a = {resolve,reject,messages:[],searchObservations:[],bytes:0,wireBytes:0,maxOutputBytes,maxProtocolBytes,onEvent}; this.#active = a;
    const startedAt = new Date().toISOString();
    const contextHash = inferenceRequestHash({instructions,input,schema,model,reasoningEffort,instructionProfile});
    if(nativeSession){
      if(!['checkpoint','bind','prepare','dispatch','ack','finish','retainOutcome'].every(k=>typeof nativeSession[k]==='function')){this.#active=undefined;throw error('CAPABILITY','Complete native controller session is required');}
      try{
        if(['checkpoint','bind','dispatch','ack','finish','retainOutcome'].some(k=>Object.prototype.toString.call(nativeSession[k])==='[object AsyncFunction]'))throw error('PROTOCOL','Native commit hooks must be synchronous');
        const initial=nativeSession.checkpoint();
        if(initial?.then){const task=Promise.resolve(initial).catch(()=>{});this.#nativeTasks.add(task);task.finally(()=>this.#nativeTasks.delete(task));throw error('PROTOCOL','Native checkpoint must be synchronous');}
        const transcript=clone(initial),state=inspectNativeReadTranscript(transcript,transcript.head);
        if(state.phase!=='CREATED'||transcript.header.requestHash!==contextHash||canonical(transcript.header.tool)!==canonical(NATIVE_READ_TOOL_BINDING)
          ||transcript.header.limits.maxFinalBytes>maxOutputBytes)throw error('CAPABILITY','Native session is not its exact fresh request and tool policy');
        a.native={session:nativeSession,transcript,state,item:null};a.callbackAbort=new AbortController();
      }catch(e){this.#active=undefined;throw e instanceof ProviderError?e:error('PROTOCOL','Invalid native controller checkpoint');}
    }
    const cancel = () => this.#fail(error('CANCELLED','Generation cancelled'));
    signal?.addEventListener('abort',cancel,{once:true});
    const timer = setTimeout(() => this.#fail(error('TIMEOUT','Generation timed out')),timeoutMs);
    try {
      await this.start();
      const t = await this.#call('thread/start',{cwd:this.#directory,environments:[],dynamicTools:this.#options.nativeRead?NATIVE_READ_TOOLS:[],ephemeral:true,sandbox:'read-only',approvalPolicy:'never',developerInstructions:instructions,...(profile.baseInstructions === null ? {} : {baseInstructions:profile.baseInstructions}),...(model ? {model} : {}),...(reasoningEffort ? {config:{model_reasoning_effort:reasoningEffort}} : {})});
      if (!t.thread?.id || t.modelProvider !== 'openai' || !Array.isArray(t.instructionSources) || t.instructionSources.length || t.approvalPolicy !== 'never' || t.sandbox?.type !== 'readOnly' || t.sandbox?.networkAccess !== false) throw error('CAPABILITY','Thread isolation contract was not confirmed');
      if (model && t.model !== model) throw error('CAPABILITY','Requested model was not selected');
      if (reasoningEffort && t.reasoningEffort !== reasoningEffort) throw error('CAPABILITY','Requested reasoning effort was not selected');
      a.threadId = t.thread.id;
      await this.#inventory(a.threadId);
      a.turnRequested = true;
      const turn = await this.#call('turn/start',{threadId:a.threadId,input:[{type:'text',text:input}],outputSchema:schema,environments:[],...(reasoningEffort ? {effort:reasoningEffort} : {})});
      if (!turn.turn?.id || (a.turnId && a.turnId !== turn.turn.id)) throw error('PROTOCOL','Missing or mismatched turn identifier');
      if (turn.turn.items?.some(i => !this.#safeItem(i.type)||i.type==='dynamicToolCall')) throw error('CAPABILITY','Unexpected tool in turn response');
      a.turnId = turn.turn.id;
      if(a.native)this.#nativeBind(a);
      await done;
      if (this.#fatal) throw this.#fatal;
      const explicit = a.messages.filter(m => m.phase === 'final_answer');
      if (explicit.length > 1) throw error('PROTOCOL','Ambiguous final messages');
      const final = explicit[0] ?? a.messages.filter(m => m.phase == null).at(-1);
      if (!final) throw error('PROTOCOL','No final assistant message');
      let value;
      try { value = JSON.parse(final.text); } catch { throw error('PROTOCOL','Final output is not JSON'); }
      let valid;
      try { valid = await Promise.race([Promise.resolve().then(()=>validate(value)),interrupted]); } catch { throw this.#fatal ?? error('PROTOCOL','Caller schema validation failed'); }
      if (this.#fatal) throw this.#fatal;
      if (valid !== true) throw error('PROTOCOL','Caller schema validation rejected output');
      if(a.native)this.#nativeRecord(a,'finish',{threadId:a.threadId,turnId:a.turnId,outputJson:canonical(value)},['FINISH']);
      const response={value,...(a.native?{nativeTranscript:clone(a.native.transcript)}:{}),...(this.#options.publicSearch?{searchObservations:a.searchObservations}:{}),receipt:{kind:'inference',threadId:a.threadId,turnId:a.turnId,model:t.model,reasoningEffort:reasoningEffort ?? t.reasoningEffort ?? null,status:'completed',...(a.usage ? {usage:a.usage,usageScope:a.usageScope} : {}),contextHash,
        ...(a.native?{toolPolicy:NATIVE_READ_PROFILE,nativeTranscript:{schema:a.native.transcript.schema,head:a.native.transcript.head,callbackCount:a.native.state.callbackCount}}:{}),
        ...(this.#options.publicSearch?{toolPolicy:'public-search-v1'}:{}),
        transport:{wireBytes:a.wireBytes,maxProtocolBytes,completedMessageBytes:a.bytes,streamedOutputBytes:a.streamedOutputBytes??null,maxOutputBytes},
        ...(profile.baseInstructions === null ? {} : {instructionProfile:{id:profile.id,hash:profile.hash}}),startedAt,completedAt:new Date().toISOString(),simulation:Boolean(this.#options.testTransportInjection)}};
      if(a.native){
        const expected={valueHash:sha256(value),receiptHash:sha256(response.receipt)},retained=a.native.session.retainOutcome(clone({value,receipt:response.receipt}));
        if(retained?.then){const task=Promise.resolve(retained).catch(()=>{});this.#nativeTasks.add(task);task.finally(()=>this.#nativeTasks.delete(task));throw error('PROTOCOL','Native public outcome must be retained synchronously');}
        if(canonical(retained)!==canonical(expected))throw error('PROTOCOL','Native public outcome retention differs from the completed response');
      }
      return response;
    } catch(e) {
      this.#fail(e instanceof ProviderError ? e : error('PROTOCOL','Generation failed'));
      throw this.#fatal;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort',cancel); this.#active = undefined; }
  }
  async close() {
    if (this.#closing) return this.#closing;
    this.#closing = this.#close(); return this.#closing;
  }
  async #close() {
    this.#closed = true;
    this.#fail(error('CANCELLED','Provider closed'));
    // Wait for an in-flight bootstrap to observe closed, before deciding that no
    // process exists. Never claim that sending a signal proved process exit.
    if (this.#starting) await this.#starting.catch(() => {});
    if (this.#child && !this.#exitObserved) {
      const wait = async () => {
        let timer;
        try { return await Promise.race([this.#exitWait.then(() => true),new Promise(resolve => {timer=setTimeout(() => resolve(false),this.#options.closeGraceMs);})]); }
        finally { clearTimeout(timer); }
      };
      if (!await wait()) {
        this.#child.kill('SIGKILL');
        if (!await wait()) throw error('CLEANUP_UNCONFIRMED','Provider exit was not observed; temporary state retained for diagnosis');
      }
    }
    if(this.#nativeTasks.size){
      let timer;
      try{
        const settled=await Promise.race([Promise.allSettled([...this.#nativeTasks]).then(()=>true),new Promise(resolve=>{timer=setTimeout(()=>resolve(false),this.#options.closeGraceMs);})]);
        if(!settled)throw error('CLEANUP_UNCONFIRMED','Native callback controller has not settled; retain its checkpoints');
      }finally{clearTimeout(timer);}
    }
    if (this.#directory) await rm(this.#directory,{recursive:true,force:true});
    return {processExitObserved: this.#child ? this.#exitObserved : null};
  }
}
