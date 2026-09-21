import {CodexProvider} from '../providers/codex.mjs';
import {inferenceRequestHash} from '../providers/instruction-profiles.mjs';
import {check, clone, id, canonical, sha256, safeCode} from './contracts.mjs';

/** Executes the exact frozen request. Expected answers/holdouts stay in the
 * trusted measurement callback, never in an added model prompt. The callback
 * defines a domain-specific oracle; it is not a generic quality certificate.
 */
export class SubscriptionCaseEvaluator {
  constructor({store, authority, validate, measure, providerFactory = () => new CodexProvider(),
    allowSimulation = false, timeoutMs = 900000} = {}) {
    check(store && authority && typeof validate === 'function' && typeof measure === 'function'
      && typeof providerFactory === 'function', 'CONFIG', 'Trusted store, authority and executable oracle required');
    Object.assign(this, {store, authority, validate, measure, providerFactory, allowSimulation, timeoutMs});
  }
  async runCase(request, {signal} = {}) {
    const active = () => check(!signal?.aborted, 'CANCELLED', 'Learning evaluation cancelled');
    active();
    const effective = clone(request.effectiveRequest);
    check(request.executionContext?.requestHash === inferenceRequestHash(effective)
      && request.executionContext.prefixHash === sha256(request.effectivePrefix),
    'LEARNING_EXECUTION_CONTEXT', 'Evaluator must execute the exact frozen provider request');
    const executionId = id('learning-execution'); let provider, response, closure;
    const attempt = {executionId, evaluationId:request.evaluationId, caseId:request.caseId,
      variant:request.variant, requestHash:request.executionContext.requestHash, status:'DISPATCHED'};
    this.store.put('learning-provider-attempt', executionId, attempt, {expectedVersion:0});
    const update = changes => {
      const prior = this.store.get('learning-provider-attempt', executionId);
      this.store.put('learning-provider-attempt', executionId, {...prior.data,...changes}, {expectedVersion:prior.version});
    };
    try {
    try {
      provider = this.providerFactory();
      response = await provider.generate({...effective, timeoutMs: this.timeoutMs, ...(signal?{signal}:{}),
        validate: value => this.validate(value, effective.schema)});
      check(response.receipt?.contextHash === request.executionContext.requestHash && response.receipt.status === 'completed'
        && (response.receipt.simulation === false || this.allowSimulation && response.receipt.simulation === true),
      'LEARNING_INFERENCE', 'A bound completed real inference receipt is required');
    } finally { if(provider)closure = await provider.close(); }
    check(closure?.processExitObserved === true, 'LEARNING_CLEANUP', 'Inference process exit was not observed');
    // A completed inference is preserved even if cancellation or the oracle later
    // prevents grading. It is not an accepted evaluation or permission to replay.
    update({status:'INFERENCE_COMPLETED',signed:this.authority.seal('learning.attempt',{
      executionId,requestHash:request.executionContext.requestHash,response:clone(response),closure})});
    active();
    const measurement = await this.measure({value: clone(response.value), case: request.case});
    active();
    check(measurement && ['pass','fail'].includes(measurement.outcome), 'LEARNING_OBSERVATION', 'Executable oracle must return a measured outcome');
    const actual = {value: clone(response.value), inferenceReceiptHash: sha256(response.receipt), executionId,
      executionContext: clone(request.executionContext), simulation: response.receipt.simulation};
    const observations = {outcome: measurement.outcome, metrics: clone(measurement.metrics), actual};
    canonical(observations);
    const evidence = {executionId, candidateEvaluationId: request.evaluationId, caseId: request.caseId,
      caseHash: request.caseHash, requestHash: request.executionContext.requestHash, response: clone(response), closure, observationsHash: sha256(observations)};
    this.store.put('learning-provider-execution', executionId,
      {signed: this.authority.seal('learning.inference', evidence)}, {expectedVersion: 0});
    update({status:'COMPLETED'});
    const {evaluationId,datasetHash,caseId,caseHash,roleId,instructionHash,variant,evaluatorId} = request;
    return {observations, receipt: this.authority.seal('evaluation.case', {evaluationId,datasetHash,caseId,caseHash,roleId,instructionHash,
      variant,evaluatorId,evaluatorRunId:'trusted-subscription-evaluator',executionId,observationsHash:sha256(observations)})};
    } catch(error) {
      update({status:error.code==='CANCELLED'||error.code==='ABORTED'?'CANCELLED':'FAILED',code:safeCode(error),
        processExitObserved:closure?.processExitObserved===true});
      throw error;
    }
  }
}
