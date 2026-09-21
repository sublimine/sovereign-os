import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256} from '../../factory/lib/contracts.mjs';
import {nativeSourceViewCases} from '../../reconstruction/verification/native-source-view-cases.mjs';
import {renderSourceTextView,readSourceTextView} from '../../factory/lib/source-text-view.mjs';
import {selectInputCopy} from '../../factory/lib/input-copy-contract.mjs';

const previous=()=>({request:'Before\n<obj>e\u0301\r\n</obj>\nAfter',requestHash:sha256('Before\n<obj>e\u0301\r\n</obj>\nAfter'),
  expected:{body:'e\u0301\r\n',sha256:sha256('e\u0301\r\n'),utf8Bytes:5}});

test('fixed diagnostic cases retain exact source/oracle and literal-backslash countercase without assuming selection success',()=>{
  const cases=nativeSourceViewCases(previous());assert.equal(cases.length,2);assert.notEqual(cases[0].id,cases[1].id);
  const selectors=[{kind:'literal-input-span-v1',before:'Before\n<obj>',after:'</obj>\nAfter'},
    {kind:'literal-input-span-v1',before:'Registro a conservar:\n<REGISTRO>',after:'</REGISTRO>\nDistractor que NO debes copiar:'}];
  for(const [i,c]of cases.entries()){
    assert.equal(sha256(c.request),c.requestSha256);assert.equal(sha256(c.expected),c.expectedSha256);
    assert.equal(Buffer.byteLength(c.expected),c.expectedUtf8Bytes);
    assert.equal(readSourceTextView(renderSourceTextView(c.request).input),c.request);
    assert.equal(selectInputCopy(c.request,selectors[i]).body,c.expected);
  }
  assert.ok(cases[1].expected.includes('\\n\\r\\t\\u0301'));
  assert.notEqual(cases[1].expected,cases[1].expected.replaceAll('\\n','\n'));
  for(const mutate of [q=>q.request+='x',q=>q.expected.body+='x',q=>q.expected.utf8Bytes++]){
    const q=previous();mutate(q);assert.throws(()=>nativeSourceViewCases(q),{code:'EXPERIMENT_BOUNDARY'});
  }
});
