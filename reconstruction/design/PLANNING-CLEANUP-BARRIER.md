# Barrera de cierre durable del planificador

19 septiembre 2026. **Cambio de desarrollo, no instalado ni cualificado con un
proveedor live.** Esta frontera endurece la recuperación de las inferencias de
planificación nuevas. No declara completado R14, no modifica el ejecutable en
servicio y no convierte una respuesta retenida localmente en una entrega
aceptada.

## Riesgo que se cierra

Una llamada de planificación puede devolver una respuesta estructuralmente válida
y, aun así, quedar en un estado incierto entre tres fronteras distintas:

1. la respuesta puede no llegar a persistirse;
2. la respuesta puede persistirse, pero el proceso/adaptador del proveedor no
   confirmar su cierre;
3. el proceso puede caer después de cualquiera de esas escrituras.

Un recibo de respuesta no demuestra por sí solo que sea seguro consumir el
resultado ni iniciar un reemplazo. Consumirlo temprano convierte una caída de
limpieza en un falso éxito; reemplazarlo temprano puede emitir una segunda
petición alrededor de un despacho cuyo desenlace externo sigue siendo
desconocido. Esta barrera conserva esas dos incertidumbres como estados
explícitos y fail-closed.

## Secuencia causal

Para una misión nueva que fija el marcador
planningCleanupProtocol: planning-cleanup-v1, la secuencia local es:

~~~text
solicitud exacta + reserva opcional
             │   (misma transacción SQLite)
             ▼
origen de despacho durable
             │
             ▼
llamada al proveedor
       ┌─────┴──────────────────────────┐
       ▼                                ▼
respuesta validada                 sin respuesta validada
       │                                │
respuesta/recibo retenidos             │
       └──────────────┬─────────────────┘
                      ▼
     resultado de provider.close() retenido
                      │
                      ▼
     lector público estricto / fallo durable
~~~

El origen se conserva antes de la llamada física y se enlaza con la solicitud
prospectiva exacta. En la ruta de inspección, también se enlaza con la reserva
global concreta. La respuesta se valida frente a su esquema antes de poder
retenerse, pero queda **en cuarentena** hasta que exista un cierre durable
válido. Esa separación es intencional: el proveedor se cierra después de
generate(), pero la respuesta no se hace consumible sólo porque haya llegado
antes.

La política de la misión se congela íntegramente en su registro de versión uno.
No es un detalle de presentación: la presencia de `planningContracts`, sus
límites, el modelo, la autoridad de herramientas y el marcador de limpieza son
la admisión de la ruta. Quitar sólo `planningContracts` después no convierte a
un actor de inspección en un planificador heredado, ni quitar el marcador lo
convierte en histórico; ambos casos bloquean el despacho antes del proveedor.

El registro de cierre se enlaza con el origen, la solicitud, la configuración
del worker, la reserva cuando existe y una de tres disposiciones mutuamente
excluyentes:

| Disposición local | Significado mínimo |
| --- | --- |
| RETAINED | Hay una respuesta pública exacta retenida antes del cierre. |
| NO_DURABLE_RESPONSE | No se retuvo una respuesta válida; sólo después de un cierre CLOSED puede conservarse un fallo local explícito. |
| RESPONSE_UNRETAINED | Se observó una respuesta validada, pero falló su retención durable; no autoriza inventar que no existió. |

CLOSED exige que el adaptador haya confirmado close() y que la observación de
salida no sea explícitamente falsa. UNCONFIRMED, un registro de cierre ausente,
un origen ausente o un enlace/orden alterado no se reinterpretan al reabrir
SQLite.

## Estados públicos y permiso resultante

La proyección de diagnóstico
sovereign.planning-cleanup-observation.v1 es total y de sólo lectura. Sólo
devuelve referencias, estados y la disposición local; no muestra la respuesta
en cuarentena, campos internos del adaptador ni resultados crudos del proveedor.

| Estado público | Condición local observada | Lo que se permite | Lo que queda prohibido |
| --- | --- | --- | --- |
| AVAILABLE | Origen y cierre válidos, CLOSED, respuesta RETAINED correctamente enlazada. | El lector estricto puede validar de nuevo la respuesta pública exacta. | Afirmar aceptación, corrección semántica, cierre físico del host o entrega remota exactly-once. |
| NO_DURABLE_RESPONSE | Origen y cierre válidos, CLOSED, sin respuesta durable. | Registrar el fallo local **exacto y posterior al cierre**; sólo entonces la política puede admitir un actor distinto ya autorizado. | Declarar que el proveedor no hizo trabajo remoto, devolver presupuesto, repetir el mismo despacho o sustituirlo sólo por el estado de cierre. |
| PENDING_CLEANUP | Falta el cierre o es UNCONFIRMED. | Inspeccionar el historial sin mutarlo y pedir reconciliación. | Consumir la respuesta, crear fallo de reemplazo o iniciar otra solicitud del mismo actor. |
| RECONCILIATION_REQUIRED | Cierre CLOSED con RESPONSE_UNRETAINED. | Conservar el diagnóstico y escalar para dirección/reconciliación. | Tratar la respuesta como ausente, reemplazarla o persistir una respuesta tardía. |
| UNVERIFIED | El origen, el cierre, sus hashes, su orden o sus vínculos no verifican. | Exponer únicamente que la evidencia no verifica. | Inferir disponibilidad, recuperar contenido o reparar el historial por reintento. |
| NOT_APPLICABLE | Actor histórico anterior al protocolo. | Mantener su semántica histórica. | Fabricar evidencia retrospectiva de cierre. |

