# Auditoría de enrutamiento de aprendizaje

Estado: árbol de trabajo, 19 de septiembre de 2026. Esta auditoría describe la
ruta de código que incorpora procedencia (protocolo 12) y activación/despacho
(protocolo 14); no describe una release instalada. El release e3dfb824 y sus resultados históricos permanecen
consultables en [STATUS](../verification/STATUS.md), pero no acreditan estos
cambios hasta que una cualificación y promoción separadas los incluyan.

La ruta es registro → compilación/revalidación → evaluación/promoción →
resolución → worker. No convierte la infraestructura en aprendizaje automático,
ni convierte una firma en verdad de un evaluador.

## Camino comprobado en el árbol de trabajo

1. LearningService.registerBaseline() sólo admite un dataset
   evaluation-only. Para un overlay activable,
   LearningService.registerDomain() normaliza ámbito/dataset, deriva el
   policyId, congela el prefijo y registra el binding learning-domain.
   Si el manifiesto porta procedencia —obligatoria para activación— verifica
   dentro de la misma transacción las firmas, la política externa y las fuentes,
   escribe learning-provenance y eleva el protocolo a 12. Las claves de
   confianza llegan desde configuración local, nunca del manifiesto.
2. LearningService.compilation() vuelve a ligar dominio, dataset, ámbito y
   prefijo. En un dominio v2 recupera el registro de procedencia, comprueba su
   digest/binding y exige que el `policyId` runtime sea el mismo congelado en
   dominio/procedencia; incluso las mismas claves bajo otro ID fallan cerrado.
   Después vuelve a verificar firmas, hash y pasaje de cada fuente admitida. Por
   eso una retracción bloquea evaluación, promoción,
   resolución y exportación posteriores; el historial permanece.
3. LearningService.evaluate() compara únicamente el candidato con su padre
   bajo los casos congelados y el prefijo efectivo. Para cada caso y variante
   baseline/candidate primero persiste una autorización durable que enlaza
   evaluación, caso/hash, variante, requestHash, prefixHash y scopeHash, en la
   misma transacción que revalida compilación/procedencia. Sólo entonces llama
   al callback externo. No se afirma atomicidad física con el proveedor.
   Tras el callback revalida y marca ese despacho como retornado; el gate
   síncrono beforeComplete repite la revalidación dentro de la transacción que
   completa la evaluación, y otra revalidación liga el prefijo reutilizable.
   Así un resultado no vale sólo por haber sido autorizado antes de un await.
4. promote() exige esa evaluación ligada, autorización explícita y una política
   distinta de evaluation-only. Antes del CAS, LearningService emite un dossier
   `learning-activation` firmado que liga candidato/padre, hashes de
   instrucciones/dataset/ámbito/prefijo/targets, evaluación y procedencia. El
   Registry rechaza una promoción directa que no lo aporte. Tras el CAS escribe
   `learning-activation-binding`, que congela la versión y hash exactos del
   `learning-role` que quedó activo. El primer uso eleva a protocolo 14.
   Promoción y rollback no-baseline comprueban compilación antes y después de
   mover el puntero, dentro de su misma transacción. El rollback a baseline es
   una retirada segura y estrecha: no necesita revalidar la procedencia del
   overlay que precisamente se está retirando. Proponer o evaluar no modifica
   activeHash.
5. LearningService.resolver() valida antes de filtrar: corrupción o pérdida
   de procedencia no se interpreta como ausencia de coincidencia. Sólo acepta
   igualdad canónica exacta del ámbito y un target
   {model, reasoningEffort} que figure en los casos evaluados; excluye
   evaluation-only y falla cerrado ante más de una coincidencia.
6. WorkerService.createRun() construye el ámbito real, aplica las exclusiones
   de rutas cerradas/documentales/budgetadas y consulta el resolver sólo si la
   ruta es admisible. Si recibe un overlay, congela versión, scopeHash,
   prefixHash, target, activation y binding en worker-config; nunca combina en
   silencio dos overlays ni cambia los bytes de una ejecución ya creada.
7. Si el worker selecciona un overlay, su creación escribe un origen firmado e
   inmutable que liga `run@1`, `worker-config@1` y el hash de los overlays. Una
   cabeza posterior de configuración no puede convertir ese run en ordinario ni
   borrar el gate. Justo antes del proveedor, WorkerService revalida que el
   binding siga siendo el puntero activo exacto y que procedencia/ámbito/target
   permanezcan válidos. Luego retiene el request exacto y, dentro de la misma
   transacción, escribe `learning-dispatch-authorization` firmado y ligado por
   referencias a run, worker-config, request, activation y binding. El Registry
   exige un handoff opaco creado por ese WorkerService para aceptar el request,
   y otro para aceptar el recibo retornado tras su revalidación. Al aceptarlo
   consume la autorización una vez y escribe
   `learning-dispatch-completion` firmado, ligado a autorización, run pendiente,
   request, configuración y hash del recibo. Sólo después del primer handoff
   entra al proveedor. Un rollback a baseline devuelve `LEARNING_REVOKED`; una
   promoción posterior o reactivación devuelve `LEARNING_SUPERSEDED`; una
   retracción, dossier alterado o configuración cambiada falla cerrado antes de
   request/proveedor o de admitir un retorno. Esa autorización es evidencia de
   permiso previo, no de llamada o resultado externo. Si una retención exterior
   revierte después de adjuntar el recibo, sólo el mismo proceso puede reintentar
   la misma ruta/request con valor, recibo y handoff opaco exactos; no reenvía
   al proveedor. Reintentos concurrentes convergen mediante el resultado
   durable verificado y vuelven a comprobar validador del llamador, fuente,
   binding y target. Ruta/input distintos, cierre no confirmado, retractación o
   configuración posterior fallan cerrados.
