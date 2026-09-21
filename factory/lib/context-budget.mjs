import {sha256} from './contracts.mjs';

/** Size-only diagnostic of the actual envelope already selected by the trusted
 * worker. It changes no exposure, budget, receipt or acceptance decision. */
export function contextBudgetDiagnostic(envelope,{maxContextBytes,maxInstructionBytes,instructionBytes,wireBytes=null,encoding='plain-json'}){
  const logical=JSON.stringify(envelope),fieldBytes=Object.fromEntries(Object.entries(envelope).map(([key,value])=>[key,Buffer.byteLength(JSON.stringify(value))]));
  return {version:'context-budget-diagnostic-v1',encoding,logicalBytes:Buffer.byteLength(logical),logicalSha256:sha256(logical),wireBytes,
    maxContextBytes,instructionBytes,maxInstructionBytes,fieldBytes,
    sourceCount:(envelope.sources??[]).length,toolObservationCount:(envelope.toolObservations??[]).length,identityDetailLimit:128,
    sourceBytes:(envelope.sources??[]).slice(0,128).map(source=>({id:source.id,hash:source.hash,rawBytes:typeof source.raw==='string'?Buffer.byteLength(source.raw):null})),
    toolObservationBytes:(envelope.toolObservations??[]).slice(0,128).map(observation=>({id:observation.id,tool:observation.tool,
      resultBytes:Buffer.byteLength(JSON.stringify(observation.result)),quoteTextBytes:Buffer.byteLength(observation.quoteText??'')})),
    scope:'Pre-dispatch byte counts and identities only. No source or request content; no truncation, budget increase, inference, replay or semantic acceptance.'};
}
