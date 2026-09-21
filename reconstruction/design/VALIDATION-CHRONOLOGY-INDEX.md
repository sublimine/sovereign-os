# Índice efímero de posiciones históricas

## Problema y frontera de la solución

La revalidación del informe bilateral aceptado vuelve a comprobar cada cita,
firma, dependencia, control y exposición. Buscar cada posición cronológica
desde el primer evento multiplicaba las lecturas del mismo journal. Se conserva
la revalidación sustantiva: únicamente se reutiliza el índice de posiciones
`[tipo, identificador, versión] → secuencia` durante una llamada síncrona a
`ArtifactRegistry.review` o `ArtifactRegistry.assertUsable` y sus llamadas
anidadas. El índice se descarta en `finally`, también ante excepciones.

No es una caché de aceptación, validez de fuentes, contenidos, vigencia,
revocaciones ni decisiones del juez. Una llamada pública posterior construye
un índice nuevo. Sin conexión SQLite se mantiene la búsqueda anterior.

## Invalidación comprobada

La identidad del índice combina conexión, `total_changes()`, secuencia y hash
de cabecera, `PRAGMA data_version` y función lectora de eventos. Escrituras
propias, rollback, commits de otra conexión y sustitución del lector invalidan
su reutilización. Si la identidad cambia mientras se construye, el índice no
se conserva. Esto no convierte SQLite ni la VPS en un almacén inmutable.

La primera versión usaba sólo contadores y falló una contraprueba de rollback:
retenía secuencia 67 de una escritura revertida. Se añadió la identidad de
cabecera; la prueba ahora exige que esa posición vuelva a ser inexistente.
No se elimina ni se presenta como aprobado ese fallo inicial.

## Evidencia dirigida — 12 septiembre de 2026

La prueba inicial de revalidación registró 474 páginas y falló. Con el índice:
una página y las mismas 35 comprobaciones individuales de evidencia. Cuatro
pruebas específicas PASS incluyen rollback, otra conexión, cambio de lector
y renovación entre llamadas públicas. La batería dirigida ampliada de
blind-replication, planned-blind, artifacts y storage-history-integrity terminó
con **151 pruebas/151 PASS/cero fallos**, 114767,192685 ms. La regresión global
del código actual se lanzó después; este corte no le atribuye todavía un PASS.

## Medición sobre registros reales — 16:46:31.203 UTC

Una revalidación read-only por versión sobre el mismo candidato de 94TM7H:

| Implementación | Tiempo observado | Páginas de journal | Comprobaciones runtime |
| --- | ---: | ---: | ---: |
| Índice actual | 15171,584745 ms | 1 | 1018 |
| Runtime congelado 02be548e | 25577,929984 ms | 4576 | 1018 |

Se midió primero la versión indexada y después la congelada. Es **una muestra
por versión**, no una distribución, una garantía de latencia ni ahorro de
tokens del proveedor. Ambas revalidaciones aceptaron el mismo objeto completo,
hash `9761afd64b44ee21a7f2e1d8f9ea55b4ed349ae46d6aa921b7ec18b544419b0a`,
payload `f242b19a88350d9ba66d5c0f6bd768859dfb35c565fb35d91c4ca77e5ea840f5`,
y 54 dependencias de revisión. Journal y huellas no cambiaron; véase el corte
terminal de [94TM7H](../verification/COMPARISON-EVIDENCE-BILATERAL.md).

Código medido: `factory/lib/artifacts.mjs`, SHA-256
`a9c90a8e2ebd758c8b60dcba36cfc7e5712d8aa00f6b0be943e20cabe0aeb7ce`.
Paquete de referencia:
`02be548e18c2f58105958434d2476bc3f324dd53d55def3909675717479c65e9`.
El servicio instalado no se sustituyó. Los 15 segundos restantes y el coste
de inferencia requieren medición y trabajo adicional; no justifican omitir
comprobaciones para aparentar eficiencia.

## Corte global posterior — 17:02 UTC

Suite-6HfZqD: 722 pruebas/721 PASS/cero fallos/un SKIP, 190,63 s. Sus
206 inputs, conjunto de archivos y salidas coinciden a las 17:01:47.204;
sin interrupción. El código se congeló en 1588b9b9 (395 archivos/23814804 bytes),
con sus 58 inputs runtime coincidentes. No se instala automáticamente por ello.
