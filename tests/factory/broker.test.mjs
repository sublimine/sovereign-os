import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import http from 'node:http';
import {EventEmitter} from 'node:events';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from '../../factory/lib/store.mjs';
import {Authority} from '../../factory/lib/authority.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {ToolBroker,isPublicAddress,nodeTransport} from '../../factory/tools/broker.mjs';

function setup(t, options = {}) {
  const temp = fs.mkdtempSync(join(tmpdir(),'sovereign-broker-test-'));
  const store = new Store(':memory:'); const authority = new Authority(store);
  const workspaceRoot = join(temp,'jobs');
  const config = {store,authority,workspaceRoot,...options};
  const broker = new ToolBroker(config);
  const workspace = broker.registerWorkspace('mission1');
  const lease = authority.issue({missionId:'mission1',principalId:'worker1',actions:['workspace.list','workspace.read','workspace.write','source.fetch','execution.run'],resources:['workspace:mission1','public-web'],classification:'INTERNAL',expiresAt:new Date(Date.now()+60000).toISOString()});
  let next = 0;
  const request = (tool,args,overrides={}) => ({missionId:'mission1',principalId:'worker1',lease,operationId:'op'+(++next),tool,args,...overrides});
  const run = async (tool,args,overrides={}) => authority.open(await broker.execute(request(tool,args,overrides)),'tool.receipt');
  t.after(()=>{store.close();fs.rmSync(temp,{recursive:true,force:true});});
  return {temp,store,authority,workspaceRoot,config,broker,workspace,lease,request,run};
}
const response = ({address}, content='evidence', statusCode=200, headers={}) => ({remoteAddress:address,statusCode,headers:{'content-type':'text/plain; charset=utf-8',...headers},body:Buffer.from(content)});
const publicLookup = async () => [{address:'8.8.8.8',family:4}];

test('node transport preserves SOURCE_LIMIT when its cap destroy emits aborted before error',async t=>{
  const originalRequest=http.request;
  t.after(()=>{http.request=originalRequest;});
  http.request=(_options,onResponse)=>{
    const request=new EventEmitter();
    request.end=()=>queueMicrotask(()=>{
      const incoming=new EventEmitter();
      Object.assign(incoming,{socket:{remoteAddress:'8.8.8.8'},statusCode:200,headers:{'content-type':'text/plain'}});
      incoming.destroy=cause=>{
        // This is the ordering that previously replaced the cap breach with
        // NETWORK: `aborted` arrives before the destroy cause reaches error.
        queueMicrotask(()=>incoming.emit('aborted'));
        queueMicrotask(()=>incoming.emit('error',cause));
      };
      onResponse(incoming);
      incoming.emit('data',Buffer.from('five!'));
    });
    return request;
  };
  await assert.rejects(nodeTransport({url:new URL('http://example.com/evidence'),address:'8.8.8.8',family:4,maxBytes:4}),
    failure=>failure?.code==='SOURCE_LIMIT');
});

test('real mission workspace write/read/list with signed receipts and hash CAS', async t => {
  const s = setup(t);
  assert.deepEqual(s.broker.registerWorkspace('mission1'),s.workspace);
  const write = await s.run('workspace.write',{path:'src/a.txt',content:'á 🧪',expectedHash:null});
  assert.equal(write.status,'SUCCEEDED');
  assert.equal(fs.readFileSync(join(s.workspace.path,'src/a.txt'),'utf8'),'á 🧪');
  assert.equal(write.result.sha256,sha256('á 🧪'));
  const read = await s.run('workspace.read',{path:'src/a.txt'});
  assert.equal(read.result.content,'á 🧪'); assert.equal(read.result.sha256,write.result.sha256);
  const list = await s.run('workspace.list',{path:'src'});
  assert.deepEqual(list.result.entries,[{name:'a.txt',type:'file',bytes:Buffer.byteLength('á 🧪')}]);
  const conflict = await s.run('workspace.write',{path:'src/a.txt',content:'wrong',expectedHash:null});
  assert.equal(conflict.status,'FAILED'); assert.equal(conflict.result.error.code,'HASH_CONFLICT');
  assert.equal(fs.readFileSync(join(s.workspace.path,'src/a.txt'),'utf8'),'á 🧪');
  const next = await s.run('workspace.write',{path:'src/a.txt',content:'updated',expectedHash:write.result.sha256});
  assert.equal(next.result.beforeSha256,write.result.sha256);
  assert.equal(fs.readFileSync(join(s.workspace.path,'src/a.txt'),'utf8'),'updated');
  assert.ok(fs.readdirSync(join(s.workspace.path,'src')).every(name=>!name.startsWith('.broker-')));
});

