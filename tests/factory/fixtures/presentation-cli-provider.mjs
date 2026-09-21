// Test-only preload. Real CLI/SQLite/broker, explicitly simulated inference.
// No production hook, environment option or installed runtime imports this file.
import assert from 'node:assert/strict';
import {CodexProvider} from '../../../factory/providers/codex.mjs';
import {readSourceContextView} from '../../../factory/lib/source-context-view.mjs';
import {inferenceRequestHash} from '../../../factory/providers/instruction-profiles.mjs';
assert.equal(process.env.SOVEREIGN_PRESENTATION_CLI_SIM,'1');
const read=process.env.SOVEREIGN_PRESENTATION_CLI_READ==='1';let calls=0;
CodexProvider.prototype.start=async function(){throw Error('SIM fixture forbids starting any real provider');};
CodexProvider.prototype.close=async function(){return {processExitObserved:true,simulation:true};};
CodexProvider.prototype.generate=async function(request){
  calls++;assert.ok(calls<=(read?3:2),'No extra provider or plan call is authorized by this fixture');
  assert.equal(request.nativeSession,undefined,'Presentation selection must not select native transport');
  const context=readSourceContextView(request.input),task=JSON.parse(context.task),reviewer=Boolean(task.candidateId);
  const own=context.toolObservations.filter(o=>o.relation==='OWN_ACTION');
  if(!read)assert.ok(!JSON.stringify(context).includes('NEVER_READ_PRESENTATION_CLI_5197'));
  const body=read?'{"sum":30}':'Órbita e\u0301 🚀';let value;
  if(reviewer){
    assert.match(request.schema.description,/separate-evidence-v1/);
    assert.equal(own.length,read?1:0);assert.equal(task.criteria.length,3);assert.equal(task.runtimeCriteria.length,4);
    const artifact=context.artifacts.find(a=>a.id===task.candidateId);assert.equal(artifact.payload.body,body);
    const evidence=[{kind:'artifact',id:artifact.id,hash:artifact.hash,quote:artifact.payload.body},
      ...own.map(o=>({kind:'tool',id:o.id,hash:o.hash,quote:o.quoteText}))];
    value={artifactHash:artifact.hash,purpose:artifact.payload.purpose,decision:'ACCEPT',
      checks:task.criteria.map(c=>({criterionId:c.id,verdict:'PASS',evidence,
        reason:'SIM only: 13 plus 17 equals 30, or exact requested Unicode literal; independent public evidence retained outside the closed body.'})),findings:[],uncertainty:'Simulated reviewer; not LIVE semantic qualification.'};
  }else{
    assert.equal(task.node.id,'bounded-read-entry');assert.equal(task.node.outputKind,'bounded-read-response');
    assert.equal(request.schema.properties.claims.maxItems,0);assert.match(request.schema.properties.body.description,/separate-evidence-v1/);
    assert.doesNotMatch(request.instructions,/cite actual input observations faithfully in body/);
    value=read&&!own.length?{action:'tool',tool:'workspace.read',argsJson:'{"path":"input.txt"}',body:'',claims:[],method:'Read supplied integers',reason:''}
      :{action:'final',tool:'',argsJson:'',body,claims:[],method:read?'Add the two supplied integers':'Preserve the exact requested literal',reason:''};
  }
  await request.validate(value);
  process.stderr.write('SIM_PRESENTATION_CALL '+JSON.stringify({call:calls,reviewer,ownReads:own.length,action:value.action??'review',
    missionIntent:context.missionIntent,native:false,body:reviewer?null:value.body})+'\n');
  return {value,receipt:{kind:'inference',simulation:true,status:'completed',threadId:'presentation-cli-sim-'+calls,
    turnId:'sim-turn',contextHash:inferenceRequestHash(request)}};
};
