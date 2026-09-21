import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {check} from './contracts.mjs';

// XRDP may export a nested session bus. A persistent user unit belongs to the
// login-managed user bus, not whichever graphical session launched the CLI.
export function userServiceEnvironment(uid=process.getuid(),environment=process.env){
  check(Number.isSafeInteger(uid)&&uid>=0&&uid<4294967295,'SERVICE_UID','Numeric user ID required');
  const runtime='/run/user/'+uid;
  return {...environment,XDG_RUNTIME_DIR:runtime,DBUS_SESSION_BUS_ADDRESS:'unix:path='+runtime+'/bus'};
}
export function canonicalServiceCgroup(uid=process.getuid()){
  userServiceEnvironment(uid,{}); // shared strict numeric UID validation
  return `/user.slice/user-${uid}.slice/user@${uid}.service/app.slice/sovereign-factory.service`;
}
export function isCanonicalServiceProcess(cgroupText,uid=process.getuid()){
  return String(cgroupText).split('\n').find(line=>line.startsWith('0::'))?.slice(3)===canonicalServiceCgroup(uid);
}

/** Read-only Linux/systemd snapshot; never starts or repairs a service. */
export function inspectUserService({uid=process.getuid(),environment=process.env,execute=spawnSync,read=readFileSync}={}){
  const env=userServiceEnvironment(uid,environment),unit='sovereign-factory.service';
  const expectedControlGroup=canonicalServiceCgroup(uid);
  const caveat='Snapshot of the canonical user manager and process cgroup; not an uptime, logout, reboot or mission-completion test.';
  const result=execute('/usr/bin/systemctl',['--user','show',unit,'--property=LoadState,ActiveState,SubState,MainPID,ControlGroup,UnitFileState,NRestarts'],
    {env,encoding:'utf8',timeout:10000,maxBuffer:65536});
  const base={unit,bus:env.DBUS_SESSION_BUS_ADDRESS,expectedControlGroup,caveat};
  if(result.error||result.status!==0)return {...base,available:false,active:false,managerScopeVerified:false,code:'SERVICE_QUERY'};
  const properties=Object.fromEntries(result.stdout.trim().split('\n').filter(line=>line.includes('=')).map(line=>{
    const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];
  }));
  const pid=Number(properties.MainPID),active=properties.ActiveState==='active'&&properties.SubState==='running';
  let processControlGroup=null;
  if(active&&Number.isSafeInteger(pid)&&pid>0){
    try{processControlGroup=String(read('/proc/'+pid+'/cgroup','utf8')).split('\n').find(line=>line.startsWith('0::'))?.slice(3)??null;}catch{}
  }
  return {...base,available:true,properties,active,
    managerScopeVerified:active&&properties.ControlGroup===expectedControlGroup&&processControlGroup===expectedControlGroup,
    processControlGroup};
}
