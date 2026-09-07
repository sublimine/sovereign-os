# Workflow de Activación Contextual

Ω2 computes vector S,U,I,F,X,R,C,L,H,N (0–5), materiality M0–M4 and depth
R0–R5. Ω4 maps required capabilities. Deterministic rules create candidate
set; minimality removes agents without a material deliverable; coverage test
adds missing capacity; Ω20 checks cost; Ω21 checks authority.

Hard activations:

- F≥3: Ω7, Ω11.
- U≥3: Ω9, Ω10, Ω12.
- causality material: Ω8, Ω13, Ω15.
- I≥4: Ω13, Ω14, Ω18, Ω19, Ω21, Ω22.
- capital≥4: Ω20.
- strategy: Ω17 plus Ω15/18/19.
- duration≥3/change: Ω24.
- M4/P0: Ω1–Ω3, Ω9–Ω14, Ω19, Ω21–Ω23 mandatory; remaining roles excluded
  only with reason and capability coverage proof.

Output ActivationRecord stores included/excluded roles, trigger, deliverable,
cost, independence purpose and reactivation event.

