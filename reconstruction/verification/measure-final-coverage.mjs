// Read-only replay of already recorded plans. No provider calls, state writes,
// live acceptance or mutations to historical evidence. Output is always new.
import * as fs from 'node:fs';
import {resolve} from 'node:path';
import {normalizeFinalCoverage} from '../../factory/lib/final-coverage.mjs';
import {canonical, sha256} from '../../factory/lib/contracts.mjs';
const [output,...inputs]=process.argv.slice(2);
if(!output||!inputs.length||fs.existsSync(output))throw Error('New output file and explicit historical report paths required');
const rows=inputs.map(path=>{
  const bytes=fs.readFileSync(path),report=JSON.parse(bytes),before=report.plan;
  if(!before)throw Error('No saved plan in '+path);
  const {plan:after,audit}=normalizeFinalCoverage(before);
  const final=plan=>plan.nodes.find(n=>n.id===plan.finalNodeId);
  const unchanged={requirements:canonical(before.requirements)===canonical(after.requirements),
    nonFinalNodes:canonical(before.nodes.filter(n=>n.id!==before.finalNodeId))===canonical(after.nodes.filter(n=>n.id!==after.finalNodeId)),
    finalOtherFields:canonical({...final(before),criteria:[]})===canonical({...final(after),criteria:[]}),
    historicalFile:sha256(fs.readFileSync(path))===sha256(bytes)};
  if(!Object.values(unchanged).every(Boolean))throw Error('Normalization changed something outside its contract');
  return {reportPath:resolve(path),reportHash:sha256(bytes),missionId:report.mission.id,audit,unchanged,
    savedCriteria:final(before).criteria.length,normalizedCriteria:final(after).criteria.length,
    beforePlanBytes:Buffer.byteLength(JSON.stringify(before)),afterPlanBytes:Buffer.byteLength(JSON.stringify(after))};
});
const result={capturedAt:new Date().toISOString(),scope:'Offline exact-duplicate analysis of historical live plans, not new live inference or measured token savings.',
  normalizerHash:sha256(fs.readFileSync(new URL('../../factory/lib/final-coverage.mjs',import.meta.url))),rows};
fs.writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
process.stdout.write(JSON.stringify(result,null,2)+'\n');
