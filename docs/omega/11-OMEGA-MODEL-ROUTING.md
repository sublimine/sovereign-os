# Routing de Modelos y Esfuerzo

**Versión:** 1.0.0

## 1. Tiers abstractos

- **A:** máxima capacidad de razonamiento, planificación, síntesis o adversarial.
- **B:** alto razonamiento y contexto; decisiones parciales complejas.
- **C:** workhorse para extracción, clasificación, análisis definido.
- **D:** rápido/barato para routing, formato y tareas de bajo riesgo.
- **LOCAL_DETERMINISTIC:** parser, hash, schema, cálculo, solver o código cuando
  no hace falta generación.

La capacidad se describe por evals, no marca. ModelProvider puede representar
API, herramienta incluida en una membresía, sesión asistida o modelo local.
Todo uso reporta provider_mode y reproducibility class.

## 2. Routing

Features: materialidad, novedad, ambigüedad, longitud, necesidad de herramientas,
riesgo de error, requerimiento multimodal/código/matemática, independencia y
presupuesto. Se elige el tier mínimo que supera eval threshold con margen.

Tier A se reserva para Ω1, Ω4 en descomposición R5, Ω8 causal complejo, Ω12
casos epistémicos nuevos, Ω14 P0, Ω16 modelos complejos, Ω17 estrategia M4,
Ω19 existencial, Ω22 juicio final y Ω23 compresión M4. Los demás pueden escalar.

## 3. Esfuerzo

- low: transformación determinista supervisada, clasificación clara;
- medium: análisis estándar y tool use definido;
- high: ambigüedad, contradicción, causalidad, diseño, adversarial;
- maximum: P0/M4/R5, novedad extrema o múltiples marcos incompatibles.

La configuración por agente define default y triggers. Maximum requiere un
deliverable de alto valor; no se usa para espera, copia o parsing.

## 4. Escalado preventivo

Antes de ejecutar, el agente calcula **CapabilityFit**: dominio, complejidad,
context fit, tool reliability, eval margin y stakes. Escala si:

- eval margin < umbral;
- contexto necesario excede ventana aun con retrieval;
- tres o más contradicciones materiales interactúan;
- primera ruta no puede formular método verificable;
- P0/M4 exige diversidad no disponible;
- herramienta/modelo falla canary.

No necesita producir un resultado malo primero.

## 5. Degradación

Provider indisponible activa ruta alternativa compatible. Si bajar tier
violaría umbral, la misión espera o devuelve CAPABILITY_UNAVAILABLE. No se
oculta el cambio. Rutas de independencia evitan proveedor/model lineage común
cuando sea material.

## 6. Reputación y calibración

Métricas por model-version + charter-version + task class: accuracy, Brier,
ECE, citation integrity, authority violations, cost, latency, correction rate
y disagreement quality. Routing usa estas métricas como prior; verificación
actual prevalece sobre reputación.

