import {Store} from './store.mjs';
import {Authority} from './authority.mjs';
import {LearningService} from './learning-service.mjs';
import {assertActivatableLearningDatasetEligibility} from './learning.mjs';
import {assertRegisteredEvaluatorContract} from './registered-learning-evaluator.mjs';
import {keys,check,canonical,clone} from './contracts.mjs';
import {storedLearningProvenance,validateLearningProvenance} from './learning-provenance.mjs';

/** Host-owned configuration, never model self-authorization. Validate the full
 * manifest with production validators in memory before touching the real store.
 * No provider, proposal, evaluation, export, promotion or scheduler is started.
 * This minimum split is not proof of oracle truth or representative coverage.
 */
function prepare(manifest){
  keys(manifest,['domainId','roleId','scope','datasetSpec','provenance'],['domainId','roleId','scope','datasetSpec']);
  const request=clone(manifest),temporary=new Store(':memory:');let prepared;
  try{
    const stage=new LearningService({store:temporary,authority:new Authority(temporary)});
    const domain=stage.prepareDomain(request,{eligibilitySubject:'CLI registration',eligibilityCode:'LEARNING_REGISTRATION_POLICY'}),spec=domain.datasetSpec;
    assertRegisteredEvaluatorContract(spec);
    assertActivatableLearningDatasetEligibility(spec,{subject:'CLI registration',code:'LEARNING_REGISTRATION_POLICY'});
    const provenance=request.provenance===undefined?null:validateLearningProvenance({provenance:request.provenance,expectedBinding:domain.provenanceBinding});
    check(provenance||spec.policy.activation==='evaluation-only','LEARNING_PROVENANCE_REQUIRED',
      'An activatable CLI domain requires separately trusted expected-value provenance; unverified domains must be evaluation-only');
    prepared={domain,provenance,info:{policyId:domain.policyId,domainId:domain.domainId,roleId:domain.roleId,
      scopeHash:domain.scopeHash,datasetHash:domain.datasetHash,evaluatorId:spec.evaluatorId,
      executable:true,caseCount:spec.cases.length,pairedInferenceCalls:spec.cases.length*2,
      activation:spec.policy.activation??'evaluated-promotion',
      provenanceStatus:provenance?'STRUCTURALLY_VALID_PENDING_TRUST_AND_SOURCE_CHECK':'EVALUATION_ONLY_UNVERIFIED',
      ...(provenance?{provenanceHash:provenance.provenanceHash,provenanceSourceRefCount:provenance.sourceRefCount}:{}),
      caveat:'Configuration only: no inference or activation. Structural provenance is not trusted until the destination verifies the separately configured policy and every frozen source reference. Expected-value truth, split independence, representative coverage and real improvement are not certified.'}};
  }finally{temporary.close();}
  return {request,prepared};
}

/** Validate a complete private domain manifest in memory. This exports only
 * non-sensitive registration metadata: never the cases, expected values,
 * prompts, provider request or destination Store. */
export function validateLearningDomainRegistration(manifest){
  return clone(prepare(manifest).prepared.info);
}

export function prepareLearningDomainRegistration(manifest){
  const {request,prepared}=prepare(manifest);
  // Only this closure touches the destination service. The CLI must finish
  // preparation BEFORE constructing FactoryEngine, whose Authority can initialize
  // an empty existing Store. The complete request remains private in the closure.
  return service=>service.store.transact(()=>{
    const existing=service.store.get('learning-domain',prepared.domain.policyId);
    if(existing){
      const compilation=service.compilation(prepared.domain.policyId);
      check(compilation.scopeHash===prepared.domain.scopeHash&&compilation.datasetHash===prepared.domain.datasetHash
        &&existing.data.domainId===prepared.domain.domainId&&existing.data.roleId===prepared.domain.roleId,'LEARNING_REGISTRATION_CONFLICT',
        'This domain identity already binds a different frozen scope or dataset');
      if(prepared.provenance){
        const stored=storedLearningProvenance(service.store,prepared.domain.policyId);
        check(stored.provenanceHash===prepared.provenance.provenanceHash&&canonical(stored.binding)===canonical(prepared.domain.provenanceBinding),
          'LEARNING_REGISTRATION_CONFLICT','This domain identity already binds different expected-value provenance');
      }else check(existing.data.schema==='sovereign.learning-domain.v1','LEARNING_REGISTRATION_CONFLICT',
        'Unverified evaluation-only reentry cannot replace an attested domain');
      service.registry.getActive(prepared.domain.policyId); // Validate, never reset an active pointer.
      return {...prepared.info,...(prepared.provenance?{provenanceStatus:'VERIFIED_CUSTODY_AND_REVIEW'}:{}),registration:'ALREADY_REGISTERED'};
    }
    const registered=service.registerDomain(request);
    const compilation=service.compilation(registered.policyId);
    check(compilation.scopeHash===prepared.domain.scopeHash&&compilation.datasetHash===prepared.domain.datasetHash,
      'LEARNING_REGISTRATION_CONFLICT','Registration differs from the fully validated manifest');
    return {...prepared.info,...(prepared.provenance?{provenanceStatus:'VERIFIED_CUSTODY_AND_REVIEW'}:{}),registration:'REGISTERED'};
  });
}

export function registerLearningDomain(service,manifest){
  return prepareLearningDomainRegistration(manifest)(service);
}