test('stable operation replays receipt, never repeats write; mismatched binding is rejected', async t => {
  const s = setup(t); const req = s.request('workspace.write',{path:'file',content:'first',expectedHash:null});
  const first = await s.broker.execute(req);
  fs.writeFileSync(join(s.workspace.path,'file'),'later external change');
  assert.deepEqual(await s.broker.execute(req),first);
  const restarted = new ToolBroker(s.config);
  assert.deepEqual(await restarted.execute(req),first);
  assert.equal(fs.readFileSync(join(s.workspace.path,'file'),'utf8'),'later external change');
  await assert.rejects(s.broker.execute({...req,args:{...req.args,content:'different'}}),{code:'IDEMPOTENCY_CONFLICT'});
  const forged = structuredClone(first); forged.data.result.bytes = 1;
  assert.throws(()=>s.authority.open(forged,'tool.receipt'),{code:'BAD_SIGNATURE'});
});

test('lease and principal rejected before effects, including replay after revocation', async t => {
  const s = setup(t); const req = s.request('workspace.write',{path:'x',content:'x',expectedHash:null});
  await assert.rejects(s.broker.execute({...req,principalId:'other'}),{code:'PRINCIPAL'});
  assert.equal(fs.existsSync(join(s.workspace.path,'x')),false); assert.equal(s.store.get('effect',req.operationId),null);
  await s.broker.execute(req);
  s.authority.revoke(s.lease.data.id,'revoke');
  await assert.rejects(s.broker.execute(req),{code:'LEASE_REVOKED'});
  assert.equal(fs.readFileSync(join(s.workspace.path,'x'),'utf8'),'x');
});

test('traversal, symlinks, hardlinks and other mission trees are inaccessible', async t => {
  const s = setup(t); const outside = join(s.temp,'outside'); fs.writeFileSync(outside,'secret');
  fs.symlinkSync(outside,join(s.workspace.path,'link'));
  fs.symlinkSync(s.temp,join(s.workspace.path,'directory-link'));
  fs.linkSync(outside,join(s.workspace.path,'hardlink'));
  for (const path of ['../outside','/etc/passwd','a/../outside','a\\b']) await assert.rejects(s.run('workspace.read',{path}),{code:'WORKSPACE_PATH'});
  for (const path of ['link','directory-link/outside','hardlink']) {
    const receipt = await s.run('workspace.read',{path}); assert.equal(receipt.status,'FAILED'); assert.equal(receipt.result.error.code,'WORKSPACE_PATH');
  }
  const write = await s.run('workspace.write',{path:'directory-link/outside',content:'overwrite',expectedHash:sha256('secret')});
  assert.equal(write.status,'FAILED'); assert.equal(fs.readFileSync(outside,'utf8'),'secret');
  const other = s.broker.registerWorkspace('mission2');
  await assert.rejects(s.run('workspace.read',{path:'../'+other.path.split('/').at(-1)+'/x'}),{code:'WORKSPACE_PATH'});
});

