# Matriz de cualificación de la ruta planificada adaptive-v3

## Estado de este documento

La matriz determinista de CI descrita aquí está implementada en
`tests/factory/adaptive-v3-qualification-matrix.test.mjs`, con el adaptador
explícito `adaptive-v3-planned` de
`reconstruction/verification/full-route-harness.mjs`. Cada brazo usa una
base SQLite y un workspace nuevos; todos los proveedores de la matriz son
`SIMULATED`. La fila de archivo y prueba ejecuta además un oráculo local
aislado, que se clasifica separadamente como `REAL_LOCAL_ISOLATED`.

Esto no es una ejecución de suscripción, no crea una misión en la cola, no
modifica el runtime instalado y no certifica proveedor, modelo, web, verdad
factual ni cumplimiento total de la fábrica. El auditor post-cierre está
implementado en `reconstruction/verification/adaptive-v3-qualification-audit.mjs`
y se ejercita contra cada fila antes de que su directorio temporal se elimine.
No crea motores, proveedores, brokers ni runners; abre la SQLite cerrada con
URI `immutable=1`, modo defensivo, `readOnly` y `query_only`, rechaza
sidecars WAL/SHM y compara los bytes de evidencia antes y después. Puede
invocarse desde el mismo proceso de pruebas: no declara ni demuestra un nuevo
proceso de sistema, host ni identidad de proceso.

La evidencia de una fila cerrada también puede conservarse mediante
`reconstruction/verification/adaptive-v3-evidence-bundle.mjs`. El bundle
captura el árbol completo después de B, vuelve a enlazar el workspace retenido
con la validación B firmada y exige un SHA-256 del manifiesto conservado fuera
del propio bundle para poder reauditarlo. Esta capacidad no convierte CI en
una ejecución live ni la retención local en almacenamiento WORM, procedencia
externa, frescura o protección frente al administrador de la VPS.

La brecha que motivó este corte era la siguiente: la ruta planificada de
`adaptive-v3` tenía pruebas estructurales propias, y el repositorio contenía
evidencia separada sobre fuentes, ejecución aislada, recuperación y
especialistas, pero no una matriz pequeña que demostrara, bajo **la misma ruta
planificada V3**, cuáles de esos controles se conservan en categorías
representativas y qué límite exacto tiene cada demostración.

El objetivo es cerrar esa brecha con evidencia acotada y auditable. No es
demostrar que la fábrica sea correcta para toda petición, que un modelo sea
correcto en general, ni que una fuente externa sea verdadera.

## Regla de honestidad de la evidencia

Cada resultado de la matriz debe llevar una clasificación explícita. Ninguna
clasificación puede sustituirse por lenguaje promocional ni por una inferencia
a partir de una prueba vecina.

| Clase de evidencia | Qué acredita | Qué no acredita |
| --- | --- | --- |
| Estructural | Integridad de los recibos, firma, linaje, selección de ruta, separación de actores, persistencia y reentrada B sin trabajo nuevo fuera de sus lecturas validadas. | Que el contenido producido sea verdadero, útil o semánticamente correcto, o que B corresponda a otro proceso del sistema. |
| Operacional | Que una acción declarada ocurrió en el entorno acotado registrado: por ejemplo, un programa aislado se ejecutó o se observó una respuesta de un transporte. | Disponibilidad futura, seguridad universal del entorno, verdad de una página o calidad general del modelo. |
| Oráculo controlado | Que una salida satisface una expectativa finita, predeclarada e independiente de la entrada del proveedor o modelo. | Generalización fuera del caso, comprensión semántica general o validez factual externa. |
| Semántica o factual | Una conclusión propuesta por un productor o revisor, con su procedencia y sus límites. | Verdad por el mero hecho de haber sido emitida, citada o aceptada internamente. |
| Live o de suscripción | Nada por defecto. Sólo puede existir después de una ejecución manual, autorizada y registrada como tal. | Que escribir este diseño, ejecutar CI o usar fixtures haya validado una cuenta, cuota, proveedor o suscripción. |

