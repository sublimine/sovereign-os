# Revisión aislada KZ6Aeb — no cualificada

13 septiembre2026. Copia diagnóstica de UWr0Gu, no recuperación ni entrega.
Prerregistro en [UWr0Gu](DOCUMENTARY-LIVE-UWr0Gu.md). Originales conservados.

## Resultado observado

- Cualificación09:54:37.016; fin09:58:00.162; sesión78538exit2.
- PID2020361/boot2a077981-8aea-444e-8eff-44fa69814267/startTicks47720793,
  reconciliado ausente09:59:49.175.
- Release639c5597ca0b3a6e9639a7eb437a7ae81c046e6cfafebfd875f50bf827e22cdf,
  suite xXVzSB/271pins/76runtime, todos íntegros al cierre. No instalado.
- Nuevo actor `run:a5c1b437-2e3c-47af-a4f6-9deba425d757`.
- Seis llamadas REALES completadas sin error de proveedor, **301.645tokens**.
  Cero juicios/aceptación. La séptima solicitud local fue detenida ANTES del
  proveedor por el techo de seis. CódigoEXPERIMENT_BOUNDARY, noTIMEOUT/cuota.
- ResumenSHAf1ead91ad88d106cae56f61180df8e13ea450285ba5c0fee7ee827621f4a7aaa;
  journal de copia640/8068c37a83c6aff40bbefafb577182a445491cd58a551bc0ec1cfbc1c4e0bc62.
- Base originalSHAc82a6e118d4c30d0210ad59353cdb79d2f752ab3bdcf47ffb77b02f40da476ff
  intacta, journal496. No nuevos efectos, productores, fuentes, productos,
  cambios de plan/política ni de heads históricos en la copia salvo nuevas
  observaciones del juez. La misión sigueFAILED; el candidato sigueCANDIDATE.

La casilla `completeCalls:true` del resumen sólo significa que las seis llamadas
al proveedor completaron; no es un juicio ni contabiliza como inferencia real la
solicitud que el propio harness no envió. `independentWindows:false` requiere
una revisión comprometida en ese check: no significa que no hubiera ventanas.

## Navegación realmente elegida

| Llamada | Acción propuesta | Observación siguiente |
|---|---|---|
| 0 | SQLite[1430000,1444000) | ventana propia14000B |
| 1 | PostgreSQL[0,23119) | raw completo de esa página |
| 2 | SQLite[1433000,1437000) | sustituye sólo ventanaSQLite |
| 3 | SQLite[1434000,1436500) | vuelve a reducir ventanaSQLite |
| 4 | SQLite[1434000,1435800) | nueva reducciónSQLite |
| 5 | SQLite[1434000,1435800) | repetición exacta, cero texto nuevo |

Cada respuesta es action=document/source.read con resultado inactivo exacto,
no una decisiónUNKNOWN material. La primera completó en15.686s/41090tokens.
El bloqueo de gramática minItems11 se corrigió efectivamente: la acción antes
imposible ahora se representa y ejecuta. Eso no soluciona por sí solo la ruta.

Auditoría de solicitudes completas0–5: las dos referenciasSQLite ya estaban
en la entrada1; **las cinco referencias de los cuatro hechos están literalmente
presentes en todas las entradas2–5**, con sourceId/hash propios correctos.
Once criterios de contenido y tres runtime permanecen, así como la petición
íntegra. Esto acredita exposición de pasajes, no lectura cognitiva, suficiencia
semántica ni intención privada del juez. No se inspeccionó razonamiento privado.

## Intervención siguiente, motivada por la interfaz observada

En cada entrada, `documentNavigation.operations[].result.scope` repite el
aviso temporal del momento de selección: «NEXT input, not yet completed reading».
Es históricamente correcto, pero seguía apareciendo sin separar aquel momento
de las ventanas ya incluidas en la entrada actual. También sólo se exponía
`step`, no el presupuesto de respuestas restante. El bucle está observado;
que esta ambigüedad lo explique por completo **sigue siendo hipótesis**.

