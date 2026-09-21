# Recuperación de un lote exacto

14 septiembre 2026, 06:23 UTC. **Instalado 926c524d**, después de la global
G50Fbx y del ensayo prospectivo de suscripción bSXjkB. Se conserva `read-test-v1`
sin ampliarlo retrospectivamente. El opt-in nuevo es `read-test-cursor-v1`.
[Resultado, revisión y límites](../verification/PRODUCER-CURSOR-RESULTS.md).
[Instalación y preservación](../verification/CURSOR-RUNTIME-INSTALLATION-2026-09-14.md).

## Evidencia de desarrollo

- Registro de intentos, declaración/avance atómicos y reentrada del mismo
  productor implementados. Configuración diferente (más amplia o más estricta)
  requiere restaurar explícitamente los límites originales; nunca los sustituye
  silenciosamente. Los demás límites del proveedor siguen aplicándose normalmente.
- Integración 99527: 152 PASS/0 FAIL, 21909.975244 ms. Modelos SIM; archivos,
  SQLite, SIGKILL y ejecutor aislado reales. Incluye seis fronteras del motor
  completo, no sólo llamadas directas a WorkerService. En cinco recuperaciones
  positivas el juez vuelve a leer ambos archivos y ejecuta su propia prueba.
  En el despacho sin resultado, la reconciliación registra EXECUTION_INTERRUPTED,
  no repite el comando y no entrega un candidato aceptado.
- La primera batería del motor dio 1 PASS/5 FAIL por una aserción que exigía
  journal idéntico después de adquirir/liberar el coordinador. Se preserva el
  resultado inicial. Se corrigió para exigir que todos los registros materiales,
  cargos, inferencias y efectos permanezcan idénticos, permitiendo sólo las
  escrituras reales de propiedad del coordinador. Segunda pasada: seis PASS.
- Compatibilidad iz0Fzj/64186, dos PASS/0 FAIL, 1456.225468 ms. Módulos reales
  68fd4472 rechazan cabecera 4 al abrir y desde un escritor ya abierto. Una
  respuesta antigua de protocolo 3 conserva lectura/recuperación sin añadirle
  cargos ni cursor. Auditoría posterior 05:53:48.410, owner ausente, ocho pins
  intactos; ambas bases aisladas conservadas. No se tocó la base instalada.
- Clasificación de errores, restauración de límites y cortes adicionales quedaron
  incluidos en G50Fbx: 1653 PASS/0 FAIL/un SKIP. SdIPvT/LIVE 9FZelU conservan
  su alcance anterior, no se usan para cualificar estas fuentes posteriores.

Salidas: [integración](../verification/experiments/producer-batch-cursor-integration.json),
[fallo inicial](../verification/experiments/producer-batch-engine-initial.json),
[retest](../verification/experiments/producer-batch-engine-retest.json),
[compatibilidad](../verification/runs/producer-cursor-compatibility-iz0Fzj/post-close-audit.json).

## Evidencia que motiva el orden

Diagnóstico [MAYwkd](../verification/runs/producer-batch-recovery-diagnosis-MAYwkd/post-close-audit.json):
cinco procesos de fixture terminaron con el corte explícito 86, modelos SIM,
archivos/SQLite reales y ejecución nativa donde se alcanzó. Después sólo se
leyeron las bases. Auditoría 05:17:41.148: seis owners ausentes, 315 entradas
y el script de diagnóstico intactos; journal y WAL de cada cápsula conservados.
No se ejecutó recuperación ni se midió ahorro de suscripción.

| Corte | Evidencia del lote de dos lecturas y una ejecución | Tratamiento necesario |
|---|---|---|
| Tras primera lectura | Primer recibo incorporado; otros dos efectos ausentes | Conservar primero; sólo pendientes bajo su identidad original |
| Antes de ejecución | Ambas lecturas incorporadas; ejecución ausente | No repetir lecturas para comprar la misma decisión |
| Despachado sin resultado | Ejecución DISPATCHED, sin recibo | Reconciliar o bloquear; no repetir el comando |
| Tras recibo de ejecución | Resultado firmado existente, aún no incorporado al agente | Incorporar ese recibo exacto, sin nueva ejecución |
| Tras observación | Los tres recibos ya incorporados | Avanzar al siguiente paso de decisión sin repetir efectos |

El checkpoint previo guarda toolOperations=2 tras la primera lectura aunque ya
hay tres efectos comprometidos contando las escrituras anteriores. Guarda 4
antes de ejecutar y también después del quinto efecto. Es un contador previo
al despacho, no un cargo durable individual. No puede copiarse a una nueva
sesión como si demostrara todo lo gastado ni reiniciarse a cero.

