# Réplica sellada: contrato de implementación

10 septiembre 2026. Trabajo en desarrollo; no es una habilitación de todos los
métodos de Ω9/VERITAS04 ni una certificación de independencia cognitiva.

## Por qué este orden

1. Un protocolo material, revisado independientemente, vincula privadamente el
   original exacto y fija el problema público, método, controles, tolerancia,
   condiciones de parada y límites. El revisor debe comprobar que el paquete
   público no filtra solución, prestigio ni ruta original y conserva el objetivo.
2. El controlador congela ese protocolo y construye una solicitud exacta. El
   replicador sólo recibe la sección pública y su ficha completa: no recibe la
   petición global, plan, original, historiales, feedback ni workspace.
3. Una ejecución nueva, sin herramientas, registra su solicitud antes de llamar
   al proveedor. No se reintenta una ejecución incierta ni se reemplaza su salida.
4. Se conserva y sella el resultado público, los controles, desviaciones y
   desconocidos. Un UNKNOWN se conserva, pero no autoriza abrir el original.
5. El resultado sellado se materializa como candidato exacto y se somete a
   revisión independiente, con evidencia autenticada de la ejecución. Sólo su
   aceptación permite abrir el original para un comparador distinto. La réplica
   no puede continuar ni cambiar tolerancia. La apertura **no** equivale a una
   comparación ni a aceptación final de la afirmación original.

## Alcance inicial cerrado

El adaptador `closed-blind-v1` admite exclusivamente premisas completas dentro
del protocolo público. No adquiere fuentes, ejecuta código ni usa archivos.
La diversidad de método, controles y raíces compartidas requiere revisión
semántica; una declaración no prueba independencia. El original y sus campos
privados se excluyen por construcción de la solicitud, no por una instrucción
al modelo para que los ignore. El proveedor oficial ya impone hilo nuevo y
ausencia de herramientas; los dobles de test se etiquetan como simulación.

No se borra ninguna ficha. Los guardas que impiden usar Ω9/VERITAS04 como jueces
ordinarios siguen activos. La integración del planificador, comparación y
aceptación final, rutas con datos externos y cualificación real siguen pendientes.
No es un sandbox contra el administrador del VPS ni contra un controlador
malicioso. El sellado garantiza integridad/orden en el registro confiable, no
cifrado frente al propietario ni ausencia de conocimiento previo del modelo.

## Reutilización examinada

La [persistencia de LangGraph](https://docs.langchain.com/oss/javascript/langgraph/persistence)
proporciona checkpoints; sus [interrupciones](https://docs.langchain.com/oss/javascript/langgraph/interrupts)
permiten suspender/reanudar. Ninguna de esas dos funciones demuestra por sí sola
ocultación de una respuesta o diversidad metodológica. Las
[evaluaciones por pares de LangSmith](https://www.langchain.com/blog/pairwise-evaluations-with-langsmith)
comparan generaciones existentes: es una fase distinta de producir una réplica
sin ver el original. Esta es una conclusión de diseño a partir de esas funciones,
no una afirmación de inexistencia de toda implementación externa. Se reutilizan
el Store, Authority, catálogo y proveedor oficial ya verificados; añadir otro
motor de checkpoints no sustituye las fronteras que faltan.

## Pruebas necesarias antes de habilitarlo

Protocolo sin aceptar; candidato original cambiado/ajeno/retractado; filtración
estructural del original; cambio de contexto o feedback tras freeze; apertura
prematura; respuesta UNKNOWN; control omitido; hilo reutilizado; cancelación y
fallo de proveedor; reinicio durante RUNNING; idempotencia del sello/apertura;
tolerancia alterada; resultado divergente conservado; ausencia de promoción
automática del original; comparación independiente antes de entrega.

## Aprobación histórica — corrección del 12 septiembre

El primer adaptador consultaba el contexto **actual** del revisor del protocolo.
Un test adversario confirmó que aprobar sin ver el original y añadirlo después
podía habilitar indebidamente el freeze. Otro test detectó que el evaluador
`content` explícito, equivalente al predeterminado del registro, era rechazado.
Ambos fallaban antes de la corrección; no se cambió el objetivo de las pruebas.

Ahora se usa sólo la última aceptación exacta, en un registro de revisión v1,
y se resuelve la última versión de cada actor **anterior a su commit**. El juez
debía tener ya el original y protocolo en su contexto, con inferencia terminada
en esa exposición y sin compartir hilo con el productor original. Los hashes,
versiones y secuencia de esa aprobación quedan dentro del registro firmado de
freeze y se comprueban al ejecutar y abrir. Las fechas de pared no deciden el
orden. No se reescriben registros ni se añade evidencia retroactiva.

Los cinco IDs/textos/orden/evaluadores deben seguir siendo idénticos; únicamente
la ausencia de `evaluation` se normaliza a `content`, como en ArtifactRegistry.
Sustituir un juicio semántico por un control mecánico no es equivalente.

24 pruebas dirigidas PASS con proveedor y juicios semánticos **simulados**,
incluyendo un segundo proceso real con SQLite. Conservan UNKNOWN, divergencia,
controles fallidos, cancelación y aperturas inválidas. Un fixture adicional
intentó retirar contexto y falló con `CONTEXT_ERASURE`: se corrigió para añadir
instrucciones posteriores, manteniendo la prohibición de borrar exposición.
Esto no cualifica inferencias reales ni habilita el planificador ordinario.

Actualización posterior del 12 septiembre: la [frontera de revisión material](SEALED-MATERIAL-REVIEW.md)
ya está implementada en desarrollo y obliga a revisar el intento antes de abrir.
La [comparación determinista acotada](PREREGISTERED-COMPARISON.md) y la revisión
de su informe están implementadas posteriormente, con juicios simulados. Faltan
comparación semántica general, cualificación real e integración de la
ruta. `open()` sigue siendo una API privada para el controlador, no una herramienta
de agente. Los cortes y resultados anteriores se conservan como históricos.
