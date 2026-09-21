import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {compileLearningPrefix} from '../../factory/lib/learning-service.mjs';

test('producer node-view policy is persisted by real CLI, idempotent and never retroactively applied on resume',t=>{
  const directory=mkdtempSync(join(tmpdir(),'sovereign-plan-view-cli-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const cli=resolve('factory/bin/sovereign.mjs'),call=args=>spawnSync(process.execPath,[cli,...args,'--state-dir',directory],{encoding:'utf8',timeout:10000});
  const args=['submit','--text','Closed queue fixture; never start this mission.','--request-id','submission:plan-view-fixture','--preset','adaptive-v1','--producer-context','node-contract-v1'];
  const first=call(args);assert.equal(first.status,0,first.stderr);const job=JSON.parse(first.stdout);
  assert.equal(JSON.parse(call(args).stdout).missionId,job.missionId);
  const changed=call([...args.slice(0,-1),'full-plan']);assert.equal(changed.status,1);assert.match(changed.stderr,/SUBMISSION_CONFLICT/);
  const db=new DatabaseSync(join(directory,'state.sqlite'),{readOnly:true});try{
    const rows=db.prepare("SELECT r.json FROM records r JOIN heads h ON h.type=r.type AND h.id=r.id AND h.version=r.version WHERE r.type='mission'").all();
    assert.equal(rows.length,1);const m=JSON.parse(rows[0].json);assert.equal(m.policy.producerContext,'node-contract-v1');
    assert.ok(m.policySelection.explicitOverrides.includes('producerContext'));
  }finally{db.close();}
  const resume=call(['resume',job.missionId,'--producer-context','full-plan']);assert.equal(resume.status,1);assert.match(resume.stderr,/crear una misión/);
  for(const value of ['','future']){const r=call(['submit','--text','bad policy','--producer-context',value]);assert.equal(r.status,1);assert.match(r.stderr,/POLICY/);}
});
test('node-view control prose is an explicit producer-only prefix option, not silently added to legacy or reviewer instructions',()=>{
  const scope={roleIds:['omega_23'],purpose:'fixture',mode:'producer'},plain=compileLearningPrefix(scope),explicit=compileLearningPrefix({...scope,producerContext:'full-plan'});
  assert.equal(plain,explicit);assert.ok(compileLearningPrefix({...scope,producerContext:'node-contract-v1'}).startsWith(plain));
  assert.throws(()=>compileLearningPrefix({...scope,mode:'reviewer',producerContext:'node-contract-v1'}),{code:'CONFIG'});
  assert.throws(()=>compileLearningPrefix({...scope,producerContext:'future'}),{code:'CONFIG'});
});
