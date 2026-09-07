# Source Lifecycle Protocol

```text
DISCOVERED → ACCESS_REVIEW → REGISTERED → HANDLING_ASSIGNED
→ ACQUIRED → QUARANTINED → ADMISSIBLE|REJECTED
→ ASSESSED → DEPENDENCY_MAPPED → ACTIVE
→ REASSESSMENT_DUE → ACTIVE|DEGRADED|COMPROMISED|RETIRED
```

Transitions require source identity/channel distinction, legal basis, handling,
raw evidence, reliability feature update and audit. `COMPROMISED` triggers freeze
and descendant analysis, not automatic deletion. `RETIRED` revokes future use;
historical artifacts remain versioned. Anonymous/protected identities use sealed
refs resolvable only by authorized audit route.

Timeout at ACCESS_REVIEW → INACCESSIBLE; at QUARANTINED → parser/manual review;
at REASSESSMENT_DUE → STALE for new decisions. No silent expiry.

