import * as fs from 'node:fs';
import {resolve, dirname, basename, isAbsolute, sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {isIP} from 'node:net';
import {lookup as dnsLookup} from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import {check, keys, identifier, string, integer, digest, sha256, clone, timestamp, safeCode, ContractError} from '../lib/contracts.mjs';
import {validateExecutionArgs, validateExecutionResult} from './execution.mjs';
import {validateSearchArgs} from './search-contract.mjs';
import {missionInferenceBudget,reserveMissionInference,missionBudgetRecordRef} from '../lib/mission-inference-budget.mjs';
import {assertMissionSearchDispatchProvenance,MissionExternalDispatchProvenanceControl} from '../lib/mission-external-dispatch-provenance.mjs';
import {WORKSPACE_DEFAULTS,safeDirectories,relativePath,regular,utf8} from './workspace-files.mjs';
import {assertInputWorkingState} from '../lib/mission-input-workspace.mjs';
import {ADAPTIVE_V3_DIRECT_ENTRY_MODE} from '../lib/adaptive-v3-routing.mjs';
import {assertAdaptiveV3MissionRoute} from '../lib/adaptive-v3-route-contract.mjs';
import {isProjectContextIntakeNode,projectContextDescriptor} from '../lib/project-context.mjs';
import {sublimineMissionAssetManifestInput} from '../lib/mission-assets.mjs';
import {SOURCED_RESPONSE_MODE,sourcedResponseAcquisition} from '../lib/sourced-response-spec.mjs';
import {assertSourcedEvidenceProfileMission,sourcedEvidenceProfileAllowsUrl,sourcedEvidenceProfileNextSeed} from '../lib/sourced-evidence-profile.mjs';

const error = (code, message) => new ContractError(code, message);
const abortCheck = signal => { if (signal?.aborted) throw signal.reason instanceof ContractError ? signal.reason : error('ABORTED', 'Operation cancelled'); };
const TOOLS = ['source.fetch', 'source.search', 'workspace.list', 'workspace.read', 'workspace.write', 'execution.run'];
const SOURCE_TRANSPORT_SCHEMA='sovereign.source-transport.v1';
export const REAL_SOURCE_TRANSPORT_DESCRIPTOR=Object.freeze({schema:SOURCE_TRANSPORT_SCHEMA,
  classification:'REAL_NETWORK',network:'ENABLED',fixtureId:null});
export function normalizeSourceTransportDescriptor(value=REAL_SOURCE_TRANSPORT_DESCRIPTOR){
  keys(value,['schema','classification','network','fixtureId']);
  check(value.schema===SOURCE_TRANSPORT_SCHEMA,'CONFIG','Unknown source transport descriptor schema');
  check(['REAL_NETWORK','SIMULATED_FIXTURE'].includes(value.classification),'CONFIG','Unknown source transport classification');
  check(['ENABLED','DISABLED'].includes(value.network),'CONFIG','Unknown source transport network classification');
  if(value.classification==='REAL_NETWORK')check(value.network==='ENABLED'&&value.fixtureId===null,
    'CONFIG','Real source transport cannot carry a fixture identity');
  else{check(value.network==='DISABLED','CONFIG','Simulated source fixture must not enable network');digest(value.fixtureId,'source fixture identity');}
  return clone(value);
}
const assertAdaptiveV3BrokerRoute=(broker,missionId)=>{
  const route=assertAdaptiveV3MissionRoute(broker.store,broker.authority,missionId);
  check(route?.decision.selectedEntryMode!==ADAPTIVE_V3_DIRECT_ENTRY_MODE,'ADAPTIVE_V3_ROUTE_INTEGRITY',
    'A deterministic adaptive-v3 route cannot prepare, dispatch or reconcile a broker effect');
  return route;
};
// The generic broker retains its historic source policy.  Every direct
// sourced-response mission, including a persisted legacy one, is nevertheless
// subject to the source-route byte safety ceiling before any receipt can be
// written.  That is a runtime admission guard, not a mutation of its historic
// policy, quota, or contract hash.  The v2 marker adds its stricter sealed
// recovery metadata without becoming the sole place where this safety rule
// lives.
const sourcedAcquisitionForMission=(store,missionId)=>{
  const mission=store.get('mission',missionId)?.data;
  if(mission?.policy?.entryMode!==SOURCED_RESPONSE_MODE)return null;
  return sourcedResponseAcquisition(mission);
};
const sourceByteLimit=(broker,missionId)=>{
  const acquisition=sourcedAcquisitionForMission(broker.store,missionId);
  return {acquisition,maxBytes:acquisition===null?broker.maxSourceBytes:Math.min(broker.maxSourceBytes,acquisition.maxSourceBytes)};
};

// Store.list() is deliberately ID-ordered, which is not an execution order.
// A sealed profile therefore derives the earlier source sequence from the
// append-only journal, rather than from UUIDs or wall-clock coincidence.
const committedRecordSequence=(store,type,id,version)=>{
  let after=0;
  for(;;){
    const events=store.events({after,limit:1000});
    for(const event of events)if(event.kind==='record.committed'&&event.data.type===type
      &&event.data.id===id&&event.data.version===version)return event.seq;
    if(events.length<1000)break;
    after=events.at(-1).seq;
  }
  check(false,'SOURCED_EVIDENCE_PROFILE_SEQUENCE','Sealed source history lacks its committed order');
};

const sealedProfileCompletedFetchUrls=(broker,{missionId,profile,operationId=null})=>{
  const prior=broker.store.list('effect').filter(record=>record.data?.missionId===missionId
    &&record.data?.tool==='source.fetch'&&record.id!==operationId)
    .map(record=>({record,sequence:committedRecordSequence(broker.store,'effect',record.id,record.version)}))
    .sort((left,right)=>left.sequence-right.sequence);
  check(prior.length<=profile.sources.length,'SOURCED_EVIDENCE_PROFILE_SEQUENCE',
    'Sealed evidence packet cannot issue more fetches than its declared seeds');
  return prior.map(({record})=>{
    check(record.data.state==='SUCCEEDED'&&record.data.receipt,'SOURCED_EVIDENCE_PROFILE_SEQUENCE',
      'A failed, pending or uncertain sealed seed stops the packet instead of authorizing another fetch');
    const receipt=broker.authority.open(record.data.receipt,'tool.receipt');
    check(receipt.id===record.id&&receipt.missionId===missionId&&receipt.tool==='source.fetch'
      &&receipt.status==='SUCCEEDED'&&receipt.argsHash===record.data.argsHash,
    'SOURCED_EVIDENCE_PROFILE_SEQUENCE','Sealed source history is not bound to its completed fetch receipt');
    string(receipt.result?.finalUrl,'sealed source final URL',{min:1,max:8192});
    return receipt.result.finalUrl;
  });
};
const missionSearchTarget=(store,missionId)=>{
  const mission=store.get('mission',missionId)?.data;
  check(mission?.id===missionId&&mission.policy&&typeof mission.policy==='object',
    'MISSION_POLICY','Public search requires a persisted mission policy');
  // Pre-target historic records remain compatible with their former provider
  // default. Every FactoryEngine-created mission has both fields, and those
  // sealed values are mandatory whenever either is present.
  if(mission.policy.model===undefined&&mission.policy.reasoningEffort===undefined)return null;
  check(typeof mission.policy.model==='string'&&typeof mission.policy.reasoningEffort==='string',
    'MISSION_POLICY','Public search target is incomplete');
  string(mission.policy.model,'mission search model',{min:1,max:256});
  string(mission.policy.reasoningEffort,'mission search reasoning effort',{min:1,max:128});
  return Object.freeze({model:mission.policy.model,reasoningEffort:mission.policy.reasoningEffort});
};
// Project-context bytes are part of the sealed workspace snapshot, not an
// ordinary mission attachment. The broker is the final enforcement point:
// an untrusted worker that guesses a hidden path cannot turn generic
// workspace authority into a second private-context transport.
const projectContextAccess=(broker,missionId,principalId=null)=>{
  const descriptor=projectContextDescriptor(broker.store,missionId);
  // Calls without a worker principal are trusted controller maintenance
  // reads (preparation/validation), never provider-dispatched operations.
  if(!descriptor||principalId===null)return {descriptor,allowed:true};
  const run=broker.store.get('run',principalId)?.data;
  if(!run||run.missionId!==missionId)return {descriptor,allowed:false};
  const nodeSpec=nodeId=>broker.store.get('node',`${missionId}:${nodeId}`)?.data?.spec;
  if(run.mode==='producer'&&isProjectContextIntakeNode(nodeSpec(run.nodeId)))return {descriptor,allowed:true};
  if(run.mode==='reviewer'&&run.context?.artifactIds?.length===1){
    const artifact=broker.store.get('artifact',run.context.artifactIds[0])?.data;
    if(artifact?.missionId===missionId&&isProjectContextIntakeNode(nodeSpec(artifact.payload?.nodeId)))return {descriptor,allowed:true};
  }
  return {descriptor,allowed:false};
};
const projectContextAncestor=(candidate,path)=>candidate==='.'||candidate===''||candidate===path||path.startsWith(candidate+'/');

function ipv4(value) { return value.split('.').reduce((n, part) => (n << 8n) | BigInt(part), 0n); }
function ipv6(value) {
  if (value.includes('.')) {
    const at = value.lastIndexOf(':'); const n = ipv4(value.slice(at + 1));
    value = value.slice(0, at + 1) + (n >> 16n).toString(16) + ':' + (n & 65535n).toString(16);
  }
  const halves = value.split('::'), left = halves[0] ? halves[0].split(':') : [], right = halves[1] ? halves[1].split(':') : [];
  const parts = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  return parts.reduce((n, part) => (n << 16n) | BigInt('0x' + part), 0n);
}
const within = (n, base, prefix, width) => (n >> BigInt(width - prefix)) === (base >> BigInt(width - prefix));
// Conservative subset of ordinary public unicast. IANA special-purpose ranges
// are excluded even when an individual special service is globally reachable.
const V4_DENY = ['0.0.0.0/8','10.0.0.0/8','100.64.0.0/10','127.0.0.0/8','169.254.0.0/16','172.16.0.0/12','192.0.0.0/24','192.0.2.0/24','192.31.196.0/24','192.52.193.0/24','192.88.99.0/24','192.168.0.0/16','192.175.48.0/24','198.18.0.0/15','198.51.100.0/24','203.0.113.0/24','224.0.0.0/4','240.0.0.0/4','168.63.129.16/32'].map(item => { const [a,p] = item.split('/'); return [ipv4(a), Number(p)]; });
const V6_DENY = ['2001::/23','2001:db8::/32','2002::/16','2620:4f:8000::/48','3fff::/20'].map(item => { const [a,p] = item.split('/'); return [ipv6(a), Number(p)]; });
export function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) return !V4_DENY.some(([base,prefix]) => within(ipv4(address), base, prefix, 32));
  if (family !== 6) return false;
  const n = ipv6(address);
  return within(n, ipv6('2000::'), 3, 128) && !V6_DENY.some(([base,prefix]) => within(n, base, prefix, 128));
}
function sameAddress(a, b) {
  if (isIP(a) === 6 && ipv6(a) >> 32n === 65535n) a = [24n,16n,8n,0n].map(shift => Number((ipv6(a) >> shift) & 255n)).join('.');
  return isIP(a) === isIP(b) && (isIP(a) === 4 ? ipv4(a) === ipv4(b) : isIP(a) === 6 && ipv6(a) === ipv6(b));
}
function publicUrl(value, previous = null) {
  string(value, 'url', {max: 8192});
  let url; try { url = new URL(value); } catch { throw error('URL', 'Invalid URL'); }
  check(['http:', 'https:'].includes(url.protocol), 'SSRF', 'Only public HTTP(S) is supported');
  check(!url.username && !url.password && !url.hash, 'SSRF', 'Credentials and fragments are not accepted');
  check(!url.port || url.port === (url.protocol === 'https:' ? '443' : '80'), 'SSRF', 'Only standard web ports are supported');
  check(!(previous?.protocol === 'https:' && url.protocol === 'http:'), 'SSRF', 'HTTPS downgrade is forbidden');
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  check(!host.includes('%') && (isIP(host) || host.includes('.')), 'SSRF', 'Local or scoped hostname rejected');
  check(!/(^|\.)(localhost|local|internal|lan|home|onion|arpa|invalid)$/.test(host), 'SSRF', 'Local or special hostname rejected');
  if (isIP(host)) check(isPublicAddress(host), 'SSRF', 'Nonpublic address rejected');
  return {url, host};
}

