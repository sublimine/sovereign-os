// Exact offline transport comparison on previously accepted model review checks.
// Excludes runtime-generated controls. Never rewrites the historical reports.
import * as fs from 'node:fs';
import {resolve} from 'node:path';
import {compactReviewEvidence,expandReviewReferences} from '../../factory/lib/review-codec.mjs';
import {canonical,sha256} from '../../factory/lib/contracts.mjs';
const [output,...paths]=process.argv.slice(2);
if(!output||!paths.length||fs.existsSync(output))throw Error('New output file and explicit report paths required');
const rows=paths.map(path=>{
  const raw=fs.readFileSync(path),report=JSON.parse(raw),artifact=report.final;
  if(artifact?.status!=='ACCEPTED')throw Error('Accepted final required for this offline measurement');
  const accepted=report.reviews.find(r=>r.id===artifact.reviews.at(-1));
  if(!accepted||accepted.result.artifactHash!==artifact.payloadHash)throw Error('Exact accepted review missing');
  const contentIds=new Set(artifact.payload.criteria.filter(c=>(c.evaluation??'content')==='content').map(c=>c.id));
  const original={...accepted.result,checks:accepted.result.checks.filter(c=>contentIds.has(c.criterionId))};
  const encoded=compactReviewEvidence(original),expanded=expandReviewReferences(encoded);
  if(canonical(original)!==canonical(expanded))throw Error('Transport changed original review');
  if(sha256(fs.readFileSync(path))!==sha256(raw))throw Error('Historical source changed');
  return {path:resolve(path),reportHash:sha256(raw),missionId:report.mission.id,reviewId:accepted.id,
    contentChecks:original.checks.length,originalEvidenceEntries:original.checks.reduce((n,c)=>n+c.evidence.length,0),catalogEntries:encoded.evidence.length,
    originalCanonicalBytes:Buffer.byteLength(canonical(original)),encodedCanonicalBytes:Buffer.byteLength(canonical(encoded)),roundTripVerified:true};
});
const result={capturedAt:new Date().toISOString(),scope:'Offline canonical serialization, not actual model output, token counts, latency or improved judgment.',
  codecHash:sha256(fs.readFileSync(new URL('../../factory/lib/review-codec.mjs',import.meta.url))),rows};
fs.writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});process.stdout.write(JSON.stringify(result,null,2)+'\n');
