// Read-only service diagnostics; output is a new evidence file, never replaced.
import * as fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {inspectUserService} from '../../factory/lib/service-status.mjs';
const output=process.argv[2];
if(process.argv.length!==3||!output)throw Error('New evidence output path required');
const response=spawnSync('/usr/bin/systemctl',['--user','show','sovereign-factory.service','--property=MainPID,ControlGroup,ActiveState,SubState,UnitFileState,Result,ExecCondition'],{encoding:'utf8',timeout:10000});
if(response.status!==0)throw Error('Ambient manager unavailable');
const pid=Number(response.stdout.match(/^MainPID=(\d+)$/m)?.[1]);
const ambient={bus:process.env.DBUS_SESSION_BUS_ADDRESS,runtimeDirectory:process.env.XDG_RUNTIME_DIR,service:response.stdout,
  processCgroup:pid?fs.readFileSync('/proc/'+pid+'/cgroup','utf8'):null};
const result={capturedAt:new Date().toISOString(),scope:'Two read-only user-manager snapshots; no logout, reboot or uptime qualification.',ambient,canonical:inspectUserService()};
fs.writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
process.stdout.write(JSON.stringify({output,...result})+'\n');
