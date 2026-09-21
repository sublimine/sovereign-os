# Historia material de replicadores

12 septiembre 2026. Desarrollo posterior a suite-SK6sfG, no instalado.

## Tres defectos reproducidos antes de la corrección

1. `productionScope` buscaba exclusivamente actores `producer`; un candidato
   creado por un `replicator` real del registro provocaba RUNTIME_INTEGRITY al
   preparar las observaciones del revisor.
2. `dependencyGates` también ignoraba los replicadores. Si una etapa tenía un
   intento temprano de réplica y otro posterior de productor, podía presentar
   como previa una aceptación que realmente llegó después del primer intento.
3. `nodeEffectInventory` excluía al replicador del conjunto de actores: un
   intent de escritura PREPARED inyectado en el ledger se contaba como cero.
   El ensayo no ejecuta una escritura ni atribuye ese permiso al adaptador.

Los tres tests fallaron antes del cambio. La corrección enumera ambos modos
materiales dentro de **la misma misión y nodo**, identifica el modo de cada
intento y conserva el corte histórico por secuencia de commit. Una etapa no
limpia su genealogía por cambiar de modo. Se siguen excluyendo actores ajenos y
hechos posteriores al candidato. Los inventarios de efectos incluyen al
replicador, también si el intent fue fallido, incierto o no debió existir.

## Alcance probatorio y compatibilidad

Esto permite entregar al revisor los registros reales de una réplica, pero
`mode:replicator` **no** es una prueba de sellado, diversidad ni éxito. No se
suprimen los guardas de asignación, no se otorgan herramientas y no se cambia
el planificador ni el servicio instalado.

Una cuarta prueba integra freeze/execute con el proveedor simulado del adaptador
y construye un candidato de ensayo mediante ArtifactRegistry. Su revisor puede
recibir la historia de ese actor y el hash de su única solicitud, sin el cuerpo
original. El candidato sigue CANDIDATE y no es utilizable como fundamento.
El esquema público de réplica no es el del trabajador ordinario: su cobertura
de feedback permanece `UNSUPPORTED_INPUT_SHAPE`, no se inventan arrays vacíos.
Los bytes de la solicitud sí se conservan con su hash antes del envío.

37 pruebas dirigidas PASS: 25 del adaptador, siete de historia de producción y
cinco de dependencias. Juicios/modelos simulados; SQLite y el segundo proceso
del test de recuperación son reales. Regresión global posterior registrada en
[STATUS](../verification/STATUS.md); ningún resultado simulado cualifica la
semántica de una llamada real.

## Siguiente integración necesaria

Crear un producto material vinculado al sello exacto, una proyección autenticada
del protocolo público y la solicitud realmente enviada, revisión independiente
del método/controles, comparación distinta con el original y aceptación final.
Reutilizar los juicios existentes cuando sirvan, sin añadir revisores decorativos.
La firma debe probar procedencia/orden y el juicio debe evaluar contenido: ni
una sustituye al otro. La ruta y su cualificación real siguen pendientes.