test('workspace and file limits prevent effects, including parent-directory quota', async t => {
  const s = setup(t,{maxFileBytes:10,maxWorkspaceBytes:10,maxEntries:2});
  await assert.rejects(s.run('workspace.write',{path:'big',content:'x'.repeat(11),expectedHash:null}),{code:'SCHEMA'});
  assert.equal(fs.existsSync(join(s.workspace.path,'big')),false);
  const nested = await s.run('workspace.write',{path:'a/b/c',content:'x',expectedHash:null});
  assert.equal(nested.result.error.code,'WORKSPACE_LIMIT'); assert.deepEqual(fs.readdirSync(s.workspace.path),[]);
  await s.run('workspace.write',{path:'x',content:'12345678',expectedHash:null});
  const over = await s.run('workspace.write',{path:'y',content:'123',expectedHash:null});
  assert.equal(over.result.error.code,'WORKSPACE_LIMIT'); assert.equal(fs.existsSync(join(s.workspace.path,'y')),false);
  const invalid = await s.run('workspace.write',{path:'z',content:'\ud800',expectedHash:null});
  assert.equal(invalid.result.error.code,'ENCODING'); assert.equal(fs.existsSync(join(s.workspace.path,'z')),false);
});

test('execution runner remains fail-closed with no shell or file effect', async t => {
  const s = setup(t); const r = await s.run('execution.run',{argv:['true'],cwd:'.'});
  assert.equal(r.status,'FAILED'); assert.equal(r.result.error.code,'CAPABILITY');
  assert.deepEqual(fs.readdirSync(s.workspace.path),[]);
  assert.equal(s.store.get('effect',r.id).data.state,'FAILED');
});

test('public address classifier rejects special IPv4/IPv6, mapped and translation ranges', () => {
  for (const ip of ['0.1.2.3','10.0.0.1','100.100.100.200','127.1.2.3','169.254.169.254','172.16.0.1','192.0.0.9','192.168.0.1','192.0.2.1','198.18.0.1','198.51.100.1','203.0.113.1','224.0.0.1','255.255.255.255','168.63.129.16','::','::1','::ffff:8.8.8.8','64:ff9b::808:808','2001::1','2001:db8::1','2002:808:808::1','3fff::1','fc00::1','fe80::1','ff02::1','not-ip']) assert.equal(isPublicAddress(ip),false,ip);
  for (const ip of ['8.8.8.8','1.1.1.1','2606:4700:4700::1111','2001:4860:4860::8888']) assert.equal(isPublicAddress(ip),true,ip);
});

