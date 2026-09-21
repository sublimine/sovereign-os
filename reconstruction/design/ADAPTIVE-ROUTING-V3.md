# Enrutamiento adaptativo v3: frontera directa y planificada

Estado: **desarrollo no instalado**. Este documento describe un contrato del
árbol de trabajo; no declara que el servicio activo de la VPS use `adaptive-v3`
ni que el mandato R01–R16 esté aceptado.

## Problema que resuelve

Una petición corta no debe gastar planificación, fichas, inferencias y jueces
por ceremonial. Pero una respuesta aparentemente corta puede contener un hecho
actual, ambigüedad, archivos, efectos, contexto local o una conclusión que no
se pueda calcular desde una gramática finita. Tratarla como “directa” por
palabras clave degradaría la calidad precisamente en los casos donde hace falta
investigar, planificar y revisar.

`adaptive-v3` no intenta adivinar si una respuesta parece fácil. Sólo admite
una vía sin proveedor cuando puede reconstruir el resultado exactamente desde
una solicitud inmutable y una gramática explícita. Todo lo demás se endurece a
la planificación completa.

## Decisión de ruta

La creación de misión calcula y firma una decisión versionada que conserva el
modelo y el esfuerzo solicitados sin sustituirlos. El selector sólo puede elegir:

| Ruta | Se permite cuando | No se permite |
|---|---|---|
| `closed-response-v3` | Transformación literal delimitada o derivación formal finita, sin entrada local, fuente, efecto ni ambigüedad; la materialización exacta cabe en sus límites | Hechos, investigación, archivos, ejecución, herramientas, entradas del usuario, salida creativa o petición fuera de la gramática |
| `planned` | Cualquier otro caso, incluido un límite de recursos alcanzado | El usuario no puede rebajar una obligación de planificación solicitando la vía directa |

La misión conserva una ruta firmada `adaptive-v3-route` ligada a `mission@1`,
su política, la huella de la entrada si existe, la versión del selector y el
preflight de materialización. En cada frontera se vuelve a derivar. Sólo pueden
cambiar campos de ciclo de vida; una modificación de intención, política,
modelo, esfuerzo, manifest de entrada o ruta bloquea la misión.

## Cadena de la ruta directa

La vía directa no finge que una comprobación mecánica sea una revisión humana o
semántica. Su cadena es estrictamente:

```text
mission@1 + ruta firmada
        │
        ▼
preflight y recomputación exacta
        │
        ▼
único productor nativo sin proveedor
        │
        ▼
origen firmado → candidato v1 → certificado firmado → artifact v2 ACCEPTED
```

El certificado declara de forma expresa `provider: none` y
`semanticReview: none`. Sólo acredita igualdad byte a byte con la
recomputación, la ausencia de la maquinaria prohibida y el orden durable de
los registros. No acredita verdad factual, calidad general de un texto ni una
revisión independiente de modelo.

La reentrada vuelve a validar la cadena histórica. No crea un segundo
productor, candidato, certificado, inferencia, revisión ni efecto.

## Fronteras que impiden una degradación silenciosa

1. **Motor.** La entrada directa se intenta antes de preparar inputs, recuperar
   ledger/broker, validar snapshots o llamar al planificador. Una ruta directa
   corrupta queda `NEEDS_DIRECTION`; nunca se reinterpreta como planificada.
   La materialización vive en un método privado de `FactoryEngine`: no existe
   un runner genérico exportable ni una API pública que acepte un motor de
   apariencia compatible para fabricar el productor, origen, candidato o
   certificado reservados.
2. **Registro de artefactos.** En una ruta directa sólo se registra el productor
   nativo reservado. No se puede crear un producto alternativo, usar un revisor
   ordinario ni consumir un artefacto ACCEPTED que no tenga su certificado de
   recomputación.
3. **Workers y broker.** Crear worker, solicitar inferencia, emitir lease,
   ejecutar herramienta o reconciliar efectos vuelve a validar la ruta y se
   rechaza para `closed-response-v3`.
4. **Informe y CLI.** La vista pública expone la ruta, versión y referencias
   necesarias, pero no filtra el razonamiento interno del selector ni presenta
   la certificación mecánica como evaluación humana.

Estas capas son deliberadamente redundantes: una llamada interna indebida o un
registro duradero manipulado debe parar, no encontrar una ruta alternativa de
menor calidad.

## Pruebas y límites de la afirmación

La cualificación local cubre gramática y límites, firma/rederivación de ruta,
orden de registros, reentrada, corrupción de ruta/manifest/certificado,
intentos de registrar actores y artefactos alternativos, workers/broker con un
actor forjado, y una misión marcada artificialmente como completada. También
mantiene regresiones de workers, broker, búsqueda, presets y CLI.

La matriz incluye además rutas `planned` con SQLite y broker reales, y
proveedores SIM declarados: una conserva planificación inspeccionada, revisión
independiente y reentrada sin nueva inferencia; otra escribe y relee un archivo
con identidad de revisor separada; una tercera conserva un rechazo material y
exige un método causalmente distinto antes de aceptar la revisión. Estas pruebas
acreditan custodia y recuperación del flujo, no verdad factual, juicio semántico
del proveedor ni calidad general del plan.

Esto no demuestra calidad universal de las respuestas planificadas, equivalencia
entre modelos, funcionamiento continuo de varios días, ni superioridad frente a
otro sistema. Una tarea que requiera hechos, cambios en archivos, investigación
o juicio sustantivo sigue necesitando el plan, evidencia y aceptación
independiente ordinarios.
