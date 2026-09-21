// Logical product families, not process counts or automatic activation rules.
// Original contracts and domain facets remain attached to every card.
const omega = [
  ['sovereign_decision'], ['mission_graph_control', 'consumer_intent'],
  ['independent_process_audit'], ['mission_graph_design'],
  ['intelligence_requirements'], ['collection_strategy', 'source_discovery'],
  ['operational_provenance'], ['causal_identification'], ['blind_replication'],
  ['evidence_dependence'], ['claim_atomization', 'atomic_fact_verification'],
  ['epistemic_state'], ['assumption_challenge'], ['authorized_adversarial_test'],
  ['option_generation', 'counterhypothesis_testing'],
  ['reproducible_simulation', 'resolvable_forecasting'],
  ['conditional_strategy_portfolio'], ['systemic_externalities'],
  ['strategic_risk_case', 'resilience_design'], ['resource_allocation'],
  ['authority_determination'], ['final_acceptance'],
  ['evidence_based_product', 'faithful_decision_brief'], ['evaluated_learning'],
];
const departments = {
  veritas: ['intelligence_requirements', 'claim_atomization', 'operational_provenance', 'blind_replication', 'evidence_dependence', 'atomic_fact_verification', 'measurement_integrity', 'material_dissent', 'epistemic_calibration', 'evidence_based_product'],
  adversum: ['adversarial_mandate', 'assumption_challenge', 'authorized_adversarial_test', 'counterhypothesis_testing', 'threat_mechanism', 'incentive_challenge', 'model_challenge', 'resilience_drill', 'material_dissent', 'adversarial_disposition'],
  praxis: ['consumer_intent', 'scenario_design', 'resolvable_forecasting', 'reproducible_simulation', 'real_options', 'systemic_externalities', 'strategic_risk_case', 'option_temporality', 'decision_information_value', 'conditional_strategy_portfolio'],
  imperium: ['mission_authority', 'authority_delegation', 'capability_lease', 'resource_allocation', 'resource_priority', 'institutional_governance', 'stakeholder_legitimacy', 'data_rights', 'external_commitment_control', 'authority_revocation'],
  telos: ['quality_mandate', 'final_admission', 'dossier_integrity', 'evidence_to_decision_binding', 'final_acceptance', 'change_experiment_design', 'independent_change_evaluation', 'institutional_memory', 'recovery_readiness', 'evaluated_learning'],
};

export function groupRole(role, { pi, sigma }) {
  if (role.id.startsWith('pi_')) {
    const mapping = pi.find(item => item.piRole === role.id);
    if (!mapping) throw new Error(`CATALOG_MAPPING_MISSING: ${role.id}`);
    return {
      capabilities: [{
        id: mapping.canonicalCapability.id.replaceAll('-', '_'),
        rationale: mapping.canonicalCapability.producerOwner,
        productBoundary: mapping.canonicalCapability.ownedProduct,
      }],
      facets: mapping.preserve.facets,
      independence: mapping.acceptanceBeforeConsumers,
      sharing: mapping.execution,
      mapping,
    };
  }
  if (role.id.startsWith('sigma_')) {
    const mapping = sigma.find(item => item.id === role.id);
    if (!mapping) throw new Error(`CATALOG_MAPPING_MISSING: ${role.id}`);
    return {
      capabilities: [{ id: mapping.canonicalCapability, rationale: mapping.sharedExecution, productBoundary: mapping.artifactStateDependencies }],
      facets: [mapping.preservedFacets],
      independence: mapping.independentAcceptance,
      sharing: mapping.sharedExecution,
      mapping,
    };
  }
  const [family, number] = role.id.split('_');
  const ids = family === 'omega' ? omega[Number(number) - 1] : [departments[family]?.[Number(number) - 1]];
  if (!ids?.length || ids.some(id => !id)) throw new Error(`CATALOG_MAPPING_MISSING: ${role.id}`);
  const rationale = typeof role.distinctiveness === 'string'
    ? role.distinctiveness
    : role.distinctiveness.shareableMechanismsAndBoundary;
  return {
    capabilities: ids.map(id => ({ id, rationale, productBoundary: role.outputs })),
    facets: [typeof role.purpose === 'string' ? role.purpose : role.purpose.effect],
    independence: role.verification,
    sharing: role.recommendedDisposition,
  };
}
