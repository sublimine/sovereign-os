# Bounded network-component diagnostic — 2026-09-09

Historical failure retained. A subsequent owner-administered package/profile installation enabled sandbox startup; see [post-install verification](POST-INSTALL-ISOLATION.md). This document records the earlier unsuccessful experiment, not the current startup result.

## Question and source inspection

Could the previously observed `bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted` be only a network-isolation setup failure, with a job-only filesystem profile otherwise viable?

Inspected the official Codex source at tag `rust-v0.153.4`, commit `3d2ee51ca2d5db578f328aa75e20aa22c0197c9a`, before executing the diagnostic:

- [`linux_run_main.rs`, function `bwrap_network_mode`](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/linux-sandbox/src/linux_run_main.rs#L432): with no proxy mode, enabled networking selects `FullAccess`; disabled networking selects `Isolated`.
- [`bwrap.rs`, `BwrapNetworkMode::should_unshare_network`](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/linux-sandbox/src/bwrap.rs#L85): FullAccess does not request a new network namespace. Other namespace and filesystem machinery is not thereby removed.

## Exact diagnostic

Invoked the installed official CLI with temporary, per-command configuration only:

```sh
/home/cardeex/.local/bin/codex sandbox -P preflight \
  -c 'permissions.preflight.filesystem={":minimal"="read","/tmp/sovereign-preflight.c4ltj0/job"="write"}' \
  -c 'permissions.preflight.network.enabled=true' \
  -C /tmp/sovereign-preflight.c4ltj0/job -- /usr/bin/true
```

Observed exit code: **1**. Stderr:

```text
bwrap: setting up uid map: Permission denied
```

This diagnostic deliberately selected a command that makes no network connections and performs no intended filesystem mutation. It did not use a globally readable workspace profile, disable filesystem isolation, change kernel settings, install software, or alter persisted user configuration.

## Conclusion and limits

Removing the network-namespace setup path did **not** make the sandbox start: a UID-map setup permission failure remained. Therefore the prior failure is not explained solely by loopback setup. The result is consistent with the independently observed failure of `unshare -Ur /usr/bin/true` while writing `/proc/self/uid_map`.

No successful child execution occurred. This test certifies neither enforcement of the proposed filesystem policy nor any network restriction; networking was explicitly enabled for this narrow diagnostic. The test does not identify which host/container policy denies UID mapping. A maintained proxy alone would not solve the observed sandbox-startup failure. No further isolation bypass was attempted.
