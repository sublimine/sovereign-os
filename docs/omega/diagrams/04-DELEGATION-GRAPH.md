# Delegation Graph

~~~mermaid
flowchart TB
  N[Need Detected] --> G[Capability Gap]
  G --> R{Template exists?}
  R -->|yes| U[Reuse Template]
  R -->|no| C[Derived Charter]
  U --> D[Duplicate/Conflict Check]
  C --> D
  D --> A[Model + Tool + Context + Budget]
  A --> P[Ω21 Policy Authorization]
  P --> S[Sandboxed AgentInstance with Lease]
  S --> X[Execute + Checkpoint]
  X --> V[Self-check]
  V --> I{Material?}
  I -->|yes| IV[Independent Verification]
  I -->|no| O[Return Structured Artifact]
  IV --> O
  O --> T[Terminate Instance/Revoke Credentials]
  T --> M{Reusable template?}
  M -->|yes| K[Retain Template + Metrics]
  M -->|no| GC[Retire Template]
~~~

Cada Ω puede patrocinar sólo especialistas de su jurisdicción. Ω2/Ω4 controlan
la topología global; Ω20 el envelope; Ω21 permisos.

