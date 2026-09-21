# Registro declarativo de un dominio de aprendizaje

Estado: contrato del árbol de trabajo, 19 de septiembre de 2026. Describe la
implementación que está bajo desarrollo y **no** acredita que el wrapper o el
servicio instalado la contengan. El release instalado `e3dfb824` y su evidencia
histórica siguen siendo el estado de producción consultable en
[`STATUS`](../verification/STATUS.md); no se deben atribuir a ese release el
protocolo 12 ni esta política de procedencia hasta una promoción separada.

## Límite de la interfaz

En el árbol de trabajo, `learn-register --file MANIFIESTO` recibe un único
objeto JSON UTF-8 cerrado con `domainId`, `roleId`, `scope`, `datasetSpec` y,
si el dominio puede activar un overlay, `provenance`. No acepta flags de modelo,
razonamiento, permisos o activación que reescriban el manifiesto. La captura de
archivo conserva los límites existentes, no sigue enlaces y no interpola texto
en shell. El manifiesto, casos, `expected`, holdouts, citas y atestaciones se
mantienen locales: no se convierten por sí mismos en contexto del proponente.

No hay selección automática de casos, proveedor nuevo, scheduler ni autoridad
del modelo para modificar sus propios criterios. `registerBaseline()` del
`LearningService` queda expresamente limitado a
`datasetSpec.policy.activation: "evaluation-only"`; un overlay activable debe
pasar por `registerDomain()` con procedencia verificada.

## Procedencia de valores esperados

`provenance` usa `sovereign.learning-provenance.v1`. Su binding congela el
dominio, rol, hash del ámbito normalizado, hash del dataset, evaluador y, para
cada caso, los hashes de caso/input/`expected`/criterio y los flags de split.
Cada caso requiere exactamente una entrada de evidencia con una o más
referencias a fuente (`sourceId`, hash y pasaje literal), derivación declarada,
método de revisión, limitaciones y dos atestaciones Ed25519: una `labeler` y
una `reviewer`.

Las claves públicas no viajan en el manifiesto. El operador entrega una política
local independiente `sovereign.learning-provenance-policy.v1` mediante
`--provenance-policy RUTA` o `SOVEREIGN_LEARNING_PROVENANCE_POLICY`. El material
de claves y sus roles forma parte de la configuración confiada del proceso; el
dominio sólo congela el `policyId`, no una nueva raíz de confianza. La política
ha de estar disponible tanto al registrar como al usar el dominio. Se rechazan
roles no autorizados, `keyId` repetidos y políticas que reutilizan la misma
identidad criptográfica (misma clave pública) para entradas distintas.
En cada revalidación, el `policyId` de runtime debe coincidir con el congelado
en el dominio y en su registro de procedencia: el mismo material de claves bajo
otro `policyId` también falla cerrado.

Una firma válida prueba que las dos identidades configuradas atestaron esos
bytes y que las referencias aún apuntan a fuentes admitidas con el hash y pasaje
indicados. Eso acredita custodia y revisión bajo esa política; **no** prueba la
verdad factual de un `expected`, independencia humana, calidad del método,
representatividad del split ni ausencia de contaminación semántica. Sin
procedencia, el dominio sólo puede ser `evaluation-only`. Un dominio
`evaluation-only` puede llevar procedencia opcional, pero sigue sin poder activar
un overlay.

## Dos puertas, con alcances distintos

`learn-validate --file MANIFIESTO` valida en memoria la forma cerrada del
manifiesto, ámbito, dataset, binding de procedencia y requisitos mínimos de
registro (evaluador compatible, `requireImprovement`, un caso requerido no
holdout y un holdout). Si se entrega `--provenance-policy`, sólo valida la forma
de esa política. No abre el Store de destino, no verifica criptográficamente
firmas ni busca/revalida fuentes, no reserva el `policyId` y no hace inferencia,
evaluación, promoción, exportación ni activación. Su salida no expone casos ni
`expected`; es una puerta de revisión estructural, no una certificación de
confianza o calidad.

`learn-register` prepara primero esa validación y después abre el Store real.
Dentro de la misma transacción, para un manifiesto con procedencia, verifica la
política externa, ambas firmas, admisión vigente, hash y pasaje de cada fuente
antes de persistir `learning-provenance`, el dominio, baseline y compilación.
Así no hay una ventana entre comprobar una fuente y escribir el dominio. La
ruta de registro CLI trata una repetición idéntica como `ALREADY_REGISTERED`
sin resetear el puntero activo; una misma identidad con otro ámbito, dataset o
procedencia se rechaza. La llamada SDK baja `LearningService.registerDomain()`
es deliberadamente más estricta ante un ID ya existente (`LEARNING_EXISTS`): no
debe confundirse con la reentrada idempotente de la CLI.

## Uso posterior y compatibilidad

Una compilación de dominio atestado vuelve a obtener el registro congelado y
comprueba binding, identidad de política, firmas y fuentes en evaluación,
promoción, resolución y exportación. La retirada de una fuente bloquea esos usos futuros;
no borra el historial ni convierte una evaluación pasada en evidencia nueva.
Ningún paso crea una misión, propuesta, comparación, promoción, exportación o
scheduler automáticamente.

Cada caso de evaluación y cada variante (`baseline`/`candidate`) recibe primero
una autorización durable que liga evaluación, caso/hash, variante, request,
prefijo y ámbito. Se persiste en la misma transacción que revalida procedencia,
y sólo después se llama al callback externo: eso ordena la custodia, no hace
atómica físicamente una llamada al proveedor. Tras el callback se revalida otra
vez; el gate síncrono `beforeComplete` repite la comprobación dentro del commit
de evaluación, y una última revalidación liga el prefijo reutilizable. Una
revocación anterior bloquea el despacho; una posterior queda ordenada después de
la autorización y puede impedir completar, reutilizar o promover el resultado.
Promoción y rollback comprueban antes y después del cambio de puntero dentro de
su transacción. El historial conserva esa secuencia, no una nueva acreditación.

Persistir un dominio con procedencia eleva el `user_version` de SQLite a
protocolo 12 en esa misma transacción. Los dominios v1 sin atestación conservan
sus filas e historial, pero no ganan acreditación retrospectiva; su compilación
exige protocolo 11 y por tanto no se sirve desde una base que ya optó por 12.
No hay downgrade ni migración automática. Antes de una promoción de release hay
que drenar escritores anteriores, cualificar el binario compatible y planear
esa frontera de protocolo sin presentar un árbol de desarrollo como si ya
estuviera instalado.

## Cobertura esperada del árbol de trabajo

Las pruebas de registro/procedencia ejercitan manifiestos cerrados, Unicode,
conflicto e idempotencia, solapamiento, archivos ilegibles o no regulares,
política ausente o malformada, binding alterado, firmantes/roles/claves públicas
duplicadas, fuentes retiradas y revalidación antes de uso. Deben conservar el
estado antes/después y las fuentes originales. Esa cobertura es una barrera de
regresión del árbol de trabajo: no sustituye una cualificación del paquete
instalado, un evaluador de dominio acreditado ni una demostración de aprendizaje
real.
