import test from 'node:test';
import assert from 'node:assert/strict';
import {contextBudgetDiagnostic} from '../../factory/lib/context-budget.mjs';
import {sha256} from '../../factory/lib/contracts.mjs';

test('budget diagnostic measures actual repeated Unicode payloads without exposing content or modifying input',()=>{
  const secret='PRIVATE_FIXTURE_DO_NOT_EMIT',raw='é😀'.repeat(400),result={content:raw,sha256:sha256(raw)};
  const envelope={missionIntent:secret,sources:[{id:'source:unit',hash:sha256(raw),raw}],
    toolObservations:[{id:'operation:unit',tool:'source.fetch',result,quoteText:JSON.stringify(result)}],task:'{}'};
  const before=JSON.stringify(envelope),d=contextBudgetDiagnostic(envelope,{maxContextBytes:1024,maxInstructionBytes:100,instructionBytes:5,encoding:'lossless-json-v2'});
  assert.equal(d.logicalBytes,Buffer.byteLength(before));assert.equal(d.logicalSha256,sha256(before));
  assert.equal(d.sourceBytes[0].rawBytes,2400);assert.equal(d.wireBytes,null);
  assert.equal(d.toolObservationBytes[0].resultBytes,Buffer.byteLength(JSON.stringify(result)));
  assert.equal(d.fieldBytes.sources,Buffer.byteLength(JSON.stringify(envelope.sources)));
  assert.equal(JSON.stringify(envelope),before);assert.ok(!JSON.stringify(d).includes(secret));assert.ok(!JSON.stringify(d).includes(raw));
  assert.equal(d.maxContextBytes,1024);assert.ok(d.logicalBytes>d.maxContextBytes);
});
