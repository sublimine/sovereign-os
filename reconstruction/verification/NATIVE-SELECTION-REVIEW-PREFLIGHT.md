# Próxima puerta: selección semántica frente a fidelidad nativa

12 septiembre 2026, 20:44 UTC. Preparación posterior a 24pcUY; **no llamadas
reales realizadas ni autorización para repetir aquella misión**.

## Qué falta y por qué

24pcUY prueba una ruta positiva integrada conocida: selección correcta, copia
exacta y dos aceptaciones. No prueba que el juez detecte una copia nativa exacta
del objeto equivocado. La simulación previa de un RETURN demuestra que el motor
lo conserva, no que un juez real sepa emitirlo. Ambos controles son necesarios.

Dos fuentes sintéticas nuevas tienen secciones ALFA/BETA parecidas y una petición
inequívoca de sólo una de ellas. La primera conserva CRLF/emoji/NFD; la segunda
combina backslashes literales, Unicode descompuesto, LF y tabulador final.
Cada pareja conserva exactamente petición, requisitos, criterios, método,
instrucciones y roles; sólo cambia el selector nativo. Ambos selectores son
únicos, válidos y fieles al texto seleccionado, pero uno selecciona la sección
expresamente excluida. No se introduce un error mecánico que evite el juicio.

Orden prospectivo: correcto/incorrecto, incorrecto/correcto. No es una muestra
aleatoria representativa. Caso correcto: ACCEPT y selección/fidelidad PASS.
Incorrecto: RETURN, selección FAIL y fidelidad PASS. Rechazar por sistema todos
los casos no aprueba este contraste; tampoco aprobar el texto por su firma.

## Diseño del futuro ensayo, todavía no implementado ni lanzado

Cuatro juicios reales de producto, máximo una llamada por caso, sin reparación
ni re-voto. Las propuestas y aceptaciones previas de plan serán fixtures
explícitamente SIMULADOS; no se describirán como planificación real ni como
aceptaciones semánticas válidas. En los negativos, esa aceptación previa
deliberadamente errónea permite comprobar si el juez actual conserva su obligación
de selección pese al estado histórico ACCEPTED. No falsificar recibos reales.
La creación/copia/origen/cronología, el contexto del juez y su commit seguirán
el motor real. Sólo el juez del producto llama al proveedor de suscripción.

Conservar fuente íntegra, ficha omega_22 completa y observaciones nativas
autenticadas; source-text-v1 en cb746cb7 congelado, sin instalación o cambio de
preset. No enviar al juez expected, oracleReason, ID de variante o selector
alternativo; no dar el cuerpo esperado como respuesta en instrucciones.
Guardar solicitud exacta antes de llamar, respuesta/recibo antes de validarla,
y conservar cada caso aunque su veredicto falle el oracle. Cuota, excepción,
interrupción o ruptura de integridad detienen el despacho restante; no crean
otra oportunidad bajo otro ID. No cambiar fichas/modelo/criterios entre pares.

Se deberá verificar por separado el acierto de decisión, selección y fidelidad,
los pasajes válidos y los motivos completos. Un fallo de cita no cuenta como
un rechazo semántico correcto. En positivos: producto aceptado y reentrada sin
inferencia adicional. En negativos: rechazo material conservado, ningún final
COMPLETED y reentrada sin volver a copiar o votar. Una aceptación simulada previa
no se convierte en evidencia de verdad por estar firmada localmente.

Antes de cualquier llamada: implementar y probar el harness, congelar sus inputs,
regresión completa del conjunto definitivo y verificación del runtime. No
ejecutar el harness antiguo de role-fit, que usa otro oracle y exposición.

## Preparación comprobada

Tres pruebas dirigidas PASS, 534.1874 ms; sin modelo. Contrastan los cuatro
planes con validatePlan, normalización de cobertura/gates y contratos de roles;
ambos selectores con oracle independiente; variación exclusivamente del selector;
conservación de dificultades Unicode/escapes y negativos del propio verificador.

- Casos: bfb51bbd8f32561b1698138bf3bd4cdd831201472737951ea0da9bb8fa0824db.
- Tests: b88df01ed8659ab283706c3c632c752f37c9ce18604137f79263d28db0616f5f.

Estos dos archivos son posteriores a Bx7JMX (224 inputs); no atribuirle ahora
226 inputs. Los 62 inputs runtime no han cambiado. El ensayo 24pcUY permanece
cerrado e íntegro; su resultado no se extiende a estos casos todavía no ejecutados.

## Implementación prospectiva — 21:31 UTC

Harness separado implementado; **ninguna llamada real todavía**. Ejecuta el motor
completo por caso, con dos recibos upstream marcados simulation:true y sólo un
proveedor de revisión del producto. Fija cero reparaciones, un intento por nodo,
ninguna herramienta y máximo cuatro proveedores reales globales. La ruta del
adaptador cerrado comparte el mismo guard; cualquier actor no previsto se bloquea
antes de llamar. Un veredicto semántico equivocado se conserva y no se repite;
una excepción, cita inválida, cuota o fallo de integridad corta los casos restantes.