function awaitAbort(promise, signal) {
  abortCheck(signal);
  return new Promise((resolve, reject) => {
    const aborted = () => { try { abortCheck(signal); } catch (e) { reject(e); } };
    signal?.addEventListener('abort', aborted, {once: true});
    Promise.resolve(promise).then(resolve, reject).finally(() => signal?.removeEventListener('abort', aborted));
  });
}

// No global fetch, proxy agent, ambient cookies, caller headers or DNS relookup.
// Destination is the verified numeric address; Host/SNI remain the original host.
export function nodeTransport({url, address, family, signal, maxBytes}) {
  return new Promise((resolve, reject) => {
    publicUrl(url.href);
    check(isPublicAddress(address) && isIP(address) === family, 'SSRF', 'Transport requires a validated public IP pin');
    abortCheck(signal);
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const request = (url.protocol === 'https:' ? https : http).request({
      protocol: url.protocol, hostname: address, family, port: url.protocol === 'https:' ? 443 : 80,
      method: 'GET', path: url.pathname + url.search, agent: false, signal,
      servername: isIP(host) ? undefined : host, rejectUnauthorized: true,
      headers: {host: url.host, accept: 'text/*, application/json, application/xml, application/xhtml+xml', 'accept-encoding': 'identity', 'user-agent': 'SovereignFactoryEvidence/1'},
      maxHeaderSize: 16384,
    }, response => {
      // `IncomingMessage.destroy(limitError)` can emit `aborted` before its
      // `error` event.  Preserve the typed local cause across that event
      // ordering; otherwise an intentional byte-cap stop is misreported as a
      // generic interrupted network response.
      let responseFailure = null;
      response.on('error', cause => reject(responseFailure ?? cause));
      if (!sameAddress(response.socket.remoteAddress, address)) { response.destroy(error('SSRF', 'Connected peer differs from pinned address')); return; }
      const chunks = []; let bytes = 0;
      response.on('data', chunk => {
        if (responseFailure) return;
        bytes += chunk.length;
        if (bytes > maxBytes) {
          responseFailure = error('SOURCE_LIMIT', 'Response exceeds byte cap');
          response.destroy(responseFailure);
        }
        else chunks.push(chunk);
      });
      response.on('aborted', () => reject(responseFailure ?? error('NETWORK', 'Response interrupted')));
      response.on('end', () => {
        if (responseFailure) reject(responseFailure);
        else resolve({statusCode: response.statusCode, headers: response.headers, body: Buffer.concat(chunks), remoteAddress: address});
      });
    });
    request.on('socket', socket => socket.once('connect', () => { if (!sameAddress(socket.remoteAddress, address)) request.destroy(error('SSRF', 'Connected peer differs from pin')); }));
    request.on('error', reject);
    request.end();
  });
}

