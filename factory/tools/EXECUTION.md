# Native execution contract

Implemented on this VPS after the owner's installation of bubblewrap and its specific AppArmor profile. This is not an unrestricted terminal, an assertion of perfect security, or acceptance of the entire factory.

This document describes the development tree, not an automatic update to the
installed service. The post-exec launch confirmation passed regression C5d78Q
on13September2026:1312tests,1311PASS,0FAIL,1explicitSKIP;287inputs and captures
reconciled18:47:29.393UTC. Native full development with the subscription provider
still requires its own qualification; test counts are not delivered work.

`execution.run` accepts exactly `{argv: string[], cwd: relativeDirectory}`. The trusted broker supplies the mission snapshot; a worker cannot choose a mount, environment, service name, cgroup property, secret or approval policy. The SDK requires an explicit trusted `IsolatedExecutionRunner` dependency. The local CLI configures it; missing infrastructure fails closed with no unrestricted fallback.

## Why this order

1. Verify the current scoped authority and durably record the operation intent.
2. Read the bounded mission files into a manifest with hashes and exact UTF-8 bytes. Persist the job identity before launching a process.
3. Create a private temporary snapshot in `/run/user/<uid>` tmpfs. The original workspace, database and authentication are not mounted into the job.
4. Start a uniquely named transient **user** service with real cgroup memory, swap, process, CPU and lifetime limits. Run the official installed Codex sandbox from an empty trusted launch directory, not the untrusted project's `.codex` configuration.
5. A read-only supervisor checks snapshot bytes, namespace separation, seccomp, effective capabilities, NoNewPrivs and denial of an outside synthetic canary. The controller separately reads actual cgroup limits. Only after both checks and a current authority check does it release the attempt to start the worker program.
6. Require a second nonce/snapshot-bound supervisor frame emitted after `Popen` confirms exec, before relaying any program output. READY, release and observed exec are distinct states. Then observe actual stdout/stderr and exit, while checking cancellation, authority and limits. Stop the exact service and verify no processes remain before removing its owned scratch directory. Drain the launcher's output before deciding whether a quick program had an observed start.
7. Recheck that original mission files still match the tested snapshot. Persist the job result, then its signed broker receipt. A nonzero program exit is an observed execution, **not** a passing test.
8. After the candidate exists, its independent reviewer repeats each required command and reads delivered files. Acceptance requires its own cited receipts, the planned argv/cwd/expected exit, semantic test-coverage judgment, and an unchanged current manifest. Mutation after review invalidates reuse.

The first gates verify authority and environment, not factual output that has not been collected. Result verification and acceptance happen after acquisition/execution. This distinction avoids a circular “verify data before obtaining it” workflow.

## Isolation and limits

Default job limits: 512 MiB aggregate memory, no swap, 32 tasks, 0.5 CPU, 30 seconds of managed lifetime, 128 KiB per output stream, and 8 MiB per scratch file. Input snapshot limits: 2,000 explicit entries, 32 MiB aggregate, 4 MiB per file at the runner boundary; the default broker further restricts each retained mission file to 1 MiB. Violations fail explicitly. Node and Python3 are available. Output admitted as textual proof must be lossless UTF-8; binary/invalid output is not silently substituted.

Network creation/connection is denied inside execution, including tested IPv4, IPv6 and UNIX sockets. The profile permits Codex's basic runtime reads (`:minimal`), plus the exact Node/Codex binaries and trusted supervisor/configuration. It is **not** a claim that absolutely nothing beyond the input directory is readable. Authentication and the controller workspace are excluded.

The initial command receives ordinary anonymous output pipes from the supervisor: socket-backed stdio did not produce reliable Node output under the network-denying sandbox. This relay fixes that first boundary, not arbitrary descendants that create their own socket-backed descriptors. The supervisor is nondumpable; real tests check denial of child access to its process memory and descriptors.

