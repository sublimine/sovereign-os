import test from 'node:test';
import assert from 'node:assert/strict';
import {safeCode} from '../../factory/lib/contracts.mjs';

test('safeCode retains versioned uppercase protocol codes without exposing arbitrary error text',()=>{
  assert.equal(safeCode({code:'ADAPTIVE_V3_ROUTE_INTEGRITY'}),'ADAPTIVE_V3_ROUTE_INTEGRITY');
  assert.equal(safeCode({code:'V2'}),'V2');
  for(const code of ['adaptive_v3','V3-HYphen','V3 space','V3\nINJECT','3V',''])assert.equal(safeCode({code}),'INTERNAL');
  assert.equal(safeCode({code:42}),'INTERNAL');assert.equal(safeCode(null),'INTERNAL');
});
