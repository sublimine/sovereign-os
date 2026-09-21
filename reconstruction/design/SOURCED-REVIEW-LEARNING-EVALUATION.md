# Evaluación aislada del juez de fuentes

Contrato previo14septiembre2026,22:22UTC. No cambia ninguna ruta operacional.
Inspección cerrada sourced-learning-scope-Uij350: los dos requests históricos
del juez omega_22 (xPHjHG y01EeX4) se recomponen exactamente con54dc, prefijo
9700bytes/a4253a73. Las bases originales conservan diarios129/98. Ambas
inscripciones evaluation-only se rechazan SCHEMA por sourcedResponseReview.
No hubo modelo, replay, promoción ni registro persistente. El segundo caso
tiene productor SIM y juez real; no es un fallo real del productor para aprender.

## Necesidad y límite

Permitir un dominio de EVALUACIÓN solamente con el discriminador exacto
sourcedResponseReview=sourced-response-v1 y conservar todos sus campos:
perfil, representación de fichas/contexto/revisión, productor por lotes y hash
del presupuesto. No eliminar esos campos para igualar un ámbito legacy. Los
dos requests conocidos tienen hashes de presupuesto distintos, por tanto no
son un único ámbito intercambiable aunque compartan prefijo/purpose.

La admisión extendida requiere mode=reviewer, policy.activation=evaluation-only
y exactamente UN contrato reconocido: boundedReadReview o sourcedResponseReview,
nunca ambos. Mantener rechazos de null/desconocido/ausente, productor, campos
de otros controladores y formatos inválidos. No ampliar ámbitos operacionales,
autoridad, WorkerService ni selección de overlays. No proponer aprendizaje de
productores con contrato propio y cero roles de catálogo.

La prohibición de desplegar sigue en Registry/Service/Conductor. El paquete54dc
anterior ya reconoce y bloquea evaluation-only: comprobar con el paquete real
que esta nueva variante tampoco obtiene resolve/promote/export ni callbacks
durante esos intentos. No declarar que rechaza leer un ámbito desconocido si
sólo rechaza su promoción. Recompilar bytes iguales para EVALUACIÓN no equivale
a ejecutar un workflow ni acreditar un evaluador semántico.

## Pruebas antes de aceptación del componente

Pruebas locales con dos dominios/mismo rol/ámbitos exactos, petición compuesta
idéntica, aprobación SIM inactiva y reentrada EVALUATED_ONLY; negativos de
contratos combinados/desconocidos/modo y atomicidad. Preservar exclusiones
adaptativas y formatos legacy. Nuevo paquete y regresión completa, sin modificar
los cortes cerrados54dc/4456 ni bases históricas. Cualificación con requests
conocidos sólo como integridad de compilación; no fingir holdout ni mejora real.

El auditor semántico y un dataset acreditado son obligaciones distintas. No
promover ni instalar esta infraestructura para aparentar que están resueltas.
