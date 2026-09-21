# XrlCqq — resultado conservado, contraste completo no aprobado

12 septiembre 2026. Cerrado 21:50:42.535 UTC, sesión 24690 exit 2. Cuatro
llamadas reales Astra/ultra por suscripción, ninguna reparación/repetición,
ningún efecto de misión. Los ocho pasos previos de propuesta/aceptación de plan
fueron **simulados**, no ocho inferencias reales. No se instaló este runtime.

El oracle prospectivo obtuvo tres casos conformes y uno no conforme. No equivale
a 75% de precisión: el diseño mezcla selección y aceptación sustantiva de un
prerrequisito simulado. No es calibración representativa, eficiencia demostrada,
aceptación íntegra de producción ni cierre de R01–R16.

## Resultado por obligación, sin cambiar etiquetas

| Caso | Objeto solicitado / seleccionado | Decisión | Selección | Fidelidad | Objeto requerido | Oracle original |
|---|---|---|---|---|---|---|
| 0 | BETA 0072 / BETA 0072 | RETURN | UNKNOWN | PASS | PASS | FAIL |
| 1 | BETA 0072 / ALFA 0071 | RETURN | FAIL | PASS | FAIL | PASS |
| 2 | ALFA 0093 / BETA 0094 | RETURN | FAIL | PASS | FAIL | PASS |
| 3 | ALFA 0093 / ALFA 0093 | ACCEPT | PASS | PASS | PASS | PASS |

Cada juicio contiene cuatro criterios de contenido y cuatro controles nativos.
Los controles de identidad independiente y ausencia de escrituras/ejecución/
adquisición son PASS en todos. El primer par preserva 44 bytes con CRLF, emoji,
NFD y espacios; el segundo 42 bytes con backslashes literales, NFD, LF y tabulador
final. Dos negativas son copias válidas del objeto equivocado, no corrupción de bytes.

Case-0 reconoce explícitamente que BETA y su copia son correctas. Devuelve por
la falta de aceptación sustantiva previa del plan: los PASS históricos declaran
ser simulados. Case-3 inspecciona la misma advertencia, interpreta la aceptación
registrada como antecedente suficiente y realiza él mismo el contraste semántico.
No demuestra que uno no supiera seleccionar texto. Sí muestra una interpretación
distinta de la frontera entre aceptación registrada y aceptación sustantiva.

Los dos negativos localizan el error en planificación/aceptación del selector,
sin culpar al mecanismo de copia ni certificar la verdad del contenido. No se
ejecutaron sus sugerencias de corregir/reproducir: este ensayo no autoriza otra
votación o nueva copia después del resultado. Case-0/1/2 permanecen NEEDS_DIRECTION,
case-3 mantiene su COMPLETED histórico de diagnóstico; no se convierte en una
misión con planificación real porque su último juez sea real.

## Coste observado y alcance

| Caso | Inicio y fin UTC | Tokens | Duración de llamada |
|---|---|---:|---:|
| 0 | 21:38:19.230–21:41:46.067 | 23318 | 206837 ms |
| 1 | 21:41:47.124–21:44:31.332 | 22341 | 164208 ms |
| 2 | 21:44:32.828–21:47:33.631 | 22776 | 180803 ms |
| 3 | 21:47:34.513–21:50:41.900 | 22925 | 187387 ms |

Total cuatro recibos: **91360 tokens**, 68038 entrada + 23322 salida;
18403 de razonamiento están incluidos en salida, no se suman otra vez.
739235 ms de llamadas sumadas. Cuatro hilos distintos, simulation:false,
scoped-v1; cero llamadas productoras para las copias. No cuenta como coste de
una misión con planificación real: upstream fue simulado y sin uso medido.
Tampoco acredita eficiencia satisfactoria para peticiones breves.

## Auditoría de registros

Revalidación completa 21:52:09.662–21:52:10.045 UTC, SQLite readOnly/BEGIN/ROLLBACK.
Leídos íntegros los motivos, hallazgos e incertidumbres de los cuatro jueces;
73 citas comprobadas contra el campo correcto, incluyendo 16 controles firmados.
artifact cita exclusivamente payload.body; runtime cita su quoteText exacto,
con verificación de referencia/contexto/hashes; control liga criterio/candidato/
misión/juez y firma. No se confundió existencia del pasaje con verdad universal.

En los cuatro casos se verificaron los recibos guardados contra las respuestas
capturadas, hash de solicitud, exposición completa del juez, ficha omega_22
completa frente al catálogo congelado y origen nativo recalculado. Todos conservan
cronología misión 2 → plan aceptado 40 → productor nativo 47 → origen 48 → candidato 51.
La aceptación de plan es estado de fixture, no validación semántica real.

