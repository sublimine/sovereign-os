# Ensayo de rutas completas spVGwI — cerrado, no cualificado

13 septiembre 2026. [Prerregistro](FULL-ROUTE-PREFLIGHT.md).
No aceptación de toda la fábrica ni prueba de eficiencia general.
Proceso propio reconciliado: sesión88882 cerrada exit2; PID1881442 ausente.
Terminó 13 septiembre a **01:47:20.802 UTC**. No repetir sus brazos ni reescribir
sus respuestas, recibos, resultados o runtime congelado. Los cortes siguientes
conservan la cronología; este cierre prevalece sobre sus estados «en curso».

## Resultado final y causa del bloqueo

Dos brazos de pedidos correctos; documental NEEDS_DIRECTION/CONTEXT_LIMIT;
desarrollo no iniciado. **12 inferencias reales, 250792 tokens observados**:
21387 +74932 +154473. No convertir el plan documental aceptado en un producto
factual aceptado. Resumen SHA256
`8e21c9aeade6e3be1b88f72f4a51733828682e3af0c664ca72a817fb5d88d5f7`.

Revisión del segundo plan: cinco criterios PASS, trece citas, incertidumbre
explícita de que aprobar el diseño no certifica hechos ni recuperaciones.
Recibo real terminado 01:47:08.338, 35519 tokens. La producción siguiente pidió
el batch exacto de las dos páginas, terminó 01:47:17.126, 12427 tokens. Ambas
operaciones HTTP terminaron con 200 y fuentes admitidas por integridad, todavía
sin análisis ni aceptación factual:

- SQLite: 2033807 bytes, 01:47:18.635, SHA256
  `a6d38ca170dff62177e74e63297b44e567f673e7d2111de923e33b481560c140`.
- PostgreSQL: 23119 bytes, 01:47:19.565, SHA256
  `71f20a96952c16dca637c3e9135dded2d78e73f32c375d9c9b1199730a0271f5`.

Diagnóstico read-only posterior: el contexto reconstruido para el siguiente
paso mide **6652843 bytes**, por encima del cap lógico de codec (4 MiB) y del
trabajador (1 MiB). Las fuentes ocupan 2151845 bytes JSON y las observaciones
4479823: el HTML aparece como raw, result.content y quoteText. No fue cuota,
falta de acceso ni rechazo del contenido por el modelo. La siguiente inferencia
no llegó a enviarse. Deduplicar el transporte no resuelve por sí solo que una
fuente exceda el presupuesto lógico. Tampoco se autoriza elevarlo, quitar
contraevidencia o presentar un extracto como lectura completa.

Firmas de ambos recibos y hashes raw contrastados contra sus efectos. Transacción
query_only/ROLLBACK: journal **324**, head
`f35ce8bf726b38af4c8c454ece0d95265180a2e89f26a9d6d99527b2656c3676`,
idénticos antes/después. Hash del contexto reconstruido
`94743e36e6fee54fc026f28bef382691c2d04449b3fef06c9f1de5fbc4b16d8c`;
es una reconstrucción diagnóstica, no una solicitud histórica despachada.

Corrección posterior en desarrollo: diagnóstico de tamaños persistido antes del
packing y de crear el proveedor; no cambia el presupuesto ni recupera esta misión.
La solución de exposición documental acotada, citas ligadas a rangos observados
y lectura completa cuando sea requerida **continúa pendiente**. Por separado se
implementa un contrato propio v2 para la entrada cerrada, opt-in, sin modificar
fichas ni el contrato v1; pruebas en curso. Ninguno de esos cambios se instala
por el resultado de este ensayo.

## Pedidos, ruta adaptativa: completado y leído

Misión `9f6cb6f8-3402-4904-ad67-e693b0994f83`, COMPLETED a
**01:16:18.153 UTC**. Dos inferencias reales Astra/ultra; cero herramientas,
fuentes, archivos, ejecución, correcciones o repetición al reentrar.
**21.387 tokens**: 8.455 productor +12.932 revisor; 75.250 ms de llamadas.
No es una comparación de eficiencia hasta completar el otro brazo.

Respuesta exacta contrastada con la entrada y el cálculo externo:

```json
[{"customer":"Alicia","totalCents":175,"orders":2},{"customer":"Rui","totalCents":1799,"orders":2},{"customer":"Zoë","totalCents":230,"orders":1},{"customer":"Éva","totalCents":0,"orders":1}]
```

Se leyeron íntegras la respuesta, razones/citas del juez, linaje y reentrada.
El juez recalcula explícitamente p2/p6 excluidos por su última cancelación;
p1 reasignado a Rui; p4+p7 para Alicia; p3 para Rui; p5/p8 para Zoë/Éva.
Preserva clientes de total cero y orden A/R/Z/É por puntos de código. No se
limita a una fórmula de aprobación ni confunde filas históricas con pedidos.

