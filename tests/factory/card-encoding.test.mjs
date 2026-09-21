import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {compileRoleInstructions,listCapabilities,selectCards} from '../../factory/catalog/index.mjs';
import {compileLearningPrefix} from '../../factory/lib/learning-service.mjs';
import {FactoryEngine} from '../../factory/lib/engine.mjs';
import {WorkerService} from '../../factory/lib/workers.mjs';
import {inferenceRequestHash} from '../../factory/providers/instruction-profiles.mjs';
import {sha256,id} from '../../factory/lib/contracts.mjs';

test('compact cards preserve every field/string/order in all 154 cards, with identical control prose and legacy default',()=>{
  for(const role of listCapabilities())for(const mode of ['producer','reviewer']){
    const ids=[role.id],purpose='Exact purpose with "quotes", newline\n and braces {}';
    const options={purpose,mode},payload={purpose,mode,cards:selectCards(ids)},body=JSON.stringify(payload,null,2),pretty=compileRoleInstructions(ids,options),compact=compileRoleInstructions(ids,{...options,cardEncoding:'compact-json-v1'});
    assert.ok(pretty.endsWith(body));const preamble=pretty.slice(0,-body.length);
    assert.equal(compact,preamble+JSON.stringify(payload));assert.deepEqual(JSON.parse(compact.slice(preamble.length)),JSON.parse(body));assert.equal(compileRoleInstructions(ids,{...options,cardEncoding:'pretty-json'}),pretty);assert.ok(Buffer.byteLength(compact)<Buffer.byteLength(pretty));
  }
});
test('compact representation cannot bypass prior logical byte caps or mutate learned overlays',()=>{
  const options={purpose:'test',mode:'reviewer'},ids=['omega_22','veritas_07'];
  const pretty=compileRoleInstructions(ids,options);
  assert.throws(()=>compileRoleInstructions(ids,{...options,cardEncoding:'compact-json-v1',maxBytes:Buffer.byteLength(pretty)-1}),{code:'CATALOG_BUDGET_EXCEEDED'});
  assert.throws(()=>compileRoleInstructions(ids,{...options,cardEncoding:'invented'}),{code:'CATALOG_ENCODING'});
  const overlays=[{roleId:'omega_22',instructions:'Preserve every exact string:  a\nb  "quoted".'}],full={...options,roleIds:ids,overlays};
  const old=compileLearningPrefix(full),compact=compileLearningPrefix({...full,cardEncoding:'compact-json-v1'});
  const marker='\nAPPROVED SCOPED INSTRUCTION OVERLAYS';assert.equal(compact.slice(compact.indexOf(marker)),old.slice(old.indexOf(marker)));
  assert.throws(()=>compileLearningPrefix({...full,cardEncoding:'compact-json-v1',maxBytes:Buffer.byteLength(old)-1}),{code:'CONTEXT_LIMIT'});
});
test('mission pins card representation, binds actual simulated inference and persists worker instructions across reentry',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'sovereign-card-encoding-')),databasePath=join(directory,'state.sqlite'),workspaceRoot=join(directory,'workspaces');
  let engine=new FactoryEngine({databasePath,workspaceRoot});t.after(()=>{engine.close();rmSync(directory,{recursive:true,force:true});});
  const m=engine.create('Closed simulated transport test.',{preset:'adaptive-v1',allowedTools:[],cardEncoding:'compact-json-v1'});
  assert.equal(m.policy.cardEncoding,'compact-json-v1');assert.equal(m.policySelection.effectivePolicyHash,sha256(m.policy));assert.ok(m.policySelection.explicitOverrides.includes('cardEncoding'));
  let sent=null;
  const workers=new WorkerService({store:engine.store,authority:engine.authority,registry:engine.registry,broker:engine.broker,providerFactory:()=>({async generate(request){sent=request;const value={answer:'recorded'};assert.equal(await request.validate(value),true);return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:id('sim-thread'),turnId:id('sim-turn'),contextHash:inferenceRequestHash(request)}};},async close(){}})});
  const run=workers.createRun({missionId:m.id,nodeId:'n',mode:'producer',purpose:'exact',roleIds:['omega_23']});
  const config=engine.store.get('worker-config',run.id).data;assert.equal(config.compilationScope.cardEncoding,'compact-json-v1');
  assert.equal(config.instructions,compileLearningPrefix({...config.compilationScope}));
  await workers.infer({runId:run.id,instructions:'Return the fixture string.',input:'{}',schema:{type:'object',properties:{answer:{type:'string'}},required:['answer'],additionalProperties:false},validate:v=>v.answer==='recorded'});
  assert.ok(sent.instructions.startsWith(config.instructions));assert.equal(engine.store.get('run',run.id).data.inferenceReceipt.contextHash,inferenceRequestHash(sent));
  engine.close();engine=new FactoryEngine({databasePath,workspaceRoot});assert.deepEqual(engine.store.get('worker-config',run.id).data,config);assert.equal(engine.status(m.id).mission.policy.cardEncoding,'compact-json-v1');
  assert.throws(()=>engine.create('bad',{cardEncoding:'future'}),{code:'POLICY'});assert.equal(engine.create('legacy',{allowedTools:[]}).policy.cardEncoding,undefined);
});
test('CLI stores compact card choice, preserves request idempotency and rejects changing existing mission scope',t=>{
  const directory=mkdtempSync(join(tmpdir(),'sovereign-card-cli-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const cli=resolve('factory/bin/sovereign.mjs'),call=args=>spawnSync(process.execPath,[cli,...args,'--state-dir',directory],{encoding:'utf8',timeout:10000});
  const args=['submit','--text','Controlled CLI fixture; do not start the queue.','--request-id','submission:card-fixture','--card-encoding','compact-json-v1'];
  const first=call(args);assert.equal(first.status,0,first.stderr);const job=JSON.parse(first.stdout);assert.equal(JSON.parse(call(args).stdout).missionId,job.missionId);
  const changed=call([...args.slice(0,-1),'pretty-json']);assert.equal(changed.status,1);assert.match(changed.stderr,/SUBMISSION_CONFLICT/);
  const db=new DatabaseSync(join(directory,'state.sqlite'),{readOnly:true});try{const rows=db.prepare("SELECT r.json FROM records r JOIN heads h ON h.type=r.type AND h.id=r.id AND h.version=r.version WHERE r.type='mission'").all();assert.equal(rows.length,1);assert.equal(JSON.parse(rows[0].json).policy.cardEncoding,'compact-json-v1');}finally{db.close();}
  const resume=call(['resume',job.missionId,'--card-encoding','pretty-json']);assert.equal(resume.status,1);assert.match(resume.stderr,/crear una misión/);
});