test('public source retrieval preserves raw text/hash/status and omits cookies/auth metadata', async t => {
  const attempts = []; const s = setup(t,{lookup:publicLookup,transport:async o=>{attempts.push(o);return response(o,'raw\ntext',404,{'etag':'"v1"','set-cookie':'secret','authorization':'secret'});}});
  const r = await s.run('source.fetch',{url:'https://example.com/data'});
  assert.equal(r.status,'SUCCEEDED'); assert.equal(r.result.status,404); assert.equal(r.result.content,'raw\ntext');
  assert.equal(r.result.sha256,sha256('raw\ntext')); assert.equal(r.result.finalUrl,'https://example.com/data');
  assert.equal(r.result.headers.etag,'"v1"'); assert.equal(r.result.headers['set-cookie'],undefined); assert.equal(r.result.headers.authorization,undefined);
  assert.deepEqual(r.result.acquisition,{schema:'sovereign.source-transport.v1',classification:'REAL_NETWORK',network:'ENABLED',fixtureId:null});
  assert.equal(attempts[0].address,'8.8.8.8'); assert.equal(attempts[0].url.hostname,'example.com');
  await assert.rejects(s.run('source.fetch',{url:'https://example.com',headers:{authorization:'secret'}}),{code:'SCHEMA'});
  assert.equal(attempts.length,1);
});
test('legacy sourced route preserves its policy but applies the byte and HTTP admission gates before persistence',async t=>{
  const deniedMarker='LEGACY_DENIED_BODY_MUST_NOT_PERSIST',oversizedMarker='LEGACY_OVERSIZED_BODY_MUST_NOT_PERSIST',
    caps=[],oversized=oversizedMarker+'é'.repeat(32769);
  const s=setup(t,{lookup:publicLookup,transport:async o=>{
    caps.push(o.maxBytes);
    return response(o,o.url.pathname==='/denied'?deniedMarker:oversized,o.url.pathname==='/denied'?403:200);
  }});
  // This represents an immutable pre-v2 mission record.  The broker is allowed
  // to apply a safer runtime admission gate, but must not stamp/rewrite it.
  const policy={entryMode:'sourced-response-v1'};
  s.store.put('mission','mission1',{id:'mission1',policy},{expectedVersion:0});
  const denied=await s.run('source.fetch',{url:'https://example.com/denied'});
  const tooLarge=await s.run('source.fetch',{url:'https://example.com/oversized'});
  assert.deepEqual(caps,[65536,65536]);
  assert.deepEqual(denied.result,{error:{code:'SOURCE_HTTP_STATUS'}});
  assert.deepEqual(tooLarge.result,{error:{code:'SOURCE_LIMIT'}});
  assert.equal(denied.status,'FAILED');assert.equal(tooLarge.status,'FAILED');
  assert.deepEqual(s.store.get('mission','mission1').data.policy,policy);
  const durable=JSON.stringify([
    ...s.store.list('effect').map(record=>record.data),
    ...s.store.list('source-http-trace').map(record=>record.data),
  ]);
  assert.equal(durable.includes(deniedMarker),false);
  assert.equal(durable.includes(oversizedMarker),false);
});
test('source receipt seals a control-plane simulated-fixture identity and rejects contradictory descriptors',async t=>{
  const fixtureId=sha256('two fixed textual fixtures');
  const s=setup(t,{lookup:publicLookup,transport:async o=>response(o,'fixture body'),
    sourceTransportDescriptor:{schema:'sovereign.source-transport.v1',classification:'SIMULATED_FIXTURE',network:'DISABLED',fixtureId}});
  const receipt=await s.run('source.fetch',{url:'https://example.com/fixture'});
  assert.deepEqual(receipt.result.acquisition,{schema:'sovereign.source-transport.v1',classification:'SIMULATED_FIXTURE',network:'DISABLED',fixtureId});
  assert.throws(()=>new ToolBroker({...s.config,sourceTransportDescriptor:{schema:'sovereign.source-transport.v1',classification:'SIMULATED_FIXTURE',network:'ENABLED',fixtureId}}),
    {code:'CONFIG'});
  assert.throws(()=>new ToolBroker({...s.config,sourceTransportDescriptor:{schema:'sovereign.source-transport.v1',classification:'REAL_NETWORK',network:'ENABLED',fixtureId}}),
    {code:'CONFIG'});
});
test('revocation while a public response is in flight prevents a successful acquisition receipt',async t=>{
  let entered,finish;const started=new Promise(r=>entered=r);
  const s=setup(t,{lookup:publicLookup,transport:async o=>{entered();return new Promise(r=>finish=()=>r(response(o,'bytes arrived after revocation')));}});
  const pending=s.run('source.fetch',{url:'https://example.com/slow'});await started;
  s.authority.revoke(s.lease.data.id,'Owner revoked while response was pending');finish();
  const r=await pending;assert.equal(r.status,'FAILED');assert.equal(r.result.error.code,'LEASE_REVOKED');assert.equal(r.result.content,undefined);
});
test('HTTP trace records every redirect in order, before dispatch, and is bound in replayed receipt',async t=>{
  let calls=0,operationId;const destinations=['https://example.com/start','https://other.example.net/middle','https://example.com/final'];
  const s=setup(t,{lookup:publicLookup,transport:async o=>{
    const before=s.store.get('source-http-trace',operationId);assert.equal(before.data.state,'DISPATCHING');
    assert.equal(before.data.hops.at(-1).url,o.url.href);assert.equal(before.data.hops.at(-1).response,null);
    const index=calls++;assert.equal(o.url.href,destinations[index]);
    return response(o,'hop '+index,index===2?200:index===0?301:302,index===2?{}:{location:destinations[index+1],'set-cookie':'do not expose'});
  }});
  const req=s.request('source.fetch',{url:destinations[0]});operationId=req.operationId;
  const signed=await s.broker.execute(req),r=s.authority.open(signed,'tool.receipt'),trace=r.result.httpTrace;
  assert.equal(r.status,'SUCCEEDED');assert.equal(trace.complete,true);assert.equal(trace.version,'http-exchange-trace-v1');
  assert.deepEqual(trace.hops.map(h=>h.url),destinations);assert.deepEqual(trace.hops.map(h=>h.response.status),[301,302,200]);
  trace.hops.forEach((h,i)=>{assert.equal(h.response.sha256,sha256('hop '+i));assert.equal(h.response.bytes,5);});
  assert.equal(trace.hops.at(-1).response.sha256,r.result.sha256);assert.equal(r.result.finalUrl,destinations[2]);
  assert.equal(JSON.stringify(trace).includes('do not expose'),false);
  assert.deepEqual(await s.broker.execute(req),signed);assert.equal(calls,3);
  const durable=s.store.get('source-http-trace',operationId);assert.equal(durable.version,6);assert.deepEqual(durable.data.hops,trace.hops);
});
test('HTTP trace certifies an observed zero-redirect response without asserting factual admission',async t=>{
  const s=setup(t,{lookup:publicLookup,transport:async o=>response(o,'not found',404)});
  const r=await s.run('source.fetch',{url:'https://example.com/missing'});
  assert.equal(r.result.httpTrace.hops.length,1);assert.equal(r.result.httpTrace.complete,true);
  assert.equal(r.result.httpTrace.hops[0].response.status,404);
});
test('failed HTTP path retains attempted unknown exchange locally, not a fabricated complete receipt',async t=>{
  let calls=0;const s=setup(t,{lookup:publicLookup,transport:async o=>{
    if(calls++===0)return response(o,'redirect',302,{location:'https://other.example.net/next'});
    throw Object.assign(new Error('simulated transport failure'),{code:'NETWORK'});
  }});
  const req=s.request('source.fetch',{url:'https://example.com/start'}),r=s.authority.open(await s.broker.execute(req),'tool.receipt');
  assert.equal(r.status,'FAILED');assert.equal(r.result.httpTrace,undefined);assert.equal(r.result.content,undefined);
  const trace=s.store.get('source-http-trace',req.operationId).data;assert.equal(trace.state,'FAILED');assert.equal(trace.hops.length,2);
  assert.equal(trace.hops[0].response.status,302);assert.equal(trace.hops[1].response,null);assert.equal(trace.errorCode,'NETWORK');
});
test('HTTP trace checkpoint failure prevents dispatch and trace never fabricates blocked private hop',async t=>{
  let calls=0;const s=setup(t,{lookup:publicLookup,transport:async o=>{calls++;return response(o,'',302,{location:'https://127.0.0.1/secret'});}});
  const req=s.request('source.fetch',{url:'https://example.com/start'}),r=s.authority.open(await s.broker.execute(req),'tool.receipt');
  assert.equal(r.status,'FAILED');assert.equal(r.result.error.code,'SSRF');assert.equal(calls,1);
  const trace=s.store.get('source-http-trace',req.operationId).data;assert.equal(trace.hops.length,1);assert.equal(trace.state,'FAILED');
  assert.equal(JSON.stringify(trace).includes('127.0.0.1'),false);
  const original=s.store.put.bind(s.store);s.store.put=(type,...args)=>{if(type==='source-http-trace')throw new Error('disk fixture');return original(type,...args);};
  assert.equal((await s.run('source.fetch',{url:'https://example.com/no-dispatch'})).status,'FAILED');assert.equal(calls,1);
});
test('authority is checked at the final acquisition handoff and failed receipt replay cannot reacquire',async t=>{
  let calls=0;
  const s=setup(t,{lookup:publicLookup,transport:async o=>{calls++;return response(o,'must not be released');}});
  const fetch=s.broker.fetchSource.bind(s.broker);
  s.broker.fetchSource=async(...args)=>{
    const result=await fetch(...args);
    queueMicrotask(()=>s.authority.revoke(s.lease.data.id,'Revoked between acquisition return and receipt publication'));
    return result;
  };
  const req=s.request('source.fetch',{url:'https://example.com/handoff'});
  const signed=await s.broker.execute(req),r=s.authority.open(signed,'tool.receipt');
  assert.equal(r.status,'FAILED');assert.deepEqual(r.result,{error:{code:'LEASE_REVOKED'}});
  assert.equal(s.store.get('effect',req.operationId).data.state,'FAILED');
  const replacement=s.authority.issue({missionId:'mission1',principalId:'worker1',actions:['source.fetch'],resources:['public-web'],classification:'PUBLIC',expiresAt:new Date(Date.now()+60000).toISOString()});
  assert.deepEqual(await s.broker.execute({...req,lease:replacement}),signed);assert.equal(calls,1);
});
test('expiry and ancestor revocation while acquiring cannot expose response bytes',async t=>{
  for(const kind of ['expiry','parent-revocation']){
    let entered,finish;const started=new Promise(r=>entered=r);
    const s=setup(t,{lookup:publicLookup,transport:async o=>{entered();return new Promise(r=>finish=()=>r(response(o,'not authorized at completion')));}});
    const lease=kind==='expiry'?s.lease:s.authority.issue({missionId:'mission1',principalId:'worker1',actions:['source.fetch'],resources:['public-web'],classification:'PUBLIC',expiresAt:s.lease.data.expiresAt,parent:s.lease});
    const pending=s.run('source.fetch',{url:'https://example.com/pending'},{lease});await started;
    if(kind==='expiry')s.authority.clock=()=>s.lease.data.expiresAt;
    else s.authority.revoke(s.lease.data.id,'Parent revoked during delegated acquisition');
    finish();const r=await pending;
    assert.equal(r.status,'FAILED',kind);assert.deepEqual(r.result,{error:{code:kind==='expiry'?'LEASE_EXPIRED':'LEASE_REVOKED'}},kind);
  }
});

