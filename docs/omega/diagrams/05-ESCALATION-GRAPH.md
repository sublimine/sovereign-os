# Escalation Graph

~~~mermaid
flowchart TB
  X[Anomaly] --> C{Classify}
  C -->|schema/lineage| O7[Ω7]
  C -->|fact| O11[Ω11]
  C -->|independence| O10[Ω10]
  C -->|epistemic| O12[Ω12]
  C -->|mission/deadlock| O2[Ω2]
  C -->|resources| O20[Ω20]
  C -->|authority| O21[Ω21]
  C -->|risk| O19[Ω19]
  C -->|quality| O22[Ω22]
  C -->|process/abuse| O3[Ω3]
  O7 --> R{Resolved?}
  O11 --> R
  O10 --> R
  O12 --> R
  O20 --> R
  O21 --> R
  O19 --> R
  O22 --> R
  O2 --> R
  R -->|yes| B[Return to earliest invalid node]
  R -->|no, material decision| D[Ω2 Deduplicate + Compress]
  D --> S[SovereignAttentionPacket]
  S --> O1[Ω1]
  O3 -->|Ω1 implicated / constitutional| H[Human Oversight]
  O1 -->|outside delegation| H
~~~