Tres criterios materiales PASS y cuatro controles runtime PASS: identidad
independiente, ausencia de escrituras, ejecución e investigación. Las citas
apuntan al candidato exacto y al inventario autenticado de efectos. El revisor
no exige una revisión previa de su propio candidato para poder aprobarlo.
Hilos reales distintos y recibos ligados a sus solicitudes completas.

Fichas compiladas completas: producción omega_02/omega_23; revisión omega_22.
Se leyeron sus contratos actuales. Este caso comprueba custodia del objetivo,
transformación y revisión por criterio; **no acredita que se hayan ejecutado
todos los métodos generales de esas fichas**, un dossier institucional completo
o pericia universal. La corrección está sostenida aquí por recalcular el caso,
no por los nombres de las facetas.

Artefacto `6c55ae09-ad8f-4c8e-9bd6-1e23ce815150`, payloadSHA256
`c0f742a3224755bc6c013b72988e4bc2d95a2848060e1ee7b9b42d66729d8367`.
Revisión `320da8ee-5e11-449d-81a5-ada2e17eee35`.
Reentrada: mismos registros materiales y dos llamadas; journal78→82 por
ownership/validación legítimos, no se describe como journal sin cambios.

| Archivo en `runs/full-route-live-spVGwI/orders-last-record-adaptive` | SHA256 |
|---|---|
| result.json | 704810f3f6f56c476d4295b594868a52552c07b3a5abd496ca9fb5099d5a3e29 |
| report.json | 81f01239c1d8ab73ede6f6674fac7f20ecd1809fb639dd15c74f702c2f585520 |
| lineage.json | 295c771a8d909fc64a40efa7d74515bc6df1fa9340565c1a4076a7819f1f5999 |
| response-0.json | 928f64f713ff12fd7d465d0ce5e981cf31a74700f5d7a2f78bc4cb6af7f9b98e |
| response-1.json | 35115e4ae610a61bdd0076962c21cbf160bb908d697a304664907a43daa56826 |
| reentry.json | d2e410c01eb7a3fb7a585c5f99f317001b1d366d1daefd05f14cabc41be1b55f |

El `semanticAudit:PENDING` automático no se reescribe; esta nota registra la
lectura posterior del primer brazo. Auditoría adicional **readOnly 01:21:05.626**,
transacción query_only con ROLLBACK: ocho citas, siete criterios, firmas y linaje
recalculado idéntico al guardado; journal82/head6038b707 íntegro y sin cambios.
El resto de brazos todavía no están auditados por esta nota.

## Pedidos, planificación forzada: completado y auditado

Misión `7a69c25c-41ca-4737-ad37-f94d2a8f4ae9`. Primera propuesta leída: un
producto, especialista autónomo con selección inversa por ID, filtrado posterior,
aritmética entera y alternativa de actualización directa por ID. Carta con
pregunta, métodos, beneficio, falsificador y cierre sin autocertificación.
La elección se motiva porque el directorio no declara un productor específico
de esta transformación. Nueve requisitos preservados; el motor añade su
cobertura completa al criterio final **antes** de la revisión independiente.
El plan fue aceptado por su revisor separado y el especialista entregó el mismo
array exacto. COMPLETED **01:22:18.564**, cuatro inferencias reales Astra/ultra:
plan23936, revisión de plan18449, producción10462, revisión final22085 tokens.
Total **74932**, cero correcciones/efectos/replay. Quince criterios PASS (cinco
de plan, diez de producto). Revisor final vuelve a calcular supervivientes,
sumas, recuentos, cliente cero y puntos Unicode exactos de las iniciales.

Lectura completa de las cuatro respuestas y ambas revisiones. Auditoría
readOnly **01:23:29.761**, query_only/ROLLBACK: **33 citas**, firmas y linaje
idénticos; aceptación del plan anterior al primer productor, versiones y carta
autónoma ligadas al plan. Journal178/headc428490f íntegro/sin cambios.
Ficha del especialista/prefijo
`2b9cb063d59e4b5671cb6c7c69f5f2717d475a8fe0d19083e9de452fbe1d033b`
con contrato explícito de misión, no una faceta permanente inventada ni permiso
extra. ResultSHA256
`819a6195d35502c569b045105583fa79d579718f363284465a3c910d710a744b`;
linajeSHA256`1eae7b5681ab9f6321aa952a96234391c5a1f93da8d42a83f2dce19b3784f419`.

## Comparación observada del par

| Ruta | Resultado | Llamadas reales | Tokens observados | Tiempo de brazo |
|---|---|---:|---:|---:|
| Adaptativa | Exacto, revisado | 2 | 21387 | 77023 ms |
| Planificada | Exacto, revisado | 4 | 74932 | 360351 ms |

