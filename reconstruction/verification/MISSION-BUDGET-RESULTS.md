# Resultados: presupuesto compartido de misión

## Preflight simulado, antes de llamadas reales

`mission-budget-sim-MPLf7F` cerró 13 septiembre 23:02:12.986 UTC, sesión 54426
exit 2, tras una respuesta SIMULADA. El techo, reserva, candidato, ausencia de
entrega y cero llamada de reentrada fueron correctos. Falló el comparador del
lanzador: exigía igualdad de `metrics.workerPhases[].runIds`, pero el motor había
registrado otro actor de revisión sin solicitud ni recibo al reabrir.

Diagnóstico exclusivamente sobre los JSON cerrados: única diferencia era ese ID;
el centinela confirmó `attempted: 0`. Antes de cualquier inferencia real se
corrigió el comparador para conservar todas las métricas de consumo y verificar
por separado que los registros previos siguen íntegros y que el único actor nuevo
es un revisor de la misma misión, sin solicitud/reserva/recibo. El runtime no se
modificó. Este resultado fallido se conserva y no se reclasifica como PASS.

Prerregistro: [MISSION-BUDGET-QUALIFICATION.md](MISSION-BUDGET-QUALIFICATION.md).
`mission-budget-sim-COewHT` cerró 23:03:34.875 UTC, sesión 77136 exit 0:
ambos brazos estructurales correctos, tres respuestas SIMULADAS, dos procesos
nuevos de reentrada, cero intento de proveedor en ellos. Auditoría posterior:
owner ausente y pins íntegros; summary SHA-256
`28933974e960b265592f2414e6acc2fe8b1bd584a6aa4dca1918ae6fe62143ad`.
`actualSubscription` y `protocolPassed` permanecen false, como corresponde.

## Ensayo real cerrado — 23:05:48.955 UTC

`mission-budget-live-8lANly`, sesión 82758, owner 2324204/startTicks 52459845,
boot 2a077981-8aea-444e-8eff-44fa69814267. Sesión 82758 cerrada exit 0:
tres llamadas reales, dos bases nuevas, sin instalación ni cambio del servicio.
Pins suplementarios:

- Lanzador: `f3ff2df61235669e15a3ad72856eca5ac96bb9fd92f5b0702e3f71ca6f0e56f5`.
- Prerregistro: `f06dbcee042e69eb999b18d49c11294f594e6837a45d4f669d59bb2b8fd33c1b`.
- Caso: `bcf73433641400da1accba615579aec9560be0e7661e622fa897d2f3474458e8`.

Auditoría sólo lectura 23:08:57.158, owner y procesos de reentrada ausentes:
298 entradas y tres pins suplementarios íntegros en ese corte; reservas anteriores
al despacho, requests retenidos, prefijos completos, recibos reales y tres cierres
de proveedor reconciliados. Cuatro usos de citas literales en el contexto exacto.
[Auditoría](runs/mission-budget-live-8lANly/post-close-audit.json), summary SHA
`f24ec075d09eaf901c4a71ba9ada1bdce87546808145796237a2634f0e7d7727`.

| Brazo | Resultado de misión | Inferencias reales | Tokens observados | Reapertura |
|---|---|---|---|---|
| blocked | NEEDS_DIRECTION; candidato sin aceptar ni entregar; techo 1 agotado antes del juez | 1 | 6509 | Proceso distinto; cero intento de proveedor, cero reserva, candidato intacto |
| complete | COMPLETED/ACCEPT; techo 2 | 2 | 19499 | Proceso distinto; cero intento de proveedor y cero reserva |

Total 26008 tokens; no cifra inferida de reservas. Bases sin cambios por auditoría:
blocked `5f5828c7aa0f11e678bc64202143c315e2f9ec9916124bce56908d18d5703f20`,
complete `bcb716d1dad79d855fa5df488b04cc436b58084b6e00debbb3fed163c6e701e1`.
Journals finales: 56 eventos/head a7f55074… y 83/head 85086401… respectivamente.
Un primer intento del auditor falló antes de leer eventos por pedir un límite no
admitido de Store.events; consulta readonly exacta corregida, sin cambiar el ensayo.

### Revisión manual del contenido

Petición/caso, ambos cuerpos y juicio completos leídos. A queda excluido porque
la última aparición de su revisión máxima 3 está inactiva; C queda excluido por
su revisión máxima 4. B conserva el último empate 2 con importe cero; D conserva
revisión 1 e importe -2. Los ceros, signos, tipos y caracteres se conservan.
Orden por puntos de código: B, D, a, É, U+E000, U+1F600; total 6. Ambos cuerpos
coinciden con el oracle externo y no añaden texto ni claves. El juez explica esa
recomputación y cita el candidato y el inventario operativo real.

Son **tres criterios de contenido juzgados por el modelo y cuatro controles del
motor**, no siete juicios LLM. Su revisión usa actor/thread distintos; sus dos
citas distintas generan cuatro usos, todos contrastados literalmente. El primer
brazo no adquiere aceptación por ser correcto externamente: sigue sin juez y sin
entrega. No incompatibilidad material detectada en este contrato acotado.

`semanticAudit: PENDING` de los resúmenes originales se conserva como el estado
que tenían al cerrar; esta revisión posterior es una evidencia separada, no una
reescritura. No se afirma ahorro, precisión universal, prueba real de búsqueda o
réplica ciega, instalación ni cierre de R01–R16. Cambios posteriores al historial
de fallos de productor no están cubiertos por este ensayo ni por R62Cdt.
