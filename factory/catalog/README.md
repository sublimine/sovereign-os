# Audited capability catalog

This is a new operational selection module built from the reconstruction audits. It does not use the withdrawn prototype. The 154 cards describe capabilities, not 154 sessions, an approved fixed topology, working external integrations or demonstrated method execution.

## Exports

- `listCapabilities()` returns a compact, deterministic directory of `{id,title,canonicalCapabilities:[id]}`. It intentionally omits contracts and methods; it is not a truncated card.
- `getRole(id)` returns an entire deeply immutable normalized card.
- `selectCards(ids,{maxBytes=262144})` returns complete cards in lexical ID order. Empty selections, duplicate/unknown IDs and invalid budgets fail. UTF-8 serialized bytes above budget fail with `CATALOG_BUDGET_EXCEEDED`; nothing is truncated.
- `compileRoleInstructions(ids,{purpose,mode,maxBytes=262144})` returns a deterministic string containing policy, full selected cards and the assigned purpose. `mode` must be `producer` or `reviewer`. The same byte bound covers the entire string, including instructions and purpose.

The default byte limit is a transport/context constraint, not a quality standard or an agent quota. Callers may explicitly change it. The planner should select obligations by product and causal relevance, not load all cards to every worker. A reviewer card selection describes the obligations being checked; it does not allow repairing and approving the target in the same role. Context isolation and effect authorization still require enforcement outside these instructions.

## Preservation and integrity

`manifest.json` pins five audit-role files, their five source ledgers, both reconciliation maps, and all 154 individual JSON records. Σ is split between `sigma` (01–19) and `sigma-complement` (20–40). Original source hashes come from those pinned source ledgers, not freshly asserted trust. Startup verifies their referenced bytes before building cards. Missing or changed sources fail closed; runtime never refreshes pins automatically.

Cards preserve all audited method leaves, input/output declarations, activation, completion, failure/recovery, uncertainty and independence. `originalAudit` is a hash-bound file, JSON pointer and record hash for the complete original audit, including fields not in the normalized view. `sourceRefs` also retain original charter/dossier locators. There is no silent summarization of methods or replacement of the underlying audit. The compact directory is explicitly a different projection.

PI and Sigma reconciliation facets are retained. Omega and departmental families in `grouping.mjs` consolidate by the product/method boundary documented in their audits; each card keeps the original output object and rationale. Sharing a family is not claiming two outputs are interchangeable: factual versus adversarial dissent, a truth packet versus an executive dossier, or a resource request versus allocation retain their own contracts. Mechanism design remains distinct from causal acceptance; recovery design remains distinct from a drill or readiness certificate; final acceptance remains distinct from sovereign authorization.

Old documentary thresholds, quotas and unresolved inconsistencies remain visible as audit material, not enacted runtime policy. The compiler explicitly preserves current mission authority and requires conflicts to be resolved rather than silently inheriting draft rules.

## Updating and tests

`node factory/catalog/generate-manifest.mjs` prints an `apply_patch` for reviewed application; it never writes files. A manifest update acknowledges a source change and therefore requires review, not use as an automatic response to integrity failure.

`node --test tests/factory/catalog.test.mjs` checks all 154 cards, hashes and complete audit links, method preservation, selective compilation, deterministic behavior, invalid selections and byte-exact budget rejection. These tests validate the catalog implementation, not the effectiveness of the agents' described methods.
