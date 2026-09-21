# Admisión de archivos para peticiones normales

14 septiembre 2026. **Diseño previo conservado; implementación de desarrollo en
verificación desde 11:10.** [Resultados y límites](../verification/MISSION-INPUT-RESULTS.md).
No modifica los contratos ni evidencias congelados de bounded-read.

## Evidencia del problema

`factory/bin/sovereign.mjs` interpreta --file como el texto de la petición.
`MissionQueue.submit` guarda misión y trabajo QUEUED en una misma transacción,
sin adjuntos ni fase de preparación. `ToolBroker.registerWorkspace` crea un
directorio vacío cuando hace falta. No hay un importador de archivos en CLI/cola.
Los ensayos ocSk6B y GoZbep prepararon el archivo antes de engine.run: sus pruebas
de lectura/revisión siguen siendo válidas, pero no prueban la entrada de datos
desde una petición normal en la cola. No recomendar copiar después de submit:
el servicio podría arrancar antes. Pausar después tampoco elimina esa carrera.

## Resultado requerido

El propietario proporciona una petición y archivos explícitos. El controlador
conserva sus bytes/versiones y nombres relativos, los prepara antes de cualquier
inferencia, y puede recuperarlos sin volver a leer una fuente local que haya
cambiado. Los agentes siguen leyendo por el broker y el juez relee después del
candidato. Los datos adjuntos no se convierten en instrucciones, hechos externos
verificados, productos generados ni prueba de que un método se haya ejecutado.

## Elecciones y razones

- Reutilizar Node fs, SQLite, registros inmutables, ownership y límites del broker;
  no introducir otro framework, daemon, base o endpoint de subida para este flujo.
- CLI con manifiesto --inputs separado de --file. Lista explícita de pares
  source/path; source identifica un archivo autorizado del host, path su nombre
  relativo en la misión. Sin glob, directorios recursivos ni búsqueda de datos.
  SDK admite bytes/texto explícitos y procedencia, no descubrimiento arbitrario.
- Capturar archivos regulares UTF-8 completos antes de publicar el trabajo.
  Rechazar enlaces, rutas de destino ambiguas/duplicadas/solapadas, datos inválidos
  o mayores que los límites vigentes del broker. No truncar ni normalizar Unicode.
  Comprobar identidad y estabilidad del archivo abierto; si cambia durante la
  lectura, conservar un error de admisión sin producir una misión incompleta.
- Persistir original y manifiesto de inputs en la MISMA transacción que misión,
  selección e idempotencia de envío. El ID de petición vincula también los nombres
  y hashes originales. Una repetición idéntica no recopia ni recrea; un contenido
  distinto no adopta el ID anterior. La procedencia inicial queda explícita.
- La cola sólo puede ejecutar con un protocolo que comprenda esa admisión. Fijar
  un nuevo floor en la transacción de creación; un ejecutor anterior no debe
  arrancar una misión omitiendo sus archivos. No elevar misiones sin adjuntos.
- Antes de producir, materializar únicamente el manifiesto durable en un workspace
  propio. Preparación e inferencia son fases distintas; no crear ni consumir una
  inferencia hasta verificar los bytes preparados. No releer source al reanudar.
- Recuperación por estado y contenido exactos: archivo ya preparado coincidente
  no se reescribe. Archivo ajeno, enlace, contenido cambiado o propiedad incierta
  no se sobreescribe para forzar éxito. Resolver expresamente ventanas de caída
  al crear directorio, temporal, publicación y commit; no adoptar huérfanos por
  su nombre ni borrar archivos desconocidos. fsync y pruebas SIGKILL donde aplique.
- Conservar el manifiesto original después de iniciar trabajo; no restaurarlo
  encima de cambios legítimos producidos después. Diferenciar input original,
  estado de trabajo y outputs con sus recibos. Detectar modificación no autorizada
  antes del primer consumo, no únicamente entre productor y juez.
- Preparar un adjunto crea una copia privada: declararlo como preparación del
  controlador, no ocultarlo como una escritura de agente inexistente. Los controles
  de no escritura de trabajo siguen describiendo su alcance real, no todo el host.
  No ofrecer copias si una prohibición explícita las incluye.
- Exponer nombres, hashes y condición USER_SUPPLIED_UNVERIFIED, no inyectar todo
  el contenido en cada prompt ni rutas privadas del host innecesarias. La lectura
  real sigue aportando el recibo y la relectura propia del juez. El origen local
  cambiante no se presenta como un archivo vivo sincronizado.

## Pruebas antes de promover

Pruebas negativas de paths/enlaces/UTF-8/tamaño/duplicados, source que cambia,
idempotencia y conflicto, creación atómica con cola activa, cero inferencias antes
de preparación, SIGKILL en las fronteras y recuperación sin sobrescritura,
inputs modificados antes/después del comienzo, compatibilidad/floor, CLI y SDK.
Conservar antiguos envíos sin archivos. Regresión completa del nuevo núcleo,
snapshot distinto y cualificación del flujo REAL de envío con archivos; no heredar
la calificación global del snapshot 3d2 como si cubriera código posterior.

Primero cerrar y auditar GoZbep con sus pins intactos. La instalación de 3d2 y el
ajuste de skill preparados no se han ejecutado. Su promoción como solución de
entrada integrada queda pendiente de esta carencia; no invalidar retroactivamente
sus resultados de lectura ni llamar a este documento una implementación.
