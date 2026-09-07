# Authority Graph

~~~mermaid
flowchart TB
  H[Human Sovereign / Oversight]
  O1[Ω1 Final Decision]
  O2[Ω2 Mission Command]
  O3[Ω3 Independent Inspector]
  O4[Ω4 Mission Architecture]
  I[Ω5–Ω8 Intelligence & Reality]
  V[Ω9–Ω12 Truth & Verification]
  A[Ω13–Ω15 Adversarial]
  D[Ω16–Ω19 Prediction, Strategy, Impact, Risk]
  P[Ω20–Ω21 Resources & Governance]
  Q[Ω22–Ω24 Quality, Dossier, Evolution]
  L[Lower Departments]
  S[Temporary Specialists]

  H -->|delegates bounded sovereignty| O1
  H -->|protected oversight| O3
  O1 -->|commands| O2
  O2 -->|mission authority only| O4
  O2 -->|activates, does not dictate verdict| I
  O2 -->|activates, preserves independence| V
  O2 -->|activates under rules of engagement| A
  O2 -->|activates| D
  O2 -->|requests/coordinates| P
  O2 -->|activates| Q
  O3 -.->|audits process, including Ω1| O1
  O3 -.->|audits all| O2
  O3 -.-> I
  O3 -.-> V
  O3 -.-> A
  O3 -.-> D
  O3 -.-> P
  O3 -.-> Q
  O2 --> L
  O4 --> S
  I --> S
  V --> S
  A --> S
  D --> S
  P --> S
  Q --> S
~~~

Las flechas de Ω2 no conceden autoridad sobre el contenido de una verificación,
auditoría, autorización o gate. Ω3 no tiene mando jerárquico sobre Ω1, pero su
canal y sus findings son independientes.

