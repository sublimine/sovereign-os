# Contrato propio del productor — node-contract-v1

Desarrollo 2026-09-10, no instalado ni cualificado con inferencia real al redactar
este contrato. El ensayo Q7iZzelI identificó que cada productor recibía el cuerpo
completo del plan aceptado. Aunque no reciba un producto hermano, puede leer sus
instrucciones. No se debe llamar ceguera general a ese aislamiento de artefactos.

La opción persistente `producerContext: node-contract-v1` / CLI
`--producer-context node-contract-v1` conserva el plan original como dependencia
aceptada y versionada. En el contexto de producción sustituye su exposición
completa por `planViews`: nodo propio íntegro, requisitos servidos íntegros y,
para el producto final, todos los requisitos. No incluye contratos de otros nodos,
su método/especialista ni la explicación global de routing. La petición original
se conserva sin recortar; también los inputs aceptados y sus pruebas.

El plan original no recibe otro cuerpo bajo el mismo hash: no aparece como
artefacto completo en esa exposición. La vista tiene hash propio, conserva
identidad/hash del origen y se recompone exactamente desde el registro para
validarla. Es metadata de contrato, no nueva fuente factual ni un producto
inventado con aprobación de modelo. El registro de contexto conserva la vista
antes de inferir; no puede borrarse, ampliarse o cambiarse al reanudar. La historia
de producción declara explícitamente NODE_CONTRACT_VIEW y el hash observado.

El planificador y los jueces conservan el contexto completo que les corresponde.
Las versiones y misiones antiguas no se migran. El formato pertenece al scope de
aprendizaje del productor, por lo que no hereda overlays evaluados con otra
exposición. No modifica adaptive-v1 ni el servicio instalado f452c286.

## Límites intencionados

- No garantiza ausencia semántica de pistas en la petición, requisitos compartidos,
  contrato propio, feedback o producto de un prerrequisito legítimo.
- No aísla archivos dentro de un mismo workspace ni cambia permisos de herramientas.
- Un juez que vio el plan completo puede escribir feedback con pistas; eso exige
  un contrato de revisión más estricto si la petición requiere ceguera semántica.
- El conocimiento previo del modelo no se borra ni se presenta como independiente.
- La vista es una selección causal de contrato, no compresión sin pérdida del plan
  completo. Todos los requisitos se conservan en el mandato y la aceptación final.

La aceptación exige tests de canal con marcadores exclusivos por rama, hash de
origen/vista, integridad/reentrada, conservación final y rechazo de omisiones o
cambios. Después se necesitará una misión nueva sobre paquete congelado, lectura
de contratos/productos/razones y examen del contexto realmente despachado. Un
test sintético no certificará por sí solo independencia intelectual universal.

Primeras pruebas dirigidas: siete PASS. Dos fixtures iniciales intentaron instalar
su plan sin adquirir el propietario del coordinador y recibieron NEEDS_DIRECTION;
se corrigió la preparación de los fixtures, no el guard de propiedad. Los otros
68 controles del primer lote pasaron. El CLI y el scope de aprendizaje cuentan
con tests propios, sin llamadas reales al modelo ni arranque de esa cola de prueba.

Regresión completa posterior suite-ImGn5s: 527 pruebas, 526 PASS, cero fallos y un
SKIP live; paquete f4867dc0, 379 archivos, coincide con el código probado. Ensayo
h53t6RZV iniciado 03:08:47 UTC sobre ese paquete no instalado. Reutiliza exactamente
la petición matemática de `run-live-pure-parallel.mjs`, pero ejecuta una misión
nueva Astra/ultra y conserva las solicitudes exactas antes de pasarlas al proveedor.
No se inyectan marcadores en los contratos generados por el planificador real.
Resultados/razones pendientes al registrar este despacho; no duplicar el ensayo.