Un informe puede explicar que una respuesta está retenida pero bloqueada. No es
una vía alternativa de consumo: si la proyección `planningCleanup` dice
AVAILABLE, `planningInspection` aún usa el lector estricto del contrato de
respuesta antes de mostrar acción, motivo o cobertura pública; para
NO_DURABLE_RESPONSE sólo puede mostrar el token local de fallo tras su lector
estricto. Si no, nunca muestra contenido. La exclusión de campos internos del
adaptador se aplica a la proyección de limpieza; el timeline general puede
conservar metadatos de diagnóstico acotados, nunca una respuesta cruda.

## Recuperación y prevención de repetición

La reserva de una inspección de planificación comprueba **todos** los intentos
anteriores de la misión, no sólo los del actor actual. En el mismo actor, cada
antecesor debe observar AVAILABLE. Para un actor distinto, AVAILABLE es válido;
NO_DURABLE_RESPONSE sólo lo es si existe el token de fallo exacto, validado
después del cierre y unido a la reserva anterior. No basta con que el último
parezca sano: un historial antiguo contaminado no queda curado por una llamada
posterior. La regla evita que una respuesta ya retenida, cuyo recibo limpió la
marca de pendiente, o un cierre sin su token de abandono, se use como pretexto
para emitir una segunda solicitud mientras el desenlace original sigue incierto.

Un fallo local de proveedor no se convierte en autorización de sustitución hasta
que la disposición es NO_DURABLE_RESPONSE, el cierre es CLOSED y el token de
fallo exacto quedó escrito después de ambos. Aun en ese caso, la recuperación
sigue su política de actor activo durable, presupuesto, cuota, calidad y
mandato; esta barrera no concede una llamada adicional por sí sola. Una
respuesta validada pero no retenida exige reconciliación/dirección y conserva el
identificador de la solicitud original.

## Integridad y compatibilidad

- La primera escritura de origen exige protocolo SQLite 15 dentro de la misma
  transacción material. Si la transacción revierte, revierten el marcador, la
  promoción de protocolo y los registros asociados.
- Las misiones históricas cuyo registro de versión uno no admitió el protocolo
  no reciben un marcador ni un cierre inventado. Cuando tienen una solicitud
  identificable, el informe las proyecta como NOT_APPLICABLE; sin esa solicitud
  el actor aparece sin intento. Una misión v15 no puede rebajarse a histórica
  borrando o cambiando su política actual.
- Una alteración de versión, identidad, política, solicitud, configuración,
  reserva, resultado enlazado o secuencia de commits bloquea el lector estricto.
  Una discordancia entre la política actual y la admisión v1 se proyecta como
  UNVERIFIED sin presupuesto ni valor retenido. Si el ledger estricto de
  inspección (política, reserva, orden o head) no verifica, `missionReport()`
  falla cerrado con PLANNING_INSPECTION_INTEGRITY en vez de inventar una vista
  autenticada.
- Esta prueba local no acredita que el proveedor haya ejecutado exactamente una
  vez, que no quede proceso en el host, que la red haya entregado una petición,
  ni que el plan sea correcto, aceptado o autorizado para efectos.

## Evidencia de desarrollo

Las pruebas dirigidas cubren respuesta retenida antes de cierre, ausencia de
cierre, cierre no confirmado, respuesta no retenida, fallo local tras cierre,
alteración de origen/cierre, degradación de política, informe JSON/texto de sólo
lectura, reserva concurrente y cortes reales de proceso en las fronteras de
origen, respuesta y cierre. Incluyen el hueco post-cierre/pre-token: ningún
actor de sustitución puede llegar al proveedor hasta que el fallo durable exacto
está ligado a la reserva previa. La regresión del motor conserva además
recuperación con SQLite real y proveedores simulados declarados.

El corte actual se limita al árbol de desarrollo. Antes de cualquier promoción
se requiere una regresión completa archivada, revisión de compatibilidad,
reconciliación del escritor/cola y una cualificación separada que no convierta
los dobles simulados en evidencia de un proveedor real. R01–R16 permanecen
abiertos.
