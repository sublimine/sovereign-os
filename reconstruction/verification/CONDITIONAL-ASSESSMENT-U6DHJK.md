# Fallo de construcción de esquema — u6DhJK

Auditoría readOnly: 12 septiembre 2026, 23:45:51.714 UTC.
El ensayo **NO pasó**. [Contrato previo](CONDITIONAL-ASSESSMENT-PREFLIGHT.md).

## Observación y causa

El primer juez devolvió PASS para selección y fidelidad, pero con `evidence:[]`.
Las razones y la incertidumbre contenían únicamente el hash del candidato.
La validación rechazó la respuesta con ASSESSMENT_EVIDENCE. No se ejecutó case-1.
Sesión propia 19366 cerrada exit 2 a las 23:39:17.945 UTC; una llamada real,
dos pasos upstream simulados, cero reparaciones o efectos.

La solicitud guardada prueba un error **nuestro de implementación**, no una
medición válida de capacidad semántica del modelo: `responseSchema` reutilizaba
el mismo objeto `str` en artifactHash, reason, uncertainty y campos de citas.
Después, `schema.properties.artifactHash.enum=[contract.artifactHash]` mutaba ese
objeto compartido. Al serializar, TODOS esos campos quedaban restringidos al
hash del candidato. Ningún ID de evidencia expuesto coincidía con ese hash;
era imposible emitir una cita válida bajo el esquema enviado. No se atribuye
este fallo a falta de razonamiento, a la cuota ni a discrepancia UNO/DOS.

Los mocks previos comprobaban la respuesta con el validador de aplicación,
pero no contrastaban su compatibilidad con el esquema efectivamente enviado.
Por eso las 816 pruebas que pasaron antes no detectaron este defecto.

## Recibo y preservación

Inferencia oficial Astra/ultra, scoped-v1, simulation:false, status:completed.
23:38:38.808–23:39:17.905: **39097 ms; 16987 tokens** (15804 entrada,
1183 salida, de los cuales 994 de razonamiento). Son contadores del recibo,
no facturación ni prueba de razonamiento correcto.

La llamada sí se consumió. El recibo y la salida quedaron en response-2.json
antes de validación. El trabajador NO adjuntó ese recibo: la validación falló
antes del retorno del proveedor al trabajador. Su estado INFERENCE_FAILED
describe el fallo de aplicación, no ausencia de llamada. Conserva request
pendiente; no reejecutar esa identidad ni convertirla en resultado aceptado.

- Misión `mission:755fb9d5-73ee-4a8e-bda4-865839c78d91`, NEW.
- Candidato `artifact:6ac980ad-7f9a-470c-95e4-9c2aca54feed`, CANDIDATE, 49 bytes.
- Actor `run:0113f76f-ea7b-43dc-bbb5-8e81d20173ed`, sin resultado diagnóstico firmado.
- Request/receipt context hash `b401fdd530964b14d5fc008affb574ee875fd2794031544c168659bf4a88eed9`, recomputado idéntico.
- Ficha omega_22 completa incluida, prefijo `47ff99756428d602d6afa29593b25e6f8d5b99c4d382284aed7b924bd5dc9044`.
- Seis referencias runtime validadas; origen nativo recalculado idéntico al original.
- Journal intacto: 79 eventos, `d84ba8181497917509796d8b62840362efa578285b874359df9637b3caf0ae35`.
- Una aprobación previa simulada de planificación, ninguna aprobación del candidato, cero efectos.

Directorio histórico: `runs/conditional-selection-live-u6DhJK`. Snapshot
6d198c9f permanece intacto/no instalado. Auditoría mediante transacción
readOnly + ROLLBACK, sin reabrir Store en modo escritura.

