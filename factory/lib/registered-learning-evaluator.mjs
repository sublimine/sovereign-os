import {SubscriptionCaseEvaluator} from './learning-evaluator.mjs';
import {canonical,check,sha256} from './contracts.mjs';
import {assertAdaptiveV3LearningActiveLineageAllowed,assertAdaptiveV3LearningCandidateAllowed,assertAdaptiveV3LearningCycleDataAllowed} from './learning.mjs';

// Semantic version of the grading contract, not a plugin/module path. Never
// change the meaning of an existing ID to make a frozen comparison pass.
export const EXACT_JSON_EVALUATOR='exact-json-value-v1';
const criterion={metric:'exactMatch',direction:'higher',threshold:1};
export function assertRegisteredEvaluatorContract(spec){
  check(spec.evaluatorId===EXACT_JSON_EVALUATOR,'LEARNING_EVALUATOR','No executable implementation for this frozen evaluator ID');
  for(const c of spec.cases){
    canonical(c.expected);
    check(canonical(c.criteria)===canonical([criterion]),'LEARNING_EVALUATOR_CONTRACT',
      'exact-json-value-v1 requires exactly exactMatch, higher, threshold 1 for every case');
  }
}

/** Explicit host-owned execution wiring. No inference on construction/listing;
 * no module loading, arbitrary metric callbacks or promotion from CLI data.
 * Equality is the whole oracle, NOT a schema validator or a truth certificate.
 * The dataset owner must justify the frozen expected values and their scope.
 */
export class RegisteredLearningEvaluator {
  constructor({service,conductor,providerFactory,allowSimulation=false,timeoutMs=900000}={}){
    check(service?.store&&service?.authority&&conductor?.service===service,'CONFIG','Shared trusted learning service and coordinator required');
    Object.assign(this,{service,conductor,store:service.store,providerFactory,allowSimulation,timeoutMs});
  }
  dataset(policyId){
    const compilation=this.service.compilation(policyId),record=this.store.get('learning-dataset',compilation.datasetHash);
    check(record?.version===1&&sha256(record.data)===compilation.datasetHash,'LEARNING_DATASET','Registered evaluator requires the unchanged frozen dataset');
    return {compilation,spec:record.data};
  }
  list(){
    return this.store.list('learning-compilation').map(r=>{
      const {compilation,spec}=this.dataset(r.id);let code=null;
      try{assertRegisteredEvaluatorContract(spec);}catch(e){
        if(!['LEARNING_EVALUATOR','LEARNING_EVALUATOR_CONTRACT'].includes(e.code))throw e;
        code=e.code;
      }
      return {policyId:r.id,roleId:compilation.domain?.roleId??r.id,domainId:compilation.domain?.domainId??null,
        scopeHash:compilation.scopeHash,datasetHash:compilation.datasetHash,evaluatorId:spec.evaluatorId,
        executable:code===null,code,caseCount:spec.cases.length,pairedInferenceCalls:spec.cases.length*2,
        activation:spec.policy.activation??'evaluated-promotion',
        caveat:'Executable compatibility only; expected-value correctness, representative coverage and real improvement are not certified.'};
    });
  }
  prepare(cycle){
    // `prepare()` is public SDK wiring, so it must not become an alternate
    // provider path around LearningConductor.advance().  Check the supplied
    // immutable cycle before creating a provider-backed evaluator.
    assertAdaptiveV3LearningCycleDataAllowed(this.store,this.service.authority,cycle,{subject:'Registered learning evaluator'});
    assertAdaptiveV3LearningCandidateAllowed(this.store,this.service.authority,cycle.candidateId,{subject:'Registered learning evaluator'});
    assertAdaptiveV3LearningActiveLineageAllowed(this.store,this.service.authority,cycle.roleId,{subject:'Registered learning evaluator parent'});
    const {compilation,spec}=this.dataset(cycle.roleId),candidate=this.store.get('learning-candidate',cycle.candidateId);
    check(candidate?.version===1&&candidate.data.roleId===cycle.roleId&&candidate.data.datasetHash===compilation.datasetHash
      &&cycle.datasetHash===compilation.datasetHash&&cycle.scopeHash===compilation.scopeHash
      &&candidate.data.parentHash===cycle.parentHash,'LEARNING_DATASET','Cycle, candidate and frozen evaluator must refer to the same comparison');
    assertRegisteredEvaluatorContract(spec); // All cases before acquiring an owner or consuming a comparison.
    const cases=new Map(spec.cases.map(c=>[c.id,sha256(c)]));
    const evaluator=new SubscriptionCaseEvaluator({store:this.store,authority:this.service.authority,
      ...(this.providerFactory?{providerFactory:this.providerFactory}:{}),allowSimulation:this.allowSimulation,timeoutMs:this.timeoutMs,
      validate:value=>{canonical(value);return true;},
      measure:({value,case:c})=>{
        const pass=canonical(value)===canonical(c.expected);
        return {outcome:pass?'pass':'fail',metrics:{exactMatch:pass?1:0}};
      }});
    return (request,options)=>{
      // Recheck immediately at dispatch: a retained/corrupt candidate cannot
      // become executable merely because it was prepared before another actor
      // altered the durable learning lineage.
      assertAdaptiveV3LearningCycleDataAllowed(this.store,this.service.authority,cycle,{subject:'Registered learning evaluator'});
      assertAdaptiveV3LearningCandidateAllowed(this.store,this.service.authority,cycle.candidateId,{subject:'Registered learning evaluator'});
      assertAdaptiveV3LearningActiveLineageAllowed(this.store,this.service.authority,cycle.roleId,{subject:'Registered learning evaluator parent'});
      check(request.evaluatorId===EXACT_JSON_EVALUATOR&&request.datasetHash===compilation.datasetHash
        &&request.roleId===cycle.roleId&&request.caseId===request.case?.id
        &&cases.get(request.caseId)===request.caseHash&&request.caseHash===sha256(request.case),
      'LEARNING_EVALUATOR_CONTRACT','Executable evaluator received a case outside its exact frozen dataset');
      return evaluator.runCase(request,options);
    };
  }
  async evaluate(cycleId,{signal}={}){
    const cycle=this.conductor.get(cycleId);
    // Missing/unknown or incompatible evaluator does not burn the one permitted
    // comparison. Recovery of EVALUATING is owned by the durable coordinator;
    // terminal states never require another evaluator or provider dispatch.
    const runCase=cycle.status==='PROPOSED'?this.prepare(cycle):undefined;
    return this.conductor.advance(cycleId,{runCase,signal,allowProposal:false});
  }
}