test('URL and every DNS answer validated before any connection', async t => {
  let calls = 0; const s = setup(t,{lookup:async()=>[{address:'8.8.8.8',family:4},{address:'10.0.0.1',family:4}],transport:async o=>{calls++;return response(o);}});
  for (const url of ['file:///etc/passwd','http://127.0.0.1','http://2130706433','http://0x7f000001','http://[::ffff:127.0.0.1]','https://user:pass@example.com','http://metadata.google.internal','https://example.com:8443']) await assert.rejects(s.run('source.fetch',{url}),{code:'SSRF'});
  const result = await s.run('source.fetch',{url:'https://example.com'}); assert.equal(result.result.error.code,'SSRF'); assert.equal(calls,0);
});

test('redirects revalidate DNS/public destination and prohibit downgrade', async t => {
  for (const destination of ['http://example.com','https://169.254.169.254','https://private.example.com']) {
    let calls = 0;
    const s = setup(t,{lookup:async host=>host==='private.example.com'?[{address:'192.168.1.1',family:4}]:await publicLookup(),transport:async o=>{calls++;return response(o,'',302,{location:destination});}});
    const r = await s.run('source.fetch',{url:'https://example.com'}); assert.equal(r.result.error.code,'SSRF'); assert.equal(calls,1);
  }
});

