# Relectura independiente de entradas — corrección en desarrollo

14 septiembre 2026, 08:37 UTC. Corrección cualificada e instalada en b7cb510c.
El resultado real tiene alcance acotado; no cierra el mandato completo.

## Evidencia y causa

En la versión defectuosa, `WorkerService.review` vuelve a leer obligaciones de archivo y escrituras del
productor, y vuelve a listar directorios observados. Sin embargo, una entrada
obtenida únicamente mediante `workspace.read` llega al juez como observación
externa del productor: no se programa una lectura propia. El esquema del juez
ordinario permite emitir un dictamen, no solicitar esa herramienta. Añadir la
instrucción «el juez debe leer» al plan no hace ejecutable esa instrucción.

El diagnóstico aislado CVLfLT reproduce una aceptación con cero lecturas propias
mediante un juez SIM deliberadamente permisivo. La llamada real 6 de WfS70I
detecta la ausencia y devuelve correctamente el informe. Su aritmética desde
los operandos históricos es correcta; eso no acredita la versión actual. La
planificación había aprobado una revisión cuyo método no ejecutaba el motor.
Se bloquea instalar 68fae338. WfS70I cerró por plazo a las 07:31:15.122:
once llamadas completas, duodécima cancelada y sin entrega. Se reconcilió su
evidencia antes de modificar el núcleo; su resultado original no cambia.

## Contrato de la corrección

- La adquisición precede al cálculo; la comprobación propia del juez sucede
  después de crear el candidato. Un recibo histórico no se convierte en acción
  propia por copiarlo a otro contexto.
- El controlador identifica las entradas a partir de recibos propios auténticos
  y observados del productor, no a partir de afirmaciones del cuerpo ni nombres
  de herramientas permitidas. La obligación de leer no es una obligación de
  producir/escribir un archivo: `requiredEffects:file` no es el mecanismo.
- Cada entrada necesita identidad de archivo y versión. Lecturas repetidas de
  los mismos bytes pueden compartir una comprobación; versiones distintas no
  pueden reducirse silenciosamente a «la última». Una ambigüedad exige una
  disposición explícita; el orden de un array del modelo no la resuelve.
- Una lectura anterior a una modificación deliberada del mismo archivo no es
  el estado final del producto. La comprobación de una salida escrita debe
  seguir su versión de escritura; no se exigirá que conserve los bytes viejos.
- La lectura propia debe ser posterior al candidato, completa, de la misma
  misión y realizada por el revisor asignado. Aceptar requiere citarla. Si
  falta o difiere la versión, no se fabrica una prueba ni se repone presupuesto.
- Una comprobación síncrona al aceptar y al entregar debe detectar cambios
  posteriores a la lectura del juez. No equivale a bloquear al administrador del
  sistema operativo ni garantiza que el archivo nunca cambie después.
- El vínculo de esta obligación debe quedar versionado y verificable. La
  reentrada no puede perderlo ni añadir supuesta evidencia a aceptaciones
  históricas. La compatibilidad con ejecutores antiguos debe comprobarse antes
  de instalar. El formato implementado y su compatibilidad constan abajo.
- No se releen sin criterio todas las fuentes ni se conceden herramientas
  generales al juez. Las entradas de un candidato y los productos aceptados de
  sus antecesores tienen alcances distintos; el diseño debe conservarlos.

## Pruebas obligatorias

1. Entrada sólo leída, sin efectos de escritura: lectura propia, cita auténtica
   y mismo contenido; una respuesta SIM permisiva sin esa cita no se acepta.
2. Cambio de archivo entre productor/juez y entre juez/aceptación: rechazo
   material con evidencia conservada, no una aceptación basada en la historia.
3. Dos lecturas de la misma versión; versiones contradictorias; lectura seguida
   de escritura; dos entradas; fuente fallida; recibo de otro actor o misión.
4. Formatos ordinario, catálogo y documental: ningún formato evita la frontera.
5. Reinicio, preservación de artefactos antiguos, ejecutor antiguo ya abierto y
   apertura posterior a la promoción de protocolo que finalmente se adopte.
6. Recorrido integrado y verificación del contenido real. El coste de agrupar
   herramientas no justifica exigir una lista de directorio innecesaria.

WfS70I se conserva con su oráculo original: exigir tipos JSON numéricos y uso de
cursor/list no estaba en el encargo material. Separar esos defectos de medición
del defecto de relectura; no convertir retroactivamente la corrida en un éxito.

## Implementación y verificación actual

`input-file-review.mjs` reconstruye el origen inmutable del candidato y la última
versión comprometida de su productor anterior a él. Verifica recibos, identidad,
misión, contenido completo y orden de journal. Las lecturas directas exitosas
prevalecen sobre pistas externas de recuperación del mismo path; éstas cuentan
cuando no existe observación propia. Se conserva la historia, no se selecciona
silenciosamente entre versiones directas contradictorias. Los outputs escritos
se revisan por su contrato de escritura, no como entradas antiguas inmutables.

Cada revisor nuevo fija `inputReviewProtocol: input-file-review-v1` en su versión
original y promueve protocolo 5 atómicamente. El vínculo no puede borrarse en el
head para eludirlo. Revisores históricos sin el campo conservan su semántica
histórica, nunca reciben supuestas pruebas nuevas. `WorkerService` adquiere la
lectura propia antes de inferir; ambos formatos, ordinario y documental, exigen
su cita. El registro de aceptación impide el bypass de un caller permisivo.
Una ambigüedad, alteración de la vinculación o cambio de bytes requiere resolver
el estado: no gastar votos de calidad intentando hacer pasar el mismo defecto.

Integración dirigida 80380: 231 PASS/0 FAIL. Integridad más ocho cortes SIGKILL
del motor: 18 PASS/0 FAIL (86574). Ejecutable anterior 926c524d real, aislado:
cinco comprobaciones de compatibilidad pasan; escritores abiertos/nuevos
rechazan protocolo 5, se preservan 17 versiones históricas y una revisión nueva
sí obtiene la lectura propia. Evidencia en
`../verification/runs/input-review-compatibility-2TAW1V/post-close-audit.json`.

La primera global U9qZO8 terminó con 1690 PASS/1 FAIL/1 SKIP. La prueba fallida
corrompía candidato y review juntos: la nueva vinculación rechaza la corrupción
antes del control de protocolo ciego esperado. Se conservaron sus resultados y
se separaron ambos casos sin cambiar el motor: candidato genuino con controles
operativos insuficientes → BLIND_PROTOCOL; candidato reescrito →
INPUT_REVIEW_INTEGRITY. Las 114 pruebas de replicación ciega pasan. La segunda
global TymHUs/37691 cerró con 1692 PASS/0 FAIL/1 SKIP; snapshot b7cb510c de
429 archivos. SIM completo whNNS3 pasó 17 controles con siete respuestas
simuladas, relectura propia y reentrada sin inferencia; auditado tras cierre.
El único LIVE corregido LFYIrU/1075 cerró con siete llamadas y 17 controles PASS;
40 citas reconciliadas, recálculo propio explícito y reapertura sin inferencias.
El prerregistro nuevo prohíbe provocar la lectura declarando falsamente un
output de archivo. La instalación se realizó después de la revisión sustantiva
y de comprobar cola inactiva, backup privado y preservación de todas las versiones.
Véase `../verification/INPUT-REVIEW-INSTALLATION-2026-09-14.md`.
