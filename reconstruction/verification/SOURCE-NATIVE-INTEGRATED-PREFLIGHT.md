# Cualificación integrada de source-text-v1

12 septiembre 2026. Contrato anterior a cualquier llamada de este ensayo.

## Hipótesis y alcance

La vista literal pasó dos selecciones aisladas en fV56uy. Esto no prueba que el
planificador completo elija correctamente el contrato nativo, que el plan sea
aceptado ni que el juez compruebe el producto. Se cualifica esa ruta integrada
en cb746cb7, manteniendo intactos OZcLj2, cVQFI4 y fV56uy. No es un holdout ni
una comparación causal de eficiencia; la fuente ya es un caso diagnóstico conocido.

Se usa exactamente request/expected de native-input-live-OZcLj2/qualification.json:
fuente SHA-256 6bdc23cdc84e7f006f8b2e833175b60a8e8d15a4b469d131bd92cae892bda582;
cuerpo de 47 bytes, CRLF, emoji y NFD, hash
c0469889c88aaa3a23def8cbb768144bad5634db2e6ca6270bda1eece5f0e44b.
El esperado queda en el oracle local; el modelo sólo recibe la petición original
y los contextos/prefijos/esquemas ordinarios completos. No hay prompt de respuesta,
plan preescrito ni selección sugerida desde el verificador.

## Política y presupuesto

Una misión aislada nueva, sin cola ordinaria. Astra/ultra por suscripción oficial,
preset adaptive-v1 con entryMode=planned y contextEncoding=source-text-v1 explícitos,
fichas compactas completas y contrato propio, cero herramientas/efectos,
maxParallelPureNodes=1, maxPlanAttempts=1 y maxNodeAttempts=1. Se permite una
reparación estructural/de referencia por juez, no repetición de rechazo material.
Máximo total de cinco llamadas; la ruta sin reparaciones requiere tres:
planificador, juez del plan y juez del producto. Una inferencia productora
ordinaria no es una copia nativa y el harness la bloquea; no se cuenta como éxito
una ruta distinta. No hay API de pago, instalaciones, publicaciones o segundo
ensayo automático. Cuota/interrupción/fallo quedan registrados para reconciliar;
no autorizan un nuevo ID para obtener otra oportunidad.

## Puertas distintas

1. Nuevo verificador independiente de ambos selectores: coincidencias únicas,
   orden, cuerpo exacto y ninguna reparación de escapes/Unicode. No importa el
   selector ejecutable de producción. Debe fallar ante cuerpo, estado, hash,
   contrato, criterio, origen documental o aceptación alterados.
2. El motor valida el plan y añade selección/fidelidad antes de su revisión;
   las exigencias originales deben llegar al producto sin pérdida.
3. El origen nativo se recomputa con inputCopyEvidence, firma, identidades,
   contrato y orden real. Exactitud de copia no certifica verdad del texto.
4. Se exigen aceptación independiente del plan y del producto, cuerpos/hashes/
   bytes exactos, un origen nativo, cero productor LLM y cero efectos.
5. Reentrada COMPLETED: dos commits del lock engine/exclusive y una validación
   vacía de workspace (registro firmado más evento): cuatro eventos en ese orden.
   La validación debe pertenecer al resultado y juez exactos, estado UNCHANGED,
   cero archivos/listados/ejecuciones. Todas las versiones anteriores de registros
   no-engine y sus hashes permanecen idénticos, excluyendo sólo el nuevo ID de
   esa validación; misma identidad final y cero inferencias nuevas. No se exige
   journal invariable ni se confunde esta observación con un nuevo producto.
6. Auditoría manual posterior de cada solicitud, salida, ficha/prefijo aplicado,
   plan, razón/evidencia del juez y prueba nativa. Un booleano no sustituye esto.

El nuevo harness y oracle se fijan por hash antes de la misión. No se modifica
run-live-input-copy.mjs ni su oracle antiguo limitado a v1. El paquete congelado
debe coincidir con los inputs runtime de la regresión; no se edita durante el
ensayo. Las capturas de solicitud se guardan antes del envío y las respuestas
completadas antes de entregar el control al motor. Si el proveedor rechaza la
salida antes de devolver recibo, su consumo queda desconocido, no cero.