8. validateLearningDomainRegistration() y la CLI learn-validate hacen
   únicamente preflight estructural en memoria: forma del manifiesto, ámbito,
   dataset, binding y, si se aportó, forma de la política. No abren un Store de
   destino, no verifican firmas con claves confiadas ni admisión/revocación de
   fuentes. Su salida no revela casos ni expected; no debe llamarse
   «validación completa de confianza».

## Evidencia ejecutable y su alcance

- tests/factory/learning-domains.test.mjs cubre ámbitos/dominios disjuntos,
  conflictos de target y prefijo de worker.
- tests/factory/learning-evaluation-only.test.mjs comprueba que un ámbito
  experimental no puede resolver, promover ni exportar.
- La suite de LearningService incluye recuperación de rollback exterior después
  de adjuntar recibo: una sola llamada al proveedor, reintentos exactos
  concurrentes que convergen, reconciliación de cleanup y bloqueo si se
  retracta la fuente o cambia la configuración.
- tests/factory/learning-service.test.mjs y learning.test.mjs cubren CAS de
  padre, dataset congelado, evaluación emparejada, activación/binding firmados,
  autorización de despacho previa al proveedor, rollback a baseline,
  supersesión, retractación y corrupción de dossier.
- tests/factory/learning-domain-registration.test.mjs cubre preflight sin
  Store de destino, registro separado, conflictos y opciones de política.
- tests/factory/learning-provenance.test.mjs cubre binding por caso,
  firmantes/roles/identidades criptográficas inválidos y el bloqueo al retirar
  una fuente. Sus claves son fixtures de autenticación, no identidades humanas
  ni evidencia factual.
- tests/factory/learning-status.test.mjs comprueba la proyección read-only y
  que los casos/expected no se publican.

La regresión archivada de e3dfb824 es evidencia de ese paquete anterior, no
una prueba del protocolo 12 de este árbol. Antes de desplegar hay que obtener y
conservar una regresión nueva, una auditoría de upgrade y una verificación del
wrapper/servicio que realmente se vaya a activar.

## Límites que permanecen abiertos

- La instalación viva continúa sin dominios, ciclos, candidatos ni evaluaciones
  registrados. Además, no se debe asumir que contiene el código v2 hasta que el
  release se promueva y se compruebe.
- La atestación verifica custodia y revisión conforme a una política externa.
  No acredita la verdad semántica de un expected, independencia humana,
  representatividad, calidad de la derivación o mejora de modelo.
- exact-json-value-v1 sigue siendo un oráculo de igualdad para datasets
  explícitos, no un juez semántico.
- learn-status sólo informa de registros almacenados y contadores seguros;
  no revalida en su lectura firmas, fuentes o revocaciones actuales.
- Una autorización de despacho no produce atomicidad física con un proveedor:
  acredita que el permiso durable existía antes del intento, no que el proveedor
  fuera llamado, devolviera una respuesta o fuera correcto. La reconciliación de
  resultado sigue siendo una responsabilidad separada.
- Los handoffs de request/recibo prueban la ruta local confiada del worker, no
  una firma criptográfica del proveedor. Se pierden tras reinicio por diseño:
  un despacho pendiente requiere reconciliación con evidencia externa, nunca un
  recibo reconstruido desde el hash del request. La caché de recuperación del
  rollback exterior también vive sólo en ese proceso y sólo autoriza el mismo
  request/ruta; no convierte el protocolo en exactly-once físico. Un actor que
  pueda mutar el Store o usar directamente la Authority ya pertenece a la base
  de confianza; los guards de SDK no afirman defender esa autoridad.
- Los runs congelados no se reescriben tras rollback o promoción. Quedan
  deliberadamente bloqueados y hay que crear un run nuevo para consumir el
  nuevo puntero; esto evita usar bytes históricos como permiso perpetuo.
- No existe promoción automática: toda activación requiere evaluación,
  autorización, target exacto y procedencia válida en el momento de uso. No se
  debe fabricar un dataset de dominio para convertir esta auditoría en una
  demostración de aprendizaje real.
