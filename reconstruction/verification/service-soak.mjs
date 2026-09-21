// Qualification observer, not a service, scheduler, repair loop or model worker.
// Reuse the existing immutable journal and canonical-manager/release verifiers.
import * as fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {Store,check,sha256,canonical,id,identifier,instant,inspectUserService,verifyRuntimeRelease,verifySoakRuntime} from './service-soak-runtime.mjs';

const here=dirname(fileURLToPath(import.meta.url));
export const SOAK_PATH=join(here,'service-soak/state.sqlite');
export const SOAK_POLICY=Object.freeze({schema:'sovereign.service-soak.v1',targetMs:72*60*60*1000,
  maxGapMs:45*60*1000,maxClockDriftMs:120000,maxCaptureMs:60000});
const HOME_PATH=process.env.SUBLIMINE_HOME||process.env.HOME;
check(typeof HOME_PATH==='string'&&HOME_PATH.startsWith('/'),'SOAK_CONFIG','A trusted absolute SUBLIMINE_HOME or HOME is required');
const STATE_DIR=process.env.SUBLIMINE_STATE_DIR||join(HOME_PATH,'.local/state/sovereign-factory');
const RELEASES=process.env.SUBLIMINE_RELEASES_DIR||join(HOME_PATH,'.local/share/sovereign-factory/releases');
const NODE=process.env.SUBLIMINE_NODE_BIN||process.execPath;
const WRAPPER=process.env.SUBLIMINE_BIN||join(HOME_PATH,'.local/bin/sovereign');
const UNIT=process.env.SUBLIMINE_SERVICE_UNIT||join(HOME_PATH,'.config/systemd/user/sovereign-factory.service');
const regexpEscape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const SCOPE='Sampled canonical service/process identity, packaged files and read-only queue journal. No inference, restart, repair, mission dispatch or continuous-availability guarantee.';
const probePaths=[fileURLToPath(import.meta.url),join(here,'service-soak-runtime.mjs')];
function probeCodeFiles(){
  return probePaths.map(path=>{regular(path);return {path,hash:sha256(fs.readFileSync(path))};});
}
// Bind this process to its source snapshot. A subsequent edit is not silently
// attributed to already loaded code. This is not loaded-memory attestation.
const loadedProbeFiles=probeCodeFiles();
export function probeIdentity(){
  const files=probeCodeFiles();
  check(canonical(files)===canonical(loadedProbeFiles),'SOAK_PROBE_CHANGED','Observer source changed after module load');
  const runtime=verifySoakRuntime(),body={schema:'sovereign.soak-probe.v2',files,runtime};
  return {...body,hash:sha256(body)};
}