Las etiquetas `SIMULATED`, `REAL`, `NOT_RUN` y
`OBSERVED_NOT_QUALIFIED` son obligatorias cuando procedan. No se puede
convertir un dato ausente, simulado o fallido en una evidencia real mediante
un resumen.

## Alcance del corte

El corte añade una cualificación, un auditor de sólo lectura y dos controles
de runtime deliberadamente estrechos. No es un cambio de política general ni
una autorización para reanudar, reparar o recrear una entrega ordinaria:

- `FactoryEngine.run(..., {validationOnly:true})` sólo admite una misión V3
  firmada, `planned`, ya `COMPLETED` y sin manifest de entrada. Ante una
  validación fallida devuelve el error al llamador; no invalida el artefacto,
  no cambia estado, no recupera ledger/broker, no planifica, no infiere ni
  activa aprendizaje.
- `WorkerService.verifyWorkspaceSnapshot()` mantiene los leases provisionales,
  la validación firmada y su evento en una única transacción SQLite. En la
  rama `validationOnly`, `recordFailure:false` evita el evento histórico de
  fallo; si una relectura falla, la transacción revierte leases y validación.
- B abre `Store`, `Authority` y la raíz de workspace en modo existente: una
  base, clave o raíz ausente falla antes de crear, cambiar permisos o inicializar
  un recurso. Sólo después de esa frontera B puede dejar sus commits de lease y
  `workspace-validation` permitidos.

La entrada normal sin `validationOnly` conserva su ruta ordinaria; estos
controles no declaran que todo tipo de reentrada futura sea inocua.

Archivos de la implementación de CI actual:

- `reconstruction/verification/full-route-harness.mjs`: adaptador de casos
  de ruta completa ya existente.
- `reconstruction/verification/full-route-cases.mjs`: brazos de prueba
  predeclarados para la ruta `adaptive-v3`.
- `tests/factory/full-route-harness.test.mjs`: cobertura del arnés.
- `tests/factory/adaptive-v3-qualification-matrix.test.mjs`: matriz
  determinista y de fixtures de las cuatro filas.
- `reconstruction/verification/adaptive-v3-qualification-cases.mjs`:
  brazos CI inmutables y separados de los brazos live históricos.
- `reconstruction/verification/adaptive-v3-qualification-audit.mjs`:
  reconciliación post-cierre, de sólo lectura, de una fila explícita.
- `reconstruction/verification/full-route-audit.mjs`: auditor del delta
  inmutable de journal de la reentrada B.
- `reconstruction/verification/adaptive-v3-evidence-bundle.mjs`: retención
  local post-cierre, enlace portable workspace↔validación B y reauditoría con
  ancla de manifiesto externa.
- `factory/lib/engine.mjs` y `factory/lib/workers.mjs`: superficie mínima de
  `validationOnly` y snapshot atómico descrita arriba.
- `tests/factory/validation-only-reentry.test.mjs`: deriva adversarial de
  archivo alterado después de cerrar A, sin residuo de lease, validación,
  estado, efecto ni fallback.
- `tests/factory/reentry-existing-only.test.mjs`: rechazos sin inicialización
  de base, clave o raíz de workspace durante la construcción de B.

Archivos reservados para una fase posterior, sólo con una necesidad y una
autorización explícitas:
- `reconstruction/verification/experiments/qualify-adaptive-v3-planned-matrix.mjs`:
  ejecutor opt-in de observación, si se implementa y se autoriza.
- `reconstruction/verification/experiments/audit-adaptive-v3-planned-matrix.mjs`:
  auditor posterior de sólo lectura.

Quedan fuera de este corte:

- ampliaciones generales de `FactoryEngine`, `WorkerService`, catálogo de
  roles, cola o política de misión más allá de la ruta explícita
  `validationOnly` y de su snapshot atómico;