export class ToolBroker {
  #externalDispatchProvenance;
  constructor({store, authority, workspaceRoot, lookup = dnsLookup, transport = nodeTransport, clock = timestamp,
    maxFileBytes = WORKSPACE_DEFAULTS.maxFileBytes, maxWorkspaceBytes = WORKSPACE_DEFAULTS.maxWorkspaceBytes, maxEntries = WORKSPACE_DEFAULTS.maxEntries,
    maxSourceBytes = 2 * 1024 * 1024, timeoutMs = 15000, maxRedirects = 4, workspaceClassification = 'INTERNAL', executionRunner = null, searchProvider = null,
    sourceTransportDescriptor = REAL_SOURCE_TRANSPORT_DESCRIPTOR, requireExistingWorkspaceRoot = false} = {}) {
    check(store && authority, 'CONFIG', 'Trusted store and authority required');
    check(typeof lookup === 'function' && typeof transport === 'function' && typeof clock === 'function', 'CONFIG', 'Trusted injections must be functions');
    check(executionRunner === null || typeof executionRunner.run === 'function' && typeof executionRunner.available === 'function', 'CONFIG', 'Runner must be a trusted control-plane dependency');
    check(searchProvider===null||typeof searchProvider.search==='function','CONFIG','Search is a trusted control-plane dependency');
    if(searchProvider!==null)integer(searchProvider.timeoutMs,'search timeout',{min:1000,max:900000});
    check(['PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED'].includes(workspaceClassification), 'CONFIG', 'Invalid workspace classification');
    check(typeof requireExistingWorkspaceRoot === 'boolean', 'CONFIG', 'requireExistingWorkspaceRoot must be boolean');
    string(workspaceRoot, 'workspaceRoot'); check(isAbsolute(workspaceRoot) && resolve(workspaceRoot) !== sep, 'CONFIG', 'Specific absolute workspace root required');
    for (const [name,value] of Object.entries({maxFileBytes,maxWorkspaceBytes,maxEntries,maxSourceBytes,timeoutMs})) integer(value,name,{min:1});
    integer(maxRedirects,'maxRedirects',{max:10});
    check(maxFileBytes <= 4 * 1024 * 1024 && maxSourceBytes <= 4 * 1024 * 1024, 'CONFIG', 'Receipt payloads must fit trusted storage');
    const sourceTransport=normalizeSourceTransportDescriptor(sourceTransportDescriptor);
    Object.assign(this, {store,authority,lookup,transport,clock,maxFileBytes,maxWorkspaceBytes,maxEntries,maxSourceBytes,timeoutMs,maxRedirects,workspaceClassification,executionRunner,searchProvider,sourceTransport});
    this.#externalDispatchProvenance=new MissionExternalDispatchProvenanceControl({store,authority});
    this.workspaceRoot = safeDirectories(workspaceRoot, !requireExistingWorkspaceRoot); this.inflight = new Map();
  }
  registerWorkspace(missionId) {
    identifier(missionId);
    assertAdaptiveV3BrokerRoute(this,missionId);
    return this.store.transact(() => {
      const existing = this.store.get('tool-workspace', missionId);
      if (existing) { this.workspace(missionId); return clone(existing.data); }
      safeDirectories(this.workspaceRoot);
      const path = resolve(this.workspaceRoot, 'mission-' + sha256(missionId));
      check(!fs.existsSync(path), 'WORKSPACE_EXISTS', 'Unregistered directory must not be adopted');
      fs.mkdirSync(path, {mode: 0o700});
      const data = {missionId, path, resource: `workspace:${missionId}`};
      this.store.put('tool-workspace', missionId, data, {expectedVersion: 0}); return data;
    });
  }
  workspace(missionId) {
    identifier(missionId);
    assertAdaptiveV3BrokerRoute(this,missionId);
    const record = this.store.get('tool-workspace', missionId);
    check(record && record.data.missionId === missionId, 'WORKSPACE_MISSING', 'Mission workspace is not registered');
    check(dirname(record.data.path) === this.workspaceRoot && basename(record.data.path) === 'mission-' + sha256(missionId), 'WORKSPACE_PATH', 'Workspace binding differs');
    return safeDirectories(record.data.path);
  }
  resolvePath(missionId, path, {rootAllowed = false, createParents = false} = {}) {
    identifier(missionId);
    assertAdaptiveV3BrokerRoute(this,missionId);
    const parts = relativePath(path, rootAllowed), root = this.workspace(missionId); let current = root;
    for (const part of parts.slice(0,-1)) {
      current = resolve(current, part);
      if (createParents && !fs.existsSync(current)) fs.mkdirSync(current, {mode: 0o700});
      const stat = fs.lstatSync(current); check(stat.isDirectory() && !stat.isSymbolicLink(), 'WORKSPACE_PATH', 'Symlink or nondirectory parent rejected');
    }
    return parts.length ? resolve(current, parts.at(-1)) : root;
  }
  scan(root) {
    let entries = 0, bytes = 0;
    const visit = (dir, depth) => {
      check(depth <= 32, 'WORKSPACE_LIMIT', 'Directory depth cap exceeded');
      for (const name of fs.readdirSync(dir)) {
        check(++entries <= this.maxEntries, 'WORKSPACE_LIMIT', 'Workspace entry cap exceeded');
        const path = resolve(dir,name), stat = fs.lstatSync(path);
        check(!stat.isSymbolicLink(), 'WORKSPACE_PATH', 'Symlinks are not supported');
        if (stat.isDirectory()) visit(path,depth+1);
        else { regular(stat); bytes += stat.size; check(bytes <= this.maxWorkspaceBytes, 'WORKSPACE_LIMIT', 'Workspace byte cap exceeded'); }
      }
    };
    visit(root,0); return {entries,bytes};
  }
  readFile(path) {
    const before = fs.lstatSync(path); regular(before);
    check(before.size <= this.maxFileBytes, 'WORKSPACE_LIMIT', 'File exceeds byte cap');
    const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
      const stat = fs.fstatSync(fd); regular(stat);
      check(stat.ino === before.ino && stat.dev === before.dev && stat.size <= this.maxFileBytes, 'WORKSPACE_PATH', 'File changed during admission');
      const buffer = Buffer.alloc(this.maxFileBytes + 1); let used = 0;
      while (used < buffer.length) { const got = fs.readSync(fd,buffer,used,buffer.length-used,null); if (!got) break; used += got; }
      check(used <= this.maxFileBytes, 'WORKSPACE_LIMIT', 'File grew beyond byte cap');
      return buffer.subarray(0,used);
    } finally { fs.closeSync(fd); }
  }
  fileHash(path) { try { return sha256(this.readFile(path)); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
  executionAvailable() { return this.executionRunner?.available().available === true; }
  searchAvailable() { return this.searchProvider!==null; }
  toolDeadline(tool) {
    return tool==='source.search'?Math.max(this.timeoutMs,(this.searchProvider?.timeoutMs??0)+10000)
      :tool==='execution.run'?Math.max(this.timeoutMs,(this.executionRunner?.wallTimeMs??0)+10000):this.timeoutMs;
  }
  async searchSource(missionId,args,signal,verifyAuthority) {
    identifier(missionId);
    check(typeof verifyAuthority==='function','CONFIG','Search requires a trusted authority verifier');
    const verify=()=>{assertAdaptiveV3BrokerRoute(this,missionId);return verifyAuthority();};
    assertAdaptiveV3BrokerRoute(this,missionId);
    check(assertSourcedEvidenceProfileMission(this.store.get('mission',missionId)?.data)===null,
      'SOURCED_EVIDENCE_PROFILE_SCOPE','This sealed evidence profile does not permit public discovery');
    check(this.searchAvailable(),'CAPABILITY','No public discovery provider is configured');
    verify();abortCheck(signal);
    const controller=new AbortController(),cancel=()=>controller.abort(signal.reason);
    signal.addEventListener('abort',cancel,{once:true});
    const poll=setInterval(()=>{try{verify();}catch(e){controller.abort(e);}},100);poll.unref();
    try {
      // Await provider cleanup on cancellation; never detach an active search.
      // Discovery uses the same sealed target as its mission.  A provider may
      // have a separate tool profile, but it may not silently spend a default
      // Astra/ultra target while the mission is pinned to another one.
      const target=missionSearchTarget(this.store,missionId);
      const result=await this.searchProvider.search(args,{signal:controller.signal,...(target?{target}:{})});
      abortCheck(controller.signal);verify();
      check(result?.schema==='sovereign.discovery.v1'&&result.query===args.query&&result.queryHash===sha256(args)
        &&result.closure?.processExitObserved===true&&result.inference?.toolPolicy==='public-search-v1'
        &&Array.isArray(result.searchObservations)&&result.searchObservations.some(o=>o.actionType==='search')
        &&Array.isArray(result.candidates)&&result.candidates.length<=args.limit,'SEARCH_RECEIPT','Discovery did not return its exact observed query');
      for(const candidate of result.candidates) {
        check(candidate.evidenceStatus==='UNVERIFIED_DISCOVERY_CANDIDATE','SEARCH_RECEIPT','Discovery cannot confer factual authority');
        publicUrl(candidate.url);string(candidate.title,'candidate title',{max:2000});
      }
      check(Buffer.byteLength(JSON.stringify(result))<=128*1024,'SOURCE_LIMIT','Discovery receipt exceeds cap');
      return result;
    } catch(e) {
      if(e.code==='CLEANUP_UNCONFIRMED'){e.effectUncertain=true;throw e;}
      abortCheck(controller.signal);throw e;
    }
    finally{clearInterval(poll);signal.removeEventListener('abort',cancel);}
  }
  executionSnapshot(missionId,{principalId=null}={}) {
    identifier(missionId);
    if(principalId!==null)identifier(principalId,'execution snapshot principal');
    assertAdaptiveV3BrokerRoute(this,missionId);
    assertInputWorkingState(this,missionId);
    const projectContext=projectContextAccess(this,missionId,principalId);
    const assetManifest=sublimineMissionAssetManifestInput(this.store,missionId);
    const excludedPaths=[
      ...(projectContext.descriptor&&!projectContext.allowed?[projectContext.descriptor.path]:[]),
      ...(assetManifest?[assetManifest.path]:[]),
    ];
    const root = this.workspace(missionId); this.scan(root);
    const manifest = [], files = [];
    const walk = (directory, prefix = '') => {
      let visible=false;
      for (const name of fs.readdirSync(directory).sort()) {
        const path = prefix ? prefix + '/' + name : name, absolute = resolve(directory, name);
        relativePath(path); const stat = fs.lstatSync(absolute);
        if (stat.isDirectory() && !stat.isSymbolicLink()) {
          // Preserve the pre-order manifest layout for visible directories,
          // but do not let a hidden file disclose an otherwise empty parent
          // chain (for example `client-acme/internal`).  Ordinary empty
          // directories remain visible; only ancestors whose sole remaining
          // content was the excluded controller-private file disappear.
          const directoryIndex=manifest.length;
          manifest.push({type: 'directory', path});
          const childVisible=walk(absolute,path);
          const privateAncestor=excludedPaths.some(hidden=>projectContextAncestor(path,hidden));
          if(privateAncestor&&!childVisible)manifest.splice(directoryIndex,1);
          else visible=true;
        }
        else {
          if(excludedPaths.includes(path))continue;
          regular(stat); const raw = this.readFile(absolute), content = utf8(raw), hash = sha256(raw);
          files.push({path, content, sha256: hash}); manifest.push({type: 'file', path, sha256: hash, bytes: raw.length});
          visible=true;
        }
      }
      return visible;
    };
    walk(root); return {manifest, files, hash: sha256(manifest)};
  }
  async runExecution({missionId, operationId, binding, args, signal, verify}) {
    assertAdaptiveV3BrokerRoute(this,missionId);
    check(this.executionAvailable(), 'CAPABILITY', 'No operational isolated runner is configured');
    verify(); abortCheck(signal);
    const snapshot = this.executionSnapshot(missionId,{principalId:binding.principalId});
    let job = this.store.put('execution-job', operationId, {...binding, args: clone(args), snapshotHash: snapshot.hash,
      manifest: snapshot.manifest, state: 'PREPARED', mode: 'snapshot-discard'}, {expectedVersion: 0});
    let completed = false;
    try {
      const result = await this.executionRunner.run({args, snapshot, signal, verifyAuthority: verify,
        onCreated: metadata => { job = this.store.put('execution-job', operationId,
          {...job.data, ...metadata, state: 'STARTING'}, {expectedVersion: job.version}); }});
      completed = true;
      validateExecutionResult(result);
      check(result.schema === 'sovereign.execution.v1' && result.simulation === false && result.mode === 'snapshot-discard'
        && result.snapshotHash === snapshot.hash && sha256(result.manifest) === snapshot.hash
        && result.isolation?.enforced === true && result.isolation.processesTerminated === true
        && result.isolation.scratchRemoved === true && result.outputTruncated === false
        && sha256(result.argv) === sha256(args.argv) && result.cwd === args.cwd,
      'EXECUTION_RECEIPT', 'Runner did not return its exact bounded operation');
      integer(result.exitCode, 'execution exitCode', {max: 255});
      verify(); abortCheck(signal);
      check(this.executionSnapshot(missionId,{principalId:binding.principalId}).hash === snapshot.hash, 'WORKSPACE_CHANGED', 'Original workspace changed during snapshot execution');
      this.store.put('execution-job', operationId, {...job.data, state: 'COMPLETED', result}, {expectedVersion: job.version});
      return result;
    } catch (error) {
      try {
        this.store.put('execution-job', operationId, {...job.data, state: error.effectUncertain ? 'UNCERTAIN' : 'FAILED',
          failure: {code: safeCode(error), details: clone(error.details ?? {})}}, {expectedVersion: job.version});
      } catch { if (completed || job.data.unit) error.effectUncertain = true; }
      throw error;
    }
  }
  /** Only the exclusive engine owner invokes recovery. Never replay a command.
   * A completed durable job can restore its missing receipt. An interrupted
   * disposable job is first terminated, then recorded as interrupted, not PASS.
   * Other tool types and unresolved cleanup remain uncertain for reconciliation.
   */
  reconcileExecutions(missionId) {
    identifier(missionId); assertAdaptiveV3BrokerRoute(this,missionId); const recovered = [];
    for (const effect of this.store.list('effect')) {
      if (effect.data.missionId !== missionId || effect.data.tool !== 'execution.run'
        || !['DISPATCHED', 'UNCERTAIN'].includes(effect.data.state) || effect.data.receipt || this.inflight.has(effect.id)) continue;
      const job = this.store.get('execution-job', effect.id);
      if (!job) continue; // No durable ownership identity; do not guess a unit.
      check(['missionId', 'principalId', 'tool', 'argsHash'].every(k => job.data[k] === effect.data[k])
        && sha256(job.data.args) === effect.data.argsHash && sha256(job.data.manifest) === job.data.snapshotHash
        && job.data.mode === 'snapshot-discard', 'RECEIPT_BINDING', 'Recovery job binding differs');
      let cleanup = null;
      if (job.data.unit) {
        if (typeof this.executionRunner?.reconcile !== 'function') continue;
        try { cleanup = this.executionRunner.reconcile(job.data); }
        catch (error) {
          this.store.append('execution.reconciliation.pending', {operationId: effect.id, missionId, code: safeCode(error)});
          continue;
        }
      }
      let status = 'FAILED', result = {error: {code: 'EXECUTION_INTERRUPTED'},
        outcomeKnown: false, automaticReplay: false, ...(cleanup ? {cleanup} : {})};
      if (job.data.state === 'COMPLETED') {
        const value = job.data.result;
        validateExecutionResult(value);
        check(value?.schema === 'sovereign.execution.v1' && value.simulation === false && value.mode === 'snapshot-discard'
          && value.snapshotHash === job.data.snapshotHash && sha256(value.manifest) === job.data.snapshotHash
          && value.cwd === job.data.args.cwd && sha256(value.argv) === sha256(job.data.args.argv)
          && value.isolation?.enforced === true && value.isolation.processesTerminated === true
          && value.isolation.scratchRemoved === true && value.outputTruncated === false,
        'EXECUTION_RECEIPT', 'Persisted execution result does not meet the recovery contract');
        integer(value.exitCode, 'recovered exitCode', {max: 255});
        status = 'SUCCEEDED'; result = value;
      } else if (job.data.state === 'FAILED') {
        result = {error: {code: job.data.failure.code}, ...(cleanup ? {cleanup} : {})};
      }
      const {missionId: mission, principalId, tool, argsHash, startedAt} = effect.data;
      const receipt = this.authority.seal('tool.receipt', {id: effect.id, missionId: mission, principalId, tool, argsHash,
        status, result, startedAt, completedAt: this.clock()});
      this.store.transact(() => {
        this.store.put('effect', effect.id, {...effect.data, state: status, receipt}, {expectedVersion: effect.version});
        this.store.put('execution-job', effect.id, {...job.data, recovery: {status, cleanup, recoveredAt: this.clock()}}, {expectedVersion: job.version});
        this.store.append('execution.reconciled', {operationId: effect.id, missionId, status, replayed: false});
      });
      recovered.push(effect.id);
    }
    return recovered;
  }
  workspaceTool(missionId, tool, args, signal, operationId=null,principalId=null) {
    identifier(missionId);
    assertAdaptiveV3BrokerRoute(this,missionId);
    abortCheck(signal);
    const projectContext=projectContextAccess(this,missionId,principalId);
    const assetManifest=sublimineMissionAssetManifestInput(this.store,missionId);
    if(projectContext.descriptor&&!projectContext.allowed){
      if(tool==='workspace.read'&&args.path===projectContext.descriptor.path)check(false,'PROJECT_CONTEXT_SCOPE',
        'Only the mandatory project-context intake producer and its exact independent reviewer may read the controller-private context file');
      if(tool==='workspace.list'&&projectContextAncestor(args.path,projectContext.descriptor.path))check(false,'PROJECT_CONTEXT_SCOPE',
        'A nonrecipient worker may not enumerate the controller-private project-context directory');
      if(tool==='workspace.write'&&args.path===projectContext.descriptor.path)check(false,'PROJECT_CONTEXT_SCOPE',
        'The controller-private project-context file is immutable and outside nonrecipient worker authority');
    }
    if(assetManifest){
      if(tool==='workspace.read'&&args.path===assetManifest.path)check(false,'ASSET_MANIFEST_SCOPE',
        'The sealed asset manifest has no generic workspace-read authority; a future asset resolver must be explicitly capability-bound');
      if(tool==='workspace.write'&&args.path===assetManifest.path)check(false,'ASSET_MANIFEST_SCOPE',
        'The sealed asset manifest is immutable and outside worker write authority');
    }
    const admitted=assertInputWorkingState(this,missionId,{excludeOperationId:operationId});
    if (tool === 'workspace.list') {
      const path = this.resolvePath(missionId,args.path,{rootAllowed:true});
      const stat = fs.lstatSync(path); check(stat.isDirectory() && !stat.isSymbolicLink(), 'WORKSPACE_PATH', 'List target must be directory');
      this.scan(this.workspace(missionId));
      const entries = fs.readdirSync(path).sort().map(name => { const s = fs.lstatSync(resolve(path,name)); return {name,type:s.isDirectory()?'directory':'file',bytes:s.isFile()?s.size:0}; })
        .filter(entry=>!assetManifest||((args.path==='.'?'':args.path+'/')+entry.name)!==assetManifest.path);
      return {path:args.path,entries};
    }
    if (tool === 'workspace.read') {
      const raw = this.readFile(this.resolvePath(missionId,args.path));
      const expected=admitted?.versions.get(args.path);
      if(expected)check(sha256(raw)===expected.hash,'WORKSPACE_CHANGED','Admitted input changed at the actual read boundary');
      return {path:args.path,content:utf8(raw),sha256:sha256(raw),bytes:raw.length};
    }
    const raw = Buffer.from(args.content,'utf8');
    check(raw.toString('utf8') === args.content, 'ENCODING', 'Write must be lossless UTF-8');
    check(raw.length <= this.maxFileBytes, 'WORKSPACE_LIMIT', 'Write exceeds file cap');
    const root = this.workspace(missionId), totals = this.scan(root);
    let target;
    try { target = this.resolvePath(missionId,args.path); } catch (e) { if (e.code !== 'ENOENT' || args.expectedHash !== null) throw e; }
    const beforeHash = target ? this.fileHash(target) : null;
    check(beforeHash === args.expectedHash, 'HASH_CONFLICT', 'Expected file hash differs');
    const previousBytes = beforeHash === null ? 0 : fs.lstatSync(target).size;
    const missingParents = []; let parent = root;
    for (const part of relativePath(args.path).slice(0,-1)) { parent = resolve(parent,part); if (!fs.existsSync(parent)) missingParents.push(parent); }
    check(totals.bytes - previousBytes + raw.length <= this.maxWorkspaceBytes && totals.entries + missingParents.length + (beforeHash === null ? 1 : 0) <= this.maxEntries, 'WORKSPACE_LIMIT', 'Workspace quota exceeded');
    abortCheck(signal);
    target = this.resolvePath(missionId,args.path,{createParents:true});
    this.scan(root);
    const temporary = resolve(dirname(target), '.broker-' + randomUUID() + '.tmp'); let renamed = false;
    try {
      const fd = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
      try { fs.writeFileSync(fd,raw); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      check(this.fileHash(target) === args.expectedHash, 'HASH_CONFLICT', 'Target changed before atomic write');
      abortCheck(signal); fs.renameSync(temporary,target); renamed = true;
      const dirfd = fs.openSync(dirname(target),fs.constants.O_RDONLY); try { fs.fsyncSync(dirfd); } finally { fs.closeSync(dirfd); }
      return {path:args.path,beforeSha256:beforeHash,sha256:sha256(raw),afterSha256:sha256(raw),bytes:raw.length};
    } catch (e) { if (renamed) e.effectUncertain = true; throw e; }
    finally { if (!renamed) {
      try { fs.unlinkSync(temporary); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      for (const path of missingParents.reverse()) { try { fs.rmdirSync(path); } catch (e) { if (!['ENOENT','ENOTEMPTY'].includes(e.code)) throw e; } }
    } }
  }
  async fetchSource(missionId,args, signal, verifyAuthority, recordTrace = () => {}, operationId = null) {
    identifier(missionId);
    check(typeof verifyAuthority==='function','CONFIG','Source acquisition requires a trusted authority verifier');
    const verify=()=>{assertAdaptiveV3BrokerRoute(this,missionId);return verifyAuthority();};
    assertAdaptiveV3BrokerRoute(this,missionId);
    const mission=this.store.get('mission',missionId)?.data,
      {acquisition,maxBytes:sourceCap}=sourceByteLimit(this,missionId),
      evidenceProfile=assertSourcedEvidenceProfileMission(mission);
    let {url,host} = publicUrl(args.url), consumed = 0;
    const assertProfileUrl=target=>check(sourcedEvidenceProfileAllowsUrl(evidenceProfile,target.href),
      'SOURCED_EVIDENCE_PROFILE_SCOPE','Source URL is outside the sealed evidence profile');
    // Validate the immutable URL membership and the one permitted next seed
    // before DNS or a transport connection.  Earlier failed/pending attempts
    // cannot be converted into a different public URL or a duplicate retry.
    assertProfileUrl(url);
    const expectedSeed=evidenceProfile===null?null:sourcedEvidenceProfileNextSeed(evidenceProfile,
      sealedProfileCompletedFetchUrls(this,{missionId,profile:evidenceProfile,operationId}));
    if(evidenceProfile!==null)check(expectedSeed!==null&&url.href===expectedSeed.url,
      'SOURCED_EVIDENCE_PROFILE_SEQUENCE','Sealed sources must be fetched once and in their declared order');
    const hops=[];
    for (let redirect = 0; ; redirect++) {
      assertProfileUrl(url);
      if(expectedSeed!==null)check(url.href===expectedSeed.url,'SOURCED_EVIDENCE_PROFILE_SEQUENCE',
        'A sealed source cannot redirect into another declared seed or an alternate URL');
      abortCheck(signal); verify();
      const addresses = isIP(host) ? [{address:host,family:isIP(host)}] : await awaitAbort(this.lookup(host,{all:true,verbatim:true}),signal);
      check(Array.isArray(addresses) && addresses.length > 0 && addresses.length <= 64, 'DNS', 'DNS produced no bounded address set');
      for (const item of addresses) check(item && isPublicAddress(item.address) && isIP(item.address) === item.family, 'SSRF', 'DNS contains nonpublic address');
      const chosen = [...addresses].sort((a,b) => a.family-b.family || a.address.localeCompare(b.address))[0];
      abortCheck(signal); verify();
      // Persist intent BEFORE calling transport. A null response denotes an
      // attempted request of unknown outcome, never proof that no request ran.
      hops.push({url:url.href,requestedAt:this.clock(),response:null});
      recordTrace({state:'DISPATCHING',hops:clone(hops)});
      const response = await awaitAbort(this.transport({url,address:chosen.address,family:chosen.family,signal,maxBytes:sourceCap-consumed}),signal);
      check(response && sameAddress(response.remoteAddress,chosen.address), 'SSRF', 'Transport peer differs from validated address');
      check(Buffer.isBuffer(response.body), 'TRANSPORT', 'Transport must return bounded raw bytes');
      consumed += response.body.length; check(consumed <= sourceCap, 'SOURCE_LIMIT', 'Total response bytes exceed cap');
      integer(response.statusCode,'HTTP status',{min:100,max:599});
      hops.at(-1).response={status:response.statusCode,bytes:response.body.length,sha256:sha256(response.body),observedAt:this.clock()};
      recordTrace({state:'RESPONSE_OBSERVED',hops:clone(hops)});
      const headers = response.headers ?? {};
      if ([301,302,303,307,308].includes(response.statusCode)) {
        check(redirect < this.maxRedirects && typeof headers.location === 'string', 'REDIRECT', 'Redirect limit or missing location');
        const next = publicUrl(new URL(headers.location,url).href,url); assertProfileUrl(next.url);
        if(expectedSeed!==null)check(next.url.href===expectedSeed.url,'SOURCED_EVIDENCE_PROFILE_SEQUENCE',
          'A sealed source cannot redirect into another declared seed or an alternate URL');
        url = next.url; host = next.host; continue;
      }
      // A direct sourced-response is evidence acquisition, not an arbitrary
      // HTTP client.  Never turn an error document into a durable usable
      // source.  This applies to legacy source missions at runtime too while
      // leaving their persisted quota/hash/policy exactly as admitted.
      if(acquisition!==null)check(response.statusCode>=200&&response.statusCode<300,
        'SOURCE_HTTP_STATUS','Non-2xx response is not admissible source evidence');
      check(!headers['content-encoding'] || headers['content-encoding'].toLowerCase() === 'identity', 'ENCODING', 'Compressed responses are not supported');
      const type = String(headers['content-type'] ?? '').toLowerCase();
      check(/^(text\/|application\/(?:json|[^; ]+\+json|xml|xhtml\+xml)(?:;|$))/.test(type), 'MEDIA_TYPE', 'Only textual evidence is currently supported');
      const charset = type.match(/charset\s*=\s*["']?([^;"' ]+)/)?.[1];
      check(!charset || ['utf-8','utf8','us-ascii'].includes(charset), 'ENCODING', 'Only UTF-8 evidence is supported');
      const minimal = {};
      for (const key of ['content-type','etag','last-modified','date']) if (typeof headers[key] === 'string') { string(headers[key],key,{max:2048}); minimal[key] = headers[key]; }
      return {content:utf8(response.body),sha256:sha256(response.body),bytes:response.body.length,finalUrl:url.href,retrievedAt:this.clock(),status:response.statusCode,mediaType:type.split(';')[0],headers:minimal,
        acquisition:clone(this.sourceTransport),
        httpTrace:{version:'http-exchange-trace-v1',complete:true,hops:clone(hops),
          scope:'Every HTTP request invoked by this broker operation, in order, including followed redirects. Response hashes cover received bytes. No cookies, credentials or redirect response bodies are exposed. Not a host-wide trace, truth verdict or proof of source independence.'},
        interpretation:'Acquired source bytes are evidence, not a factual truth verdict.'};
    }
  }
  validateArgs(tool,args) {
    if (tool === 'source.fetch') { keys(args,['url']); publicUrl(args.url); }
    else if(tool==='source.search')validateSearchArgs(args);
    else if (tool === 'workspace.write') { keys(args,['path','content','expectedHash']); relativePath(args.path); string(args.content,'content',{min:0,max:this.maxFileBytes}); if (args.expectedHash !== null) digest(args.expectedHash); }
    else if (tool === 'workspace.read' || tool === 'workspace.list') { keys(args,['path']); relativePath(args.path,tool==='workspace.list'); }
    else if (tool === 'execution.run') validateExecutionArgs(args);
    else { keys(args,[]); }
  }
  async execute(request) {
    keys(request,['missionId','principalId','lease','operationId','tool','args','signal'],['missionId','principalId','lease','operationId','tool','args']);
    const {missionId,principalId,lease,operationId,tool,signal} = request;
    check(signal === undefined || signal instanceof AbortSignal, 'SCHEMA', 'signal must be a control-plane AbortSignal');
    [missionId,principalId,operationId].forEach(identifier); check(TOOLS.includes(tool),'CAPABILITY','Unsupported tool');
    assertAdaptiveV3BrokerRoute(this,missionId);
    const args = clone(request.args); this.validateArgs(tool,args);
    const binding = {missionId,principalId,tool,argsHash:sha256(args)};
    const web=tool==='source.fetch'||tool==='source.search';
    const verify = () => this.authority.verify(lease,{missionId,principalId,action:tool,resource:web?'public-web':`workspace:${missionId}`,classification:web?'PUBLIC':this.workspaceClassification});
    verify(); abortCheck(signal);
    assertInputWorkingState(this,missionId,{excludeOperationId:operationId});
    const existing = this.store.get('effect',operationId);
    if (existing) {
      check(Object.entries(binding).every(([k,v])=>existing.data[k]===v),'IDEMPOTENCY_CONFLICT','Operation ID is bound to a different request');
      if (existing.data.receipt) { const receipt = this.authority.open(existing.data.receipt,'tool.receipt'); check(receipt.id===operationId && Object.entries(binding).every(([k,v])=>receipt[k]===v),'RECEIPT_BINDING','Receipt binding differs'); return clone(existing.data.receipt); }
      if (this.inflight.has(operationId)) return this.inflight.get(operationId);
      if (['DISPATCHED','UNCERTAIN'].includes(existing.data.state)) {
        if (existing.data.state === 'DISPATCHED') this.store.put('effect',operationId,{...existing.data,state:'UNCERTAIN'},{expectedVersion:existing.version});
        throw error('EFFECT_UNCERTAIN','Dispatched operation needs reconciliation; it will not be repeated');
      }
      check(existing.data.state === 'PREPARED','EFFECT_STATE','Invalid effect state');
    }
    const promise = this.perform({operationId,binding,args,signal,verify,lease});
    this.inflight.set(operationId,promise);
    try { return await promise; } finally { this.inflight.delete(operationId); }
  }
  async perform({operationId,binding,args,signal,verify,lease}) {
    const controller = new AbortController();
    const deadlineMs = this.toolDeadline(binding.tool);
    const timer = setTimeout(()=>controller.abort(error('TIMEOUT','Tool deadline exceeded')),deadlineMs);
    const cancelled = () => controller.abort(error('ABORTED','Operation cancelled'));
    signal?.addEventListener('abort',cancelled,{once:true}); if(signal?.aborted)cancelled();
    let record, result, status = 'SUCCEEDED', observed = false, writeObserved = false;
    try {
      record = this.store.transact(()=> {
        assertAdaptiveV3BrokerRoute(this,binding.missionId);
        const current = this.store.get('effect',operationId);
        if (current) { check(current.data.state==='PREPARED','EFFECT_UNCERTAIN','Operation already dispatched'); check(Object.entries(binding).every(([k,v])=>current.data[k]===v),'IDEMPOTENCY_CONFLICT','Request binding differs'); return current; }
        return this.store.put('effect',operationId,{...binding,state:'PREPARED',startedAt:this.clock()},{expectedVersion:0});
      });
      try {
        verify(); abortCheck(controller.signal);
        if (binding.tool === 'execution.run') check(this.executionAvailable(),'CAPABILITY','No operational isolated runner is configured');
        record = this.store.transact(()=>{
          assertAdaptiveV3BrokerRoute(this,binding.missionId);
          // This is the authority observation that authorizes the durable
          // DISPATCHED transition.  Keep it inside the same transaction as
          // the signed sidecar; an earlier check cannot cover a concurrent
          // revocation before the irreversible marker is committed.
          verify();
          this.authority.consumeDispatch(lease,{missionId:binding.missionId,principalId:binding.principalId,action:binding.tool,
            resource:binding.tool==='source.fetch'||binding.tool==='source.search'?'public-web':`workspace:${binding.missionId}`,
            classification:binding.tool==='source.fetch'||binding.tool==='source.search'?'PUBLIC':this.workspaceClassification,
            operationId,argsHash:sha256(args)});
          const dispatched=this.store.put('effect',operationId,{...record.data,state:'DISPATCHED'},{expectedVersion:record.version});
          if(binding.tool==='source.search'){
            const effect=missionBudgetRecordRef(dispatched);
            if(missionInferenceBudget(this,binding.missionId)){
              const preflight=this.#externalDispatchProvenance.prepareSearch({effectRecord:dispatched,signedLease:lease,issuedAt:this.clock()});
              const call=reserveMissionInference(this,{missionId:binding.missionId,kind:'search',binding:{effect}});
              check(call,'INFERENCE_PROVENANCE_CONTROL','A budgeted search must create one exact mission reservation');
              const callRef=missionBudgetRecordRef(call);
              // Bind this sidecar to the reservation just created, rather
              // than allowing a later call for the same search effect to
              // borrow a generic proof.  The effect, call and proof commit
              // atomically before any network search is attempted.
              this.#externalDispatchProvenance.issueSearch(preflight,{callRecord:call});
              assertMissionSearchDispatchProvenance({store:this.store,authority:this.authority},{effect,call:callRef});
            }
          }
          return dispatched;
        });
        if (binding.tool === 'source.fetch') result = await this.fetchSource(binding.missionId,args,controller.signal,verify,trace=>{
          const prior=this.store.get('source-http-trace',operationId);
          this.store.put('source-http-trace',operationId,{version:'http-exchange-trace-v1',operationId,...binding,...trace,
            scope:'Local pre-dispatch/response checkpoints; only a successful signed receipt can certify a complete authorized acquisition.'},{expectedVersion:prior?.version??0});
        },operationId);
        else if(binding.tool==='source.search')result=await this.searchSource(binding.missionId,args,controller.signal,verify);
        else if (binding.tool === 'execution.run') result = await this.runExecution({missionId: binding.missionId, operationId, binding, args, signal: controller.signal, verify});
        else result = this.store.transact(()=> {
          verify();
          const value = this.workspaceTool(binding.missionId,binding.tool,args,controller.signal,operationId,binding.principalId);
          if (binding.tool === 'workspace.write') writeObserved = true;
          return value;
        });
        // A network await is an authority boundary. A response may arrive after
        // expiry/revocation, or lose authority at the async return handoff. Do
        // not publish its content as an authorized successful acquisition.
        // Writes/execution keep their separate observed/uncertain-effect rules.
        if (binding.tool === 'source.fetch' || binding.tool === 'source.search') {
          verify(); abortCheck(controller.signal);
        }
        observed = true;
      } catch (e) {
        if (e.effectUncertain || writeObserved) {
          try { this.store.put('effect',operationId,{...record.data,state:'UNCERTAIN'},{expectedVersion:record.version}); } catch { /* Durable DISPATCHED still prevents automatic retry. */ }
          throw error('EFFECT_UNCERTAIN','Effect occurred but durable outcome is uncertain');
        }
        status = 'FAILED'; result = {error:{code:safeCode(e)}};
        if(binding.tool==='source.fetch'){
          const trace=this.store.get('source-http-trace',operationId);
          if(trace)this.store.put('source-http-trace',operationId,{...trace.data,state:'FAILED',errorCode:safeCode(e)},{expectedVersion:trace.version});
        }
      }
      const receipt = this.authority.seal('tool.receipt',{id:operationId,...binding,status,result,startedAt:record.data.startedAt,completedAt:this.clock()});
      try { this.store.put('effect',operationId,{...record.data,state:status,receipt},{expectedVersion:record.version}); }
      catch (e) { if (observed) throw error('EFFECT_UNCERTAIN','Observed effect could not be durably recorded; no automatic replay'); throw e; }
      return receipt;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort',cancelled); }
  }
}
