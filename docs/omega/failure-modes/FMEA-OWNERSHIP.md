# Ownership de familias FMEA

| Familia | Detecta | Contiene | Recupera | Revalida |
|---|---|---|---|---|
| factual/evidence | Ω7/Ω11 | Ω2/Ω7 | producer/Ω6 | Ω9–Ω12 |
| mission/liveness | runtime/Ω2 | Ω2 | Ω4/sponsor | Ω3/Ω22 |
| adversarial/security | Ω14/monitoring | Ω19/Ω21 | lower Security/Ops | Ω14/Ω3 |
| risk/cascade | Ω18/Ω19 | Ω19 | lower Ops/Engineering | drill + Ω22 |
| authority/abuse | PDP/Ω3/Ω21 | Ω21 | accountable owner | Ω3/human |
| quality/synthesis | Ω22/Ω23 | Ω22 | earliest owner | Ω7/Ω12/Ω22 |
| change/drift | Ω24/Ω3 | rollback owner | Ω24 | Ω3/Ω14/Ω22 |

No family closes without an independent revalidator when materiality is M3/M4.

