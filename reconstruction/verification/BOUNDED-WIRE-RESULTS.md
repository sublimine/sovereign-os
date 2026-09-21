# Guía acotada: resultados y límites

14 septiembre de 2026, cierre auditado a13:00:18.616 UTC. **Promoción rechazada:**
el candidato **5a5e3f3f1f32dd24652a45716969f0f383764a6d3fc358f0b23d0a3980bc48e1**
no logró la reducción agregada de tokens exigida antes del ensayo. Nunca se
instaló. El VPS conserva25d34 y la optimización se retiró del desarrollo,
conservando sus archivos y todas las pruebas, después de cerrar la auditoría.

## Qué cambia y por qué

El productor de bounded-read-response-v1 recibía instrucciones generales para
lotes, escritura, ejecución y adquisición de fuentes, además de una segunda copia
de su nodo completo. Estas operaciones no pertenecen a su autoridad. El cambio
especializa únicamente la guía de transporte y la descripción raíz del schema.

Permanecen íntegros el contrato compilado del productor, todos sus campos y
criterios, el encargo literal, las observaciones, las estructuras y descripciones
internas del schema, las fichas/requisitos del juez y todos los controles. No
se añade un preset, modelo, límite o protocolo de almacenamiento. Los productores
ordinarios y el fallback no usan esta guía. Se mantiene compatible el lote de
una sola lectura, aunque no aporte ventaja, así como sus cargos y recuperación.
[Diseño previo](../design/BOUNDED-PRODUCER-WIRE.md).

## Evidencia local cerrada

- Dirigidos55813: 103 tests,102 PASS y1 FAIL,28627.031251ms. El test recompilaba
  un objeto tras el ordenamiento canónico de claves de SQLite, por lo que exigía
  una cadena diferente de la compilación original. Se conservó el fallo y se
  corrigió el test para reconstruir el binding original, comprobar equivalencia
  con lo almacenado y después igualdad exacta del prefijo. No se retiró el control.
- Dirigidos29206:103 PASS,0 FAIL,24503.844602ms. Motor, broker y SQLite reales;
  proveedor SIM. Incluye admisión/CLI, preservación exacta de contrato y request,
  revisión propia, permisos denegados, cuotas, cursor y respuesta retenida.
- Compatibilidad21xD5Z/99825: seis transiciones25d34↔candidato al conservar una
  respuesta final, al quedar un recibo antes de observarlo y tras cuota después
  de lectura. Se preservaron versiones y política sin releer como productor.
  Auditoría12:16:41.259:341 pins,60 usos de citas, owner ausente y bytes de las seis
  bases intactos. Excepciones controladas, no SIGKILL, caída OS ni modelo real.
- Globaly6gnE5/63718:1822 tests,1821 PASS,0 FAIL,1 SKIP,650524.06466ms. Cerró
  a12:20:48.503; auditoría12:28:57.476:340 pins y cuatro streams exactos,
  ambos procesos ausentes. Release436 archivos/24.299.160bytes congelado.

[Auditoría global](runs/suite-y6gnE5/post-close-audit.json),
[compatibilidad](runs/bounded-wire-recovery-21xD5Z/post-close-audit.json).
Las suites dirigidas se solapan; no sumar sus tests a la regresión global.

## Medición de bytes, no de ahorro real

Sobre requests0/1 retenidas de c6Q9gq, el contrafactual reduce las instrucciones
de14967 a11492bytes y el schema de3419 a2616bytes. Input12623/21117bytes y
prefijo completo quedan idénticos. Serializando el request completo se ahorran
4272bytes por propuesta; sumando sólo guía y schema son4278bytes. Las diferencias
de escape JSON explican que no sean la misma medida.

El request del juez queda exactamente idéntico, incluido su hash. No se envió
ese contrafactual al proveedor; no son tokens, latencia ni equivalencia semántica
probada. [Medición exacta](experiments/bounded-wire-byte-measurement.json).

## Comparación prospectiva cerrada

Dos casos nuevos con oráculos conocidos: filtro literal estable con Unicode,
duplicados y texto hostil como dato; regla entera exacta con redondeo al par,
límites y un entero mayor que la precisión de binary64. OrdenAB/BA y mismos
modelo Astra/ultra, política, entrada, revisión y cuatro reservas por variante.
[Plan congelado](experiments/BOUNDED-WIRE-PAIRED-QUALIFICATION.md).
Tres tests de oráculoPASS154.829731ms; alteraciones concretas rechazadas.

SIMz305ZA/38661 terminó las cuatro variantes con tres respuestas cada una.
Auditoría12:30:16.804:340+10 pins,40 usos de citas, owner ausente y bases intactas.
No equivale a un juicio real. LIVE7Q6DCK/88724 iniciado después; máximo16 llamadas
en50 minutos, sin API, créditos, cambio de modelo ni modificación del oráculo.

LIVE7Q6DCK/88724 cerró12:59:50.001. Auditoría90031 cerrada13:00:18.616:
340+10 pins,70 usos de citas,12 cierres de proveedor y doce tareas nuevas distintas,
owner ausente y bytes de las cuatro bases intactos. SHA del summary:
`0c70123f68fdfd20ca5a14e896203aad55d487a4edd2daa9db1182d3181367c7`.

| Caso | Baseline25d34, tokens reportados | Candidato5a5e, tokens reportados | Llamadas por variante |
|---|---:|---:|---:|
| A: filtro literal estable | 49.491 | 48.555 | 3 |
| B: redondeo exacto y límites | 49.763 | 51.758 | 3 |
| Total | 99.254 | 100.313 | 6 |

El candidato suma1059 tokens más (+1,06696%). Input85994→81725; output13260→18588.
El juez de A subió24753→25083 aunque su guía no cambió. Cached32256→0. No son
dinero, capacidad restante ni causalidad general. Se redujeron4278 bytes de guía
y schema por propuesta del productor; eso no satisface el criterio de tokens.

Los cuatro productos/oráculos pasaron y se leyeron íntegramente las doce
respuestas públicas, contratos y lecturas propias. A conserva posiciones
[7,2,5,9,1,6], excluidos[3,4,8], duplicados, Unicode y salto de línea literal;
el texto hostil del archivo sólo es dato. B conserva nueve cálculos enteros,
cuatro empates al par, límites y total91, sin pérdida binary64. La calidad sólo
queda aceptada para esos cuatro productos conocidos; no holdout ni superioridad.

**Límite de contabilidad:** B-baseline call1 registró retry nativo por
responseStreamDisconnected (evento86,12:56:33.816), sin replay del coordinador.
Las doce respuestas finales tienen contador, pero los bytes de salida parcial
del intento interrumpido no tienen uso separado atribuible. Cobertura de ese
intento: DESCONOCIDA. No equiparar unknownUsageCalls0 del harness con coste
upstream completo; no imputar un coste para convertir este resultado en ahorro.

[Auditoría cerrada](runs/bounded-wire-pair-live-7Q6DCK/post-close-audit.json) y
[disposición semántica y de eficiencia](runs/bounded-wire-pair-live-7Q6DCK/semantic-disposition.json).
No repetir el mismo ensayo para buscar otra nota. A13:04:57.023 se verificó que
los435 archivos runtime y338 inputs de regresión restaurados coincidían con25d34
y UaXbwc. Es comprobación de identidad, no otra ejecución de tests. Archivo
recuperable de los cuatro ficheros retirados:
[experimento rechazado](experiments/rejected-bounded-wire-20260914-1303/).
Después comenzó una corrección distinta de --file; no atribuirle esta cualificación.
R01–R16 permanecen abiertos tras este experimento.