test('connection peer must match validated pin, including fake rebinding transport', async t => {
  let calls = 0;
  const s = setup(t,{lookup:publicLookup,transport:async o=>{calls++;return {...response(o),remoteAddress:'127.0.0.1'};}});
  const r = await s.run('source.fetch',{url:'https://example.com'});
  assert.equal(r.result.error.code,'SSRF'); assert.equal(calls,1); assert.equal(r.result.content,undefined);
});

test('redirect count, aggregate bytes, encoding and text type have explicit failure receipts', async t => {
  let calls = 0;
  const s = setup(t,{lookup:publicLookup,maxRedirects:1,transport:async o=>{calls++;return response(o,'',302,{location:'/next'});}});
  assert.equal((await s.run('source.fetch',{url:'https://example.com'})).result.error.code,'REDIRECT'); assert.equal(calls,2);
  for (const [options,expected] of [
    [{maxSourceBytes:4,transport:async o=>response(o,'12345')},'SOURCE_LIMIT'],
    [{transport:async o=>response(o,'x',200,{'content-encoding':'gzip'})},'ENCODING'],
    [{transport:async o=>response(o,'x',200,{'content-type':'application/pdf'})},'MEDIA_TYPE'],
    [{transport:async o=>({...response(o),body:Buffer.from([255])})},'ENCODING'],
  ]) {
    const fixture = setup(t,{lookup:publicLookup,...options});
    const r = await fixture.run('source.fetch',{url:'https://example.com'}); assert.equal(r.status,'FAILED'); assert.equal(r.result.error.code,expected);
  }
});