- creación de departamentos, especialistas o herramientas nuevos;
- modificación automática de `AGENTS.md` o aprendizaje de agentes;
- despliegue, compra, conexión o validación de una suscripción;
- cualquier conclusión de calidad universal, autonomía ilimitada o corrección
  factual general.

## Invariantes comunes de la ruta

Las cuatro filas se ejecutan con `preset: 'adaptive-v3'` y solicitan
`entryMode: 'planned'`. Antes de interpretar el resultado, el auditor debe
comprobar el registro de ruta y rechazar la fila si no demuestra todos estos
invariantes:

1. El modo seleccionado es `planned`; existe un plan material y la
   aceptación requerida del plan.
2. No aparece un origen, certificado, ejecución o artefacto de la ruta
   directa como sustituto de la ruta planificada.
3. La secuencia usa los actores ordinarios de planificación, producción y
   revisión permitidos por la política; productor y revisor tienen
   identificadores distintos y el revisor no recibe la conversación privada
   del productor.
4. Los recibos de fuente, ejecución, efecto y revisión conservan su linaje,
   sus hashes y su relación con la misión.
5. Tras cerrar A, B es una instancia nueva en proceso contra la misma SQLite
   y workspace persistidos. Su fachada congelada no provoca proveedor,
   inferencia, fetch, efecto, reescritura ni ejecución nuevos. Sólo se
   permiten las lecturas, arrendamientos, snapshots y registros de auditoría
   explícitamente declarados.
6. El informe final identifica el modo elegido y sus referencias de ruta; no
   presenta una calificación estructural como validación semántica.

Un test que sólo compruebe el texto final no satisface esta matriz.

### Reentrada B de capacidad reducida

La primera instancia A completa la misión y se cierra antes de construir B.
B crea `Store`, `Authority`, `ArtifactRegistry`, `PlanLedger` y
`FactoryEngine` nuevos sobre el mismo `state.sqlite` y workspace. La matriz
comprueba referencias de objeto distintas para A/B y el journal durable para
las mutaciones permitidas; eso acredita una instancia nueva **in-process**,
no un reinicio del proceso Node, PID distinto, host distinto ni identidad de
proceso verificable desde SQLite.

Antes de construir `WorkerService` y los servicios auxiliares de B, el arnés
le entrega una fachada de broker `Object.freeze(...)`, no un `ToolBroker`
parcheado. La fachada declara transporte de fuente `UNAVAILABLE` y red
`DISABLED`, no expone runner de ejecución y rechaza con
`REENTRY_FORBIDDEN` toda superficie no listada. Sólo expone:

- `workspace.read` y `workspace.list` para la misión exacta;
- `executionSnapshot` únicamente para contrastar una obligación de ejecución
  histórica, sin lanzar una ejecución;
- `toolDeadline` para esas dos lecturas, clasificación de workspace y las
  consultas de disponibilidad negativas necesarias para el snapshot.

Proveedor, producción, revisión, recuperación, `execute`, fetch, búsqueda,
reconciliación, registro de workspace, escritura, ejecución y aprendizaje no
son capacidades de B. La traza de intentos bloqueados y las lecturas permitidas
se enlazan al delta firmado del journal; una traza limpia no equivale a probar
que un administrador del host no pudiera alterar recursos fuera de la prueba.

El snapshot de B puede dejar dos commits de coordinación del motor
(`engine` adquirir/liberar) incluso cuando la validación falla. No se presenta
esa realidad de WAL/journal como "cero escrituras": la garantía acotada es
que no sobrevive ningún lease de lectura, `workspace-validation`, evento
`workspace.validation.failed`, cambio de misión/artefacto/efecto ni fallback.
En éxito, los leases de lectura y la validación firmada deben coincidir
exactamente con el delta auditado; en fallo, la transacción los revierte.

## Filas de la matriz

