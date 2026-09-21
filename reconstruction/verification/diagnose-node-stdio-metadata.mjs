// Fixed, synthetic diagnostic. No model, network connection, permissions change
// or inference qualification. Preserve raw observations before interpreting them.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join, resolve} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {sha256} from '../../factory/lib/contracts.mjs';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {captureProcessIdentity} from '../../factory/lib/process-identity.mjs';

export const SYSCALL_PROBE = `import ctypes, errno, json, os, stat, sys
libc=ctypes.CDLL(None, use_errno=True)
libc.getsockname.argtypes=[ctypes.c_int, ctypes.c_void_p, ctypes.POINTER(ctypes.c_uint)]
libc.getsockname.restype=ctypes.c_int
libc.getsockopt.argtypes=[ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_void_p, ctypes.POINTER(ctypes.c_uint)]
libc.getsockopt.restype=ctypes.c_int
rows=[]
for fd in (1,2):
 mode=os.fstat(fd).st_mode
 address=ctypes.create_string_buffer(256); length=ctypes.c_uint(256)
 ctypes.set_errno(0); name_rc=libc.getsockname(fd,address,ctypes.byref(length)); name_errno=ctypes.get_errno()
 kind=ctypes.c_int(-1); size=ctypes.c_uint(ctypes.sizeof(kind))
 ctypes.set_errno(0); opt_rc=libc.getsockopt(fd,1,3,ctypes.byref(kind),ctypes.byref(size)); opt_errno=ctypes.get_errno()
 rows.append({'fd':fd,'socket':stat.S_ISSOCK(mode),'fifo':stat.S_ISFIFO(mode),
  'getsockname':{'return':name_rc,'errno':name_errno,'error':errno.errorcode.get(name_errno),'length':length.value},
  'getsockopt':{'return':opt_rc,'errno':opt_errno,'error':errno.errorcode.get(opt_errno),'soType':kind.value if opt_rc==0 else None}})
os.write(1,('SYSCALLS:'+json.dumps({'boundary':sys.argv[1],'rows':rows},separators=(',',':'))+'\\n').encode())
`;

