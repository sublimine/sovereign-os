# Instrucciones de transporte del productor acotado

14 septiembre 2026. Diseño anterior al cambio. Instalado25d34 permanece intacto.

## Defecto observado y alternativa elegida

Las solicitudes reales0/1 de c6Q9gq tienen14967 bytes de instrucciones cada una:
9122 de prefijo completo y5825 de tarea. La tarea duplica íntegramente node.instructions
y anuncia lotes read/test, escritura/ejecución aunque esta ruta permite como
máximo un workspace.read. Esas instrucciones generales no conceden autoridad,
pero añaden coste y una ambigüedad evitable. Schema3419bytes; input12623/21117.
Juez:11258bytes instrucciones,31692input y9267schema; no se cambia en este paso.
Medidas de bytes, no estimación inventada de tokens ni ahorro real demostrado.

Preflight: reutilizar el contrato, generador JSON y broker propios existentes;
no biblioteca, framework, caché semántica ni modelo nuevo. Un recorte genérico
de instrucciones sería incorrecto para productores con escrituras, ejecución,
documentos o recuperación; sólo especializar transporte de bounded-read-response-v1.

## Invariantes

Conservar byte por byte prefijo completo compilado, ficha Ω22, node, criterios,
misión original, contextos/observaciones, schemas estructurales, límites, modelos,
recibos, política y controles. No abreviar premisas ni resúmenes del candidato.
Cambiar exclusivamente instrucciones de tarea del productor y descripción raíz
del schema, eliminando documentación de capacidades ausentes y la segunda copia
del node íntegro ya presente tanto en prefijo como task.node. No tocar descripciones
de claims ni enum/required/tipos; el schema no es una concesión de permisos.

Debe explicar claramente broker externo frente a sandbox nativo, tool/final/blocked,
campos inactivos, claims vacíos, método público, fallo y lectura completa. Aunque
batch no aporta ventaja, un lote de una única lectura previamente permitido sigue
siendo válido; no introducir incompatibilidad oculta. Historial heredado no es
acción propia ni lectura nueva. El juez y fallback completos no cambian.

No nuevo preset ni protocolo de almacenamiento: no nueva autoridad, formato de
respuesta ni paso de recuperación. Se conserva cada solicitud histórica exacta;
las respuestas retenidas se recuperan contra sus vínculos originales. Verificar
recuperación desde25d34 antes de promover. No modificar la instalación activa ni
reescribir cualificaciones previas para hacerlas coincidir con desarrollo nuevo.

## Cualificación prevista

Tests de forma y motor real/SIM: tres pasos con adjunto, dos sin herramientas,
lote de una lectura, permisos denegados, fallback, citas/relectura, cuotas y
respuesta retenida. Comparación exacta de bytes conservados; no sólo buscar frases.
Regresión completa y snapshot nuevo si los dirigidos pasan. Sólo después ensayos
reales prospectivos con modelo/esfuerzo/permisos/criterios iguales y auditoría
de respuestas; comparar también tokens y errores, no sólo tamaño de solicitud.
No repetir inventario conocido como única prueba ni proclamar causalidad con un
par. Si empeora calidad, repara/rechaza sin rebajar criterios. R01–R16 abiertos.