Known descendant reporting limitation, observed on Node24.19.0: the child of `node --test` can classify its stdout/stderr descriptors as unknown and use Node's discard-only Writable stream. Individual subtest events then disappear before the controller captures them; `outputTruncated:false` only describes the controller's byte cap, not end-to-end transparency of every descendant. [Fixed synthetic diagnosis](../../reconstruction/verification/NODE-CHILD-STDIO-RESULTS.md) records raw descriptor writes and a stream callback without the stream's text. A [second fixed native probe](../../reconstruction/verification/NODE-CHILD-STDIO-UPSTREAM.md) directly observed EPERM from getsockname and getsockopt on the child's existing fd1/2; the identical outside-sandbox control succeeded and emitted the stream. The FIFO root still emits without those queries succeeding. This identifies the local failure, not a transparent compatibility fix. No network permission or requested worker command was changed.

Separate real controls verify that a failing assertion and a top-level error still return nonzero, and that two explicitly awaited test bodies complete even with an aggregate `tests 1` report. An aggregate file PASS alone is not coverage evidence: inspect effective assertions, use explicit completion guards where needed, and preserve the original output and uncertainty. These controls do not repair descendant reporting or certify every test suite. Never manufacture TAP lines or silently change the requested command/isolation to obtain a preferred report.

Writes made by commands are disposable. Delivered files must be created/updated through `workspace.write` with its hash precondition. This prevents a tested program from directly rewriting host mission files, and keeps delivery evidence distinct from scratch build output. Dependencies cannot be downloaded from the network during execution. Nothing changes systemwide AppArmor restrictions or uses sudo.

The official [Codex sandbox documentation](https://learn.chatgpt.com/docs/sandboxing) supplies the sandbox implementation model. The installed version and specific behavior here were checked against local official source and real host probes, not inferred solely from those documents. An OS/kernel vulnerability or a hostile host administrator remains outside the claimed boundary.

## Crashes and receipts

Each operation has durable `effect` and `execution-job` records. Same-ID replay returns the original signed receipt after current authorization; it does not execute again against changed files.

The development runner now includes `isolation.programStart` with the observed
post-exec frame in each new successful execution receipt. A missing executable
or another bootstrap failure without that frame is `EXECUTION_START`, not an
observed program exit1. Error details separate `executionGateReleased` from
`programStarted`; absence of an observed frame is not proof that no program
ran if transport failed. Historical v1 receipts remain readable but never gain
this new proof retroactively. This does not repair descendant stdio or establish
the root cause of a transient EAGAIN. See the
[reproduction and current qualification](../../reconstruction/verification/EXECUTION-LAUNCH-PROOF.md).

Under exclusive engine ownership, `reconcileExecutions` stops only a durably identified owned job. A complete persisted result can restore a receipt lost at the final storage boundary. A job interrupted before its result was persisted becomes `FAILED/EXECUTION_INTERRUPTED` **after** verified cleanup, with an explicitly unknown original outcome. It is not called successful and its original ID does not rerun. Later repair can choose a new attempt on a new snapshot. Unconfirmed cleanup or missing ownership remains uncertain. Other broker operations are not automatically reclassified by this execution-specific recovery.

An actual regression kills the controller with SIGKILL and exercises recovery; other tests inject storage failure at the result/receipt boundary. These are process-crash tests, not proof of three days of operation or recovery from every OS/storage failure.

## Reproduction

```bash
node --test --test-concurrency=1 tests/factory/execution-launch.test.mjs tests/factory/execution.test.mjs tests/factory/execution-integration.test.mjs
```

Native tests exercise Node/Python output, literal argv, disposable snapshots, private files/environment, network denial, time/memory/task/output bounds, cancellation with a detached descendant, revocation before and during execution, malformed snapshots, invalid encoding, untrusted project configuration and supervisor protection. Node test-runner controls additionally check nonzero assertion/top-level failures and completion of awaited fixture callbacks, without relying on reporter formatting.

Integration tests use **simulated inference and real execution**, files, SQLite, authority and reviews. They cover the full effect/review sequence, dishonest PASS, producer-only proof, uncited independent proof, changed manifests, same-ID replay, lost receipts and real controller death. Model-quality qualification is separate and must identify its real provider receipts.
