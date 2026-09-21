// Explicit CI-only arms for adaptive-v3 planned-route qualification.  They
// intentionally live outside FULL_ROUTE_CASES: the historical live runner
// enumerates that array and must not acquire a new subscription arm merely
// because deterministic tests are added.
import {FULL_ROUTE_CASES} from './full-route-cases.mjs';

const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){
  Object.values(value).forEach(freeze);Object.freeze(value);
}return value;};
const cloneArm=(base,id,extra={})=>freeze({...structuredClone(base),id,modes:['adaptive-v3-planned'],adaptiveV3Qualification:true,...extra});

export const ADAPTIVE_V3_SPECIALIST_CHARTER=freeze({question:'Which finite candidates satisfy the supplied relation?',
  methods:['Enumerate every supplied candidate and exhibit every exclusion.'],
  falsifier:'A valid omitted candidate or an invalid included candidate.',
  expectedBenefit:'No existing selected facet implements this bounded derivation.',
  completion:'Return the exact requested result and a public completeness argument, not an acceptance receipt.'});

export const ADAPTIVE_V3_QUALIFICATION_CASES=freeze({
  sources:cloneArm(FULL_ROUTE_CASES.find(item=>item.family==='sources'),
    'distinct-two-publishers-adaptive-v3-planned-sim'),
  development:cloneArm(FULL_ROUTE_CASES.find(item=>item.family==='development'),
    'merge-integer-windows-adaptive-v3-planned-sim',{producerBatch:'read-test-v1',maxCalls:14}),
  recovery:freeze({id:'sum-method-recovery-adaptive-v3-planned-sim',family:'transformation',
    modes:['adaptive-v3-planned'],adaptiveV3Qualification:true,qualificationMaxNodeAttempts:1,allowedTools:[],maxCalls:10,
    request:'Deliver the sum of the two original terms 9 and 4, preserving an independently reviewed correction path for any material omission.',
    expected:13}),
  specialist:freeze({id:'standalone-specialist-adaptive-v3-planned-sim',family:'transformation',
    modes:['adaptive-v3-planned'],adaptiveV3Qualification:true,allowedTools:[],maxCalls:8,
    request:'Derive the requested finite result using the supplied local specialist charter and return only {"result":"complete"}.',
    expected:{result:'complete'}})
});

export const adaptiveV3QualificationCase=row=>ADAPTIVE_V3_QUALIFICATION_CASES[row]??null;
