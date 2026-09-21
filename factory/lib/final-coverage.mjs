import {check, clone, identifier, sha256, list} from './contracts.mjs';
import {validateCriteria} from './plans.mjs';

const signature = criterion => JSON.stringify([criterion.text, criterion.evaluation ?? 'content']);

/** Normalize a NEW, structurally validated proposal BEFORE independent plan review.
 * Only byte-identical text with the same evaluator may share a final check.
 * Requirements, non-final nodes, effects and already stored plans are untouched.
 * Distinct requirement identities remain distinct even when their text matches.
 */
export function normalizeFinalCoverage(proposal) {
  const plan = clone(proposal), final = plan.nodes.find(n => n.id === plan.finalNodeId);
  check(final, 'PLAN_FINAL', 'Final node missing');
  list(final.criteria, 'proposed final node-local criteria', {max: 1000});
  if(final.criteria.length)validateCriteria(final.criteria);
  const required = new Map(), bySignature = new Map();
  for (const requirement of plan.requirements) {
    for (const criterion of requirement.criteria) {
      const id = `req.${requirement.id}.${criterion.id}`;
      identifier(id, 'qualified requirement criterion');
      // IDs allow dots: r=a.b/c=c and r=a/c=b.c must not silently alias.
      check(!required.has(id), 'PLAN_COVERAGE_ID', 'Qualified requirement criterion IDs collide');
      const value = {id, text: criterion.text, ...(criterion.evaluation ? {evaluation: criterion.evaluation} : {})};
      required.set(id, value);
      const key = signature(value);
      bySignature.set(key, [...(bySignature.get(key) ?? []), id]);
    }
  }
  // Check every reserved binding BEFORE coalescing. A second correct alias
  // cannot conceal a weaker or differently evaluated req.* criterion.
  for (const criterion of final.criteria) if (required.has(criterion.id)) {
    check(signature(criterion) === signature(required.get(criterion.id)), 'MANDATE_DRIFT', 'Final requirement criterion was altered');
  }
  const aliases = [], normalized = [], present = new Set();
  for (const criterion of final.criteria) {
    const matches = bySignature.get(signature(criterion)) ?? [];
    // No fuzzy matching, trimming, translation, scope inference, or merging
    // across requirements. Keep ambiguous matches as additional obligations.
    const target = required.has(criterion.id) ? criterion.id : matches.length === 1 ? matches[0] : criterion.id;
    if (target !== criterion.id) aliases.push({from: criterion.id, to: target, basis: 'exact-text-and-evaluator'});
    if (!present.has(target)) normalized.push(target === criterion.id ? criterion : required.get(target));
    present.add(target);
  }
  const added = [];
  for (const [id, criterion] of required) if (!present.has(id)) {
    normalized.push(criterion); present.add(id); added.push(id);
  }
  const legacyFinalCriterionCount = final.criteria.length + [...required.keys()].filter(id => !final.criteria.some(c => c.id === id)).length;
  const criteriaBefore = final.criteria.length;
  final.criteria = normalized;
  validateCriteria(final.criteria);
  return {plan, audit: {algorithm: 'exact-final-coverage-v1', proposedPlanHash: sha256(proposal), normalizedPlanHash: sha256(plan),
    criteriaBefore, criteriaAfter: normalized.length, requiredCriterionCount: required.size, legacyFinalCriterionCount,
    aliases, added, caveat: 'Pre-review normalization of exact duplicates only; not measured token savings or semantic equivalence of paraphrases.'}};
}
