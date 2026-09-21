import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicSearch,discoveryUrl} from '../../factory/providers/public-search.mjs';
function setup({value={candidates:[{title:'Original source',url:'https://example.com/p#section'}]},observations=[{id:'search1',query:'example original',actionType:'search'}],toolPolicy='public-search-v1',exit=true,error=null,directWebOnly=true,receiptTarget=null}={}){
  const state={calls:0,closed:0};
  const search=new PublicSearch({providerFactory:()=>({async publicSearchConfiguration(){return {webSearch:'live',standaloneWebSearch:true,codeModeDisabled:true,codeModeHostDisabled:true,directWebOnly,capabilities:{webSearch:true,namespaceTools:true}};},async generate(request){state.calls++;state.request=request;if(error)throw error;await request.validate(value);
    return {value,receipt:{simulation:true,toolPolicy,model:receiptTarget?.model??request.model,reasoningEffort:receiptTarget?.reasoningEffort??request.reasoningEffort,completedAt:'2026-09-09T16:00:00Z'},searchObservations:observations};},async close(){state.closed++;return {processExitObserved:exit};}})});
  return {search,state};
}
test('SIMULATED search: real query requirement, exact query exposure, unverified candidates, confirmed cleanup',async()=>{
  const s=setup(),args={query:'example original',limit:3},r=await s.search.search(args);
  assert.equal(s.state.request.input,JSON.stringify(args));assert.equal(s.state.request.instructionProfile,'public-search-v1');
  assert.equal(r.candidates[0].url,'https://example.com/p');assert.equal(r.candidates[0].evidenceStatus,'UNVERIFIED_DISCOVERY_CANDIDATE');assert.equal(s.state.closed,1);
  assert.equal(r.content,undefined);assert.equal(r.sources,undefined);
});
test('SIMULATED search: a broker-supplied sealed target overrides defaults and is receipt-attested',async()=>{
  const s=setup(),target={model:'gpt-5.6-terra',reasoningEffort:'ultra'};
  await s.search.search({query:'official public source',limit:1},{target});
  assert.equal(s.state.request.model,target.model);assert.equal(s.state.request.reasoningEffort,target.reasoningEffort);
  const misattested=setup({receiptTarget:{model:'gpt-6-astra',reasoningEffort:'max'}});
  await assert.rejects(misattested.search.search({query:'official public source',limit:1},{target}),{code:'SEARCH_TARGET'});
});
test('SIMULATED search: a historic null target uses the configured fallback rather than weakening a supplied target check',async()=>{
  const s=setup();
  await s.search.search({query:'official public source',limit:1},{target:null});
  assert.equal(s.state.request.model,s.search.model);
  assert.equal(s.state.request.reasoningEffort,s.search.reasoningEffort);
});
test('SIMULATED search: effective boolean CLI override cannot silently erase the direct-web namespace policy',async()=>{
  const s=setup({directWebOnly:false});await assert.rejects(s.search.search({query:'original',limit:1}),{code:'CAPABILITY'});
  assert.equal(s.state.calls,0);assert.equal(s.state.closed,1);
});
test('SIMULATED search: model URLs alone cannot fabricate an observed search',async()=>{
  const s=setup({observations:[]});await assert.rejects(s.search.search({query:'original',limit:1}),{code:'SEARCH_UNOBSERVED'});assert.equal(s.state.closed,1);
});
test('SIMULATED search: cleanup, provider failure and tool policy are enforced',async()=>{
  for(const [options,code]of [[{exit:false},'CLEANUP_UNCONFIRMED'],[{toolPolicy:'other'},'SEARCH_UNOBSERVED'],[{error:Object.assign(Error('quota'),{code:'QUOTA'})},'QUOTA']]){
    const s=setup(options);await assert.rejects(s.search.search({query:'original',limit:1}),{code});assert.equal(s.state.closed,1);
  }
});
test('Discovery rejects local endpoints, credentials, nonstandard ports and executable URLs without fetching them',()=>{
  for(const url of ['http://localhost','http://127.0.0.1','http://169.254.169.254','http://host.internal','https://user:pass@example.com','https://example.com:8443','file:///etc/passwd','javascript:alert(1)'])assert.throws(()=>discoveryUrl(url));
  assert.equal(discoveryUrl('https://example.com/a#b'),'https://example.com/a');
});
test('SIMULATED search: bad or overlarge queries rejected before provider creation; duplicate candidate URLs deduplicated',async()=>{
  const s=setup({value:{candidates:[{title:'one',url:'https://example.com'},{title:'two',url:'https://example.com/#x'}]}});
  for(const args of [{query:'',limit:1},{query:'x'.repeat(2001),limit:1},{query:'x',limit:11},{query:'x',limit:1,secret:'unrequested'}])await assert.rejects(s.search.search(args));
  assert.equal(s.state.calls,0);const r=await s.search.search({query:'original',limit:2});assert.equal(r.candidates.length,1);
});
