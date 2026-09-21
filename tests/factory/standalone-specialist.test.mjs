import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePlan} from '../../factory/lib/plans.mjs';
import {assertPlanRoleExecution,assertRoleExecution} from '../../factory/lib/role-execution.mjs';
import {compileStandaloneSpecialistPrefix} from '../../factory/lib/standalone-specialist.mjs';
import {validateSpecialistCharter} from '../../factory/lib/specialist-charter.mjs';
import {WORKER_CONTROL} from '../../factory/lib/learning-service.mjs';

const charter=()=>({question:'Derive the finite specified result.',methods:['Exhaust all supplied cases.'],falsifier:'An omitted valid case.',expectedBenefit:'Supply the missing derivation method.',completion:'Exact candidate and public completeness proof.'});
function plan(){const criteria=[{id:'result',text:'Derive the result.'}];return {requirements:[{id:'r',text:'Derive the result.',requestQuote:'Derive the result.',criteria}],nodes:[{id:'derive',title:'Derive',purpose:'derive',roleIds:[],reviewerRoleIds:['omega_22'],requirementIds:['r'],dependencies:[],method:{id:'enumerate',rationale:'Finite coverage',alternatives:['Structural proof']},instructions:'Derive the result.',outputKind:'result',criteria,requiredEffects:[],tools:[],specialist:charter()}],finalNodeId:'derive',routingRationale:'One requested material product and independent acceptance.'};}
test('standalone plan is structurally valid only with a complete charter and independent catalog reviewer',()=>{
  const p=plan();assert.equal(validatePlan(p,'Derive the result.',{allowedTools:[]}).valid,true);assert.doesNotThrow(()=>assertPlanRoleExecution(p));
  const none=plan();none.nodes[0].specialist=null;assert.throws(()=>validatePlan(none,'Derive the result.'),{code:'SPECIALIST_BINDING'});
  const reviewer=plan();reviewer.nodes[0].reviewerRoleIds=[];assert.throws(()=>validatePlan(reviewer,'Derive the result.'));
  const blind=plan();blind.nodes[0].reviewerRoleIds=['veritas_04'];assert.throws(()=>assertPlanRoleExecution(blind),{code:'ROLE_EXECUTION_UNSUPPORTED'});
  const borrowed=plan();borrowed.nodes[0].roleIds=['omega_09'];assert.throws(()=>assertPlanRoleExecution(borrowed),{code:'ROLE_EXECUTION_UNSUPPORTED'});
  assert.throws(()=>assertRoleExecution([],'producer'),'Ordinary admission still rejects unbound empty roles');
  for(const changed of [{...charter(),methods:[]},{...charter(),falsifier:''},{...charter(),authority:'ALL'}])assert.throws(()=>validateSpecialistCharter(changed));
});
test('standalone prefix keeps full charter, control and context decoders, and cannot use compression to bypass its logical ceiling',()=>{
  const b={schema:'sovereign.standalone-specialist.v1',missionId:'mission:unit',nodeId:'derive',purpose:'derive',planArtifactId:'artifact:unit',planArtifactHash:'a'.repeat(64),nodeHash:'b'.repeat(64),charter:charter(),scope:'Unit fixture, not an accepted live plan.'};
  const options={purpose:'derive',mode:'producer',producerContext:'node-contract-v1',contextEncoding:'lossless-json-v2'};
  const before=JSON.stringify(b),pretty=compileStandaloneSpecialistPrefix(b,options),compact=compileStandaloneSpecialistPrefix(b,{...options,cardEncoding:'compact-json-v1'});
  assert.ok(pretty.includes(JSON.stringify(b,null,2)));assert.ok(compact.includes(JSON.stringify(b)));
  assert.ok(compact.includes(WORKER_CONTROL));assert.match(compact,/planViews/);
  assert.equal(JSON.stringify(b),before);assert.ok(Buffer.byteLength(compact)<Buffer.byteLength(pretty));
  assert.throws(()=>compileStandaloneSpecialistPrefix(b,{...options,cardEncoding:'compact-json-v1',maxBytes:Buffer.byteLength(pretty)-1}),{code:'CONTEXT_LIMIT'});
  assert.throws(()=>compileStandaloneSpecialistPrefix(b,{...options,purpose:'different'}),{code:'SPECIALIST_BINDING'});
  assert.throws(()=>compileStandaloneSpecialistPrefix(b,{...options,mode:'reviewer'}),{code:'SPECIALIST_BINDING'});
  assert.throws(()=>compileStandaloneSpecialistPrefix(b,{...options,contextEncoding:'unknown'}),{code:'CONFIG'});
  const literal=compileStandaloneSpecialistPrefix(b,{...options,contextEncoding:'source-text-v1'});
  assert.ok(literal.includes('sovereign.source-context-view.v1'));assert.ok(literal.includes('sovereign.lossless-context.v2'));
  assert.ok(literal.includes(JSON.stringify(b,null,2)));assert.notEqual(literal,pretty);
});
