# Information Flow Graph

~~~mermaid
flowchart LR
  U[User Intent] --> O2[Ω2 ObjectiveInvariant]
  O2 --> O4[Ω4 MissionGraph]
  O4 --> O5[Ω5 Intelligence Requirements]
  O5 --> O6[Ω6 Acquisition]
  O6 --> E[(EvidenceStore)]
  E --> O7[Ω7 Provenance]
  E --> O10[Ω10 Dependency Graph]
  E --> O11[Ω11 Atomic Fact Audit]
  O7 --> C[(ClaimLedger)]
  O10 --> C
  O11 --> C
  C --> O9[Ω9 Blind Replication]
  O9 --> O12[Ω12 Epistemic State]
  C --> O8[Ω8 Causal Context]
  O8 --> O16[Ω16 Simulation]
  C --> O13[Ω13 Assumptions]
  C --> O15[Ω15 Alternatives]
  O13 --> O17[Ω17 Strategy]
  O15 --> O17
  O16 --> O17
  O17 --> O18[Ω18 Impact]
  O18 --> O19[Ω19 Risk]
  O17 --> O20[Ω20 Resources]
  O17 --> O21[Ω21 Governance]
  O12 --> O23[Ω23 Dossier]
  O17 --> O23
  O18 --> O23
  O19 --> O23
  O20 --> O23
  O21 --> O23
  O14[Ω14 Red Team] --> O22[Ω22 Final Gate]
  O23 --> O22
  O22 --> O1[Ω1 Decision]
  O1 --> D[(DecisionLedger)]
  D --> O24[Ω24 Learning]
  O3[Ω3 Audit] -.-> D
  O3 -.-> O24
~~~

