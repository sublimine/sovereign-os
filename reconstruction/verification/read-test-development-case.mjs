import {FULL_ROUTE_CASES} from './full-route-cases.mjs';
// Same known substantive contract and oracle, new prospectively versioned
// protocol arm. Not a holdout, historical recovery or paired cost experiment.
export const READ_TEST_DEVELOPMENT_CASE=Object.freeze({...structuredClone(FULL_ROUTE_CASES.find(s=>s.id==='merge-integer-windows')),
  id:'merge-integer-windows-read-test-v1',modes:['adaptive'],producerBatch:'read-test-v1',maxCalls:14});
