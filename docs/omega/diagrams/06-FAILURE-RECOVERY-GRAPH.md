# Failure-Recovery Graph

~~~mermaid
flowchart LR
  F[Failure Detected] --> C[Contain + Preserve]
  C --> U[Trace Upstream]
  U --> R[Locate Earliest Invalid Node]
  R --> I[Mark Invalid / Retract]
  I --> G[Transitive Descendant Query]
  G --> Z[Freeze Dependent Decisions]
  Z --> Q[Recompute from Valid Ancestor]
  Q --> V[Independent Reverification]
  V --> P{Pass?}
  P -->|no| U
  P -->|yes| N[New Version + Notifications]
  N --> D[Recovery Drill]
  D --> O[Close Propagation + Postmortem]
  O --> E[Ω24 Change Proposal if systemic]
~~~

