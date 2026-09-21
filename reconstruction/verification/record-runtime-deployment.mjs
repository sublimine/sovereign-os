import * as fs from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {verifyRuntimeRelease} from '../../factory/lib/runtime-release.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';
import {userServiceEnvironment,inspectUserService} from '../../factory/lib/service-status.mjs';
import {assertPassingRegression} from './regression-disposition.mjs';
const [directory,suitePath,output]=process.argv.slice(2);
if(!directory||!suitePath||!output)throw Error('Exact release directory, passing suite summary and new output path required');
const release=verifyRuntimeRelease(directory),manifest=JSON.parse(fs.readFileSync(join(directory,'RELEASE.json'),'utf8'));
const suite=JSON.parse(fs.readFileSync(suitePath,'utf8'));
assertPassingRegression(suite);
const tested=Object.entries(suite.inputs).filter(([path])=>path.startsWith('factory/'));
for(const [path,hash]of tested)if(manifest.files.find(f=>f.path===path)?.sha256!==hash)throw Error('Packaged runtime differs from tested cut: '+path);
for(const file of manifest.files.filter(f=>f.path.startsWith('factory/')&&/\.(mjs|py|json)$/.test(f.path)))
  if(!tested.some(([path])=>path===file.path))throw Error('Untested runtime code: '+file.path);
const command=(binary,args)=>{const r=spawnSync(binary,args,{env:userServiceEnvironment(),encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});if(r.status!==0)throw Error('Verification command failed: '+binary);return r.stdout;};
const cli=join(directory,'factory/bin/sovereign.mjs');
const roles=JSON.parse(command(process.execPath,[cli,'roles'])),queue=JSON.parse(command(process.execPath,[cli,'queue']));
if(roles.length!==154||queue.some(j=>j.status==='RUNNING'))throw Error('Require full role catalog and idle queue at activation proof');
const unitPath='/home/cardeex/.config/systemd/user/sovereign-factory.service';
const unit=fs.readFileSync(unitPath,'utf8'),wrapper=fs.readFileSync('/home/cardeex/.local/bin/sovereign','utf8');
if(!unit.includes(cli)||!wrapper.includes(cli))throw Error('Installed entrypoints do not reference this version');
const condition=join(directory,'factory/bin/check-service-scope.mjs');
if(!unit.includes('ExecCondition='+process.execPath+' '+condition))throw Error('Exact packaged user-manager startup guard required');
const service=command('systemctl',['--user','show','sovereign-factory.service','-p','MainPID','-p','ActiveState','-p','SubState','-p','UnitFileState','-p','NRestarts']);
if(!service.includes('ActiveState=active')||!service.includes('UnitFileState=enabled'))throw Error('Installed service inactive');
const manager=inspectUserService();
if(!manager.managerScopeVerified)throw Error('Service is not observed in the canonical persistent user manager');
const pid=Number(service.match(/^MainPID=(\d+)$/m)?.[1]);
if(!pid)throw Error('No running process');
const processArgv=fs.readFileSync('/proc/'+pid+'/cmdline','utf8').split('\0').filter(Boolean);
if(!processArgv.includes(cli)||!processArgv.includes('serve'))throw Error('Running process uses another runtime');
const linger=command('loginctl',['show-user','cardeex','-p','Linger','-p','State']);
const result={capturedAt:new Date().toISOString(),scope:'Installed local versioned runtime and idle service check. Not a full factory completion, uptime, security or quality certificate.',
  release,suite:{path:resolve(suitePath),sha256:sha256(fs.readFileSync(suitePath)),counts:suite.counts,testedRuntimeFiles:tested.length},
  fullRoleCount:roles.length,service,manager,processArgv,linger,unitSha256:sha256(unit),wrapperSha256:sha256(wrapper),queue};
fs.writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
process.stdout.write(JSON.stringify({output,releaseId:release.releaseId,roleCount:roles.length,mainPID:pid,verified:true})+'\n');
