// Auditable correction of the original test oracle's ordering typo. This does
// not change model outputs, decisions, issue membership or original results.
import * as fs from 'node:fs';
import {join} from 'node:path';
import {canonical, sha256} from '../../factory/lib/contracts.mjs';
const directory=process.argv[2];
if(!directory)throw Error('Specific original evaluation directory required');
const raw=fs.readFileSync(join(directory,'summary.json'),'utf8'),original=JSON.parse(raw);
const rows=original.results.map(r=>{
  const expected={...r.expected,issues:[...r.expected.issues].sort()};
  const orderingDefect=canonical(expected)!==canonical(r.expected);
  const correctedPass=canonical(r.value)===canonical(expected);
  if(r.pass!==correctedPass&&!orderingDefect)throw Error('Unrelated grade change is forbidden');
  return {id:r.id,profile:r.profile,originalPass:r.pass,correctedPass,orderingDefect,originalExpected:r.expected,correctedExpected:expected,
    responseHash:sha256(r.value),providerContextHash:r.receipt.contextHash};
});
const result={originalSummarySha256:sha256(raw),reason:'The first oracle listed issue IDs in unsorted order, contrary to the explicit sorted-output instruction. Both real outputs already matched the sorted requirement. Only this mechanical oracle defect is corrected; original records remain intact.',
  correctedAt:new Date().toISOString(),rows,variants:original.variants.map(v=>({...v,originalPassed:v.passed,passed:rows.filter(r=>r.profile===v.id&&r.correctedPass).length})),
  inferenceCallsAdded:0,scope:'Reassessment of the same frozen responses; not an additional or independent benchmark.'};
fs.writeFileSync(join(directory,'oracle-order-reassessment.json'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
process.stdout.write(JSON.stringify(result.variants)+'\n');
