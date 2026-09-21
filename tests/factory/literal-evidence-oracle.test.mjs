import test from 'node:test';
import assert from 'node:assert/strict';
import {literalEvidenceCases,literalEvidenceGold,measureLiteralEvidence,validLiteralEvidenceShape} from '../../reconstruction/verification/literal-evidence-case.mjs';
import {unpackContext} from '../../factory/lib/context-codec.mjs';
import {unpackJsonContext} from '../../factory/lib/context-json-codec.mjs';

test('all frozen literal fixtures have valid exact gold and losslessly recoverable original bodies',()=>{
  const cases=literalEvidenceCases();assert.equal(cases.length,4);
  for(const c of cases){const gold=literalEvidenceGold(c.expected);assert.equal(validLiteralEvidenceShape(gold),true);assert.equal(measureLiteralEvidence(gold,c.expected).outcome,'pass');
    const encoded=JSON.parse(c.input),decoded=encoded.encoding==='sovereign.lossless-context.v2'?unpackJsonContext(encoded):encoded.encoding==='sovereign.lossless-context.v1'?unpackContext(encoded):encoded;
    assert.equal(decoded.artifacts.find(a=>a.id===c.expected.artifactId).payload.body,c.expected.body);
    assert.equal(decoded.task.requests.length,5);
  }
});
test('oracle rejects paraphrase, decoded escapes, superseded binding, empty and oversized quotes',()=>{
  const cases=literalEvidenceCases();
  for(const edit of [v=>{v.evidence[0].quote='The two producers must be kept separate.';},v=>{v.evidence[0].id+='-old';},v=>{v.evidence[0].hash='a'.repeat(64);},v=>{v.evidence[0].quote='';},(v,c)=>{v.evidence[0].quote=c.expected.body;}]){
    const c=cases[0],v=literalEvidenceGold(c.expected);edit(v,c);assert.equal(measureLiteralEvidence(v,c.expected).outcome,'fail');
  }
  const c=cases[1],v=literalEvidenceGold(c.expected);v.evidence[0].quote=JSON.parse(v.evidence[0].quote);assert.equal(measureLiteralEvidence(v,c.expected).outcome,'fail');
});
test('oracle requires exact coverage and consumed correctly targeted catalog entries',()=>{
  const c=literalEvidenceCases()[3];
  for(const edit of [v=>{v.checks.pop();},v=>{v.checks[0].evidenceIds=['missing'];},v=>{v.checks[0].evidenceIds=['e0','e0'];},v=>{v.checks[0].evidenceIds=['e1'];},v=>{v.evidence.push({...v.evidence[0],evidenceId:'unused'});},v=>{v.evidence.push({...v.evidence[0]});},v=>{v.checks[0].reason=' ';}]){
    const v=literalEvidenceGold(c.expected);edit(v);assert.equal(measureLiteralEvidence(v,c.expected).outcome,'fail');
  }
});
