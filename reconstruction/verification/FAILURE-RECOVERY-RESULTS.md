# Resultados de recuperación de productor

## Preflight de construcción, no modelo real

`failure-recovery-sim-dYBJIB`, sesión 85297 exit 2: cuatro llamadas SIMULADAS,
preparación SIGKILL real y todos los controles de progreso/oracle/aceptación
funcionaron. Dos checks finales fallaron: separateReviewer y ownReviewRead.
Diagnóstico: el harness trataba el retorno de workers.review (artefacto) como si
fuera el registro review. Se corrigió la lectura a la revisión enlazada por el
artefacto, sin cambiar runtime, criterios del producto ni evidencia.

El resultado fallido permanece. No hubo ninguna inferencia real ni instalación.
Preflight siguiente `failure-recovery-sim-UgQ1OK` cerró 23:53:23.609 UTC,
16003 exit 0: cuatro llamadas SIMULADAS, todos los checks PASS. Diez tests del
oracle pasaron, 127.394328 ms, incluyendo conversión/signo/proveniencia erróneos,
autocertificación y campos incorrectos. Pin/owner/capturas verificados antes del real.

## Brazo real cerrado y auditado

`failure-recovery-live-PRFwPC`, sesión 69561 exit 0, inició 23:54:34.801 UTC
y cerró 23:59:16.789 del 13 septiembre 2026. Todos los checks estructurales PASS.
Owner 2344319 / startTicks 52762468 / boot 2a077981-8aea-444e-8eff-44fa69814267.
Presupuesto seis llamadas, consumió cuatro reservas/llamadas reales: 11.012,
13.316, 18.335 y 25.124 tokens, total **67.787**. Cero caché observada en las tres
llamadas del productor; no se deduce la causa a partir de ese dato.

Secuencia real: fallo controlado ENOENT y SIGKILL antes de observar; entrada
aportada externamente después; productor nuevo hereda fallo; listado propio
identifica archivo; lectura nueva después de ese progreso; candidato numérico;
revisor distinto con lectura/listado propios y tres juicios de contenido ACCEPT.
Fallo commit 11, listado commit 44, lectura posterior comprobada. No escrituras,
comandos o red del broker. No se ejecutó planificador ni se marcó la misión completa:
el registro queda NEW por ser cualificación de workers, no recorrido engine.run.

Auditoría sólo lectura 14 septiembre 00:00:16.463 UTC:
[post-close-audit.json](runs/failure-recovery-live-PRFwPC/post-close-audit.json).
301 entradas de regresión, tres pins experimentales, petición/política/fichas
completas, cuatro reservas anteriores al despacho, recibos reales, cuatro threads
distintos, limpiezas observadas y veinte usos de citas literales reconciliados.
DB intacta: `c610a43476b1e7e36a318f96deb65863d53fcbadd709ec30110f3762d75049ce`.
Journal 179 / `79f95547ae539cada53f19edd46ee132713dd13c1293d461065bc2a91261abaa`.
Resumen `d89a612a68fe140e330c1059cf76f5e721d57e2d4615c111d0a0c2719457a7b6`.

## Inspección semántica posterior

Se leyeron las tres propuestas públicas, candidato íntegro, entrada cruda,
contexto de observaciones/criterios del revisor y sus tres razones completas.
1200 mg + 0,25 g × 1000 + 0,005 kg × 1000000 = 6450 mg; 6500−6450 = +50 mg.
El revisor recalculó también mediante fracciones exactas, conservó consistent=false
y distinguió discrepancia del total de calidad del informe. Cuatro citas internas
del productor se contrastaron literalmente con la entrada. No atribuyó a sí mismo
la reparación externa ni inventó causa del ENOENT, realidad física o incertidumbre.

Este es un caso controlado pequeño, no benchmark de rendimiento, holdout general,
planificación real ni metrología universal. El coste observado sigue siendo alto.
No se instala por este único PASS, no reetiqueta fallos previos ni cierra R01–R16.