La documentación oficial de OpenAI recomienda auditar instrucciones y comprobar
los cambios significativos; no acredita que esta representación concreta sea
mejor. [OpenAI Docs: guía de Astra](https://developers.openai.com/api/docs/guides/latest-model).
La decisión de probar el wrapper deriva de los fallos y del ensayo local anterior.

## Servicio y separación de versiones

Checkpoint único de esta continuación: 20:07:47.923 UTC saludable,
448d4467-9dce-4521-b20f-c118d394b6ba. 21 muestras/17 saludables/cuatro fallidas,
journal observador 43/da1ae579. Se registra OBSERVATION_GAP entre las dos últimas
muestras; no se convierte en tiempo observado. Segmento actual 0, máximo
5132930 ms. Servicio 10bbffa0/PID989536 activo/habilitado, NRestarts 0;
journal ordinario 410/2f54d5b7 y misión previa sin cambios. No reinicio/instalación.

Pendientes antes de lanzamiento: resultado de pruebas dirigidas, regresión,
hashes exactos del harness/oracle/fuente y última verificación de cb746cb7.

Primer contraste con el motor (30 tests): 22 PASS/ocho fallos. Los ocho recorridos
aceptaron correctamente copia/plan/revisión; falló la expectativa nueva de sólo
dos eventos de reentrada. Lectura de verifyWorkspaceSnapshot mostró el registro
firmado y evento de comprobación vacía además del lock. Se corrige el oracle
antes de cualquier llamada real, exigiendo ambos y preservación de cada registro
anterior. No se modifica el motor ni se elimina la comprobación de entrega.

Segundo contraste dirigido: 30/30 PASS, 17920.505115 ms; incluye ambos selectores
en cuatro representaciones, dos jueces simulados, reentrada y ocho salidas
abruptas de procesos reales. Los asserts nuevos se contrastan con productos e
historiales creados por el motor, no sólo con un report inventado por el test.

Durante la primera regresión completa se añadió al harness el enlace de
engine.blind.providerFactory al mismo controlador de presupuesto/actores.
Ningún replicador queda autorizado por este ensayo. Ese archivo cambió después
del inicio de la suite: se conservará el resultado anterior sin presentarlo como
inputs idénticos, y se ejecutará la regresión del conjunto definitivo. Ningún
runtime de factory cambió; los 62 inputs seguían idénticos a cb746cb7 a las
20:15:52.706. No se ha llamado al modelo en este ensayo todavía.

La cadencia de muestras es evidencia, no un temporizador ideal: de 18:59 a 20:07
se superó maxGapMs aunque la continuación estuviera activa. No se amplía el
límite ni se convierte ese intervalo en disponibilidad observada. La observación
prolongada pendiente debe separar planificación del chat y cadencia comprobada.

## Corte definitivo anterior al lanzamiento — 20:29:57.387 UTC

Primera suite ll1x2a: 20:15:51.417–20:19:26.758, 770 tests/769 PASS/cero
fallos/un SKIP, 215257.045432 ms. Summary SHA-256
53a3d4d143e0ae420046f62bcf4c255ffcf7a099150ed6258a21f7a15cf56941.
De sus 224 inputs sólo cambió el harness durante la ejecución: 06a3c80a →
24cd6640. No se atribuye al conjunto definitivo.

Suite definitiva Bx7JMX: 20:19:51.239–20:23:22.052, 770 tests/769 PASS/cero
fallos/un SKIP, 210695.927669 ms, exit 0 sin interrupción. Sus 224 inputs,
inventario completo, manifiesto inicial/final y ambas salidas se verificaron
idénticos a las 20:29:57.387. Los 62 inputs runtime coinciden con cb746cb7;
399 archivos/23852062 bytes, verificación completa. El primer chequeo auxiliar
incluyó por error informes JSON entre los scripts de verificación; se ajustó
su filtro al inventario .mjs real de run-suite, sin modificar ningún input.

- Summary: 61a3fd922f9d6bfc3ef8e51ad01cd6058ba5c17e9e60778e0c20de1db58240e6.
- stdout: 6c2afa6757970b2dbc8cf3e5f91fa4ff2f0a8cb6bdf45d1c8a2bc502b9c98fff.
- stderr vacío: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.
- Harness: 24cd6640e1471154fa71372b002ce7267e8c73495c4e8f495ec8de76ca2de67a.
- Oracle: 36ccbaaa2a37a693cd2325690f2a46156c98fe07a8d5ef3bd35726c0644d7768.
- Archivo fuente: 53600d74469bfb1e03bcbc52615ddacb81a924453c7cbe98abcca473b0583414.
- Runtime: cb746cb7866bfa3539d13191ee139b2cf33c5338067ad238efa46e5a7b884f00.

Queda autorizado por el contrato anterior un único ensayo integrado nuevo con
estos inputs. El SKIP corresponde a inferencia real deshabilitada en la suite;
ni esa suite ni fijar hashes sustituye la cualificación integrada pendiente.
