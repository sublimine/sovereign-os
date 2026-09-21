# Procedencia de las aprobaciones — 12 septiembre 2026

## Problema y decisión

El contraste [XrlCqq](NATIVE-SELECTION-REVIEW-XrlCqq.md) conservó un desacuerdo
entre dos positivos: ambos jueces identificaron el objeto correcto, pero no
interpretaron igual una aprobación upstream simulada. Un PASS almacenado no
identifica por sí solo el origen de la inferencia que lo emitió.

Se añade la observación firmada `artifact-dependency-inferences`, esquema
`sovereign.dependency-inferences.v1`. No se cambia el contrato, resultado ni
oracle de XrlCqq. Tampoco se modifica el preimagen de las pruebas existentes
`artifact-input-copy` o `artifact-dependency-gates`.

La clasificación es de **procedencia registrada**, no una nueva aceptación ni
una atestación criptográfica del proveedor:

| Valor | Significado exacto |
|---|---|
| REAL | Todos los recibos del actor histórico seleccionado declaran el booleano `simulation:false`. |
| SIMULATED | Todos declaran `simulation:true`. |
| MIXED | Hay recibos con ambos booleanos. La última llamada no borra las anteriores. |
| UNKNOWN | Hay metadatos ausentes o no booleanos; no se tratan como `false`. |
| NONE | No hay inferencias registradas; no acredita por sí solo ejecución nativa. |

Cada recibo conserva su hash, clasificación individual, terminación y vínculo
al hash de una solicitud registrada del mismo actor. `recordedRealReviewedGate`
exige además aceptación anterior al primer intento, criterios completos PASS,
exposición independiente completada y todos los recibos completados/vinculados.
`productionAndReviewRecordedReal` exige también esas condiciones al productor.
Ninguno de los dos campos significa verdad, calidad universal o cualificación
del linaje transitivo. Una copia nativa requiere su prueba nativa separada y no
se penaliza materialmente por carecer de inferencia productora.

## Por qué estos límites y esta posición

La observación llega al revisor **después de existir el candidato**. Resume sus
prerrequisitos inmediatos, no adelanta el juicio del propio candidato. Reutiliza
el corte histórico del primer intento material —incluidos intentos fallidos y
réplicas— para no hacer pasar una aprobación tardía por una puerta previa.
El productor se lee antes de crear su dependencia; el revisor, antes de emitir
su revisión. Llamadas reales posteriores no rehabilitan una simulación anterior.

Se incluye sólo para revisores y productos expuestos no pertenecientes a
planificación. No revela cuerpos, solicitudes completas, citas privadas ni
hermanos no expuestos. Está excluida de la revisión ciega cerrada. La validación
recalcula toda la observación; una firma nueva no legitima un contenido que no
coincida con los registros históricos. Al usarla como evidencia vigente sigue
exigiéndose que cada dependencia sea utilizable, sin borrar su historia si se
revoca después.

El alcance deliberado es el productor seleccionado y el revisor de cada
dependencia inmediata, con todos sus recibos; no certifica otros intentos ni
ancestros transitivos. Tampoco demuestra que el proveedor ejecutó realmente
lo que un transporte de prueba haya etiquetado `simulation:false`.

## Pruebas dirigidas

28 pruebas PASS: 14 nuevas de procedencia, cinco de puertas históricas y nueve
de observaciones operativas. Todas las inferencias son fixtures de unidad,
también las etiquetadas false para probar la clasificación; cero llamadas al
proveedor. Cobertura: simulación, false explícito, ausencia/null/string/número,
recibo sin solicitud vinculada, historial mixto, productor sin inferencia,
invariancia temporal, corte de primer intento/réplica, exposición, deduplicación,
revocación, alteración incluso firmada y exclusión de contexto ciego/productor.

Archivos de este corte:

- `factory/lib/dependency-inferences.mjs`: `d755538adfa843d7da261baa3203a8816744b2cffe334fe3750c781d867f3c94`.
- `factory/lib/artifacts.mjs`: `05995f1d57c242e14752c9dfce761e496421ebe5d0def758aa828a1902250c1e`.
- `tests/factory/dependency-inferences.test.mjs`: `f515863ed6e04e228be1bce17e4032d54d57c6cce24426cae1634c4de8e9a95a`.