test('deadline and cancellation terminate await without late DNS dispatch', async t => {
  let dispatches = 0, finishDns;
  const s = setup(t,{timeoutMs:15,lookup:()=>new Promise(resolve=>{finishDns=resolve;}),transport:async o=>{dispatches++;return response(o);}});
  const r = await s.run('source.fetch',{url:'https://example.com'});
  assert.equal(r.result.error.code,'TIMEOUT'); finishDns(await publicLookup()); await new Promise(resolve=>setImmediate(resolve)); assert.equal(dispatches,0);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(s.run('workspace.write',{path:'no',content:'x',expectedHash:null},{signal:controller.signal}),{code:'ABORTED'});
  assert.equal(fs.existsSync(join(s.workspace.path,'no')),false);
});

test('authority revocation during DNS prevents connection', async t => {
  let finishDns, dispatches=0;
  const s = setup(t,{lookup:()=>new Promise(resolve=>{finishDns=resolve;}),transport:async o=>{dispatches++;return response(o);}});
  const pending = s.run('source.fetch',{url:'https://example.com'});
  s.authority.revoke(s.lease.data.id,'revoked while resolving'); finishDns(await publicLookup());
  const r = await pending; assert.equal(r.result.error.code,'LEASE_REVOKED'); assert.equal(dispatches,0);
});

test('same in-flight request shares operation; restart DISPATCHED is uncertain without retry', async t => {
  let calls=0,finish;
  const s = setup(t,{lookup:publicLookup,transport:o=>{calls++;return new Promise(resolve=>{finish=()=>resolve(response(o));});}});
  const req = s.request('source.fetch',{url:'https://example.com'});
  const first = s.broker.execute(req); const second = s.broker.execute(req);
  await new Promise(resolve=>setImmediate(resolve)); finish();
  assert.deepEqual(await first,await second); assert.equal(calls,1);
  const crashed = s.request('source.fetch',{url:'https://example.com'});
  s.store.put('effect',crashed.operationId,{missionId:crashed.missionId,principalId:crashed.principalId,tool:crashed.tool,argsHash:sha256(crashed.args),state:'DISPATCHED',startedAt:new Date().toISOString()},{expectedVersion:0});
  const restarted = new ToolBroker(s.config);
  await assert.rejects(restarted.execute(crashed),{code:'EFFECT_UNCERTAIN'});
  assert.equal(s.store.get('effect',crashed.operationId).data.state,'UNCERTAIN'); assert.equal(calls,1);
});

test('observed write whose receipt commit fails is not replayed or falsely called failed', async t => {
  const s = setup(t); const originalPut = s.store.put.bind(s.store);
  s.store.put = (type,id,data,options)=>{if(type==='effect'&&data.state==='SUCCEEDED')throw new Error('simulated commit failure');return originalPut(type,id,data,options);};
  const req = s.request('workspace.write',{path:'actual',content:'persisted',expectedHash:null});
  await assert.rejects(s.broker.execute(req),{code:'EFFECT_UNCERTAIN'});
  assert.equal(fs.readFileSync(join(s.workspace.path,'actual'),'utf8'),'persisted');
  assert.equal(s.store.get('effect',req.operationId).data.state,'DISPATCHED');
  s.store.put = originalPut;
  await assert.rejects(new ToolBroker(s.config).execute(req),{code:'EFFECT_UNCERTAIN'});
  assert.equal(fs.readFileSync(join(s.workspace.path,'actual'),'utf8'),'persisted');
});
