import {canonical} from '../../factory/lib/contracts.mjs';

// The immutable accepted plan is a legitimate inputRef alongside material
// parents. Verify an exact expected set, not a hardcoded number of all inputs.
export function exactHistoricalGates(gates,expectedInputs){
  if(!gates||!Array.isArray(gates.dependencies)||!Array.isArray(expectedInputs)||!expectedInputs.length)return false;
  const key=r=>canonical({artifactId:r.artifactId,hash:r.hash,purpose:r.purpose});
  if(new Set(expectedInputs.map(r=>r.artifactId)).size!==expectedInputs.length)return false;
  const observed=gates.dependencies.map(d=>d.input);
  if(new Set(observed.map(r=>r.artifactId)).size!==observed.length
    ||canonical(observed.map(key).sort())!==canonical(expectedInputs.map(key).sort()))return false;
  return gates.dependencies.every(d=>d.payloadBindingMatches&&d.acceptedBeforeFirstAttempt
    &&d.acceptanceSequence<gates.firstProducerSequence&&d.review?.decision==='ACCEPT'
    &&d.review.committedSequence<d.acceptanceSequence&&d.review.completePassingChecks&&d.review.separateCompletedReviewerExposure);
}
