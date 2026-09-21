# Entrada con lectura acotada: construcción y evidencia

14 septiembre 2026, 10:36 UTC. **Candidato de desarrollo; no instalado.**
Servicio b7cb510c intacto. El árbol de trabajo ya no coincide con TymHUs;
sus tests y LIVE históricos no cualifican este candidato. R01–R16 abiertos.
[Contrato y límites](../design/BOUNDED-READ-ENTRY.md).

El nuevo modo explícito `bounded-read-response-v1` reutiliza producción durable,
broker, registro de aceptación y relectura propia del juez. No cambia los presets.
Máximo una intención de lectura, archivo UTF-8 completo hasta 65.536 bytes. Sólo
delimita la ruta; fuera de alcance conserva el encargo para planificación. No
acredita elegibilidad semántica, verdad externa o eficiencia por su existencia.

## Pruebas dirigidas cerradas

Los conteos corresponden a ejecuciones distintas, **no se suman como cobertura**.
Proveedor simulado; SQLite, archivos, broker y los SIGKILL señalados son reales.

| Sesión | Pruebas | PASS | FAIL | Duración ms | Disposición |
|---|---:|---:|---:|---:|---|
| 43766 | 21 | 20 | 1 | 10750.658631 | Recuperación intentaba leer una respuesta anterior a la petición que falló por cuota; el control de integridad bloqueó. Se corrigió selección, no el control. |
| 82527 | 21 | 21 | 0 | 10893.408149 | Primera corrección pasa. |
| 22285 | 133 | 132 | 1 | 21788.45357 | Fixture cancelaba durante inferencia pero esperaba aceptación ya guardada. Se conservaron ambos momentos en pruebas distintas. |
| 64062 | 126 | 123 | 3 | 27405.706102 | Contabilidad sólo reconocía protocolos 4/5; se añadió el nuevo 6, conservando rechazo de desconocidos. |
| 49184 | 107 | 107 | 0 | 22339.429298 | Ruta, floor, contabilidad e input-review. |
| 26273 | 52 | 52 | 0 | 34836.636295 | Entrada y CLI; permisos explícitos nuevos e idempotencia, sin iniciar inferencia al enviar. |
| 33934 | 4 | 4 | 0 | 2802.815515 | Cursor: PREPARED, recibo antes de observarlo, observación antes del siguiente paso; incertidumbre no reintentada. |
| 76804 | 11 | 11 | 0 | 14027.248962 | Once SIGKILL reales del motor completo. |
| 1415 | 104 | 104 | 0 | 37832.380651 | Conjunto posterior con cola, CLI, v2 y nueva vinculación incluso al reanudar un resultado completado. |

Los SIGKILL cubren contrato antes/después de commit, lectura preparada/enviada/con
recibo, cierre del productor, candidato, checkpoint de revisión, juicio, entrega
antes/después de commit. PREPARED recupera su misma operación; DISPATCHED sin
recibo permanece NEEDS_DIRECTION sin otra llamada. Los casos recuperables usan
tres propuestas simuladas totales, una lectura de productor y otra del juez.
Esto prueba protocolo y conteos del fixture, no razonamiento real ni años de uptime.

## Compatibilidad aislada

[zYQ8Rk/89129](runs/bounded-read-compatibility-zYQ8Rk/summary.json), cerrado
10:02:03.749; auditoría de sólo lectura 10:02:59.139. Código anterior real
b7cb510c rechaza protocolo 6 al abrir y al intentar escribir desde una conexión
ya abierta. El nuevo lector conserva 50 versiones anteriores y su aceptación,
sin recertificarla. Tres respuestas simuladas del ejecutor anterior; cero
inferencias de suscripción. Journal 67, hash
`71d283bd26514b49039c14340b52df5c53c182354d3e43b22beb90af4a805d9c`.
Owner 2599197/startTicks 56407221 ausente, diez pins intactos en esa auditoría.
Summary SHA-256 `83f7c2cc8593adc920aded2d12a2d1a1383a058c7dee73cd16b1eb89f06e934a`.

**Límite temporal:** después de esa auditoría se reforzó la comprobación de
misión al reanudar COMPLETED en engine/bounded-read-contract/bounded-read-entry.
Sus pins históricos no describen esos tres archivos actuales. El código de
Store/input-file-review/contabilidad que impide el downgrade no cambió. No se
repitió el mismo experimento para presentar una prueba nueva equivalente.

## Regresión y primer ensayo real cerrados

Global wm3d8Q/65729: 1749 tests, 1748 PASS/0 FAIL/1 SKIP, 459838.286982 ms;
cierre 10:17:40.262. Auditoría 10:25:06.747, 331 inputs, cuatro streams idénticos
al resumen y dos owners ausentes. Snapshot 3d2f562a, 432 archivos/24.266.432 bytes.

SIM ByWPM5/64289 cerrado, tres respuestas simuladas; auditoría persistida
10:26:39.192, seis usos de citas, protocolo 6, journal 99. Primera salida de
auditoría truncada sólo en terminal; se recapturó completa sin repetir el ensayo.

[LIVE ocSk6B/58072](runs/bounded-read-live-ocSk6B/summary.json), cerrado
10:30:41.720: tres llamadas reales, 14 controles aprobados, cero reparaciones.
Auditoría 10:34:40.810: 331+7 pins, owner ausente, tres cierres observados,
once usos de citas y DB intacta; protocolo 6, journal 153. Secuencia durable:
lectura productor 39 → candidato 74 → relectura propia juez 82 → juicio 138 →
aceptación 139. Reentrada sin inferencia ni mutación material. El juez recibió
su ficha completa y explicó su propio recálculo de 6450 mg y diferencia +50.

| Consumo observado | Histórico LFYIrU | Nueva entrada |
|---|---:|---:|
| Llamadas | 7 | 3 |
| Entrada | 129585 | 35853 |
| Salida | 22596 | 7093 |
| Total | 152181 | 42946 |
| Cache incluida en entrada | 27392 | 2688 |

Reducción histórica total 71,779657%, superior al umbral previo de 25%.
Petición, archivo, modelo/esfuerzo, permisos y presupuesto conservados; sólo
entryMode distinto. No comparación aleatorizada/causal ni ahorro general.
Las tres respuestas, ficha del juez, criterios, citas y alcance se revisaron
materialmente: [aceptación acotada](runs/bounded-read-live-ocSk6B/semantic-disposition.json).
El texto del candidato conserva CANDIDATE y revisión pendiente como descripción
de su fase de creación; la aceptación posterior reside fuera del producto.

Una consulta opcional posterior de cronología falló por usar Store.history, que
no existe; transacción de sólo lectura cerrada. Consulta corregida con get por
versión confirmó la secuencia arriba, sin volver a ejecutar la misión.

## Pendiente

Cualificar transformación con datos adversariales, derivación formal sin archivo
y abandono real del atajo cuando se exige planificación previa. Casos y oráculos
prospectivos en experiments/BOUNDED-APPLICABILITY-QUALIFICATION.md. No convertir
este caso conocido en garantía general, instalar automáticamente o cerrar R01–R16.