| Fila representativa | Evidencia requerida | Oráculo o revisión independiente | Afirmación permitida | Afirmación excluida |
| --- | --- | --- | --- | --- |
| Fuentes públicas | Recibos de las dos fuentes predeclaradas, sus hashes, citas exactas, plan V3 aceptado y revisión independiente de contenido. | El caso controlado `distinct-two-publishers` y `gradeRouteContent`, con documentos congelados y separados de la salida del proveedor. | Que la ruta planificada preservó procedencia, diversidad declarada y trazabilidad de las afirmaciones sobre esos bytes concretos. | Que las fuentes sean verdaderas, independientes en el mundo real, persistentes o suficientes para investigación general. |
| Archivo y prueba | Plan aceptado, cambios de archivo permitidos, recibos de efecto, ejecución aislada y segunda ejecución independiente sobre el mismo snapshot. | `intervalOracleProgram()` para el caso `merge-integer-windows`, ejecutado después de la producción. | Que el programa concreto satisfizo el oráculo finito en el runtime aislado registrado y que la revisión no dependió sólo del productor. | Corrección de software en general, seguridad total del sandbox o calidad del código fuera de los casos declarados. |
| Cambio de método | Rechazo material conservado, diagnóstico, nuevo plan con cambio explícito de método, nueva revisión del plan y ausencia de repetición del candidato rechazado. | Predicado determinista sobre la relación entre intento rechazado, diagnóstico y plan revisado; el predicado queda fuera de los inputs del modelo. | Que el circuito mantuvo la evidencia del fallo y aplicó una revisión trazable de método para ese caso. | Que la estrategia sea óptima, que cubra todos los fallos o que el sistema tenga creatividad o juicio universal. |
| Especialista local | Carta exacta enlazada al especialista, límites de herramientas y autoridad, rol de revisión de catálogo distinto, registros de aislamiento y reentrada sin llamadas. | Auditor de configuración y de linaje; no se inventa un oráculo semántico donde no existe uno. | Que el especialista estuvo limitado a la carta y autoridad declaradas, sin filtración a otro actor ni escalado de privilegios. | Que el especialista haya producido la mejor respuesta posible o que su razonamiento sea correcto en general. |

### Requisitos particulares por fila

#### 1. Fuentes públicas

El brazo debe reutilizar la semántica de contenido ya modelada por
`reconstruction/verification/full-route-cases.mjs` sin convertir un fixture
en una navegación real. La prueba de CI puede inyectar transporte y debe
marcar todos sus recibos como `SIMULATED`.

Una observación futura de transporte sólo podría llamarse operacional si
conserva el recibo observado, hash de bytes, URL solicitada, instante,
política aplicable y citas derivadas. Incluso entonces, el resultado sigue
siendo procedencia de contenido observado; no pasa a ser una garantía de
verdad factual.

#### 2. Archivo y prueba

El brazo debe partir de la cobertura ya disponible alrededor de
`IsolatedExecutionRunner` y `intervalOracleProgram()`. La cualificación
operacional exige recibos de ejecución con `simulation: false`, un snapshot
inmutable y el resultado del oráculo independiente posterior a la entrega.

Si el ejecutor aislado no está disponible, la fila queda `NOT_RUN` para la
capa operacional. Puede conservar pruebas estructurales o controladas, pero
no puede aprobarse como ejecución real.

#### 3. Cambio de método

La falla inicial se define antes de la ejecución y se conserva como material
de auditoría. El plan revisado debe expresar qué hipótesis o procedimiento
cambia y por qué. El auditor verifica una relación concreta: el candidato
rechazado no reaparece como entrega aceptada y no se ejecutan efectos
repetidos fuera de lo permitido por la política.

Una prueba de reinicio o de SQLite puede reforzar persistencia y recuperación
operacional, pero no transforma una recuperación en prueba de corrección
semántica del método.

#### 4. Especialista local

La fila reutiliza el patrón de especialista autónomo ya cubierto en
`tests/factory/engine.test.mjs`: carta exacta, productor acotado, revisor
de catálogo independiente y ausencia de autoridad extra. La matriz debe
comprobar además que el mismo aislamiento se conserva cuando la entrada V3
es `planned`.