| Archivo histórico | SHA-256 |
|---|---|
| summary.json | `a3fd0b2027c2b9e4585254ef31212e1b2e4be846689dc5e293e4f516a3affeef` |
| case-0/request-2.json | `905fb0d3122f8efef0f03d51eba463da2da43be56590d6c544b074973274386b` |
| case-0/response-2.json | `26c6ce286978f317750d57cba9ce638e894c137892414394496e1ce0d6ff8e28` |
| case-0/assessment-contract.json | `c04b5de45abd2c7a2efdc0085c5c238c55c6b7478b0cd1b7ea59eb2e86100ab0` |
| case-0/native-origin-proof.json | `bb0eacc7155156a619244deb228819e0cd9cc07ebfd5cc5cc9281bfebb10c540` |
| case-0/failure.json | `fd263aabf8ebb1059fb35ff74fc7055395e8f20b022eaf2fd1a431d42cd1f680` |

## Corrección y nueva puerta prospectiva

El binding de artifactHash se construye ahora como nodo enum propio dentro de
responseSchema, sin mutar `str`. No se cambia ningún prompt, criterio, oracle,
modelo, proveedor o control de evidencia. Se mantiene el rechazo de PASS/FAIL
sin pruebas y la prohibición de convertir diagnóstico en aceptación operativa.

Nuevo test del límite serializado del proveedor: verifica restricciones exactas
de TODOS esos campos, permite razones/citas observadas del fixture y comprueba
dos candidatos independientes. Primero se ejecutó contra el código defectuoso:
**1 FAIL** por enum indebido en uncertainty. Después de corregir: **23 pruebas
dirigidas PASS**, cero llamadas reales. El rojo previo no se omite.

Regresión definitiva nueva **suite-GNIRNx**, iniciada 23:45:00.494 UTC,
sesión propia 21907, 237 inputs / 64 runtime. Debe finalizar sin fallos y con
conjunto completo/hashes/streams íntegros antes de construir otro snapshot.

Sólo tras superar esa puerta: un ensayo NUEVO en directorio/BD propios con el
schema corregido; máximo dos llamadas reales, una por cada caso conocido del
contrato original, sin reparaciones automáticas ni segundo voto por caso. Es
un retest de corrección de transporte, NO un holdout nuevo, NO repetición del
ensayo histórico ni validación end-to-end. Se conserva u6DhJK fallido. Si hay
otro fallo de protocolo/evidencia/cuota/integridad, se detiene ese ensayo y se
diagnostica antes de cualquier nueva ejecución.

Puerta cumplida ANTES del retest, **23:48:50.571 UTC**: GNIRNx cerró
23:48:24.557, sesión 21907 exit 0, **818 pruebas / 817 PASS / cero fallos /
un SKIP live opt-in**, 203978.181164 ms. Los 237 inputs, 64 runtime, conjunto
completo, inicio y streams coinciden; resumen
`3fc8cc0923cc738c860e12b78f108f3c60ac26363f252ae72c2cd99abab20ffa`,
TAP `3db60d81266879fbddd01330853ffb3d09b9a7b5c6dd979163e40b715f6af895`,
stderr vacío `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
Runtime nuevo `14936f68c59dc739101764df8a4a24034280669ae8c0d8b43ef894f22bc05987`,
401 archivos / 23872655 bytes, verificado/no instalado. Único módulo funcional
cambiado respecto de 6d198c9f: conditional-assessment.mjs,
`2c4eb265b057b4442b9362d9b0bb1f4c2217ef51b924dae4e8858c2506a5be3e`.
Test nuevo: `679656263c2d8bd18d41b8217245bdba22250cd2f4c7c2f434ed209824704df1`.
Harness, casos y runner permanecen idénticos a los hashes previos. No se
modificarán estos inputs durante el retest; nuevas BD/identidades, dos llamadas
máximo y cero reparaciones. u6DhJK sigue fallido y no se reabre para ejecutar.

Retest posterior GV6waD terminado y auditado: los dos casos cumplen el contrato
condicional sin aceptación operativa; no rehabilita este fallo original.
[Resultados y limitaciones](CONDITIONAL-ASSESSMENT-GV6WAD.md).
