# Registro de dominio por archivo, sin ejecución implícita

Estado: documentación del árbol de trabajo. La ruta de procedencia (protocolo 12)
y activación/despacho (protocolo 14) descrita aquí no está acreditada como instalada: comprobar el wrapper activo y
los informes locales de instalación antes de usarla contra una
base real.

## Dos comandos, dos garantías

`sovereign learn-validate --file /ruta/privada/dominio.json` acepta sólo
`--file`, `--json` y, opcionalmente, `--provenance-policy RUTA`.
No admite `--state-dir`. Ejecuta un preflight estructural en SQLite
`:memory:`: manifiesto cerrado, rol/ámbito, dataset, binding de
procedencia y reglas mínimas del registro. Si se aporta una política, comprueba
la forma de sus claves Ed25519 y roles, pero no la usa para verificar firmas ni
abre el Store de destino para comprobar fuentes, revocaciones, identidad o
solapamientos. El resultado no reserva un `policyId`, no registra nada y no
certifica que un `expected` sea verdadero.

`sovereign learn-register --file /ruta/privada/dominio.json --state-dir /ruta/estado`
es la operación distinta que puede persistir un dominio. Para uno activable se
configura también una política externa con `--provenance-policy RUTA` o
`SOVEREIGN_LEARNING_PROVENANCE_POLICY`. No crea misión, propuesta,
comparación, promoción, exportación ni llamada de modelo. Antes de usarlo hay
que confirmar que el binario que atenderá esa base admite el protocolo necesario;
la mera presencia de este archivo en un checkout no lo prueba.

## Manifiesto cerrado

El objeto JSON UTF-8 regular contiene exactamente
`{domainId, roleId, scope, datasetSpec, provenance?}`:

- `domainId`: identidad estable del experimento/dominio, no una ruta de código.
- `roleId`: ficha real del catálogo; debe pertenecer al conjunto completo de
  `scope`.
- `scope`: propósito, modo y facetas exactas del
  [servicio de aprendizaje](LEARNING-SERVICE.md). No abre rutas excluidas ni
  autoriza transferir una mejora a otro perfil/formato.
- `datasetSpec`: `missionId` de evaluación, `evaluatorId`, casos y política.
  Cada caso congela `id`, input completo, `expected`, `required`, `holdout` y
  `criteria`; el input contiene `taskInstructions`, texto de proveedor,
  schema, modelo, razonamiento e `instructionProfile` compatible. No son
  opciones sobrescribibles por CLI.
- `provenance`: obligatoria si el dominio puede activar un overlay. Usa
  `sovereign.learning-provenance.v1`, enlaza dominio/rol/ámbito/dataset/evaluador
  y cada caso congelado, e incluye referencias de fuente hash/pasaje, derivación,
  método, limitaciones y exactamente una atestación Ed25519 `labeler` y una
  `reviewer`. Puede ser opcional en `evaluation-only`, que permanece
  inactivable aun cuando la incluya.

La política `sovereign.learning-provenance-policy.v1` lleva las claves
públicas y roles confiados fuera del manifiesto. El dominio almacena sólo el
`policyId` usado, no una raíz de confianza; todo proceso que registre o use
ese dominio debe recibir la política pertinente. Se rechazan `keyId` repetidos,
roles no autorizados y claves públicas reutilizadas bajo identidades distintas.
Al usar el dominio, el `policyId` de runtime debe coincidir con el congelado en
dominio y procedencia; las mismas claves presentadas bajo otro ID de política
se rechazan igualmente.

## Registro transaccional y uso

La CLI exige un evaluador implementado compatible, `requireImprovement:true`,
al menos un caso requerido no holdout y un holdout. Es una condición mínima de
admisión, no una prueba de representatividad, independencia o mejora real. El
primer evaluador, `exact-json-value-v1`, compara JSON completo con
`exactMatch/higher/1`; no es juez semántico ni validación universal de schema.

Tras el preflight, el registro real verifica dentro de una transacción la política
externa, ambas firmas y que cada fuente permanezca ADMITTED con el hash y pasaje
declarados. Luego persiste el binding, dominio, baseline y compilación. Una
reentrada CLI idéntica devuelve `ALREADY_REGISTERED` sin resetear un puntero
activo; otra identidad que solape el mismo rol, ámbito canónico y target se
rechaza, igual que una reutilización con contenido distinto. La API baja
`LearningService.registerDomain()` rechaza directamente un dominio existente;
no confundirla con esa reentrada de CLI.

Un dominio atestado eleva la base a protocolo 12 dentro de esa transacción. La
primera activación no-baseline o autorización de despacho de un overlay eleva a
protocolo 14 en su propia transacción; registrar un dominio o medir una propuesta
no hace esa elevación por sí solo. Un dominio v1 sin atestación conserva historia,
pero su compilación exige protocolo 11; una base elevada no tiene downgrade ni
conversión automática de ese historial. Drenar escritores antiguos y cualificar
un binario compatible es parte de la promoción, no algo que haga `learn-register`.