No se debe fabricar una afirmación de “calidad de respuesta” para esta fila.
Su valor es demostrar control de autoridad, no adivinar competencia.

## Dos modos de ejecución separados

### CI: estructural y con oráculos controlados

El modo predeterminado no usa red, cuentas, cuotas ni proveedores. Puede usar
fixtures y modelos simulados siempre que cada recibo lo diga explícitamente.
Es adecuado para demostrar reproducibilidad de la ruta, aislamiento,
procedencia de fixtures, oráculos finitos y reentrada.

La disponibilidad de un ejecutor local no autoriza por sí misma ninguna
llamada externa. Una ejecución local real se clasifica por separado de la
inferencia o del transporte, que pueden seguir siendo simulados.

### Observación manual opt-in

Un futuro ejecutor de observación deberá requerir una señal explícita del
operador, por ejemplo `SOVEREIGN_ADAPTIVE_V3_LIVE=1`, y una configuración
declarada de antemano. Ese nombre es una propuesta de diseño, no una
variable existente ni una instrucción para activar nada ahora.

Antes de cualquier ejecución de ese tipo se deben fijar:

- identidad y hash del runtime;
- conjunto exacto de casos y hashes de sus fuentes congeladas;
- techo de llamadas, tiempo y coste;
- directorio de evidencia nuevo y vacío;
- prohibición de reintentos automáticos y de reparación automática;
- comando de auditoría posterior que no tenga capacidad de llamar a red,
  proveedor ni ejecutor.

Una cancelación, error, cuota agotada o recibo incompleto se conserva como
`OBSERVED_NOT_QUALIFIED`. No se repite automáticamente ni se oculta
mediante otra corrida.

## Auditoría posterior de sólo lectura

El auditor se invoca post-cierre sobre la evidencia persistida, mediante una
conexión SQLite nueva que abre la base con `immutable=1`, `readOnly`, modo
defensivo y `query_only`; rechaza previamente sidecars WAL/SHM y compara los
bytes de evidencia antes y después. No crea motor, proveedor, broker ni runner
y no llama a red, ejecución aislada ni herramientas de escritura. Puede correr
en el mismo proceso de pruebas, por lo que esta comprobación no afirma un
reinicio de Node, un PID nuevo, otro host ni una identidad de proceso distinta.

Para cada fila, el auditor verifica como mínimo:

1. hash de política, entrada solicitada, modo V3 seleccionado y aceptación
   del plan;
2. completitud y firma de los linajes esperados;
3. separación de identidades de productor, revisor y especialista;
4. clasificación real/simulada de cada recibo de fuente, inferencia,
   ejecución y efecto;
5. hash del snapshot, efectos permitidos y resultado del oráculo aplicable;
6. preservación del rechazo y cambio de método, cuando corresponda;
7. carta, límites y ausencia de autoridad no declarada del especialista,
   cuando corresponda;
8. diferencia entre la primera entrada y la reentrada: sin trabajo material
   nuevo;
9. que cada afirmación del informe se limite a la clase de evidencia
   disponible.

La salida por fila sólo puede ser una de estas:

- `QUALIFIED_FOR_DECLARED_ROW`: todos los requisitos de esa fila y de su
  clase de evidencia están presentes.
- `OBSERVED_NOT_QUALIFIED`: hubo una observación, pero falta o contradice
  un requisito.
- `NOT_RUN`: no se ejecutó la capa requerida.

No existe una salida llamada “fábrica validada” ni “modelo validado”.

## Retención local post-cierre

Una fila que ya terminó puede copiarse a un directorio de retención nuevo con
`retainAdaptiveV3QualificationBundle`. Antes de aceptar la copia, el proceso:

1. rechaza sidecars SQLite, enlaces simbólicos, enlaces duros y cambios de
   bytes durante la captura;