La captura local conserva las tres solicitudes y respuestas separadas. Para el
producto, el proveedor aplica su aislamiento/transporte/JSON y schema, devuelve
su recibo y se escribe la respuesta antes de ejecutar el validador original del
WorkerService. No cambia texto, criterios ni veredictos. El validador del motor
se mantiene y comprueba nuevamente la salida antes de registrar la inferencia.
Se verificó el contrato vigente de [Codex App Server](https://learn.chatgpt.com/docs/app-server):
outputSchema pertenece al turno concreto; no se presupone heredado entre llamadas.
Se reutiliza el adaptador oficial y su comprobación explícita de Astra/ultra,
sin crear otro adaptador de API ni tocar la autenticación.

Once dirigidas: primer corte 9 PASS/2 FAIL (5455.432191 ms): el comprobador omitía
los dos eventos mission.status legítimos en reentrada negativa. El motor no repetía
productos/inferencias. Corregido el oracle de reentrada, no el runtime: negativos
exigen seis eventos exactos (lock, estado RUNNING, estado NEEDS_DIRECTION, lock),
dos versiones de misión y mandato restante idéntico; positivos cuatro eventos
de lock/revalidación vacía firmada, sin cambio de misión. En ambos, cada versión
material de producto/origen/revisión permanece idéntica.

Segundo corte 11 PASS/0 FAIL (5207.169151 ms); posterior refuerzo para detener el
despacho ante fallo de integridad: tercer corte 11 PASS/0 FAIL, 4751.502287 ms.
Todos los proveedores de estas pruebas son explícitamente simulados. Se incluye
el falso ACCEPT conservado como fallo del oracle, la cita inválida preservada
antes de validación, cuota sin segundo intento y freeze roto sin proveedor creado.
Regresión global definitiva iniciada después de los últimos cambios; pendiente.

Inputs del ensayo previstos, congelados antes de la regresión:

- Harness: 28a1e62a4cb1b68b07521c53c806bfdcf7ed4d330b762790ce2c8d4083a4ba3c.
- Runner: ada8fa2aa412d8dc1823faf74193e096979ac4757a5797ce4551c37315e39635.
- Casos: bfb51bbd8f32561b1698138bf3bd4cdd831201472737951ea0da9bb8fa0824db.
- Test harness: f96cbfcf5c3300c054cef2805506597a978c4aad23316ef8c95a5e2e6f02c803.
- Oracle de selección independiente existente: 36ccbaaa2a37a693cd2325690f2a46156c98fe07a8d5ef3bd35726c0644d7768.
- Runtime cb746cb7866bfa3539d13191ee139b2cf33c5338067ad238efa46e5a7b884f00,
  no instalado ni modificado.

Antes de llamar, el runner exige suite completa sin fallos/interrupción, conjunto
actual exactamente igual, todos los hashes de inputs, inicio y streams íntegros,
y los 62 archivos de código runtime idénticos a la versión congelada. Estas
comprobaciones no convierten tests simulados en aceptación semántica real.

### Regresión definitiva cerrada — 21:37 UTC

NmrLo4: 21:29:11.755–21:33:03.066 UTC, 781 pruebas/780 PASS/cero fallos/un
SKIP live opt-in, 231193.156778 ms. Sesión 55287 cerrada exit 0, no señal.
229 inputs intactos y registro inicial/salidas coincidentes comprobados
21:37:51.260; runtime cb746cb7 verificado (399 archivos/23852062 bytes).

- summary.json: c036a7f0fa3578513c153fbd945c1a7d8986ab1b135cd5dd57cab5fa3e30453e.
- results.tap: fc6ceb35f230e46c1e22bfeaff807e83a8521b11d85e064eeec3a93761369112.
- stderr.txt vacío: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.

Este corte cualifica el harness definitivo con proveedores simulados; los
juicios de modelo real son el siguiente ensayo y no están incluidos en la suite.

### Primer resultado XrlCqq — 21:41 UTC, ensayo aún abierto

case-0, positivo de selección BETA, terminó NEEDS_DIRECTION. Una llamada real,
23318 tokens, 206837 ms; ninguna reparación ni repetición. El juez devuelve
RETURN con input-copy-selection UNKNOWN, fidelidad PASS y req.literal.object
PASS: identifica correctamente BETA/0072 y la copia completa, pero considera
material que el supuesto prerrequisito de aceptación independiente del plan es
explícitamente simulado. Los diez controles mecánicos/identidad/reentrada son
válidos; el oracle prospectivo de decisión/selección/final esperado NO pasa.

**Confusor del diseño, no falso negativo semántico demostrado.** El ensayo mezcla
selección del objeto y validez sustantiva del prerrequisito simulado. Los dos
positivos no son controles íntegramente válidos de aceptación de misión. El
rechazo no demuestra que el juez confunda ALFA/BETA: su razón y el criterio
req.literal.object prueban lo contrario en este caso. Se conservan expectativas,
resultado y fallo originales; no reclasificar el ensayo como aprobado ni quitar
la advertencia de simulación para obtener ACCEPT. Case-1 ya fue despachado bajo
el diseño previamente fijado; no hay un segundo intento de case-0.

La evaluación posterior deberá separar el contraste exploratorio de selección
de la aceptación real de todo un recorrido. No crear un recibo supuestamente real
para arreglar este confusor ni hacer que la firma de un fixture acredite una
revisión que no ocurrió.
