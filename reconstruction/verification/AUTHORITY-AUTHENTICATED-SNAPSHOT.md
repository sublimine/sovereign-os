# Devolver exactamente el contenido autenticado

Hallazgo local15:17:15.003 UTC del13septiembre2026. **Corrección implementada,
regresión global posterior en curso; no instalada.** Se respetó el cierre de
VM8lJD antes de cambiar sus entradas.

## Reproducción y alcance

Prueba mínima exclusivamente en Store(:memory:) y una clave aleatoria efímera.
Se firma `{scope:'fixture-read-only'}` y se pasa a Authority.open un objeto
plano cuya propiedad `data` es un getter: primero devuelve el contenido original,
después `{scope:'fixture-unverified-write'}`. Resultado observado: dos lecturas
de propiedad, ningún error, devuelve el segundo contenido no autenticado.
No se imprimió ni usó material de firma del servicio instalado. No se emitieron
leases operativas, acciones de broker, inferencias o escrituras de archivos.

La causa está en Authority.open: calcula HMAC sobre una lectura de signed.data
y luego devuelve clone(signed.data), que vuelve a consultar esa propiedad.
keys() comprueba nombres/prototipo, no rechaza por sí sola getters. Esto demuestra
una debilidad de la API JavaScript directa. Las entradas JSON ordinarias no
transportan getters; no se afirma explotabilidad remota, compromiso del servicio
ni que las pruebas de leases/broker puedan eludirse con este ejemplo.

## Corrección prospectiva

Conservar HMAC-SHA256 y el formato/canonical exactos. Rechazar propiedades de
acceso en el sobre antes de leer sus valores, y capturar los metadatos de firma
como datos JSON planos. Serializar una sola vez el cuerpo kind/data a autenticar,
verificar contra esos bytes y devolver una copia parseada de ESOS mismos bytes.
Nunca releer signed.data después de verificar ni crear una caché de firmas.
No sustituir firmas por hashes, concatenaciones nuevas o un parser canónico propio.

Reutilizar contratos y Node crypto existentes; no biblioteca nueva ni cambio
de claves. La lectura del cuerpo autenticado también evita una serialización
grande duplicada, pero la corrección se acepta por fidelidad/autenticación,
no por una promesa de rapidez. Medir cualquier efecto temporal por separado.

RED antes de producción: getter cambiante y getters en sobre/firma/data sin
ejecutarlos; firma/tipo/keyId/algoritmo erróneos; datos y metadatos alterados;
claves ocultas/símbolos/ciclos/prototipos no planos; igualdad con sobres históricos
normales, Unicode/arrays/objetos vacíos y aislamiento de la copia retornada.
Comparar aceptación de firmas previas y rechazo de contenido modificado. Mantener
regresión de leases, expiración, revocación, delegación y documentos completos.

No instalar, anunciar release, repetir modelo o medir otra operación antes de
corregir y volver a verificar. PvhN1F/786639b y la próxima salida VM8lJD no
acreditan ausencia de este hallazgo todavía no cubierto por sus tests.

## Resultado dirigido y compatibilidad

VM8lJD cerró15:18:25.982:1133tests/1132PASS/ceroFAIL/unSKIP,
326277.225204ms. Owner2127636 ausente,274inputs, started y las cuatro capturas
parciales/finales reconciliados15:24:45.032; resumen SHA256
46eb873946a60e71b911bfe83d42ac356292f8d00dbffb273b16ddf4dcb7f004.
No se construyó ni instaló un release intermedio con el hallazgo abierto.

Se añadieron siete pruebas antes de tocar Authority.open:4PASS/3FAIL,
240.182810ms. Fallaban rechazo del getter cambiante, accesores del sobre/firma
y propiedades ocultas/símbolos. Implementación: captura de descriptores propios
exactos y enumerables sin getters, clon canónico de metadatos de firma,
HMAC-SHA256 del mismo cuerpo canónico anterior y devolución JSON.parse(body).data.
El cuerpo sólo se serializa una vez; no caché, cambio de clave o nuevo formato.

La repetición del archivo completo dio14/14PASS320.182472ms. Se añadió además
un Proxy que cambia sus descriptores entre capturas: debe devolverse el contenido
autenticado y capturarse una vez, sin afirmar que los traps no se ejecuten.
Resultado final dirigido15/15PASS283.810308ms. Fixtures con bytes de firma
históricos explícitos, Unicode, referencias repetidas, sobres congelados,
devolución aislada, tipos/campos inválidos, caducidad y revocación incluidos.
Regresión global nueva iniciada después de estas pruebas; esta evidencia dirigida
no cualifica por sí sola el resto de la fábrica.

Regresión posterior Sn4ZOu iniciada 15:27:30.558, sesión 75338, propietario
2133854 / boot 2a077981-8aea-444e-8eff-44fa69814267 / startTicks 49720064.
274 entradas fijadas; conservarlas hasta reconciliar resumen, capturas y owner.

## Medición posterior prerregistrada

Sólo tras cierre global y nuevo runtime congelado: repetir el arnés FE40sy
sin cambiar operación, rangos, expectativas o controles. Nueva copia privada
de AJ4tmS, no reanudar bckJet ni reutilizar una copia donde ya se hizo el paso.
Comparar operación y ventanas por igualdad exacta, conservar los cuatro eventos
esperados, replay sin eventos y rechazo de citas que no existían en la solicitud
anterior. Verificar originales, pins, runtime y script al cerrar.

Esta versión agrupa lector por lote de selecciones y snapshot autenticado.
Una diferencia de tiempo no permite atribuir cuánto aporta cada cambio, ni
reducir tokens, certificar eficiencia general o borrar el fallo anterior. No
repetir la medición selectivamente hasta obtener un tiempo favorable.

## Regresión y copia cualificadas

Sn4ZOu cerró 15:32:32.837: 1.141 tests, 1.140 PASS, cero FAIL y un SKIP,
302174.871668ms. Propietario ausente, 274 inputs, started y cuatro capturas
reconciliados 15:33:15.967. Resumen SHA256
58dca6ba523a773f62c8db951db5c4f029a092383f90a33609ce19c0abb0fb98.
Runtime fb9fa6678bbe163f753030305853663af9d2c6c0cf3e18e759164b32bd6d413c,
413 archivos/24018064 bytes, cualificado 15:33:37.922. NO instalado.

Diagnóstico MWDBfO iniciado en copia nueva de AJ4tmS, sesión 81177. Arnés FE40sy
con sólo cuatro referencias cambiadas: runtime, suite, baseline y hash de baseline.
No se cambian rangos, expectativas, operación ni controles; resultado pendiente.

MWDBfO cerró 15:35:13.023/sesión81177exit0: paso45034.069521ms, exacta misma
operación/ventanas, cuatro eventos, replay correcto y ambas citas retroactivas
rechazadas. Owner/script/274pins/release/baseline/copia/originales reconciliados
15:36:00.122. Resultado38660195dbd423110970da2c1a5dc4fa162c41b8c91633e9a941acacfb2c9680.
Esta medición conjunta no aísla el efecto de Authority.open ni cualifica la
misión original. Cambios documentales posteriores necesitan otra regresión.
