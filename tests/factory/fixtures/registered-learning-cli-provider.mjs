// Explicit node --import SIM fixture. Never loaded or selectable by factory CLI.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const root=process.env.SOVEREIGN_TEST_RUNTIME_ROOT??new URL('../../..',import.meta.url).pathname;
const load=path=>import(pathToFileURL(resolve(root,path)).href);
const [{CodexProvider},{LearningConductor},{RegisteredLearningEvaluator},{inferenceRequestHash}]=await Promise.all([
  load('factory/providers/codex.mjs'),load('factory/lib/learning-conductor.mjs'),load('factory/lib/registered-learning-evaluator.mjs'),load('factory/providers/instruction-profiles.mjs')]);
const advance=LearningConductor.prototype.advance,prepare=RegisteredLearningEvaluator.prototype.prepare;
LearningConductor.prototype.advance=function(...args){this.allowSimulation=true;return advance.apply(this,args);};
RegisteredLearningEvaluator.prototype.prepare=function(...args){this.allowSimulation=true;return prepare.apply(this,args);};
CodexProvider.prototype.generate=async function(r){
  const proposal=!!r.schema.properties?.action;
  const value=proposal?{action:'propose',instructions:'SIMULATED CLI OVERLAY',rationale:'Protocol fixture, not a real learned improvement.',evidenceIds:['worker-rejected-output:cli-rejection:1']}
    :{answer:r.input==='frozen-holdout-question'?13:r.instructions.includes('SIMULATED CLI OVERLAY')?42:0};
  if(r.signal?.aborted)throw Object.assign(Error('cancelled'),{code:'CANCELLED'});
  if(await r.validate(value)!==true)throw Error('Fixture validation rejected');
  process.stderr.write('SIM_REGISTERED_CALL '+JSON.stringify({kind:proposal?'proposal':'comparison',contextHash:inferenceRequestHash(r),model:r.model,reasoningEffort:r.reasoningEffort})+'\n');
  return {value,receipt:{status:'completed',simulation:true,contextHash:inferenceRequestHash(r)}};
};
CodexProvider.prototype.close=async function(){process.stderr.write('SIM_REGISTERED_CLOSE\n');return {processExitObserved:true};};