export function parseProcessStat(text,expectedPid){
  // comm may contain spaces and parentheses. Fields after its LAST ')' start at 3.
  const match=/^(\d+) \(/.exec(text),end=text.lastIndexOf(')');
  check(match&&Number(match[1])===expectedPid&&end>match[0].length,'SOAK_PROC','Process identity unavailable');
  const fields=text.slice(end+1).trim().split(/\s+/),startTicks=fields[19];
  check(fields.length>=20&&/^\d+$/.test(startTicks),'SOAK_PROC','Missing process start time');
  return {pid:expectedPid,state:fields[0],startTicks};
}
function procIdentity(pid){
  const identity=parseProcessStat(fs.readFileSync('/proc/'+pid+'/stat','utf8'),pid);
  check(!['Z','X','x','T','t'].includes(identity.state),'SOAK_PROCESS_STATE','Stopped or dead process');
  return identity;
}
function bootClock(){
  const bootId=fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim();
  const uptimeMs=Math.round(Number(fs.readFileSync('/proc/uptime','utf8').split(' ')[0])*1000);
  check(/^[a-f0-9-]{36}$/.test(bootId)&&Number.isSafeInteger(uptimeMs)&&uptimeMs>=0,'SOAK_CLOCK','Invalid boot clock');
  return {bootId,uptimeMs,wallTime:new Date().toISOString()};
}
function regular(path){
  const stat=fs.lstatSync(path);
  check(stat.isFile()&&!stat.isSymbolicLink()&&fs.realpathSync(path)===path,'SOAK_PATH','Exact regular file required');
  return stat;
}
function code(error){return typeof error?.code==='string'&&/^[A-Z0-9_]+$/.test(error.code)?error.code:'SOAK_OBSERVATION';}
const executableStat=stat=>({dev:String(stat.dev),ino:String(stat.ino),size:String(stat.size),mtimeNs:String(stat.mtimeNs),ctimeNs:String(stat.ctimeNs)});
function hashOpenFile(path){
  const fd=fs.openSync(path,'r');
  try{
    const first=fs.fstatSync(fd,{bigint:true});check(first.isFile(),'SOAK_EXECUTABLE','Executable must resolve to a regular file');
    const identity=executableStat(first),hash=createHash('sha256'),buffer=Buffer.allocUnsafe(65536);let bytes=0;
    for(;;){const count=fs.readSync(fd,buffer,0,buffer.length,null);if(!count)break;hash.update(buffer.subarray(0,count));bytes+=count;}
    check(String(bytes)===identity.size&&canonical(executableStat(fs.fstatSync(fd,{bigint:true})))===canonical(identity),
      'SOAK_EXECUTABLE_RACE','Executable bytes/identity changed during read');
    return {identity,hash:hash.digest('hex')};
  }finally{fs.closeSync(fd);}
}
/** Read the kernel's open executable, not a reconstructed pathname. Linux keeps
 * it readable after unlink; identical bytes at a new path are recorded as such,
 * never described as the same inode or a restart. No service mutation. */
export function readLiveExecutable(pid,configuredPath){
  check(Number.isSafeInteger(pid)&&pid>0,'SOAK_PROC','Exact positive process ID required');
  const link='/proc/'+pid+'/exe',livePath=fs.readlinkSync(link),configuredRealPath=fs.realpathSync(configuredPath);
  const live=hashOpenFile(link),configured=hashOpenFile(configuredRealPath);
  check(fs.readlinkSync(link)===livePath&&fs.realpathSync(configuredPath)===configuredRealPath
    &&canonical(executableStat(fs.statSync(configuredRealPath,{bigint:true})))===canonical(configured.identity),
    'SOAK_EXECUTABLE_RACE','Executable path changed during capture');
  check(live.hash===configured.hash&&live.identity.size===configured.identity.size,
    'SOAK_EXECUTABLE','Live and configured executable bytes differ');
  const sameFile=live.identity.dev===configured.identity.dev&&live.identity.ino===configured.identity.ino;
  return {livePath,configuredPath:configuredRealPath,deleted:livePath.endsWith(' (deleted)'),live,configured,
    relation:sameFile?'SAME_FILE':'IDENTICAL_BYTES_DIFFERENT_FILE',
    scope:'Kernel-open file identity and content match only; not loaded-memory integrity, responsiveness or useful-work evidence.'};
}
export function readQueueDatabase(databasePath,pid,previous=null){
  const stat=regular(databasePath),identity={path:databasePath,dev:stat.dev,ino:stat.ino};
  const db=new DatabaseSync(databasePath,{readOnly:true,timeout:5000,allowExtension:false,defensive:true});
  try{
    db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; BEGIN;');
    check(db.prepare('PRAGMA quick_check').all().every(r=>Object.values(r)[0]==='ok'),'SOAK_DATABASE','SQLite structural check failed');
    const store={db,get:Store.prototype.get,list:Store.prototype.list,events:Store.prototype.events};
    const journal=Store.prototype.verifyJournal.call(store);
    const owner=store.get('queue-owner','exclusive')?.data;
    check(owner?.ownerId&&owner.pid===pid,'SOAK_OWNER','Queue owner does not match canonical process');
    const jobs=store.list('queue-job').map(r=>({missionId:r.data.missionId,status:r.data.status,
      desired:r.data.desired,attempts:r.data.attempts,lastCode:r.data.lastCode,updatedAt:r.data.updatedAt}));
    const missions=jobs.map(job=>{const mission=store.get('mission',job.missionId);check(mission,'SOAK_MISSION','Queued mission missing');
      return {id:mission.id,status:mission.data.status,version:mission.version,hash:mission.hash};});
    let predecessor='NOT_CHECKED';
    if(previous){
      if(canonical(previous.identity)!==canonical(identity))predecessor='DATABASE_CHANGED';
      else if(journal.events<previous.journal.events)predecessor='JOURNAL_REWOUND';
      else if(previous.journal.events===0)predecessor='EXTENDS';
      else predecessor=db.prepare('SELECT hash FROM events WHERE seq=?').get(previous.journal.events)?.hash===previous.journal.head?'EXTENDS':'JOURNAL_FORKED';
    }
    db.exec('COMMIT');
    return {identity,journal,predecessor,owner:{pid:owner.pid,epoch:owner.epoch,ownerId:owner.ownerId},jobs,missions};
  }finally{db.close();}
}
function collectObservation(previous){
  const clock=bootClock(),service=inspectUserService();
  check(service.active&&service.managerScopeVerified,'SOAK_SERVICE','Canonical service is not verified running');
  check(service.properties.UnitFileState==='enabled','SOAK_ENABLEMENT','Unit must remain enabled');
  const pid=Number(service.properties.MainPID),processBefore=procIdentity(pid);
  const argv=fs.readFileSync('/proc/'+pid+'/cmdline','utf8').split('\0').filter(Boolean);
  const releaseMatch=argv[1]?.match(new RegExp(`^${regexpEscape(RELEASES)}/([a-f0-9]{64})/factory/bin/sovereign\\.mjs$`));
  check(releaseMatch&&canonical(argv)===canonical([NODE,argv[1],'serve','--state-dir',STATE_DIR]),'SOAK_ARGV','Unexpected service entrypoint');
  const executable=readLiveExecutable(pid,NODE);
  const release=verifyRuntimeRelease(join(RELEASES,releaseMatch[1]),releaseMatch[1]);
  regular(UNIT);regular(WRAPPER);
  const unit=fs.readFileSync(UNIT,'utf8'),wrapper=fs.readFileSync(WRAPPER,'utf8');
  check(wrapper===`#!/bin/sh\nexec ${NODE} ${argv[1]} "$@"\n`,'SOAK_WRAPPER','Wrapper differs from installed live entrypoint');
  check(unit.split('\n').filter(l=>l.startsWith('ExecStart=')).join('\n')===`ExecStart=${argv.join(' ')}`,
    'SOAK_UNIT','Unit file and running entrypoint differ');
  const databasePath=join(STATE_DIR,'state.sqlite'),stat=regular(databasePath);
  const database=readQueueDatabase(databasePath,pid,previous?.observation?.database);
  const after=bootClock(),serviceAfter=inspectUserService(),processAfter=procIdentity(pid);
  check(after.bootId===clock.bootId&&after.uptimeMs>=clock.uptimeMs&&after.uptimeMs-clock.uptimeMs<=SOAK_POLICY.maxCaptureMs,
    'SOAK_CAPTURE_TIME','Capture exceeded bound or boot changed');
  check(serviceAfter.active&&serviceAfter.managerScopeVerified&&serviceAfter.properties.MainPID===String(pid)
    &&serviceAfter.properties.NRestarts===service.properties.NRestarts&&processAfter.startTicks===processBefore.startTicks,
    'SOAK_CAPTURE_RACE','Process changed during capture');
  check(sha256(fs.readFileSync(UNIT))===sha256(unit)&&sha256(fs.readFileSync(WRAPPER))===sha256(wrapper),
    'SOAK_CONFIG_RACE','Entrypoint changed during capture');
  check(regular(databasePath).ino===stat.ino&&regular(databasePath).dev===stat.dev,'SOAK_DATABASE_RACE','Database changed during capture');
  check(canonical(readLiveExecutable(pid,NODE))===canonical(executable),'SOAK_EXECUTABLE_RACE','Executable changed during service capture');
  const ticks=spawnSync('/usr/bin/getconf',['CLK_TCK'],{encoding:'utf8',timeout:5000,maxBuffer:1024});
  const ticksPerSecond=Number(ticks.stdout?.trim());
  check(ticks.status===0&&Number.isSafeInteger(ticksPerSecond)&&ticksPerSecond>0,'SOAK_CLOCK','Kernel tick frequency unavailable');
  return {clock,captureFinishedAt:after.wallTime,captureDurationMs:after.uptimeMs-clock.uptimeMs,
    process:{...processBefore,ticksPerSecond,executableHash:executable.live.hash,executable},service,
    release,unitHash:sha256(unit),wrapperHash:sha256(wrapper),database};
}
export function captureSample(previous=null,{sampleId=id('soak-sample')}={}){
  identifier(sampleId);
  const sample={id:sampleId,capturedAt:new Date().toISOString(),probeHash:null,scope:SCOPE,healthy:false};
  try{
    const probe=probeIdentity();sample.probeHash=probe.hash;sample.probe=probe;
    sample.observation=collectObservation(previous);
    check(canonical(probeIdentity())===canonical(probe),'SOAK_PROBE_CHANGED','Observer dependencies changed during capture');
    sample.healthy=true;
  }
  catch(error){sample.failure={code:code(error)};/* No private diagnostics or credentials in output. */}
  return sample;
}

// A met sampled window is explicitly NOT continuous uptime or useful work proof.
export function evaluateSoak(samples,policy=SOAK_POLICY){
  check(policy.targetMs>0&&policy.maxGapMs>0&&policy.maxClockDriftMs>=0,'SOAK_POLICY','Positive observation bounds required');
  let previous=null,segmentStart=null,currentSegmentMs=0,longestSampledSegmentMs=0,healthySamples=0;
  const incidents=[];
  for(const sample of samples){
    instant(sample.capturedAt);const reasons=[];
    if(!sample.healthy){reasons.push(sample.failure?.code??'SNAPSHOT_FAILED');segmentStart=null;currentSegmentMs=0;}
    else{
      healthySamples++;
      const current=sample.observation;
      check(current?.clock&&Number.isSafeInteger(current.clock.uptimeMs)&&current.clock.uptimeMs>=0,'SOAK_SAMPLE','Missing observed clock');
      if(['JOURNAL_FORKED','JOURNAL_REWOUND','DATABASE_CHANGED'].includes(current.database.predecessor))reasons.push(current.database.predecessor);
      if(previous?.healthy){
        const prior=previous.observation,delta=current.clock.uptimeMs-prior.clock.uptimeMs;
        const wallDelta=instant(current.clock.wallTime)-instant(prior.clock.wallTime);
        if(current.clock.bootId!==prior.clock.bootId)reasons.push('BOOT_CHANGED');
        else{
          if(delta<0)reasons.push('MONOTONIC_ROLLBACK');
          if(delta>policy.maxGapMs)reasons.push('OBSERVATION_GAP');
          if(Math.abs(wallDelta-delta)>policy.maxClockDriftMs)reasons.push('WALL_CLOCK_CHANGED');
        }
        if(current.process.pid!==prior.process.pid||current.process.startTicks!==prior.process.startTicks)reasons.push('PROCESS_CHANGED');
        if(current.service.properties.NRestarts!==prior.service.properties.NRestarts)reasons.push('RESTART_COUNTER_CHANGED');
        if(current.release.releaseId!==prior.release.releaseId)reasons.push('RELEASE_CHANGED');
        if(current.unitHash!==prior.unitHash||current.wrapperHash!==prior.wrapperHash||current.process.executableHash!==prior.process.executableHash)reasons.push('ENTRYPOINT_CHANGED');
        if(sample.probeHash!==previous.probeHash)reasons.push('PROBE_CHANGED');
        if(canonical(current.database.identity)!==canonical(prior.database.identity))reasons.push('DATABASE_CHANGED');
        if(current.database.owner.ownerId!==prior.database.owner.ownerId||current.database.owner.epoch!==prior.database.owner.epoch)reasons.push('QUEUE_OWNER_CHANGED');
      }
      if(reasons.length||!previous?.healthy||segmentStart===null)segmentStart=current.clock.uptimeMs;
      currentSegmentMs=current.clock.uptimeMs-segmentStart;
      longestSampledSegmentMs=Math.max(longestSampledSegmentMs,currentSegmentMs);
    }
    if(reasons.length)incidents.push({sampleId:sample.id,capturedAt:sample.capturedAt,codes:[...new Set(reasons)]});
    previous=sample;
  }
  return {policy,sampleCount:samples.length,healthySamples,failedSnapshots:samples.length-healthySamples,
    firstCapturedAt:samples[0]?.capturedAt??null,lastCapturedAt:previous?.capturedAt??null,
    status:!samples.length?'NOT_STARTED':!previous.healthy?'SNAPSHOT_FAILED':currentSegmentMs>=policy.targetMs?'SAMPLED_WINDOW_MET':'OBSERVING',
    currentSegmentMs,longestSampledSegmentMs,incidents,continuousUptimeProven:false,missionWorkProven:false,
    scope:SCOPE,caveat:'Time before the first sample, gaps and version/process changes never count toward the current sampled window. Live PID does not prove responsiveness, logout survival or 72 hours of agent development.'};
}

export function appendSample(store,sample,policy=SOAK_POLICY){
  return store.transact(()=>{
    const config=store.get('soak-policy','active');
    if(config)check(canonical(config.data)===canonical(policy),'SOAK_POLICY','Do not rewrite the observation policy');
    else store.put('soak-policy','active',policy,{expectedVersion:0});
    const prior=store.get('soak-sample',sample.id);
    if(prior){check(canonical(prior.data)===canonical(sample),'SOAK_CONFLICT','Sample ID already binds different observation');return prior;}
    const record=store.put('soak-sample',sample.id,sample,{expectedVersion:0});
    store.append('soak.observed',{id:record.id,hash:record.hash});return record;
  });
}
export function readSamples(store){
  return store.db.prepare("SELECT json FROM events WHERE kind='soak.observed' ORDER BY seq").all().map(row=>{
    const event=JSON.parse(row.json),record=store.get('soak-sample',event.id,1);
    check(record&&record.hash===event.hash,'SOAK_INTEGRITY','Sample reference does not match journal');return record.data;
  });
}
function run(){
  const [command='report',sampleId,...extra]=process.argv.slice(2);
  check(['checkpoint','report'].includes(command)&&extra.length===0&&(!sampleId||command==='checkpoint'),
    'SOAK_COMMAND','Use checkpoint [sample-id] or report. No runtime or database overrides.');
  if(sampleId)identifier(sampleId);
  if(command==='report'&&!fs.existsSync(SOAK_PATH))return console.log(JSON.stringify(evaluateSoak([]),null,2));
  fs.mkdirSync(dirname(SOAK_PATH),{recursive:true,mode:0o700});
  check(fs.realpathSync(dirname(SOAK_PATH))===dirname(SOAK_PATH),'SOAK_PATH','Observer directory cannot be redirected');
  let store;
  if(command==='report'){
    regular(SOAK_PATH);const db=new DatabaseSync(SOAK_PATH,{readOnly:true,timeout:5000});
    db.exec('PRAGMA query_only=ON; BEGIN;');store={db,get:Store.prototype.get,events:Store.prototype.events,close:()=>db.close()};
  }else store=new Store(SOAK_PATH);
  try{
    const before=Store.prototype.verifyJournal.call(store);
    let samples=readSamples(store),sample;
    if(command==='checkpoint'){
      const existing=sampleId&&store.get('soak-sample',sampleId);
      sample=existing?.data??captureSample(samples.at(-1),sampleId?{sampleId}:{});
      // Concurrent probes must not append observations with a stale predecessor.
      store.transact(()=>{check(Store.prototype.verifyJournal.call(store).head===before.head,'SOAK_CONCURRENT','Another observer committed; retry with a new capture');appendSample(store,sample);});
      samples=readSamples(store);
    }
    console.log(JSON.stringify({path:SOAK_PATH,journal:Store.prototype.verifyJournal.call(store),sample,
      summary:evaluateSoak(samples)},null,2));
    if(sample&&!sample.healthy)process.exitCode=2;
  }finally{store.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{run();}catch(error){console.error(JSON.stringify({code:code(error),scope:SCOPE}));process.exitCode=1;}
}
