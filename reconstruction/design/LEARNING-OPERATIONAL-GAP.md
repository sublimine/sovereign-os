# Aprendizaje instalado: brecha operacional, no mejora certificada

14 septiembre2026, inspección19:00UTC. R11 sigue abierto.

## Evidencia local actual

`/home/cardeex/.local/bin/sovereign learn-list` devuelve `[]`. Eso por sí solo
sólo significa ausencia de ciclos. La consulta SQLite adicional, estrictamente
read-only,18:59:17.094UTC, encuentra cero registros cuyo tipo empiece por
`learning-`: no hay ámbitos, datasets, propuestas, evaluaciones ni promociones
en la base instalada. Conserva171versiones/protocolo2/diario426, cabeza
`45a1a59ee785b7c5b4ad33a2ee3ad0d55726a2ea432c781c2c00084373cd859f`.
No se copian experimentos históricos a esta base ni se atribuyen como actividad
ordinaria. Runtime0ec8:439archivos de desarrollo comparados19:01:56.182,
cero diferencias frente al manifiesto inmutable.

El resultado histórico real de citas se mantiene: baseline4/4 y candidato4/4,
rechazo por ausencia de mejora. [Evidencia](../verification/LEARNING-LITERAL.md).
Pruebas SIM de promoción/rollback prueban mecanismos, no una mejora real.

## Qué hace y qué falta

- FactoryEngine construye LearningService/Conductor y usa su resolver.
- Al terminar una misión sólo observa oportunidades si existe al menos un
  `learning-compilation`; no lanza automáticamente propuestas o evaluaciones.
- observeMission identifica rechazos y cruza el ámbito de compilación exacto.
  Sin coincidencia devuelve NO_FROZEN_EVALUATOR_SCOPE. No inventa un evaluador.
- Registrar un ámbito exige casos/evaluador confiables y conserva prefijo,
  perfil, contexto, formato y destino. No se puede reutilizar ciegamente el
  antiguo ámbito Sol/high para Astra/ultra o una ruta con otro contrato.
- advance puede producir una propuesta y una comparación; promoción exige
  mejora/no regresión y autoridad propia. Un callback firmado aún puede mentir:
  debe estar acreditado por pruebas externas, no por la firma del candidato.

La instalación ofrece infraestructura, pero no un ciclo de autoaprendizaje
operacional configurado. No se completará R11 renombrando esa infraestructura.

La inspección posterior de WorkerService.createRun detecta otra condición:
**registrar un ámbito antiguo tampoco activa overlays en adaptive-v2**. El preset
contiene producerBatch y el constructor excluye cualquier misión que lo declare.
También excluye presupuestos globales, contratos bounded/cerrados, revisión de
entradas, documentos, réplica/comparación y planificación con inspección de fichas.
Estas exclusiones protegen ámbitos todavía no cualificados; no se eliminan para
aparentar aprendizaje. La ficha de configuración histórica sólo guarda overlays
aplicados, sin explicar si el resolver fue omitido o consultado sin coincidencia.
Los informes actuales no resumen esa distinción. La siguiente modificación
registrará la decisión observada y su motivo sin cambiar el predicado ni consultar
el resolver en una ruta excluida. No será por sí misma la activación de R11.

Contrato previo de esta modificación: el predicado se compara exhaustivamente
con el anterior; el registro se congela junto a worker-config y describe sólo
creación de ese actor. Historial sin ese campo seguirá UNKNOWN, sin diagnosticarlo
retroactivamente usando la política actual. Contar ámbitos/ciclos no los valida,
no declara mejora y no inicia inferencias. El informe separará ámbito registrado,
resolver consultado, exclusión explícita y overlay ya congelado; cualquier
promoción/reversión posterior no cambia una configuración histórica. El runtime
instalado0ec8 permanece fijo mientras se cualifica el desarrollo siguiente.

## Siguiente integración, manteniendo las garantías

Observabilidad cerrada en desarrollo19:24UTC: candidato2898f24f,440archivos,
regresión8kFjNw2016tests/2015PASS/0FAIL/1SKIP y356pins verificados. Veintiséis
dirigidos finales y el caso bounded específico pasan. La comparación con el
historial real conserva todos los campos anteriores; los ocho trabajadores
antiguos siguen NOT_RECORDED. No se instaló ni se registró un ámbito.
La igualdad439archivos con0ec8 mencionada arriba es histórica, anterior al cambio.
Evidencias y negativos en [STATUS](../verification/STATUS.md).

1. Hacer observable la diferencia entre infraestructura presente, ámbito
   configurado, propuesta pendiente, evaluación aceptada y versión realmente
   activa. Los reportes deben ser de sólo lectura, sin iniciar ciclos al abrirlos.
2. Delimitar un dominio útil a partir de fallos reales y versiones actuales.
   El evaluador tendrá entradas y criterio fijados antes de la propuesta, casos
   de regresión y controles negativos; no respuestas hechas para beneficiar el
   candidato ni métricas que otorgue el mismo agente que propone la mejora.
3. Acreditar captura→propuesta→evaluación→decisión→aplicación/reversión en una
   copia aislada. Mantener auténtico el cero cuando no hay mejora y no convertir
   un dominio estrecho en aprendizaje universal de las154facetas.
4. Configurar ejecución automática sólo con dominio, versión, alcance y consumo
   trazables. El control-plane no puede generar su propia autoridad. Un fallo
   sin evaluador adecuado debe conservarse como oportunidad no configurada.
5. No instalar overlays ni reiniciar el servicio sólo para cerrar esta lista.
   La integración y el ensayo operacional preceden a cualquier promoción.

Éste es un plan de trabajo, no evidencia de que estos pasos ya estén hechos.
No añade una misión, tarea de Codex, callback, permiso ni gasto automático.

Avance19:48UTC: además de la observabilidad, d77de83e permite registrar y evaluar
ámbitos actuales completos bajo la política inmutable evaluation-only. No permite
aplicarlos.88dirigidosPASS; globalRwCzKm2040/2039PASS/1SKIP,357pins auditados;
paqueteqqiFSS comprueba cuatro requests históricos exactos, ocho callbacks locales
y bloqueos frente a la versión anterior. No se ejecuta otra inferencia ni se
crea un dominio instalado. [Contrato y pruebas](EVALUATION-ONLY-LEARNING.md).
Las carencias operacionales y la necesidad de mejora real siguen abiertas.
