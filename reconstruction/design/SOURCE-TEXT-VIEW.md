# Fuente literal visible: representación, no reparación

12 septiembre 2026. Corrección prospectiva posterior a cVQFI4; no instalada.

## Justificación

OZcLj2 alteró Unicode al transcribir el cuerpo; cVQFI4 dejó de transcribirlo,
pero seleccionó anclas con escapes de serialización en vez de saltos reales.
Se mantienen ambos fallos. Cambiar de selector no resolvió por sí solo la
representación de entrada. Un codec reversible por código no demuestra igual
legibilidad por el modelo. No hay evidencia de un defecto del transporte.

source-text-view.v1 presenta una fuente íntegra como texto literal, sin envolver
su contenido en otra cadena JSON. La cabecera fija y sus metadatos conservan
hash SHA-256, tamaño UTF-8 y longitud UTF-16. El generador elige entre 64 pares
de marcadores hasta encontrar uno que no aparezca dentro de la fuente; si no
existe, rechaza sin truncar. El lector acota la fuente por longitud, verifica
bytes/hash y exige reconstrucción canónica exacta. No normaliza Unicode,
espacios, saltos, secuencias con backslash ni el contenido que parezca JSON.

Es una vista opcional aún no incorporada al transporte ordinario. No aumenta
límites del contexto ni autoridad: metadatos y marcadores son presentación,
no instrucciones de la fuente; el hash no acredita verdad. Una ancla incorrecta
del modelo se rechaza como antes; el lector nunca procesa su salida para
repararla. La fuente original sigue siendo la autoridad sobre los caracteres.

Se aclara además literal-input-selection-v3: preferir anclas cuando procedan;
v1 es alternativa heredada, no una orden contradictoria de transcribir siempre.
Los contratos ejecutables y registros antiguos no cambian de formato. Los
criterios de selección y fidelidad siguen revisándose antes de producir y al
aceptar el producto; esta vista no los sustituye.

## Diagnóstico fijado antes de llamadas reales

Dos casos, una llamada oficial por suscripción por caso, gpt-6-astra/ultra,
sin herramientas, API de pago, jueces, misión, instalación o repetición.
Primero la fuente inmutable de OZcLj2 con CRLF/NFD, conocida; después una
contraprueba prospectiva con rutas y secuencias backslash+n/r/t/u0301 literales,
Unicode NFD y distractor con las mismas marcas. No son un corpus representativo.

Se envía exclusivamente la fuente en la vista nueva y el contrato del selector.
El esperado y su hash quedan en el oracle local. El esquema de salida sigue
literal-input-span-v1. Se conserva respuesta/recibo antes de verificar contenido;
cada selección se aplica directamente a la fuente original y debe coincidir
íntegramente con el objeto previsto. Se guardan ambos resultados aunque uno
falle; una excepción de proveedor o cuota termina el ensayo, sin segundo intento.

Runtime, harness, helper de casos y fuente anterior se fijan y verifican antes
de cada llamada y después. La validación determinista se complementará con
lectura manual de todas las solicitudes, anclas, recibos y tramos seleccionados.
El cambio incluye presentación e instrucciones para leerla: no es un experimento
causal de una única variable ni una comparación válida de costes con cVQFI4.
No se activará el transporte ordinario por aprobar estos dos casos.

Alternativas consideradas: reparar escapes incumple fidelidad; contar offsets
por modelo desplaza el mismo problema; un catálogo de límites generado por el
controlador podría evitar transcribir anclas pero necesita especificar su
cobertura sin introducir selección semántica oculta. Se prueba primero una
vista literal reversible que no elige ni recorta partes de la fuente.

## Preflight prospectivo: 19:15 UTC

Pruebas dirigidas: 30 PASS (25 de selección/origen, cuatro de vista y una de
casos); los jueces de esas pruebas son simulados. Suite completa 7GNpLy:
19:05:31.182–19:08:54.879 UTC, 754 pruebas, 753 PASS, cero fallos/canceladas,
un SKIP, 203578.644814 ms; inferencia real desactivada. A las 19:15:48.271
se verificaron los 219 inputs, su conjunto completo y ambos streams, y los
61 inputs de runtime se contrastaron con el paquete congelado sin adicionales.

- Resumen suite: `9858836ab2cebef83c34aa102ed6e7112a59f6c869dc573cef6bfe359ace1c7e`.
- stdout: `baa41c1db3472057c7deefd6fe521b871965ab22107c69c94bbdb116794d0bb7`.
- stderr vacío: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- Release no instalada: `837e2ebad32e5d8f6122550c294f5824ce5a7f65748f938da91db987284e663b`, 398 archivos / 23844842 bytes.
- Harness: `cd5f42809f81c99abbf955dc8487dc01cad6195f4ab2a6de533828f0dadceb6a`.
- Helper de casos: `6d90eb212b7e2da1d499fc335d401229a69947399122315ab16a98db8fe8fba7`.
- qualification anterior OZcLj2: `53600d74469bfb1e03bcbc52615ddacb81a924453c7cbe98abcca473b0583414`.

Estos registros fijan la implementación anterior a las dos llamadas; no son
sus resultados. No se modifica el servicio instalado ni se crea una misión.

## Resultado y auditoría: fV56uy

19:16:23.432–19:17:15.031 UTC: dos llamadas reales, ambas selecciones exactas,
sin repetición. known-crlf-nfd conservó 47 bytes y hash c0469889; literal-backslashes-nfd
conservó 59 bytes y hash fd1db66f. Las anclas elegidas incluyen los saltos reales
adyacentes a cada bloque, excluyen las menciones en las instrucciones y el
distractor, y no transcriben el cuerpo. El segundo objeto conserva `\n`, `\r`,
`\t`, `\u0301` literales, junto al acento combinante real; no se convierten.

