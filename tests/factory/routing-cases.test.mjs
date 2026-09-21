import test from 'node:test';
import assert from 'node:assert/strict';
import {ROUTING_CASES,gradeRouting} from '../../reconstruction/verification/routing-cases.mjs';
const node=(id='final',dependencies=[])=>({id,purpose:id,roleIds:['omega_02'],reviewerRoleIds:['omega_22'],dependencies,tools:[],requiredEffects:[],method:{id:'test',rationale:'synthetic oracle fixture',alternatives:[]},specialist:null});
const plan=c=>({requirements:[{requestQuote:c.request}],nodes:[node()],finalNodeId:'final'});
test('routing gold is fixed before dispatch with every critical clause in its original request',()=>{
  assert.equal(ROUTING_CASES.length,4);
  assert.equal(new Set(ROUTING_CASES.map(c=>c.id)).size,4);
  for(const c of ROUTING_CASES)for(const q of c.criticalQuotes)assert.ok(c.request.includes(q),q);
});
test('small request oracle detects ceremonial stages, unauthorized tools and missing critical constraints',()=>{
  const c=ROUTING_CASES[0];assert.equal(gradeRouting(c,plan(c)).passed,true);
  const extra=plan(c);extra.nodes.push(node('repeat'));assert.equal(gradeRouting(c,extra).checks.proportionalProductCount,false);
  const unsafe=plan(c);unsafe.nodes[0].tools=['source.fetch'];assert.equal(gradeRouting(c,unsafe).checks.authorityPreserved,false);
  const omit=plan(c);omit.requirements=[{requestQuote:'Calcula la media aritmética de 12, 7 y 5'}];
  assert.equal(gradeRouting(c,omit).uncoveredQuotes.length,3);assert.equal(gradeRouting(c,null).passed,false);
});
test('source question requires a fetch plan; file/code obligations cannot be replaced by prose',()=>{
  const source=ROUTING_CASES[1],sp=plan(source);assert.equal(gradeRouting(source,sp).passed,false);
  sp.nodes[0].tools=['source.fetch'];assert.equal(gradeRouting(source,sp).passed,true);
  const c=ROUTING_CASES[2],p=plan(c);assert.equal(gradeRouting(c,p).passed,false);
  p.nodes[0].requiredEffects=[...c.gold.files.map(path=>({type:'file',path,command:'',expectedExit:null})),
    {type:'execution',path:'.',command:JSON.stringify(c.gold.execution),expectedExit:0}];
  p.nodes[0].tools=[...c.allowedTools];assert.equal(gradeRouting(c,p).passed,true);
  p.nodes[0].requiredEffects.at(-1).command='["true"]';assert.equal(gradeRouting(c,p).checks.exactRequiredExecution,false);
});
test('blind specification/scenario products need different upstream roots, not an arbitrary serial three-node chain',()=>{
  const c=ROUTING_CASES[3],p=plan(c);
  p.nodes=[node('spec'),node('counter'),node('final',[{nodeId:'spec',purpose:'spec',reason:'compare'},{nodeId:'counter',purpose:'counter',reason:'compare'}])];
  assert.equal(gradeRouting(c,p).passed,true);
  p.nodes[1].dependencies=[{nodeId:'spec',purpose:'spec',reason:'contaminated'}];
  assert.equal(gradeRouting(c,p).checks.distinctBlindUpstreamProducts,false);
});
