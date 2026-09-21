# Integración adaptativa versionada

14 septiembre 2026, 08:38 UTC. Servicio b7cb510c instalado tras cualificación
acotada y corrección de la relectura independiente de entradas. La CLI mantiene
selección explícita; la skill local selecciona v2 para nuevas peticiones.
No cambia misiones existentes ni acredita eficiencia general.

## Brecha observada y decisión

`mission-presets.mjs` ofrece sólo cuatro mecanismos en adaptive-v1. La entrada
habitual añade fichas compactas, vista del contrato del nodo y dos productos
puros simultáneos. No selecciona inspección completa de fichas durante el plan,
entrada cerrada v2, revisión de método ni cursor de lotes. Las pruebas separadas
de esas capacidades no demuestran que funcionen juntas.

Se reutilizan los mecanismos locales existentes y sus contratos, sin introducir
otro framework, clasificador por palabras clave ni agente de coordinación. Un
framework externo no sustituye los vínculos específicos de fichas, evidencia,
aceptación y protocolo durable ya existentes. La selección v1 queda literal e
inmutable. La v2 es una selección nueva y registrada, no una modificación de v1.

| Mecanismo v2 | Por qué se selecciona | Cuándo hace trabajo |
|---|---|---|
| closed-response-v2 | Respuesta pública y cierre recuperables, contrato propio sin asignar un rol incompatible | Entrada cerrada; si necesita efectos, evidencia externa o proceso material, pasa al plan |
| scoped-v1, lossless-json-v2, evidence-catalog-v1 | Reutilizar representaciones existentes, sin quitar campos ni criterios | Solicitudes y revisión con sus límites originales |
| compact-json-v1, node-contract-v1 | No repetir espaciado ni todo el plan donde basta el contrato exacto y su linaje | Compilación y contexto del productor; no resume las fichas |
| on-demand-v1, máximo 12 llamadas de planificación | Exposición comprobada de fichas completas antes de aceptar asignaciones | Consultas necesarias y propuestas; no obliga a doce llamadas |
| read-test-cursor-v1 | Conservar propuesta, cargos y recibos de un lote elegible tras interrupción | Sólo lotes read/list y opcional prueba final exacta; los demás no adquieren recuperación ficticia |
| reviewed-method-v1, una ronda | No agotar correcciones repitiendo el mismo método sin revisión causal | Sólo rechazo material agotado; plan nuevo revisado antes de producir |

Doce llamadas es un techo operativo inicial, igual al techo de propuestas de un
productor ordinario; no una estimación de coste ni evidencia de suficiencia para
cualquier proyecto. Una ronda permite probar un cambio revisado sin un ciclo
ilimitado de reinicios. Ambas decisiones quedan en la política congelada y pueden
ser sustituidas explícitamente al crear una misión. No hay reposición del
presupuesto global de inferencia ni cambios de modelo, herramientas, compras,
permisos o paralelismo por el preset. Las opciones explícitas prevalecen.

## Exclusiones necesarias

No se activa literal-windows-v1 globalmente: su protocolo documental no es
compatible con la recuperación ordinaria del cursor. La combinación se debe
rechazar **antes de guardar la misión o gastar inferencias**, no descubrirla en
el productor tras planificar. La lectura ordinaria de fuentes sigue disponible.
No se adopta el codec conjunto que falló su cualificación.

Las instrucciones aprendidas no se trasladan a scopes con batch, presupuesto o
inspección que no hayan sido cualificados: la barrera actual se conserva. La v2
no acredita R11 ni permite promover una mejora rechazada. La revisión de método
no aplica a protocolos ciegos, copia de entrada o documental; sus fronteras no
se mezclan ni se elimina la necesidad de resolver esos casos.

## Fronteras de aceptación de la selección

1. Definiciones versionadas e inmutables, prevalencia explícita, rechazo previo
   de conflictos sin misión/workspace/cola/inferencia y conservación de v1.
2. Recorridos integrados SIM de entrada corta y escalado a planificación con
   fichas, productor, cursor y juez; verificar la política realmente compilada,
   obligaciones, llamadas y ausencia de autocertificación.
3. Rechazo material, revisión de método y aceptación bajo esa misma selección;
   reentrada y presupuestos durables. No basta probar opciones por separado.
4. Regresión y cualificación real acotada del conjunto, con costes observados y
   lectura sustantiva del resultado. No repetir antiguos brazos como evidencia
   de una política distinta. Un caso no acredita eficiencia general.
5. Instalación conservadora y actualización de la entrada habitual sólo después
   de cerrar las fronteras anteriores. R01–R16 siguen abiertos donde falte prueba.

## Evidencia y decisión acotada

Los recorridos SIM integrados de `tests/factory/adaptive-integration.test.mjs`
cubren selección, corto/largo, herramientas, devolución, cambio de método y
recuperación. La global TymHUs cierra 1692 PASS/0 FAIL/1 SKIP con 324 entradas.
El primer LIVE WfS70I sigue fallido por una carencia real del controlador:
pedir al juez releer una entrada no ejecutaba esa lectura si no era un output.
68fae338 no se instaló. Tras corregir el vínculo original y el protocolo 5,
SIM whNNS3 y LIVE LFYIrU cierran la ruta input-only con relectura, cita propia,
recálculo y reapertura sin inferencias. El caso nuevo no exige ni simula uso de
cursor cuando basta una operación. No rehabilita el fallo anterior.

Siete llamadas reales y 152.181 tokens no justifican afirmar eficiencia óptima.
La selección hace accesibles mecanismos ya probados cuando son pertinentes;
no equivale a probar todas sus combinaciones y dominios. Instalación preservó
historial y permisos, sin nueva misión. La skill valida opciones instaladas,
conserva elecciones explícitas y no convierte consultas en nuevas ejecuciones.
Evidencia: `../verification/INPUT-REVIEW-RESULTS.md` y
`../verification/INPUT-REVIEW-INSTALLATION-2026-09-14.md`.
