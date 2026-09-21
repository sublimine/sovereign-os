# Local coordinator identity

Sublimine is a single-host Linux control plane. Queue, engine and learning owners
are now recorded with **PID + kernel boot ID + process start ticks**, not just PID.
Acquisition still commits atomically in SQLite and advances the ownership epoch;
node fencing and effect reconciliation remain separate obligations.

The former implementation called signal zero on the saved PID. After a crash or
reboot, the same number can identify an unrelated process, which would keep an
otherwise recoverable owner record busy. The read-only identity check distinguishes
that process without sending it a termination signal. Same live identity, a stopped
process, EPERM, or an unreadable identity remain busy. A positively absent PID,
different boot/start time, or zombie can release the coordinator identity. This
does not prove termination or successful completion of its external operations.

Every new owner captures kernel identity before committing. Failure to read that
identity prevents acquisition; it does not fall back to invented identity. Existing
PID-only records retain their conservative signal-zero behavior until their owner
releases or is positively absent. There is no retrospective rewrite of old evidence.
The same-process reentrant engine path preserves its epoch. New owners fence the
old instance before recovery; elapsed wall-clock time never steals a live owner.

Scope is the control plane's single host and PID namespace. This is not a distributed
lock, a proof against an administrator changing state, or authorization to kill a
process. Moving the state into a different PID namespace needs an explicit migration
policy, not an assumption that the new namespace proves the old process dead.

Tests include real self/child process identity and observed child exit, conservative
legacy/permission behavior, malformed/racing identities, and injected prior-boot or
reused-PID records for all three coordinators. The injected cases are not claimed as
an actual VPS reboot or forced kernel PID reuse. Historical counterexample and
post-fix frozen-runtime results are stored in reconstruction/verification.
