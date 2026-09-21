# Ruta documental vertical — literal-windows-v1

## Estado vigente, 13 septiembre, cierre 2cYEbW y lotes locales

[2cYEbW](DOCUMENTARY-LIVE-2cYEbW.md) completó el recorrido documental real:
plan, dos adquisiciones, candidato, juez con ventanas propias, entrega y
reentrada sin repetir trabajo. Once llamadas y 311.820 tokens: es evidencia de
ese caso, no eficiencia general ni aceptación completa de la fábrica.

Ahora se desarrolla `source.batch`, dentro de `action=document`: agrupa de dos
a ocho localizaciones/lecturas independientes sobre fuentes y grants distintos
ya expuestos. Cada miembro consume una operación del techo de 24; no se amplía
autoridad ni se confunde selección con observación. Conserva los resultados
separados y aplica rollback local incluso si un controlador captura el error
dentro de su propia transacción. [Diseño y pruebas](DOCUMENTARY-NAVIGATION-BATCH.md).
Cambios no instalados ni cualificados con inferencia real todavía.

### Corte anterior, 13 septiembre, cierre bNXUDE

La revisión documental real de un candidato conocido ha pasado en una copia
diagnóstica: [bNXUDE](DOCUMENTARY-REVIEW-bNXUDE.md), tres llamadas/147249tokens,
catorce controles aprobados y22referencias literales auditadas. OriginalUWr0Gu
sigueFAILED, no reanudado; no significa entrega ni ruta integrada cualificada.
Se trabaja ahora en eliminar reconstrucciones repetidas del mismo contexto
durante validación local, preservando cada prueba y sin caché de autoridad entre
llamadas. No instalado; falta nueva regresión tras ese cambio. Lo siguiente
conserva los cortes históricos y no es el estado vigente.

## Corte histórico, 13 septiembre, 06:57–09:58 UTC

13 septiembre 2026, 06:57 UTC. **Desarrollo opt-in, no instalado. Mandato
completo pendiente.** Los modelos y HTTP de las pruebas de integración son
sintéticos; Store, broker, firmas, motor y archivos de prueba son reales.
La regresión completa posterior 7d0wzx está cerrada y verificada. El ensayo real
ZxHWcv terminó rechazado07:29, antes de adquirir fuentes, por incompatibilidades
en los roles del plan. [Diagnóstico conservado](DOCUMENTARY-LIVE-ZxHWcv.md).
No hay aún aceptación documental real bajo este protocolo.
Retest conocido [UWr0Gu](DOCUMENTARY-LIVE-UWr0Gu.md) terminóFAILED/TIMEOUT08:53:
plan aprobado, fuentes y candidato reales, primera revisión sin finalizar.
Defecto demostrado: gramática imponía11checks también para pedir una lectura
conchecks=[]. Corregido en desarrollo con prueba primeroROJO y38documentales
PASS. El juicio final sigue exigiendo todos los criterios y ventanas propias.
Regresión posterior en curso09:49; retest de sólo revisión sobre copia del
candidato prerregistrado, máximo6llamadas, sin recomprar planificación/fuentes.
No hay aún entrega documental real integrada ni nueva instalación.
El diagnóstico de sólo revisión [KZ6Aeb](DOCUMENTARY-REVIEW-KZ6Aeb.md) cerró
09:58 tras seis lecturas/301645tokens y cero juicio; respetó el techo. La
navegación funciona, pero el juez repite lectura ya expuesta. Se está separando
el aviso histórico de preparación del texto disponible ahora, sin borrar
historia ni fingir suficiencia semántica. Cambios nuevos aún no cualificados.

## Qué cambia y por qué

El fracaso conservado spVGwI adquirió las dos fuentes originales, pero su
siguiente entrada pretendía enviar 6.652.843 bytes por duplicación del raw.
La solución no consiste en aumentar el límite ni resumir arbitrariamente los
criterios: se separan autorización para consultar un snapshot, selección literal,
entrada realmente completada y juicio sobre su contenido. Se reutilizan
Store/Authority, broker, codecs y controles existentes; no se instala otro SDK,
servicio ni dependencia de pago.

