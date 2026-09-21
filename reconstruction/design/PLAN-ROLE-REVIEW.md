# Revisar las asignaciones con las fichas completas

## Actualización — 13 septiembre 2026

El ensayo real ZxHWcv confirmó una asimetría restante: el juez ya ve las fichas
completas, pero el planificador inicial sólo ve ID/título/capacidad/propósito.
Puede proponer una asignación incompatible antes de conocer sus prerrequisitos
y pagar después tanto el plan como su rechazo. En ZxHWcv ocurrió con omega_23
sin entradas aceptadas y, después, con omega_07 sin servicio nativo completo.
[Fallo, auditoría y corrección](../verification/DOCUMENTARY-LIVE-ZxHWcv.md).

Cambio acotado en desarrollo: `knownRoleContracts` aporta desde el primer plan
la ficha íntegra de omega_23, con hash y procedencia, además del catálogo
existente. Las incompatibilidades duras conocidas se exponen por separado y
se rechazan mecánicamente. No es un catálogo abreviado de todas las condiciones,
ni una lista que declare disponibles los demás roles. La revisión completa de
cada selección sigue siendo obligatoria. Ninguna aprobación futura subsana la
falta de una entrada aceptada previa.

Frontera abierta: selección general con consulta acotada de fichas completas
antes de comprometer un plan, conservando cada consulta/propuesta y sus costes.
Debe compararse con la ruta actual en casos distintos: añadir una etapa fija
también cuesta una inferencia, y cargar las154fichas supera3MB. No introducir
otra etapa ceremonial ni declarar eficiencia por reducir el tamaño del JSON.
Todavía no se ha implementado ni cualificado esa consulta general.

## Causa y alcance

La solicitud capturada `request-1.json` de h53t6RZV, hash
`a832c71c4914d69ecc3e8c4124acc6aa3ab20f9881ed1f234951983ef41b34a8`,
contiene la ficha íntegra de omega_22 para el juez del plan, pero no las fichas
de los roles que debe evaluar como asignaciones. El plan contiene IDs y métodos
declarados por el planificador. El juez carece así de contratos completos de
los roles propuestos para contrastarlos antes de aprobar capability-fit.

El rechazo determinista de blind_replication corrige una incompatibilidad conocida,
no el caso general. Se añade por ello `targetRoleContracts` a la revisión de un
candidato de tipo mission-plan, nodo planning y propósito plan. Se liga al ID/hash
exacto del candidato, enumera cada asignación productor/revisor por nodo y aporta
una sola copia **íntegra** de cada ficha seleccionada, con su procedencia y hash
del conjunto. No carga las 154 fichas cuando el plan sólo asigna unas pocas.

El juez compara propósito, método obligatorio, entradas, salida e independencia;
las fichas objetivo no cambian sus propios roles, permisos ni fuentes empíricas.
Una limitación no se borra por eludir un ID. Debe devolver incompatibilidades
materiales, citando la asignación concreta del plan y explicando el contrato que
incumple. Las pruebas originales y cada intento quedan conservados.

## Fronteras

- No modifica el plan candidato, los criterios ni su historial.
- No incorpora instrucciones de rol adicionales al prefijo del juez ni le
  autoriza a ejecutar funciones de productores.
- No envía fichas ajenas a las asignaciones ni amplía revisiones ordinarias de
  productos con esta colección del plan.
- Conserva los límites de contexto lógico: si no cabe completo, no se trunca.
- No certifica por sí mismo que un juez razone correctamente o que existan
  adaptadores para cada método. La prueba KS0q5j41 pasó dos casos con jueces
  reales y planes simulados: ajuste correcto frente a una asignación incompatible.
  [Resultado, lectura y límites](../verification/PLAN-ROLE-REVIEW-RESULTS.md).

Es un cambio de desarrollo posterior al paquete 4506ceeb. El ensayo MztBjXHC
que usa ese paquete inmutable no contiene este cambio y no puede acreditarlo.