En evaluación, promoción, resolución y exportación, el runtime vuelve a verificar
binding, política, firmas, fuentes, hash y pasajes. Retirar una fuente bloquea
usos futuros sin borrar el registro histórico. Esto acredita custodia y revisión
conforme a la política; no demuestra verdad factual del `expected`,
independencia humana, calidad del método o ausencia de contaminación.

Para cada caso y variante de evaluación, el servicio primero persiste una
autorización durable de evaluación/caso/variante/request/prefijo/ámbito en la
misma transacción que revalida esa custodia y sólo después llama al callback.
No es una transacción física con el proveedor. Tras el callback hay otra
revalidación; `beforeComplete` es un gate síncrono dentro del commit de
evaluación, antes de enlazar el prefijo reutilizable. Una revocación previa
bloquea el despacho; una posterior queda ordenada tras la autorización y puede
bloquear el resultado en sus gates posteriores. La promoción no-baseline emite
un dossier inmutable que liga candidato, padre, dataset, ámbito, prefijo
evaluado, targets, evaluación y procedencia; el Registry no acepta una promoción
directa sin él. Después del CAS se persiste un binding separado con la versión y
hash exactos de `learning-role`. Promoción y rollback no-baseline comprueban
antes y después de mover el puntero en su transacción. El rollback a baseline es
una retirada estrecha: conserva autoridad, identidad exacta y journal, pero no
exige que la procedencia del overlay que se está desactivando siga válida.

Al crear un worker se congelan además las referencias del dossier y del binding.
Si se seleccionó un overlay, un origen firmado e inmutable liga el `run@1` y el
`worker-config@1` iniciales: una cabeza posterior de configuración no puede
borrar ni vaciar el hecho de que ese run era aprendido. Antes de cada proveedor
se vuelven a validar la fuente, el puntero, el ámbito y el target; luego se
retiene el request exacto y se persiste, en la misma transacción, una
autorización durable de despacho con referencias exactas a run, worker-config,
request, activación y binding. El Registry genérico sólo acepta esa retención
cuando el `WorkerService` entrega un handoff opaco local para esos bytes, run y
autorización exactos. Sólo después se llama al proveedor.

Al retorno, el worker vuelve a comprobar la custodia y entrega otro handoff
opaco para el recibo exacto. El Registry no acepta un recibo plano fabricado:
revalida antes de adjuntarlo, consume la autorización una sola vez y conserva
una finalización firmada que liga autorización, run pendiente, request,
configuración y hash del recibo. Una retracción, un dossier/binding modificado,
un rollback, una promoción posterior o una configuración cambiada bloquean el
run antiguo antes de registrar un request, entrar al proveedor o admitir su
resultado. No se reescriben los bytes históricos: se crea un run nuevo si se
quiere usar el overlay activo. Los handoffs son capacidades de proceso, no una
firma remota del proveedor; se pierden deliberadamente tras reinicio y exigen
reconciliación con evidencia verificable. Quien pueda mutar directamente el
Store o usar su Authority está dentro de la base de confianza: estos controles
no se presentan como una frontera contra ese propietario. Esta autorización
prueba permiso antes del intento externo, no que el proveedor haya respondido
ni que su respuesta sea correcta. Los registros históricos no son una nueva
acreditación.

Hay una recuperación estrecha si una retención exterior falla después de
adjuntar un recibo: el mismo proceso puede conservar valor público, recibo y
handoff opaco exactos y volver a intentar sólo la misma ruta y request, sin una
segunda llamada al proveedor. Dos reintentos exactos convergen en el resultado
durable verificado; antes de devolverlo se comprueba de nuevo el validador del
llamador y la custodia actual de fuente, binding y target. Un input/ruta
distinto, un cierre de proveedor no confirmado, una retracción o una
configuración cambiada fallan cerrados. No es exactly-once físico: tras un
reinicio no existe caché reconstruible desde el hash y hace falta
reconciliación externa.

## Privacidad y estados

El resultado de registro comunica identidades, hashes, compatibilidad, número de
casos y llamadas emparejadas previstas; no revela casos ni `expected`. Los
casos quedan congelados en SQLite: modificar el archivo después no los modifica.
El modelo proponente recibe sólo observaciones y ámbito pertinentes; una
evaluación explícita usa el input e instrucciones del caso, nunca su
`expected` como feedback.

`policy.activation: "evaluation-only"` permite experimentar y medir ámbitos
sin resolver, promover o exportar un overlay. Ninguna prueba SIM, firma de
procedencia o resultado de evaluación acredita por sí solo mejora de modelo,
un evaluador de dominio o aprendizaje automático operativo.
