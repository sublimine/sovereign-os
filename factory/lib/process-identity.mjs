import {readFileSync} from 'node:fs';
import {check,integer} from './contracts.mjs';

// Ownership on one Linux host/PID namespace. Never signal a recorded owner to
// reclaim a lock: only signal zero and read-only kernel identity observations.
export function processIsAlive(pid,{signal=(pid,value)=>process.kill(pid,value)}={}) {
  integer(pid,'pid',{min:1,max:2147483647});
  try{signal(pid,0);return true;}
  catch(error){if(error.code==='ESRCH')return false;if(error.code==='EPERM')return true;throw error;}
}
function boot(read){
  const value=String(read('/proc/sys/kernel/random/boot_id','utf8')).trim();
  check(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value),'PROCESS_IDENTITY','Invalid kernel boot identity');return value;
}
function stat(pid,read){
  const value=String(read('/proc/'+pid+'/stat','utf8')),match=/^(\d+) \(/.exec(value),end=value.lastIndexOf(')');
  check(match&&Number(match[1])===pid&&end>match[0].length,'PROCESS_IDENTITY','Invalid kernel process identity');
  const fields=value.slice(end+1).trim().split(/\s+/);
  check(fields.length>=20&&/^[0-9]{1,24}$/.test(fields[19]),'PROCESS_IDENTITY','Process start ticks unavailable');
  return {startTicks:fields[19],state:fields[0]};
}
export function captureProcessIdentity(pid=process.pid,{read=readFileSync}={}){
  integer(pid,'pid',{min:1,max:2147483647});
  const bootId=boot(read),before=stat(pid,read),after=stat(pid,read);
  check(before.startTicks===after.startTicks&&boot(read)===bootId&&!['Z','X','x'].includes(after.state),
    'PROCESS_IDENTITY','Process exited or changed while capturing identity');
  return {pid,bootId,startTicks:after.startTicks};
}
/** Unknown /proc access or legacy PID-only owners stay busy. Only a positively
 * dead PID, different boot, different start time or zombie proves loss of owner.
 * Elapsed wall time, leases and stopped/slow processes never do. */
export function ownerProcessIsAlive(owner,{read=readFileSync,signal}={}){
  integer(owner?.pid,'owner PID',{min:1,max:2147483647});
  if(!processIsAlive(owner.pid,{signal}))return false;
  if(owner.processIdentity===undefined||owner.processIdentity===null)return true;
  const identity=owner.processIdentity;
  check(identity.pid===owner.pid&&typeof identity.startTicks==='string'&&/^[0-9]{1,24}$/.test(identity.startTicks)
    &&typeof identity.bootId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(identity.bootId),
    'PROCESS_IDENTITY','Stored process identity is invalid; refuse to steal ownership');
  try{
    if(boot(read)!==identity.bootId)return false;
    const current=stat(owner.pid,read);
    return current.startTicks===identity.startTicks&&!['Z','X','x'].includes(current.state);
  }catch{return true;}
}
