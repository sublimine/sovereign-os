import test from 'node:test';
import assert from 'node:assert/strict';
import {userServiceEnvironment,inspectUserService,isCanonicalServiceProcess} from '../../factory/lib/service-status.mjs';

test('canonical user bus does not inherit the graphical-session bus; other environment is preserved',()=>{
  const input={XDG_RUNTIME_DIR:'/run/user/1001/systemd-session-11',DBUS_SESSION_BUS_ADDRESS:'unix:path=/run/user/1001/systemd-session-11/bus',LANG:'es_ES.UTF-8'};
  assert.deepEqual(userServiceEnvironment(1001,input),{...input,XDG_RUNTIME_DIR:'/run/user/1001',DBUS_SESSION_BUS_ADDRESS:'unix:path=/run/user/1001/bus'});
  assert.equal(input.XDG_RUNTIME_DIR,'/run/user/1001/systemd-session-11');
  for(const uid of [-1,1.5,'1001',NaN,4294967295])assert.throws(()=>userServiceEnvironment(uid,{}),{code:'SERVICE_UID'});
});

test('synthetic service snapshots require both canonical manager cgroup and observed process membership',()=>{
  const group='/user.slice/user-1001.slice/user@1001.service/app.slice/sovereign-factory.service';
  const nested='/user.slice/user-1001.slice/user@1001.service/app.slice/systemd-session@11.service/app.slice/sovereign-factory.service';
  for(const [unitGroup,processGroup,expected]of [[group,group,true],[nested,nested,false],[group,nested,false],[group,null,false]]){
    const result=inspectUserService({uid:1001,environment:{},execute:(binary,args,options)=>{
      assert.equal(binary,'/usr/bin/systemctl');assert.deepEqual(args.slice(0,3),['--user','show','sovereign-factory.service']);
      assert.equal(options.env.DBUS_SESSION_BUS_ADDRESS,'unix:path=/run/user/1001/bus');
      return {status:0,stdout:`ActiveState=active\nSubState=running\nMainPID=77\nControlGroup=${unitGroup}\n`};
    },read:path=>{assert.equal(path,'/proc/77/cgroup');if(processGroup===null)throw Error('Process exited');return '0::'+processGroup+'\n';}});
    assert.equal(result.active,true);assert.equal(result.managerScopeVerified,expected);
  }
});

test('missing, failed and inactive user services are not described as running',()=>{
  for(const response of [{status:1,stdout:'',stderr:'private diagnostic'},{error:Error('unavailable')},{status:0,stdout:'ActiveState=inactive\nSubState=dead\nMainPID=0\n'}]){
    const result=inspectUserService({uid:1001,environment:{},execute:()=>response,read:()=>assert.fail('No inactive PID read')});
    assert.equal(result.active,false);assert.equal(result.managerScopeVerified,false);
    assert.ok(!JSON.stringify(result).includes('private diagnostic'));
  }
});
test('service startup guard binds actual cgroup, not forged runtime environment or another unit/user',()=>{
  const group='/user.slice/user-1001.slice/user@1001.service/app.slice/sovereign-factory.service';
  assert.equal(isCanonicalServiceProcess('0::'+group+'\n',1001),true);
  for(const path of [group+'/child',group.replace('app.slice/','app.slice/systemd-session@11.service/app.slice/'),group.replace('sovereign-factory','other'),group.replaceAll('1001','1002'),'/'])
    assert.equal(isCanonicalServiceProcess('0::'+path+'\n',1001),false);
  assert.equal(isCanonicalServiceProcess('malformed',1001),false);
  assert.equal(isCanonicalServiceProcess('1:cpu:'+group,1001),false);
});