Se leyeron íntegros ambos requests, respuestas, recibos, selecciones y resumen.
A las 19:18:08.546 se revalidaron fuentes, oracle, vistas reversibles, identidades
de solicitud/recibo, selección aplicada al original y runtime/harness/helper.
Ambos recibos: gpt-6-astra/ultra, completed, simulation=false. 8263 + 8114 =
16377 tokens observados; no comparación causal ni evidencia de eficiencia global.

- qualification: `534858cf33e2fbffeffde418f14ee669e9b64d5865353014cfb27d2f04924ea3`.
- request-0: `383d74d9ec0bf636bb36670f96f16ededbdf90b5a308c7db8d09cd109e215b7b`.
- request-1: `627fb81dabe26849e17e1f618275826c9413232cbb4c3e2002cd6146cb4b39d8`.
- response-0: `4e04116664eb5ee043980907847698876d91182d19dc4c2a92a5b29a8bbc0746`.
- response-1: `00b1e6778a4b1520a10a8c0881dc6e1f955b33338493cff2f996729d5a148b43`.
- result-0: `44cba91580bf2cf550997cc1b8fc8aa8cf0297bd42543f9fc24f6af3a159fb59`.
- result-1: `c230f91f2d7a7a2c83303a451d90cd7841a3cac3ff0c0af7cb135eccc9605e7e`.
- summary: `d84fa1cffe120213f93eb197d5acd21534cd6e5c0d7abf2e3d51087893b64ba7`.

El campo semanticAudit=PENDING del resumen bruto no se reescribe: esta sección
es la auditoría posterior. No hay plan, producto ni aceptación final en fV56uy.
OZcLj2/cVQFI4 conservan sus fallos. No se repite este ensayo ni se instala.

## Siguiente integración, todavía sin cualificación real

Opción prospectiva source-text-v1 del contexto del worker: mantener íntegro el
contexto estructurado ya autorizado y añadir una vista literal de missionIntent
solamente cuando ese campo ya esté en el contexto admitido. No consultar la
misión global para rellenarlo. La réplica cerrada y su juez, que no reciben ese
campo, conservarán únicamente su contexto público; ningún suplemento privado.
La representación se fijará en la política, prefijo y scope de aprendizaje.

La vista complementa, no sustituye ni resume, el contexto estructurado: permite
reconstrucción exacta y contraste del duplicado con el valor original. Puede
aumentar bytes y tokens; sólo se habilita explícitamente, con los límites de
contexto lógico y de transporte conservados. Cambios en prefijos y wrapper
requieren pruebas propias y cualificación posterior del planificador completo.
Los dos casos aislados anteriores no acreditan esa integración.

Primera batería de integración (195 pruebas, 61800.383577 ms): 194 PASS/un
fallo de expectativa de test. El test nuevo esperaba null al resolver un overlay
con scope distinto; el contrato existente correctamente rechazó con LEARNING_SCOPE.
Se corrigió la expectativa a ese rechazo tipado, sin relajar el runtime. Las
pruebas de vista, worker, réplica pública, juez ciego y workflow cerrado pasaron.
Se añaden además decodificación del feedback retenido y un negativo de exposición
privada anterior usando el wrapper; pendientes nueva batería y regresión completa.

Segunda batería dirigida: exit 0, 203 pruebas (reporter dot), 19:30 UTC. Incluye
feedback íntegro en su proyección sin intención privada y rechazo de un actor
con exposición privada anterior por el nuevo wrapper. Modelos/jueces simulados;
no inferir calidad semántica real de la aceptación del fixture. Regresión completa
posterior iniciada, pendiente; desarrollo distinto de la release fV56uy.

La siguiente cualificación integrada requerirá un harness NUEVO, no modificación
de run-live-input-copy.mjs ni input-copy-trial-acceptance.mjs históricos. Este
último acepta sólo literal-input-copy-v1 y no constituye oracle adecuado para
el nuevo selector por anclas. Debe reconocer explícitamente literal-input-span-v1,
exigir cuerpo/hash/bytes exactos, selección/nodo/criterios/origen nativo ligados,
plan y aceptación independientes, cero productor LLM/efectos/replay y capturas
íntegras de todos los actores. Wrapper y schema completos han de congelarse antes
de llamar; selección aislada correcta no predice la decisión del planificador.

## Regresión y congelación de la integración: 19:35 UTC

Suite xy31zh, 19:30:57.900–19:34:18.766: 765 pruebas, 764 PASS, cero
fallos/canceladas, un SKIP; 200781.910737 ms. Inferencias reales desactivadas.
A las 19:35:07.323 se verificaron los 221 inputs, su conjunto completo y los
streams. Los 62 inputs runtime coinciden con el nuevo paquete; ningún input
runtime adicional sin registrar en la suite.

- summary: `19830e1e9514e2b4c0fa3501d201a5bf64da601d01bb60125979eedef2b40e14`.
- stdout: `165b224ac4792fa862b851423c20bac51711590d35479603a478cd7995705a23`.
- stderr vacío: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- Release: `cb746cb7866bfa3539d13191ee139b2cf33c5338067ad238efa46e5a7b884f00`, 399 archivos / 23852062 bytes; no instalada.

fV56uy y su release anterior 837e2eba se revalidaron sin cambios a las
19:33:38.017. Su resultado no se reasigna a cb746cb7. Todos los procesos de
ensayo propios de esta continuación terminaron; no se deja una prueba sin dueño.
Servicio instalado sin cambios, continuación existente ACTIVE. Siguiente puerta:
nuevo harness y oracle compatibles con ambos selectores, contrato prospectivo
y prueba real integrada en esta representación; nunca reabrir un fallo antiguo.
