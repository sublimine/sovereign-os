# Codex structured-inference provider

`CodexProvider` uses the official, version-pinned `codex app-server` stdio protocol and an existing ChatGPT subscription login. It has no API-key fallback, does not read authentication files, and removes API-key variables from the child environment. It does not promise unlimited usage or provide an operating-system sandbox.

Every ordinary `generate` creates a fresh ephemeral thread with `environments: []`, `dynamicTools: []`, empty instruction-file provenance, native/host tool feature closures, and a caller-supplied `outputSchema`. Supply a validator returning **exactly `true`** on acceptance. Only a completed final assistant JSON message passing that validator is returned. With legacy phase metadata, the last phase-unknown assistant message is selected, never the first commentary. All unexpected server requests and tool items terminate the client; errors are typed and raw provider error text is not exposed. The separate explicit public-search transport exception is described below; ordinary production and review workers cannot select it by prompt.

`receipt.kind === 'inference'` is provenance for the inference call, **not** proof of a tool execution, a true claim, a test run, or file modification. Reasoning effort is requested/configured metadata, not evidence of internal computation. There is one active generation per instance. After cancellation, timeout or fatal protocol failure, create another instance. Always `await provider.close()`.

MCP server names are extracted from bounded local TOML files, without exporting values, headers or environment entries. Only conventional unquoted `[mcp_servers.NAME]` headers are supported; unfamiliar MCP syntax fails closed. The process disables each discovered server before its first thread. Runtime inventories are checked after that closure, not used for initial discovery: upstream `mcpServerStatus/list` can eagerly initialize enabled MCP servers. Configuration administrators, installed binaries, system requirements and the current local configuration layout are trusted. This is not a universal configuration-layer parser; concurrent configuration changes or other unexamined configuration sources are outside the proven boundary. Do not treat it as hardened against a hostile host administrator. Deployment-specific probe output is intentionally retained as local operational evidence rather than published with this public source release.

The model is only a proposal producer. Do not expose app-server host RPC methods to model JSON. A separate broker validates and authorizes proposed effects. The [isolated runner](../tools/EXECUTION.md) is integrated in that external broker with per-run native checks; each installation must independently validate its own operating-system prerequisites. This inference adapter remains environmentless; broker availability never grants native tools to the model process. Integration is not universal security accreditation.

Tests default to simulated transport and explicitly label receipts `simulation: true`. Run with Node's test runner:

```sh
node --test tests/factory/codex-provider.test.mjs
```

An optional real arithmetic smoke test consumes subscription usage and is disabled by default:

```sh
SOVEREIGN_CODEX_LIVE_SMOKE=1 node --test tests/factory/codex-provider.test.mjs
```

Reference: [official app-server protocol](https://learn.chatgpt.com/docs/app-server). No live result is implied by passing simulated tests.

Validation performed on 2026-09-09: an explicitly enabled live arithmetic smoke completed successfully through the installed ChatGPT-authenticated app-server in approximately 4.5 seconds. This is one bounded inference observation, not a comprehensive sandbox or reliability certification. Default regression tests remain simulated.

## Separate public discovery client

`PublicSearch` constructs `CodexProvider({publicSearch:true})` with the distinct
hash-bound `public-search-v1` profile. The only permitted native effect item is
`webSearch`; command/file/MCP/plugin/browser/Code Mode execution remains closed.
It passes only the public query and candidate count, not the mission context.
Effective configuration is read and checked before inference. The model must
produce at least one observed completed native search, and process exit must be
confirmed, before URLs are returned as **unverified candidates**. A search item
does not admit source content: the caller must separately use the public-text
broker acquisition before factual use. The source contract and its remaining
operational limits are documented in this provider and in the factory's
[execution contract](../tools/EXECUTION.md); installation-specific probe logs
are deliberately not public source artifacts.

Search is injected as a trusted dependency, not a model-owned RPC surface. CLI
missions can propose `source.search` when authorized. Programmatic engines that
do not receive a `searchProvider` report discovery unavailable. No subscription
or paid API fallback is attempted on failure.

Usage uses the provider's cumulative `tokenUsage.total` for each fresh one-turn
thread, without adding cumulative updates. This captures multiple model responses
around native web calls when reported. `usageScope=last-response-only` marks the
legacy fallback explicitly. Earlier evidence predating this correction used
`last`; do not reinterpret it as complete multi-response search consumption.
No counter is a bill, account-wide total, or proof of unreported backend usage.