## Límite de responsabilidad

El cursor no decide qué archivos leer ni qué comando ejecutar: conserva la
propuesta pública exacta del productor, ya validada íntegramente. El compilador
experimental de `PRODUCER-CHECKPOINT.md` que genera un recorrido de todas las
obligaciones no se integra aquí; podría repetir lecturas innecesarias después
de una reparación y no coincide con esta propuesta seleccionada por el agente.

Primera versión: recuperar sólo lotes de lectura/listado y una ejecución final
con argv/cwd ya fijados por requiredEffects. No fuentes, escritura, navegación
documental, placeholders, nuevos argumentos ni nueva planificación dentro del
cursor. Las otras operaciones conservan sus recorridos actuales. Recuperar una
observación histórica no la convierte en lectura del estado actual: el agente
recibe los recibos fechados y el manifiesto exacto de la ejecución posterior.
Si versiones divergen, se conserva la discrepancia; no se oculta ni se certifica
que todas las observaciones proceden de una misma instantánea.

## Registros y reentrada

1. Origen protegido: fijar modo y límites efectivos de pasos, herramientas y
   tamaño de lote en el primer registro del productor. No aumentar esos límites
   al reabrir con otro proceso/configuración. Una configuración nueva más estricta
   tampoco puede ignorarse. La cabecera de ejecución 4 se compromete
   con ese origen; 68fd4472 entiende hasta 3 y no debe ignorar un cursor nuevo.
2. Después de respuesta y cierre durable, validar el lote COMPLETO: contrato del
   nodo, inputs aceptados, política, argumentos, dependencias, fallo previo y
   presupuesto. Guardar un registro inmutable de propuesta, petición, cierre,
   configuración, operaciones ordenadas e IDs antes de su primer efecto.
3. Registrar cada intento de herramienta una sola vez antes de despacharlo,
   también los previos al lote en ese productor opt-in. Un corte entre cargo y
   despacho no autoriza cobrarlo otra vez ni olvidarlo. Comprobar que el lote
   completo cabe antes de su primer miembro; un sufijo no intentado no se
   confunde con un efecto ejecutado. No reembolsar intentos ya registrados.
4. Reanudar con el MISMO run y los IDs originales. Resultado existente: verificar
   su recibo y recuperar la observación idempotentemente. PREPARED/ausente:
   despachar sólo bajo autorización actual. DISPATCHED/UNCERTAIN sin resultado:
   usar la reconciliación existente del broker o bloquear. FAILED nunca se
   reproduce como éxito; conserva el diagnóstico y exige cambio de método.
5. Incorporación de recibo y avance del cursor deben formar una transacción.
   Si cae antes, ambos faltan y se incorpora el mismo recibo al volver. Si cae
   después, ambos existen y no se duplican. El recibo del broker es una frontera
   distinta: no se inventa una transacción que incluya una ejecución externa.
6. Al cerrar el lote, reconstruir el siguiente paso desde su petición retenida
   (feedback, correcciones y número de paso), disposiciones de finales rechazados,
   cargos durables y observaciones reales. No vaciar memoria de fallos ni borrar
   límites. Una inferencia posterior pendiente impide recuperar un lote anterior
   como si ese contexto nuevo no existiera.

El motor sólo reutiliza ese productor cuando contrato, estado del nodo y entradas
siguen vigentes; no en un nodo INVALIDATED, una misión cancelada o ante evidencia
retirada. Revisión y candidato conservan sus rutas actuales. Un lote completo no
emite ACCEPT ni evita las lecturas/ejecuciones propias del juez.

## Frontera de aceptación

El diseño exige controles de política apagada/legada, origen/cursor/recibos alterados, cambio de
inputs o configuración, agotamiento, revocación y cancelación. Caídas reales
antes/después de cargo, recibo, observación/avance y siguiente petición; verificar
ausencia de ejecución y cobro duplicados, además de conservar cada fallo.
Incluir motor completo para probar que no crea un productor sustitutivo.

Se completaron regresión nueva, freeze, compatibilidad con ejecutor anterior,
ensayo simulado y cualificación prospectiva de suscripción con límite fijado.
Para futuras comparaciones de eficiencia: comparar igual mandato,
criterios y permisos, medir operaciones realmente ejecutadas y uso observado;
no inferir ahorro restando llamadas históricas. Los ensayos anteriores que no
usaron el lote o fallaron conservan su resultado. Este diseño no cierra R04/R14/R16.
