# Verification Graph

~~~mermaid
flowchart LR
  P[Producer] --> CL[Atomic Claims]
  CL --> L[Ω7 Lineage Integrity]
  CL --> F[Ω11 Factual Entailment]
  CL --> R[Ω9 Blind Replication]
  L --> T[Ω10 Source Independence]
  R --> T
  F --> T
  T --> E[Ω12 Epistemic Assessment]
  A[Ω13 Assumption Challenge] --> X[Correction Loop]
  RT[Ω14 Real Adversarial Test] --> X
  E --> X
  X -->|failure| ROOT[First Invalid Node]
  ROOT --> P
  X -->|passes| Q[Ω22 Product Certification]
  Q --> S[Ω23 Dossier]
~~~

Production, replication, triangulation, falsification, epistemic state and
quality certification are separate transitions. No majority edge exists.

