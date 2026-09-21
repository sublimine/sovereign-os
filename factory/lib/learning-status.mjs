import {clone} from './contracts.mjs';

const byId = (a, b) => String(a.id).localeCompare(String(b.id));

/** Read-only lifecycle projection. It never invokes a provider, resolves a
 * worker, changes a pointer, or exposes frozen cases/expected values. */
export function learningStatusReport(store) {
  const domains = store.list('learning-domain').sort(byId);
  const compilations = store.list('learning-compilation').sort(byId);
  const candidates = store.list('learning-candidate');
  const evaluations = store.list('learning-evaluation');
  const evaluatedPrefixes = store.list('learning-evaluated-prefix');
  const exports = store.list('learning-export');
  const domainByPolicy = new Map(domains.map(r => [r.id, r.data]));
  const scopes = compilations.map(compilation => {
    const data = compilation.data;
    const policy = domainByPolicy.get(compilation.id) ?? data.domain ?? null;
    const provenanceRecord = policy?.schema === 'sovereign.learning-domain.v2'
      ? store.get('learning-provenance', compilation.id)?.data ?? null : null;
    const role = store.get('learning-role', compilation.id)?.data ?? null;
    const dataset = store.get('learning-dataset', data.datasetHash)?.data ?? null;
    const scopedCandidates = candidates.filter(r => r.data.roleId === compilation.id);
    const scopedEvaluations = evaluations.filter(r => scopedCandidates.some(c => c.id === r.data.candidateId));
    const scopedPrefixes = evaluatedPrefixes.filter(r => scopedCandidates.some(c => c.id === r.data.candidateId));
    const scopedExports = exports.filter(r => r.data.roleId === compilation.id);
    const latestEvaluation = scopedEvaluations.at(-1);
    const completedPassed = scopedEvaluations.some(r => r.data.status === 'completed' && r.data.passed === true);
    const activeOverlay = Boolean(role && role.activeHash !== role.baselineHash && role.approvedHashes?.includes(role.activeHash));
    const lifecycle = activeOverlay ? 'ACTIVE_OVERLAY'
      : completedPassed ? 'EVALUATED_PASS'
      : scopedEvaluations.length ? 'EVALUATED_REJECTED_OR_INCOMPLETE'
      : scopedCandidates.length ? 'PROPOSED'
      : dataset?.policy?.activation === 'evaluation-only' ? 'REGISTERED_EVALUATION_ONLY'
      : 'REGISTERED_BASELINE';
    const cases = Array.isArray(dataset?.cases) ? dataset.cases : [];
    const targets = policy?.targets ?? [...new Map(cases.map(c => {
      const target = {model:c.input?.model ?? null, reasoningEffort:c.input?.reasoningEffort ?? null};
      return [JSON.stringify(target), target];
    })).values()];
    const provenanceStatus = policy?.schema === 'sovereign.learning-domain.v2'
      ? provenanceRecord?.provenanceHash === policy.provenanceHash && provenanceRecord?.policyId === policy.provenancePolicyId
        ? 'ATTESTED_STORED_RUNTIME_RECHECK_REQUIRED' : 'ATTESTATION_RECORD_MISMATCH'
      : dataset?.policy?.activation === 'evaluation-only' ? 'EVALUATION_ONLY_UNATTESTED' : 'LEGACY_UNATTESTED';
    return {
      policyId: policy?.policyId ?? compilation.id, ...(policy?.domainId ? {domainId:policy.domainId} : {}),
      roleId: policy?.roleId ?? compilation.id, scopeHash:data.scopeHash ?? null, datasetHash:data.datasetHash ?? null,
      evaluatorId:dataset?.evaluatorId ?? null, activation:dataset?.policy?.activation ?? 'evaluated-promotion',
      provenanceStatus,...(policy?.schema === 'sovereign.learning-domain.v2' ? {provenancePolicyId:policy.provenancePolicyId ?? null} : {}),
      caseCount:cases.length, trainingCaseCount:cases.filter(c => !c.holdout).length, holdoutCaseCount:cases.filter(c => c.holdout).length,
      targets:clone(targets), baselineHash:role?.baselineHash ?? null, activeHash:role?.activeHash ?? null,
      approvedVersionCount:Array.isArray(role?.approvedHashes) ? role.approvedHashes.length : 0, lifecycle,
      candidateCount:scopedCandidates.length, evaluationCount:scopedEvaluations.length, evaluatedPrefixCount:scopedPrefixes.length,
      exportCount:scopedExports.length,
      latestEvaluation:latestEvaluation ? {
        evaluationId:latestEvaluation.data.evaluationId ?? null, candidateId:latestEvaluation.data.candidateId ?? latestEvaluation.id,
        status:latestEvaluation.data.status ?? 'unknown', passed:latestEvaluation.data.passed ?? null,
        improved:latestEvaluation.data.improved ?? null, issueCount:Array.isArray(latestEvaluation.data.issues) ? latestEvaluation.data.issues.length : null,
      } : null,
    };
  });
  const lifecycleCounts = Object.fromEntries([...new Set(scopes.map(s => s.lifecycle))].sort().map(state => [state, scopes.filter(s => s.lifecycle === state).length]));
  const provenanceStatusCounts=Object.fromEntries([...new Set(scopes.map(s=>s.provenanceStatus))].sort().map(status=>[status,scopes.filter(s=>s.provenanceStatus===status).length]));
  return {
    schema:'sovereign.learning-status.v1', readOnly:true,
    registration:{scopeCount:compilations.length, domainCount:domains.length, legacyScopeCount:Math.max(0,compilations.length-domains.length),provenanceStatusCounts},
    lifecycleCounts, scopes,
    cycleProjection:{integrity:'NOT_PROJECTED',
      scope:'Learning-cycle rows and their count are private control-plane custody until an end-to-end origin and lifecycle-transition attestation exists.'},
    totals:{candidateCount:candidates.length,evaluationCount:evaluations.length,evaluatedPrefixCount:evaluatedPrefixes.length,exportCount:exports.length},
    safety:{providerCalls:0,stateChanges:0,automaticActivation:false,
      scope:'Projection of frozen registration, lifecycle pointers and safe counters. Learning-cycle rows/counts, cases, expected values, proposal text, provider requests and evaluator payloads are intentionally withheld.',
      caveat:'This read-only report does not verify signatures, source admission or current revocation. Registration is not evaluator readiness, measured truth, representative coverage, approval or production safety. Only runtime use rechecks an attested domain; evaluation-only domains can never activate.'},
  };
}