2. reconstruye la validación B firmada desde SQLite inmutable y exige que el
   workspace completo copiado coincida con sus observaciones. Para una fila con
   ejecución, coincide con el snapshot de ejecución; para las demás, se exige
   la lista/lecturas B completas o un workspace vacío;
3. reserva el directorio de destino sin sustituir un destino ya existente,
   sella modos locales de sólo lectura y guarda el manifiesto, el auditor
   post-cierre y la identidad de los inputs del verificador;
4. vuelve a comprobar esos datos sin crear motor, proveedor, broker, runner,
   lease ni evidencia.

`auditAdaptiveV3QualificationBundle` no acepta un hash leído desde el propio
árbol: requiere `expectedManifestSha256` suministrado desde fuera. El hash
detecta una divergencia respecto de un valor ya confiado; por sí solo no prueba
quién lo publicó, cuándo, que sea el más reciente ni que no haya rollback. Una
ancla con identidad, fila, misión y secuencia firmadas queda deliberadamente
fuera de este corte.

El mecanismo usa nombres de ruta y permisos locales; es una defensa de
integridad para raíces privadas y una detección de manipulación ordinaria, no
una defensa contra un escritor concurrente privilegiado, el dueño de la VPS o
una carrera de sustitución de directorios. Los archivos completos se conservan
para reproducibilidad, pero un archivo extra no se transforma por ello en una
afirmación cualificada: sólo los recibos, hashes y oráculos que el auditor
interpreta pueden sustentar una conclusión.

## Criterios de aceptación del corte

La implementación de CI está lista para revisión de código cuando:

1. hay una prueba determinista para cada una de las cuatro filas;
2. cada prueba demuestra los invariantes comunes de la ruta `adaptive-v3`
   planificada;
3. todo fixture, transporte, proveedor y ejecución declara inequívocamente
   si es `SIMULATED` o `REAL`;
4. los oráculos se mantienen fuera de los inputs del productor y revisor;
5. el auditor posterior puede recalcular las cuatro decisiones sin efectos
   ni llamadas externas;
6. una evidencia incompleta produce `NOT_RUN` u
   `OBSERVED_NOT_QUALIFIED`, nunca una aprobación por proximidad;
7. fuera de los dos controles estrechos documentados (`validationOnly` y el
   snapshot atómico de workspace), no se modifica el comportamiento ordinario
   ni se crean privilegios, modelos, suscripciones o agentes nuevos como
   efecto de cualificar.
8. si se retiene una fila, la auditoría debe requerir un ancla externa,
   conservar el árbol completo, enlazar su workspace con la validación B y
   rechazar topología, permisos, bytes o inputs del verificador divergentes.

La matriz no autoriza actualizar un estado de mandato, una afirmación de
entrega ni una conclusión sobre validación live. Sólo después de una futura
ejecución registrada y de su auditoría de sólo lectura podrían actualizarse
los hechos de estado, siempre con el alcance limitado de cada fila.

## Secuencia de implementación propuesta

1. Los cuatro brazos deterministas de CI y el auditor post-cierre están
   implementados con fixtures claramente `SIMULATED`; el arnés deja una
   declaración de fixture junto a cada resultado.
2. El brazo de archivo ejecuta y revisa el oráculo en un runtime local
   aislado cuando está disponible; si no lo estuviera, debe conservar
   `NOT_RUN` para esa capa y nunca sustituirla por texto de proveedor.
3. El formato de retención local ya conserva bundles de CI y se reaudita con
   ancla SHA-256 externa; una custodia WORM, antirollback o con identidad
   firmada continúa fuera de este corte.
4. Someter el diseño de observación manual a autorización explícita antes de
   habilitar transporte o proveedor alguno.
5. Tras una observación autorizada, ejecutar el auditor posterior, preservar
   la evidencia incluso si falla y registrar únicamente las decisiones de
   fila que sus recibos permitan.

Esta secuencia aumenta evidencia end-to-end sin confundir arquitectura,
operación observada, oráculo acotado y verdad semántica.
