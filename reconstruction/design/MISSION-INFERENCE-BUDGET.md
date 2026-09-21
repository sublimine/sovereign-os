# Presupuesto compartido de inferencias por misión

13 septiembre 2026, actualizado 22:59 UTC. Implementado y verificado por regresión;
no instalado. Cualificación real acotada añadida a las 23:09 UTC, más abajo.
R04/R14: controlar el coste de coordinación sin sustituir calidad por
una cantidad menor de trabajo declarado.

## Hueco y decisión

`WorkerService` limita pasos/herramientas por invocación; el protocolo de inspección
acota sólo al planificador. Crear un nuevo actor no comparte esos contadores con
entrada, jueces, réplicas o descubrimiento. Los lanzadores de cualificación sí
tienen un techo exterior, pero ese guard no pertenece al motor ordinario.

Se reutiliza el patrón local existente de reservas inmutables de planificación,
extendiendo su ámbito, no el número de llamadas permitidas. Opción explícita para
nuevas misiones: `inferenceBudget: {mode: 'mission-calls-v1', maxCalls: N}`,
N entero 1..1000; CLI `--mission-call-limit N`. Sin selección, el comportamiento
anterior se conserva. No se añade al preset ni a misiones ya existentes.

Cada solicitud lógica de modelo registrada por ArtifactRegistry (entrada,
planificación, producción, revisión, réplica) reserva una unidad ANTES de que
el proveedor pueda ejecutarla. Cada intento de `source.search` reserva una
unidad en la misma transacción que su transición DISPATCHED. Las búsquedas
nativas internas o reintentos de transporte del proveedor no son nuevas unidades
observables por este contador: no es un techo de tokens, euros ni HTTP requests.
Las herramientas sin inferencia conservan sus límites propios.

## Invariantes

- Registro inmutable por reserva, orden continuo y referencias exactas a la
  solicitud retenida/run pendiente o al intento de búsqueda. SQLite serializa
  reservas de actores/procesos concurrentes. No contador mutable reiniciable.
- La política se compara con la primera versión de la misión. Cambiar/eliminar
  el techo, ocultar una reserva o versionarla no permite seguir gastando.
- Una reserva es conservadora: muerte después del commit, timeout, rechazo o
  fallo previo al proveedor NO la reembolsan. Tampoco certifica una llamada real.
- Un intento pendiente, incluso con idéntica solicitud, no obtiene otra reserva
  ni permiso de replay. La recuperación de respuestas/effects continúa bajo sus
  contratos propios. Recuperar un recibo de búsqueda cerrado no gasta otra unidad.
- Agotamiento da `INFERENCE_BUDGET_EXHAUSTED` / NEEDS_DIRECTION y cola WAITING,
  nunca éxito, reparación de calidad, ampliación automática o retry por temporizador.
- El informe separa reservas, tipos y llamadas/uso observados existentes. Los
  datos de presupuesto no son evidencia factual ni autorización de efectos.
- La vista disponible antes de una propuesta es informativa, no una reserva
  anticipada de capacidad para su juicio. Ninguna reducción de criterios para
  encajar. Los overlays previos no se importan en el nuevo ámbito sin evaluación.

## Verificación prevista

Validación de opciones; cero cambio sin selección; límites compartidos entre
actores/fases/búsqueda; agotamiento antes de proveedor; rollback atómico;
interrupción después de reserva y reapertura sin reset; dos procesos compitiendo
por la última unidad; políticas/heads/refs alterados; fallo/timeout sin devolución;
techo de inspección de planificación independiente; reentrada de entregable sin
llamadas; CLI sin inferencia; informe sólo lectura y contexto honesto.
Después batería completa y snapshot de runtime. Proveedor de tests SIMULADO;
reservas/SQLite/procesos locales reales. No ahorro real ni cierre total por tests.

Esta prioridad no implementa todavía PRODUCER-CHECKPOINT.md ni reutilización de
threads: ambos permanecen separados para no mezclar contratos de recuperación.

## Implementación y resultados intermedios

Registro común en ArtifactRegistry.recordInferenceRequest cubre todos sus actores,
incluida BlindReplicationService; el broker añade búsquedas dentro del mismo
commit de DISPATCHED. La adjunción de recibos exige una reserva pendiente exacta
en misiones seleccionadas. CLI/SDK, informe, scope sin overlays y contexto de
productor están conectados. La vista no transmite contadores a jueces/réplicas.
El presupuesto no almacena una segunda copia de cada prompt: liga referencias
inmutables y usa una proyección estrecha para contabilizar historia; la auditoría
completa de contenido sigue perteneciendo a los lectores de ese contenido.

Primero 5 tests rojos (cuatro por opción inexistente y uno por módulo inexistente,
749.541602ms); después 5 PASS/591.97009ms y 35 PASS/2191.812505ms.
La batería de tres archivos cerró 170 tests, 169 PASS/1 FAIL,
82245.376251ms (53411exit1). El fallo fue real: el catch de planificación trataba
INFERENCE_BUDGET_EXHAUSTED como error de calidad y agotaba sus intentos locales.
Se conservó el test y se corrigió propagación; retest de ocho casos 8 PASS,
3860.587892ms (54767exit0), exige cero qualityFailures y un solo actor.

Las cuatro muertes SIGKILL antes/después del commit en worker/búsqueda y la
competencia real entre dos procesos por la última unidad pasaron en esa batería.
Los modelos/búsquedas son simulados y ninguna reserva demuestra un envío real.
Nuevo contraejemplo: adjuntar un recibo sin reserva era posible (1 FAIL,
274.029712ms); guard atómico añadido. Ese caso y la vía real de réplica con
upstream/modelo SIMULADOS: 2 PASS/608.727665ms. Una réplica consume la cuarta
reserva tras tres upstream explícitamente simulados; la siguiente se bloquea
antes de proveedor y no se filtra la respuesta privada ni el presupuesto.

Batería ampliada de nueve archivos cerrada: 433 tests, 433 PASS, cero FAIL,
157220.439974ms (56604exit0, cierre observado22:42:49UTC). Incluye los casos
anteriores y rechazo de accessors sin ejecución; el informe y el presupuesto
conservan transacciones ajenas.

Global R62Cdt cerrada 22:52:20.271 UTC, sesión 31527 exit 0: 1434 tests,
1433 PASS, cero FAIL, un SKIP, 530754.774246 ms. Auditoría 22:53:38.505:
298 entradas, comandos y cuatro streams concordantes; propietario ausente.
Runtime de4dd81603668307745993a398e7952efc3e699b6826602bfc5b14d073b38e31
congelado/cualificado para ensayo aislado, 422 archivos/24120001 bytes, no instalado.
[Prueba de cierre](../verification/runs/suite-R62Cdt/post-close-audit.json).
7fad/hWOjuv sólo cubre el sobre operativo anterior.

`mission-budget-live-8lANly` cerró 23:05:48.955 / 82758 exit 0, tres llamadas
REALES/26008 tokens. Techo 1 retiene candidato sin juicio/entrega; techo 2 permite
producción y aceptación independiente. Dos nuevas reaperturas de proceso no
despachan ni reinician reservas. Auditoría readonly 23:08:57.158 conserva ambas
DBs, contrasta recibos/requests/prefijos/reservas previas y cuatro usos de citas.
[Resultados y revisión manual](../verification/MISSION-BUDGET-RESULTS.md).
Caso conocido; no ahorro general, prueba real de búsqueda/réplicas ni instalación.
La modificación posterior de producer-failure-history no está cubierta por ese ensayo.