Corrección en desarrollo:

- conservar los resultados históricos exactamente, etiquetados
  HISTORICAL_OPERATION_RESULT; no reescribir los registros antiguos;
- exponer activeSelections (IDs/hash/rangos) derivados de las mismas selecciones
  que aportan el texto al frame actual, estables antes/después de la inferencia;
- aclarar que puede analizar/citar el texto de ESTA entrada sin otra lectura
  ni una copia ya completada de la misma respuesta. El runtime fija después el
  recibo y aplica las mismas pruebas, sin conceder aceptación anticipada;
- mostrar remainingReviewSteps; no convertir presencia/contador en suficiencia
  semántica, ni forzarACCEPT. RETURN/UNKNOWN siguen disponibles;
- en el diagnóstico de seis llamadas, el worker dispone realmente de seis
  pasos, no doce ocultamente recortados por el harness. No sube presupuesto.

PrimeroROJO: sesión27450,1FAIL/1648.732633ms, falta activeSelections. Prueba
posterior compara cada selección con sus ventanas reales y cada resultado
histórico con el registro original. Sesión97944 cerrada:103/103PASS,
117278.70779ms. Modelos/HTTP simulados; almacenamiento y pruebas de identidad
reales. Auditoría readOnly10:07:34 confirma que las pruebas antiguas del
candidatoUWr0Gu siguen siendo válidas/journal496 intacto tras el cambio.

La inspección posterior detectó que el nuevo párrafo con action=review también
se añadía al productor, cuyo protocolo termina enaction=final. Se canceló
**sólo la regresión provisional mIvGtf propia**, identificando propietario y
conservando streams/resumen; no un servicio o ensayo real.10:05:56.834→10:09:08.292,
SIGTERM/exit1, sin conteos finales, resumenSHA
266c84a7df2439df10a222de9ae862096c8b890f20587013b62ed77795b4c0ec.
No se presenta como una regresión aprobada. Propietario2024089 ausente.

Prueba de separación primeroROJO, sesión12421/1FAIL/1250.12161ms:
el productor recibía indebidamente ese párrafo. Corregido para añadirlo sólo
al reviewer; activeSelections sigue siendo una proyección fiel disponible a
ambos roles. Después siete pruebas dirigidasPASS, sesión8531/7290.885805ms,
incluyendo integración y cinco modos del harness. Nueva regresión completa
FnbTQJ/sesión88947 en curso desde10:10:52.237,PID2028114,
boot2a077981-8aea-444e-8eff-44fa69814267/startTicks47820234;271inputs. Todavía
sin nuevo ensayo real después de KZ6Aeb.

Próximo retest sólo después de tests/freeze: directorio y copia nuevos del
**original UWr0Gu**, nunca reanudar KZ6Aeb ni incorporar sus sugerencias al
candidato. Mismos roles/criterios/política/fuentes, seis llamadas máximo, nuevo
juez sin ventanas prestadas. Sin planner/productor/fetch/efectos o cambio de
modelo. Preservar cualquier fallo y distinguir mejor interfaz de mejor juicio.
No instalar ni cerrarR01–R16 por este caso conocido.

## Continuación registrada, 10:23 UTC

FnbTQJ cerrada1041tests/1040PASS/1SKIP a10:16:15.345; suite e inventario
verificados10:16:41.494. Nueva releasebd527154... verificada/no instalada.
Diagnóstico [bNXUDE](DOCUMENTARY-REVIEW-bNXUDE.md) activo desde10:17:22,
sesión8732/PID2032438, sobre copia nueva del original. Tres llamadas completas,
dos lecturas propias y respuestaACCEPT; aceptación runtime/cierre aún pendientes.
KZ6Aeb no se reanudó ni cambió su resultado fallido.