## Contraste histórico en lectura, 22:41:21 UTC

Se abrieron las cuatro SQLite de XrlCqq con `readOnly:true` y transacciones de
lectura; sin inicialización del Store, mutaciones, reentrada ni llamadas reales.
En los cuatro casos: una dependencia, un recibo de productor SIMULATED y uno
de revisor SIMULATED; puerta histórica aceptada, `recordedRealReviewedGate:false`.
La proyección adicional ocupa 3354 bytes canónicos por caso. No es un ahorro
de tokens observado ni una mejora de razonamiento demostrada.

| Caso | SHA-256 de la nueva proyección | Journal conservado |
|---|---|---|
| case-0 | `86d16a44139343730ad28556ba2e5f8351858fa798cc61233651dc4aecddda92` | 123 / `0b16d76091e041dd76b0f3b01e36f236cf0b454f9a1b73a2b83a233dfd63069c` |
| case-1 | `fb9961eacf46a5fb96590b4f6d41be036253f7a6d5fb5bd293c8246bb4afb7f3` | 118 / `c5cbe8d8113f7683eb19282013a6e6ed11d72a6b7198e17388e4c5e2161b6ef0` |
| case-2 | `9442ce40bb1222648215c9da5b3e5dbbd26cae0a5e0aec71012425b62bd155ec` | 121 / `b447e02fd6dacc40bd19ec8cfb10556fd900f05160a1071a7c19165d56e60f00` |
| case-3 | `5b346538c551287561b495bc0bd2a4a10a13346e2dc284f7f039f820f07add0a` | 126 / `7e53724189fdc27765cd03d550bc16f502ebd2f72f6236ef24a34b7d57b85f02` |

Las cuatro pruebas nativas recomputadas son idénticas a sus JSON originales.
El resumen histórico conserva SHA-256
`f7e7a51d9189280b511d7a3174fb2a93b18a7703f0954d733a9d2497b0e52a4c`
y `passed:false`. La nueva proyección no fue expuesta retroactivamente a esos
jueces: no se afirma que haya cambiado su comportamiento.

## Regresión y siguiente puerta

Regresión `suite-3wpIFU` terminada: 22:41:20.357–22:45:00.035 UTC,
**795 pruebas / 794 PASS / cero fallos / un SKIP** en 219572.373479 ms.
La prueba real de suscripción opt-in permanece omitida. Sesión 97968 cerrada
exit 0, sin interrupción. A las 22:45:44.625 se verificó el conjunto exacto
de **231 inputs / 63 runtime**, sin archivos añadidos/retirados ni hashes
distintos frente a `started.json` y `summary.json`, y las salidas completas:

- Resumen: `199511d5292118bdaf5d7b568f925602715175c8c1b5db1a99556e48213a2c96`.
- TAP: `f29d49691ac4c046295ce06599522c6eaa1cedbb0fb1e3c124813c5e1e22535f`.
- Stderr vacío: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

Copia de runtime verificada, **400 archivos / 23859342 bytes**:
`36caa8fcb0f560fbc53d14c7b23a09caf5edf9c14374176029a916ad73e7a5c7`.
Sus 63 inputs runtime coinciden con la regresión. Es un freeze de desarrollo,
no una release instalada ni cualificada con nuevas inferencias reales.
La versión instalada 10bbffa0 no se modifica. Ningún proceso propio en curso.

Antes de otro ensayo real se necesita un contrato prospectivo separado:

1. **Evaluación condicional de fixture:** juicio de selección/fidelidad bajo
   premisas explícitamente simuladas; salida diagnóstica separada, no emitir
   aceptación operativa ni COMPLETED como cualificación de una misión real.
2. **Aceptación integrada real:** planificación, revisión del plan y revisión
   final con procedencia registrada real, copia nativa autenticada y reentrada
   sin repetición. No sustituir esa evidencia por una evaluación condicional.
3. Congelar casos nuevos, criterios, exposición y presupuesto antes de inferir;
   comparar errores y coste. Mantener intactos XrlCqq y 24pcUY, sin repetirlos
   para buscar una etiqueta favorable.

La transparencia estructurada está implementada; la separación operacional de
esas dos clases de evaluación y su cualificación con juez real siguen pendientes.
No se ha instalado esta versión, realizado una nueva inferencia real ni cerrado
el mandato R01–R16.