`FactoryEngine.create(...,{documentContext:'literal-windows-v1'})` congela una
opción explícita. No modifica adaptive-v1 ni su comportamiento por defecto.
La compilación de cada actor conserva ese modo. Planificación, entrada cerrada,
replicadores y etapas nativas/selladas permanecen fuera del protocolo. No hay
flag CLI instalado. No se crea una nueva misión en la cola ordinaria.

La ruta vertical es:

1. El productor propone una adquisición autorizada. El broker recupera y guarda
   el raw y su recibo originales. La proyección para el modelo distingue
   metadatos HTTP de texto del documento.
2. Sólo una adquisición observada o una fuente declarada por un producto
   realmente asignado concede un grant propio. Un ID global de misión no basta.
   El actor documental no se añade falsamente a `context.sourceIds` legacy.
3. `source.locate` propone una búsqueda literal local, que devuelve offsets,
   no relevancia semántica. `source.read` propone rangos UTF-8 del mismo snapshot.
   Estas operaciones no descargan de nuevo ni cuentan como efectos de red.
4. Cada operación exige solicitud completada del actor, frame e instrucciones
   exactos, estado de navegación observado y propuesta del modelo retenida
   **después de la finalización y antes de la operación**. El comando y args
   deben coincidir. Un resultado final no se puede convertir en una lectura.
5. La siguiente solicitud muestra las ventanas seleccionadas y el catálogo
   tipado. Prepararlas no certifica que esa solicitud haya completado. Los
   rangos de una fuente sustituyen explícitamente sólo su selección activa;
   las otras fuentes y todos los registros históricos permanecen.
6. El productor cita `sourceKey/quote` de su entrada actual. La materialización
   guarda selectores y frame/requestHash, además de las referencias originales
   de fuente/hash/cita. El metadato no se convierte en soporte factual.
7. El juez recibe el candidato, sus criterios completos, dependencias aceptadas
   y sus propios grants. No hereda ventanas ni finalizaciones del productor.
   Puede localizar y seleccionar otras ventanas. Para ACCEPT debe tener en su
   propia entrada los pasajes de soporte declarados y evaluar contenido,
   alcance, limitaciones y contraevidencia; una coincidencia literal no prueba
   implicación semántica. RETURN/UNKNOWN no fuerzan lectura ni aprobación.
8. Los controles materiales conservan identidad independiente, criterios,
   fuentes admitidas, vigencia, premisas, efectos y estado actual. Un archivo
   escrito sigue requiriendo relectura propia del juez y comprobación al usarlo.
   El nuevo formato no salta esas obligaciones.
9. Aceptación y consumo revalidan las pruebas documentales fijadas a cada
   producto/revisión, no la última ventana de otro actor. Revocar un grant
   bloquea consumo sin reescribir el resultado histórico; retirar una fuente
   invalida también sus productos descendientes.

Límites explícitos: 64 grants por actor, 24 operaciones locales, 16 ventanas y
256 KiB literales por entrada; cada ventana tiene 4..65.536 bytes. El límite
de pasos del trabajador sigue siendo 12 por defecto, incluyendo solicitudes
de navegación; las reparaciones del juez conservan su límite independiente.
Una operación inválida termina el intento con error y conserva su propuesta,
sin una falsa operación exitosa ni selección parcial. No hay bucle ilimitado.
La entrada completa sigue limitada por la guarda de 1.000.000 bytes y el
presupuesto del trabajador; otros campos no se truncan para conseguir pasar.

## Integración de reportes, recuperación y scopes

