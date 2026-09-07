# Warning State Machine

```text
UNREGISTERED → REGISTERED → WATCHING
WATCHING → SIGNAL_RECEIVED → INTEGRITY/FRESHNESS/SPOOFING
→ BELOW_THRESHOLD → WATCHING
→ CROSSING_CANDIDATE → INDEPENDENT_REVIEW
→ ADVISORY|WARNING|CRITICAL
→ DISSEMINATED → ACKNOWLEDGED → RESOLVED
→ HIT|FALSE_ALARM|MISS_RECONSTRUCTED|UNRESOLVED
```

Failure of integrity/freshness/spoofing produces BLOCKED_SIGNAL, not suppression;
P0 may emit `UNVERIFIED_CRITICAL_SIGNAL` to authorized consumers with limitation.
Durable timers preempt when consumer window narrows. Missing ACK escalates channel,
not analytic severity. Handover transfers cursor and unresolved signals.

