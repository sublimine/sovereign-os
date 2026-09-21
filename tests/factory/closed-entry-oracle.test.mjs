import test from 'node:test';
import assert from 'node:assert/strict';
import {CLOSED_ENTRY_CASES,checkClosedAnswer} from '../../reconstruction/verification/closed-entry-cases.mjs';
test('closed entry gold freezes two independently checkable answers and four materially different escalation needs',()=>{
  assert.equal(CLOSED_ENTRY_CASES.length,6);assert.equal(CLOSED_ENTRY_CASES.filter(c=>c.pair).length,2);
  assert.equal(new Set(CLOSED_ENTRY_CASES.map(c=>c.id)).size,6);
  for(const c of CLOSED_ENTRY_CASES.filter(c=>c.pair))assert.equal(checkClosedAnswer(c,JSON.stringify(c.answer)),true);
});
test('mean oracle rejects wrong totals, extra keys, numeric strings, markdown and prose containing the right number',()=>{
  const c=CLOSED_ENTRY_CASES[0];
  for(const body of ['{"sum":24,"count":3,"mean":7}','{"sum":24,"count":3,"mean":"8"}','{"sum":24,"count":3,"mean":8,"extra":true}','```json\n{"sum":24,"count":3,"mean":8}\n```','The mean is not 8.'])assert.equal(checkClosedAnswer(c,body),false);
  assert.equal(checkClosedAnswer(c,'{"mean":8,"count":3,"sum":24}'),true);
});
test('transformation oracle preserves accents, order, lowercase and first unique occurrence',()=>{
  const c=CLOSED_ENTRY_CASES[1];
  for(const value of [['arbol','mar','sol'],['árbol','sol','mar'],['árbol','mar','árbol','sol'],['Árbol','mar','sol']])assert.equal(checkClosedAnswer(c,JSON.stringify(value)),false);
});