`missionReport.documentary` separa actores, operaciones y rangos por solicitud
retenida. `productionScope` y `dependencyGates` incluyen la misma distinción
histórica. Un `contexts.sources:[]` legacy no significa ausencia de exposición
documental. No se publican raws ni razonamiento privado. Los rangos repetidos
en varias solicitudes no se cuentan como lectura nueva única. La inspección
histórica sigue disponible después de retirar la fuente, sin certificar su
validez actual.

El formato de revisión documental es propio: conserva todos los criterios y
las instrucciones de prueba de la revisión ordinaria, usando citas tipadas.
Las opciones legacy de codificación de revisión siguen aplicándose a actores
no documentales; no se aplican a escondidas sobre la nueva gramática.

No hay transferencia de overlays de aprendizaje. Los actores documentales
no consultan el resolver legacy; una compilación con overlays se rechaza.
El servicio de aprendizaje no acepta este scope como si fuese uno evaluado:
**evaluador/dataset y promoción documental todavía pendientes**. Esta exclusión
no se presenta como autoaprendizaje completado.

Tras cuota, el motor conserva solicitud incierta y adquisición; un actor nuevo
obtiene autoridad y lectura propias, sin refetch obligatorio ni reiniciar el
presupuesto de calidad. Cancelación es terminal. Reentrada de una entrega
vuelve a validar y registra ownership/workspace-validation, sin nuevas
inferencias, efectos de broker, candidatos ni juicios.

## Pruebas y fallo de expectativa conservado

Archivo: `tests/factory/documentary-workflow.test.mjs`.

- Primera integración: 11/11 PASS (sesión90834, 44.380,623504 ms), incluidos
  plain-json/lossless-json-v2/source-text-v1 y raw de más de 2 MiB. Es una medida
  de pruebas locales con proveedor sintético, no eficiencia de inferencia real.
- Primera ampliación (sesión25583): 11 tests,10 PASS/1 FAIL,
  57.683,341622 ms. El fallo fue exigir journal idéntico al reentrar: pasó de
  242 a 246 eventos. El código existente guarda toma/liberación de ownership
  y registro/evento de workspace-validation. Se corrigió la expectativa para
  exigir **exactamente** esos cuatro registros y materiales/llamadas/efectos
  intactos; no se eliminó un control ni se convirtió un ensayo fallido en éxito.
- Repetición completa del caso del motor con auditoría de linaje añadida:
  1/1 PASS (sesión48893, 29.775,254282 ms); 13 llamadas simuladas, una adquisición,
  dos productos, jueces distintos, seis operaciones documentales locales y
  retiro propagado a los dos productos.
- Negativos adicionales (sesión87811): 8/8 PASS, 5.299,55772 ms: propuestas
  modificadas, selectores/citas/hash ajenos, grants de otro actor, relaciones
  mecánicas de dos fuentes, exclusión de overlays, archivos reales y presupuesto.
- Prerregistro del nuevo harness: 1/1 PASS, 178,890547 ms. Mantiene intactos
  texto/oráculo y parámetros del caso histórico; la nueva ruta es explícita.
- **PVrsMM cerrada con fallo**, 06:56:43.116→07:01:56.163, exit1,
  1.025 tests/992 PASS/32 FAIL/un SKIP; sesión70393/PID1974164 ausente.
  Auditoría07:03:24.525: inputs coinciden con captura e inputs actuales de ese
  instante, streams parciales/finales verificados. ResumenSHA
  `6e4b88021262387d8bca44e17b57b94ed351827db1fd382250221d9d920a47ef`.
  Los 32 fallos comparten una causa: el nuevo detector accedía a
  `mission.policy.documentContext` en fixtures/registros históricos sin policy.
  La corrección trata ausencia de política como no-opt-in; no autoriza acceso
  documental. Los 33 tests dirigidos de historia vuelven a pasar.
