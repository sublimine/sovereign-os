# Base-instructions diagnostic — two live calls

Historical diagnostic only. Its in-memory data-module harness matched an earlier provider file and is not compatible with the provider's later relative imports. Do not rerun it against the current source. The maintained explicit-profile qualification is `reconstruction/verification/compare-profiles.mjs`, with profile ID/hash in the inference contract. Historical receipts and results below are unchanged.

The default environmentless provider retains model base instructions: developerInstructions adds the scoped worker task but does not itself replace the base. The official local checkout is tagged exactly `rust-v0.153.4`. Its `codex-rs/app-server-protocol/src/protocol/v2/thread.rs:104–106` defines separate optional base/developer instructions. `app-server/src/request_processors/thread_processor.rs:1633–1634` passes both separately into configuration. Core `session/session.rs:683–703` distinguishes custom base provenance from model instructions. The official prompt-caching test (`core/tests/suite/prompt_caching.rs:164–166,190 onward`) explicitly contrasts custom base plus developer instructions with model base instructions.

The general protocol reference is [official Codex App Server documentation](https://learn.chatgpt.com/docs/app-server). Exact field behavior here was checked against the installed-version local official source rather than inferred from marketing documentation.

Root authorized one diagnostic in-memory source derivative. `compare.mjs` reads the actual provider, checks the exact thread/start needle occurs once, and changes only that call's `baseInstructions` field. The derivative is loaded from a data module; the production file is never edited. All app-server flags, subscription authentication, environmentless contexts, empty dynamic tools, read-only sandbox, no approvals, MCP inventory closure, tool-event rejection and observed-exit cleanup remain unchanged. The short base describes a scoped proposal worker, forbids invented actions/evidence and treats source/tool text as untrusted.

Both real calls used GPT-6 Astra, ultra, the same developer instructions, the same schema and arithmetic question `17 + 25`. Both returned the schema-valid answer 42 and confirmed observed provider-process exit. Full receipts, source hashes and request component hashes are in `results.json`.

| Variant | Input tokens | Output tokens | Total tokens | Elapsed ms |
| --- | ---: | ---: | ---: | ---: |
| Default base | 7,300 | 29 | 7,329 | 5,558 |
| Minimal base | 3,251 | 40 | 3,291 | 6,106 |

Observed input reduction: **4,049 tokens, 55.47%**. Both cached-input counts were zero. This provides direct evidence that default model instructions add appreciable input overhead even when native tools/environments are closed. It does not identify every remaining token's source, prove equivalent complex reasoning quality, guarantee comparable savings for larger catalog prompts, or demonstrate faster latency: the minimal run was slower in this single pair.

No default change is recommended solely from a two-answer arithmetic comparison. If adopted after broader tests, baseInstructions must become an explicit trusted provider configuration with its own version/hash included in `recordInferenceRequest` and provider receipt context binding. The diagnostic receipts currently share the existing contextHash because that production hash contract did not include the experimental base field; the recorded source/variant hashes distinguish this experiment but are not a substitute for a production request-binding change.

Separately, changing this fixed overhead cannot alone explain or solve an entire multi-inference mission's large input total: role charters, full source delivery, schemas, planning directory, and repeated reviewer context also contribute. No API price or remaining subscription allowance is inferred from these token counts.