const inspection = boundary => `
const boundary=${JSON.stringify(boundary)};
writeSync(1,'NODE_FDS:'+JSON.stringify({boundary,node:process.versions.node,uv:process.versions.uv,fds:[1,2].map(fd=>{const s=fstatSync(fd),stream=fd===1?process.stdout:process.stderr;return {fd,socket:s.isSocket(),fifo:s.isFIFO(),constructor:stream.constructor.name,type:stream._type??null};})})+'\\n');
const probe=spawnSync('/usr/bin/python3',['-I','-c',${JSON.stringify(SYSCALL_PROBE)},boundary],{stdio:['ignore',1,2],timeout:5000});
if(probe.status!==0||probe.error)throw Error('SYSCALL_PROBE_FAILED');
process.stdout.write('STREAM_'+boundary+'\\n',()=>writeSync(1,'CALLBACK_'+boundary+'\\n'));
`;
const imports = "import {spawnSync} from 'node:child_process';import {writeSync,fstatSync} from 'node:fs';\n";
const descendant = imports + inspection('CHILD');
export const STDIO_FIXTURE = imports + inspection('ROOT') + `
const child=spawnSync(process.execPath,['--input-type=module','-e',${JSON.stringify(descendant)}],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000,maxBuffer:65536});
writeSync(1,child.stdout??'');writeSync(2,child.stderr??'');
if(child.status!==0||child.error)throw Error('DESCENDANT_PROBE_FAILED');
`;
const HOST_PIPE_DRIVER = `import os,subprocess,sys
r=subprocess.run([sys.argv[1],'--input-type=module','-e',sys.argv[2]],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=15,env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8'})
os.write(1,r.stdout);os.write(2,r.stderr);sys.exit(r.returncode)
`;
export function observations(stdout) {
  const jsonLines = prefix => stdout.split('\n').filter(s => s.startsWith(prefix)).map(s => JSON.parse(s.slice(prefix.length)));
  return {fds:jsonLines('NODE_FDS:'),syscalls:jsonLines('SYSCALLS:'),markers:Object.fromEntries(
    ['STREAM_ROOT','CALLBACK_ROOT','STREAM_CHILD','CALLBACK_CHILD'].map(s=>[s,stdout.split('\n').includes(s)]))};
}
export async function diagnoseNodeStdioMetadata(directory,runtimeRoot) {
  if (!directory || !runtimeRoot || fs.readdirSync(directory).length) throw Error('Fresh empty diagnostic directory required');
  process.umask(0o077);
  const release=verifyRuntimeRelease(runtimeRoot), files=[{path:'probe.mjs',content:STDIO_FIXTURE,sha256:sha256(STDIO_FIXTURE)}];
  const manifest=files.map(f=>({type:'file',path:f.path,bytes:Buffer.byteLength(f.content),sha256:f.sha256}));
  const snapshot={files,manifest,hash:sha256(manifest)},args={argv:['node','probe.mjs'],cwd:'.'};
  const write=(name,value)=>fs.writeFileSync(join(directory,name),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
  write('qualification.json',{startedAt:new Date().toISOString(),owner:captureProcessIdentity(),release,snapshot,args,
    harnessSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),hostPipeDriver:HOST_PIPE_DRIVER,
    expected:{outsideRoot:'FIFO; getsockname/getsockopt ENOTSOCK; stream emitted',outsideChild:'SOCKET; metadata queries succeed; stream emitted',
      nativeRoot:'FIFO; metadata may be EPERM under seccomp; stream emitted via FIFO classification',nativeChild:'SOCKET; metadata EPERM; stream absent but callback present'},
    scope:'Preregistered observation, not a solution or general test-suite proof. Existing fd1/2 metadata only. No new network connection, permissions change, model or ordinary mission. Preserve deviations.'});
  const host=spawnSync('/usr/bin/python3',['-I','-c',HOST_PIPE_DRIVER,process.execPath,STDIO_FIXTURE],
    {encoding:'utf8',env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'},timeout:20000,maxBuffer:128*1024});
  const hostResult={exitCode:host.status,signal:host.signal,errorCode:host.error?.code??null,stdout:host.stdout??'',stderr:host.stderr??''};
  write('host.json',hostResult);
  const {IsolatedExecutionRunner}=await import(pathToFileURL(join(runtimeRoot,'factory/tools/execution.mjs')));
  const runner=new IsolatedExecutionRunner();let nativeResult,nativeError=null;
  try {nativeResult=await runner.run({args,snapshot,onCreated:job=>write('job.json',job)});write('native.json',nativeResult);}
  catch(error){nativeError={code:error.code??'UNKNOWN',message:error.message,details:error.details??null};write('native-error.json',nativeError);}
  const result={completedAt:new Date().toISOString(),releaseVerified:verifyRuntimeRelease(runtimeRoot).releaseId===release.releaseId,
    host:{exitCode:hostResult.exitCode,errorCode:hostResult.errorCode,...observations(hostResult.stdout)},
    native:nativeResult?{exitCode:nativeResult.exitCode,outputTruncated:nativeResult.outputTruncated,
      processesTerminated:nativeResult.isolation.processesTerminated,scratchRemoved:nativeResult.isolation.scratchRemoved,
      ...observations(nativeResult.stdout)}:null,nativeError,scope:'Synthetic diagnostic only; interpretation requires review, no automatic release promotion.'};
  write('summary.json',result);return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=await diagnoseNodeStdioMetadata(...process.argv.slice(2));process.stdout.write(JSON.stringify(result)+'\n');
  if(result.host.exitCode!==0||result.native?.exitCode!==0)process.exitCode=2;
}
