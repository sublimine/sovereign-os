# Umbral de deduplicación: medición offline, sin adopción

13 septiembre2026,12:29:33. Se probaron los parámetros existentes del codec
packJsonContext sobre las17solicitudes originales cerradas de2cYEbW y
G1ZuZR. Primero se comprobó que decodificar y recodificar con el valor por
defecto producía exactamente el input original. Después se midieron umbrales
de512y256bytes, exigiendo en todos los casos reconstrucción exacta del JSON
completo. No se proyectaron estados actuales ni se quitaron campos o fuentes.

| Solicitudes originales | Cantidad | Bytes originales | Umbral512 | Umbral256 |
|---|---:|---:|---:|---:|
| 2cYEbW documental | 11 | 658851 | 651882 | 632563 |
| G1ZuZR cerrada v2 | 2 | 20256 | 19671 | 19319 |
| G1ZuZR planificada | 4 | 162924 | 162924 | 161198 |

El umbral256 reduce los bytes de entrada3.990%,4.626%y1.059%, respectivamente.
No incluye instrucciones/esquemas y no equivale a tokens de modelo, coste
total ni mejora semántica. Las nuevas referencias pueden dificultar lectura y
citas aunque sean reversibles; no se ha probado eso con el proveedor.

Se conserva como preflight no adoptado. Prioridad actual: terminar la
cualificación de operaciones por lotes, que elimina propuestas intermedias
cuando sus operaciones son independientes. No se cambió el codec, un preset,
el input activo bckJet o un resultado histórico; no se hicieron inferencias.
Una adopción futura exigiría pruebas adversariales y calificación prospectiva,
no simplemente presentar ahorro de bytes como ahorro de tokens.
