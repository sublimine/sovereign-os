import test from 'node:test';
import assert from 'node:assert/strict';
import {exactHistoricalGates} from '../../reconstruction/verification/recovery-gates.mjs';
const refs=[{artifactId:'a',hash:'a'.repeat(64),purpose:'first'},{artifactId:'b',hash:'b'.repeat(64),purpose:'second'},{artifactId:'p',hash:'c'.repeat(64),purpose:'plan'}];
const gates=()=>({firstProducerSequence:30,dependencies:refs.map(input=>({input,payloadBindingMatches:true,acceptedBeforeFirstAttempt:true,acceptanceSequence:20,
  review:{decision:'ACCEPT',committedSequence:19,completePassingChecks:true,separateCompletedReviewerExposure:true}}))});
test('qualification recognizes two material parents plus their exact accepted plan without inventing a third material product',()=>{
  assert.equal(exactHistoricalGates(gates(),refs),true);
  assert.equal(exactHistoricalGates(gates(),refs.slice(0,2)),false,'Unspecified extra inputs are not silently accepted');
  const missing=gates();missing.dependencies.pop();assert.equal(exactHistoricalGates(missing,refs),false);
});
test('qualification rejects wrong versions, purposes, duplicate inputs and late or incomplete acceptance',()=>{
  for(const mutate of [g=>{g.dependencies[0].input={...refs[0],hash:'d'.repeat(64)};},g=>{g.dependencies[0].input={...refs[0],purpose:'wrong'};},
    g=>{g.dependencies[2].input=refs[0];},g=>{g.dependencies[0].acceptanceSequence=31;},g=>{g.dependencies[0].review.completePassingChecks=false;},
    g=>{g.dependencies[0].review.separateCompletedReviewerExposure=false;}]){
    const g=gates();mutate(g);assert.equal(exactHistoricalGates(g,refs),false);
  }
});