Reentrada: negativos seis eventos exactos de lock/estado, sin versiones materiales
nuevas; positivo cuatro eventos de lock/revalidación vacía firmada, sin cambiar
la misión ni sus productos. Ninguna copia, revisión o inferencia adicional.
assertUsable de case-3 pasa en el runtime congelado: eso valida sus controles
registrados, no convierte los prerrequisitos simulados en reales.

| Caso | Misión | Journal final |
|---|---|---|
| 0 | 351b2f60-b26f-4cb8-aeee-13442e9492d5 | 123 / 0b16d76091e041dd76b0f3b01e36f236cf0b454f9a1b73a2b83a233dfd63069c |
| 1 | 0ce0c450-0061-4467-9e3f-973941ca24a2 | 118 / c5cbe8d8113f7683eb19282013a6e6ed11d72a6b7198e17388e4c5e2161b6ef0 |
| 2 | 76281925-a383-4d57-a5b2-6b8b01dadac6 | 121 / b447e02fd6dacc40bd19ec8cfb10556fd900f05160a1071a7c19165d56e60f00 |
| 3 | 53b790f5-3d21-4a1a-8d7d-29978a5b16d7 | 126 / 7e53724189fdc27765cd03d550bc16f502ebd2f72f6236ef24a34b7d57b85f02 |

## Corte y anclas de evidencia

Runtime cb746cb7866bfa3539d13191ee139b2cf33c5338067ad238efa46e5a7b884f00:
399 archivos/23852062 bytes, 62 archivos de código. Los 229 inputs de NmrLo4 y
del ensayo siguen idénticos al cierre de auditoría. Regresión previa: 780 PASS,
cero fallos/un SKIP; detalles y hashes de harness en el [preflight](NATIVE-SELECTION-REVIEW-PREFLIGHT.md).

Directorio de datos: [native-selection-review-XrlCqq](runs/native-selection-review-XrlCqq/).
Los JSON brutos conservan semanticAudit:PENDING; esta auditoría posterior es un
documento separado y no reescribe su marca original ni sus resultados.

- qualification.json: b287dadcf33c1e1599e7bd05cdae552deeae4eae3a26612ff90a472508e9bfa8.
- summary.json: f7e7a51d9189280b511d7a3174fb2a93b18a7703f0954d733a9d2497b0e52a4c.

| Caso | result.json SHA-256 | response-2.json SHA-256 |
|---|---|---|
| 0 | bceff5ba136ba9e9543ac5154df4b52dab8aa4015328511d83ede05a3a200437 | 525ba68e06afe7a59ca6f96913a59082cd4ceb876243109fd75ba4e50b1fa3f5 |
| 1 | 961d0dcf1a2e658d926b18dc079fb7a67b743f46427742f0daf1c513bfc951e2 | 040cdc78add8e8fc6c090572e505c6eab484fd2d5bcc877a2702eec74a8efd56 |
| 2 | f81454a7978fabbfe808773416c62c42c1d721b2f43f3ce44e2e56467373095a | ba205d2f67423172cea5724f8c0c91ddcb15b520d383082a3c9f8617998e5287 |
| 3 | f521b70392cdf866a9b2732c229979bb59c8ea5947ba3823cf8388ce2adbf717 | c0219eea7c1fbb5222669df7b37cff7c56f768ebe03e819d777eb69f2093041c |

## Siguiente cambio de método, sin repetir XrlCqq

1. Separar **evaluación condicional de un espécimen** de **aceptación de entrega**.
   La primera puede usar fixtures explícitos sin certificar su linaje; la segunda
   no se cualifica con inferencias upstream simuladas. Fijar ese alcance antes
   de construir un oracle de ACCEPT/RETURN.
2. Exponer la clasificación real/simulada/desconocida de las inferencias de los
   prerrequisitos como procedencia estructurada, no depender de que un motivo
   de prueba incluya la palabra SIMULATED. Estudiar versionado y compatibilidad
   antes de cambiar el runtime; una firma o actor distinto no suple ejecución.
3. Un control positivo de aceptación completa debe satisfacer todos sus
   prerrequisitos. Si se inyecta un defecto, declarar de antemano qué obligación
   deja de ser válida. No fabricar la revisión upstream para abaratar el control.
4. Los cuatro req.literal.object concuerdan con las selecciones construidas;
   es lectura exploratoria de este corte, no nuevo oracle post hoc aprobado.
   No derivar sensibilidad/especificidad o superioridad con dos pares conocidos.
5. Mantener 24pcUY como positivo integrado con tres llamadas reales, separado
   de este ensayo mixto. La diversidad de misiones, utilidad marginal de roles,
   eficiencia y persistencia prolongada siguen pendientes.

Nada de esto exige permiso nuevo, más gasto API, reinstalación, una repetición
de estos cuatro casos o cambio retroactivo de sus criterios. La siguiente
continuación debe implementar/verificar la frontera de procedencia y evaluar
el diseño antes de proponer otro ensayo real.
