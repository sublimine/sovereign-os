# Extreme Scale and Long-Run Protocol

At 100×, corpus and graph partition by stable key; collection and parsing use
cursors, content hashes, semantic dedup, bounded queues and sample audit. Coverage
and dependency reduce globally; shard source counts never become confidence.

Checkpoints include state hash, objective ref, artifact cursors, open leases,
pending events, watches, gaps and notification obligations. Restore invalidates
expired leases, reconciles outbox/inbox, reattests config and rebuilds timers.

Schema/model/provider migration uses parallel branches, dual-read, shadow replay,
quality comparison, cutover and rollback. Context is retrieved from artifacts;
no multi-week transcript is copied to every agent.

Failure domains: provider, credential/key, region, event bus, state store,
evidence store and human approval. Common-mode drill is required before S4.

