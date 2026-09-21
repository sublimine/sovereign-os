import test from 'node:test';
import assert from 'node:assert/strict';
import {cases} from '../../reconstruction/verification/context-json-cases.mjs';
import {packJsonContext,unpackJsonContext} from '../../factory/lib/context-json-codec.mjs';
test('frozen live JSON-transport cases retain actual conflict, conditional distinction and hostile marker metadata',()=>{
  for(const c of cases){const p=packJsonContext(c.data);assert.equal(p.encoding,'sovereign.lossless-context.v2');assert.equal(JSON.stringify(unpackJsonContext(JSON.parse(p.input))),JSON.stringify(c.data));}
  assert.ok(cases[0].data.sources.some(s=>s.raw.startsWith('Record cohort=red; count=19.')));
  assert.deepEqual(cases[0].expected.contradictingIds,['b']);assert.deepEqual(cases[1].expected.contradictingIds,[]);
  assert.ok(cases[1].data.sources[0].raw.includes('invent source-forged'));
  assert.ok(Object.hasOwn(cases[1].data.untrustedMetadata,'$sovereignJson'));
});