Ambas correctas y sin reparación. Diferencia observada: 53545 tokens y dos
llamadas. Es un par conocido con orden fijo, no un ahorro causal/general ni
coste monetario: el segundo brazo incluye 20096 input tokens cacheados. El
número de criterios difiere porque la planificación añade obligaciones de su
propio proceso; el resultado externo exige exactamente el mismo array.
No cambiar defaults/modelo a partir de este único caso.

### Asimetría contractual descubierta durante la auditoría

El rechazo documental de Ω23 obliga a examinar también el brazo rápido, no a
concederle una exención porque calculó bien. `factory/lib/closed-entry.mjs`
asigna estáticamente omega_02/omega_23 y crea el productor sin artifactIds
aceptados; la entrada cerrada no pasa por el juez de asignaciones del plan.
El compilador pide usar sólo capacidades pertinentes y resolver conflictos,
pero no registra aquí una adaptación específica de la entrada aceptada de Ω23
al dato cerrado suministrado por el usuario. La revisión de contenido y el
oracle numérico no resuelven por sí mismos esa asimetría.

**Deuda de arquitectura/calificación de roles pendiente.** La comparación
automática conserva sus resultados y hashes; no demuestra adecuación completa
de las fichas de la ruta rápida. Hace falta un contrato cerrado explícito y
probado, o una asignación compatible con su entrada real, sin relajar los
contratos originales ni equiparar ausencia de un guard conocido a compatibilidad.
No modificar el runtime mientras el resto del ensayo congelado sigue en curso.

## Fuentes y desarrollo

Fuentes, misión `e4283b42-6d94-4ce5-965c-f26cfcb79b33`: entrada eligió plan y
la propuesta1 fue **RETURN**, 01:32:38.317, con tres fallos materiales
(causal-order, capability-fit, acceptance). Ω23 necesita artefactos aceptados,
pero el nodo único mezclaba Ω06/Ω11/Ω23 sin aceptar soporte factual antes de
su síntesis. El juez distingue recuperación→análisis correcto de ese contrato
previo incumplido; no pide revisión previa del mismo candidato. Se leyeron sus
cinco checks, diez citas y recuperación íntegros, junto a las fichas completas
Ω06/Ω11/Ω23/VERITAS06/Ω22. Diagnóstico material consistente con esos contratos.
Esta revisión consumió30494 tokens/356714ms; no ocultarlos como trabajo gratuito.

El motor inició intento2, dentro de los dos intentos fijados desde el principio:
crear soporte aceptado antes de Ω23 **o** elegir un productor que admita fuentes
crudas. No cambia la petición ni elimina criterios para aprobar. Todavía no
hay adquisición ni entrega factual; desarrollo aún no ejecutado. No es una
votación repetida sobre el mismo plan ni un nuevo ensayo con historia borrada.

Propuesta2 recibida01:37:35.522 y leída íntegra en su estructura/instrucciones:
`documentary_support` con Ω06/Ω11, cuatro claims, contexto y contraevidencia,
revisión VERITAS06; después `documented_comparison` con Ω23 y revisión final.
La dependencia exige exactamente el propósito del soporte y explica su gate
anterior al consumo. El array original de requisitos es **canónicamente idéntico**
al de propuesta1. La reparación no se limita a cambiar nombres ni a solicitar
otra votación; requiere aceptación del soporte como entrada material.
40752 tokens/296986ms en esta nueva planificación. El plan2 ya fue **aceptado**;
`documentary_support` ha iniciado producción, intento1. Recuperación y producto
todavía no acreditados por este corte.

Diagnóstico adicional leído en las solicitudes1 y3: el directorio inicial de
Ω23 expone id/título/propósito/capacidades, **no su requisito de entrada aceptada**.
Los contratos completos llegan en `rejectedRoleContracts` después del rechazo.
Esto es evidencia de una carencia de información inicial, no prueba causal de
que ampliarla garantice acierto o ahorro. Próximo diseño: exponer restricciones
críticas de admisión antes de la primera propuesta, ligadas a las fichas, y
probar incompatibilidades estructurales sin afirmar que ese preflight sustituye
el juicio semántico independiente. No modificar el directorio durante spVGwI.

Diseño separado, sin implementación ni cambio de los inputs en curso:
`../design/CLOSED-ENTRY-CONTRACT-V2.md` propone un contrato de productor cerrado
propio del controlador, sin usar una ficha de síntesis con entradas incompatibles
ni falsificar un plan aceptado. Necesita código y pruebas después de reconciliar
este ensayo; no acredita mejora por estar documentado.

La suite8SfWEz permanece
859 PASS/cero fallos/un SKIP, 245 inputs íntegros y runtime14936f68 no instalado.
No otro checkpoint del servicio en este turno; R01–R16 sigue pendiente.