- Negativo nuevo de política eliminada: inicialmente esperaba DOCUMENT_PROTOCOL,
  pero WorkerService.mission rechazó antes con MISSION_POLICY. Se exige ese
  rechazo temprano y, por separado, DOCUMENT_PROTOCOL en el detector, con cero
  dispatch. Ambos negativos PASS. `ymuSqn`, iniciada indebidamente después de
  aquel fallo de expectativa por secuencia de shell no condicionada, se detuvo
  a los 20,816s con SIGTERM dirigido sólo a su propietario. Conserva resumen
  y streams, **no es una regresión completa**: 07:04:03.906→07:04:24.722,
  resumenSHA `995c7a800664d2ea9d4fc0e962fdafc93b257dc32a3830d799cf0db1f3a7c9b2`.
- **7d0wzx cerrada/verificada**:07:04:56.088→07:10:32.297, exit0,
  1.025 tests/1.024PASS/cero fallos/unSKIP (smoke real deshabilitado),
  336.100,649218ms. Auditoría07:11:27.785:270 inputs/76runtime, inventario,
  hashes y streams parciales/finales coincidentes; propietario1979282 ausente
  con identidad kernel verificada. ResumenSHA
  `c66fec138f544c657b776285afcc6a7ef4fe1529bbf3fc0414674a664c26378e`.
  Freeze `50649873c3e8cf3ebc53cbc26eb0fee7fa70b143fab5c143f1a1f9eb60f6eb8a`,
  413 archivos/23.991.666 bytes verificado, no instalado.

## Ensayo real ZxHWcv en curso

Sesión55142/PID1983749, boot2a077981-8aea-444e-8eff-44fa69814267/
startTicks46747229. Base nueva en `runs/documentary-live-ZxHWcv`, misión
`mission:1d99417f-78f7-4031-89ff-2fff0dd4d87a`. Planificación despachada.
No hay resultado ni entrega. No modificar los270 inputs fijados ni duplicar
el ensayo. La cualificación07:11:49.776 verificó release y suite antes de abrirlo.

`run-live-documentary.mjs` utiliza el motor completo sobre una release congelada
verificada y la regresión exacta. Nuevo directorio/base, misma petición y oráculo
documental que spVGwI, únicamente las dos URLs iniciales originales, planificación
explícita y protocolo literal-windows-v1. Máximo absoluto 20 llamadas de
suscripción Astra/ultra, sin APIs pagadas ni lectura prestada del ensayo anterior.
El límite de caso anterior sigue siendo 12; no se cambia su historia/política.
La ruta nueva no permite atribuir ahorro causal frente a una ruta distinta.

Retiene cada solicitud/respuesta antes de validar, identidad del proceso,
fuentes, linaje, comprobación externa y reentrada. Un fallo conserva el brazo
y exige diagnóstico; no lo reejecuta automáticamente. Una aceptación estructural
deberá además auditarse semánticamente. El único caso no certificará R01–R16.

Pendientes: ensayo real y auditoría semántica, coste/latencia aceptables con
fuentes grandes, más familias/holdouts, aprendizaje del scope, criterio explícito
para activar por misión/CLI y cualificación operacional. No se instala por
pasar tests. Se mantienen tGHBOv, spVGwI y el defecto de stdout descendiente.

## Servicio existente — un solo checkpoint

06:22:23.530: muestra `soak-sample:03d1e141-2430-4ac9-be6f-c25f223556e7`,
probeHash `a11d64785044a8f1632778ebedbd0a1a1ad1b5db7df21049965ac0d2e9058701`.
Observador57/`4a061d94da8ee68c187c036b89eb280b76c169ede4925e3b837ad3f2bd6e82fb`,
28muestras/24healthy/4failed; OBSERVING. Hueco05:11→06:22 conservado; no72h.
Instalación10bbffa0, PID989536 activo/enabled/NRestarts0/gestor permanente
verificado. Journal ordinario410/
`2f54d5b7cc105de79871c8de1aa03d036ae574e9258bebc7094ba2e853c46f1a` intacto.
No repetir checkpoint en esta continuación. Sin instalación, reinicio,
publicación, compras ni nueva misión ordinaria.
