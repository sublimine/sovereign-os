# Lectura nativa: evidencia de integración de desarrollo

Actualización14septiembre2026,16:48UTC. No instalado; mandatoR01–R16 abierto.

## Qué está conectado

Selección de misión al crear, piso8, perfil sólo del productor acotado, CALL y
consumo local/global comprometidos antes del broker, lease verificable y revocable,
respuesta exacta ligada a recibo firmado, intención previa al envío, ACK exacto,
FINISH público y retención antes de retornar. El registro ordinario sigue
rechazando cambios de exposición durante inferencia; la ruta nativa incorpora
sus observaciones y recibo en la transacción de conclusión. El juez conserva su
ficha/criterios y hace su propia lectura posterior del mismo archivo.

## Pruebas cerradas, sin sumarlas como cobertura distinta

- Inicial88683:13tests/12PASS/1FAIL,5350.688159ms. La prueba predecía sin base
  cuatro eventos al reconsultar; fueron ocho. Ahora se comparan las referencias
  materiales exactas y ausencia de nuevas lecturas/inferencias. [Captura](experiments/native-read-integration-initial-tests.json).
- Primeros dirigidos58882:205/204PASS/1FAIL,22490.463287ms. Una expectativa del
  test de versión futura quedó en8 tras mover la entrada a9; se corrigió a9,
  manteniendo rechazo sin reescritura. Los19tests de integración de entonces
  pasaron. [Captura](experiments/native-read-integration-directed-initial.json).
- Retención50565:73PASS/ceroFAIL,7385.743273ms. Incluye salida comprometida antes
  del retorno, sustitución del final y cierre desconocido que bloquea recuperación.
- Crash25274:61PASS/ceroFAIL,8867.373307ms. Incluye7procesos fixture conSIGKILL
  y23tests de integración de esa revisión, más31de proveedor SIM.
  [Capturas de retención/crash](experiments/native-read-retention-directed-tests.json).
- Reporte3654:84/83PASS/ceroFAIL/1SKIP,8321.910453ms.29tests de integración,
  proveedor ordinario y reporte; skip del smokeLIVE explícitamente no habilitado.
  [Captura](experiments/native-read-report-directed-tests.json).

Siete fronteras de muerte real del controlador fixture: antes del commit de
CALL+reserva, después de ese commit y antes del broker, PREPARED, intención de
envío, ACK, FINISH y propuesta pública retenida. Al reabrir se conserva el
consumo correcto y no se invoca ningún proveedor con cierre desconocido.
La inferencia de esos fixtures está simulada. No prueba reinicio del SO, caída
del App Server real, coste LIVE ni calidad semántica de la respuesta simulada.

## Congelación y trabajo aún abierto

Paquete de cualificación **564901430de58ea5da07a78dc60183d2d87c28d18ca70148917caf9579939f9f**:
438archivos/24.311.607bytes, generado/verificado15:31UTC. No instalado.
Regresión global **suite-fg0l0i/11039 cerrada15:37:10.395**:
1957tests/1956PASS/ceroFAIL/1SKIP,465904.689133ms. Auditoría15:38:15.134:
347pins exactos, cuatro streams íntegros y ambos procesos observados ausentes.
El skip es el smokeLIVE no habilitado. [Auditoría](runs/suite-fg0l0i/post-close-audit.json).

Compatibilidad aislada5faW7G cerrada15:38:16.084 y auditada15:40:47.901:
el paquete244d749e rechaza abrir y escribir piso8, incluso desde una conexión
abierta previamente en2. El paquete nuevo reabre el registro exacto; un registro
original conservado, tres totales y cero actores/inferencias/efectos. No se abrió
la base instalada. [Auditoría](runs/native-read-floor-5faW7G/post-close-audit.json).

Par prospectivo nuevo: SIMuL68DG cerrado/auditado, cuatro brazos y diez turnos
simulados; no ahorro acreditado por SIM. LIVEvZIKxX cerrado15:57:26.492 y auditado
15:57:48.701: INCONCLUSIVE, cinco llamadas y cinco cierres reales. Baseline de
revisiones correcto/aceptado,48605tokens; productor nativo correcto,21100tokens,
pero juezTIMEOUT a180000ms sin recibo/uso completo. Dos brazosUnicode no
ejecutados. Contrato y seis archivos de ensayo congelados; no repetir brazos
fallidos ni ampliar techo. [Contrato previo](experiments/NATIVE-READ-PAIRED-QUALIFICATION.md),
[disposición semántica](runs/native-read-pair-vZIKxX/semantic-disposition.json).
No hay calidad final nativa ni comparación válida de coste. Dos
invocaciones de proveedor no significan dos unidades de presupuesto: si hubo
callback, productor inicial+continuación+juez reservan tres. No ahorro afirmado.

Copia de recuperaciónIvS8ls cerrada/auditada:73registros originales conservados,
propuesta/consumo/cierre nativos exactos y cero nuevas inferencias. La misión
permanece sin juicio por presupuesto3/3. Una lectura del juez ocurrió antes de
descubrir agotamiento. [Auditoría](runs/native-timeout-copy-IvS8ls/post-close-audit.json).
Primer intento3LIsPD falló por trasladar archivos ligados a path/inode; se
conserva. La segunda copia sólo duplicóSQLite y usó los originales para lectura,
con identidad y bytes comprobados, sin cambiar la misión LIVE.

Desarrollo posterior: [admisión previa de revisión](../design/REVIEW-BUDGET-ADMISSION.md).
El desarrollo actual34f1053b ya no coincide con56490143: global4FEbL2 cerrado
1965tests/1964PASS/0FAIL/1SKIP y auditado16:26:42.393,348pins. CopiaXe7nzd
auditada16:27:09.878 conserva73registros originales, presupuesto y propuesta;
ahora cero nuevos actores/lecturas/inferencias ante agotamiento. OriginalLIVE
intacto, juicio pendiente; no rehabilita su resultado. [Auditoría](runs/review-budget-copy-Xe7nzd/post-close-audit.json).

Nuevo ensayo operacional, no comparación de coste: dos casos conocidos distintos,
timeout ordinario15min y4turnos máximos. SIMfUK80y cerrado/auditado, lecturas2/0,
una continuación,5unidades. LIVEmWI9Fs/16320 cerrado16:35:07.559/auditado16:36:32.056:
un turno/22870tokens, lectura nativa correcta pero respuesta blocked por contradicción
entre JSON exacto y obligación de justificar/citar dentro de body. Sin timeout,
juez, producto ni segundo caso. Tres unidades reservadas incluyen fallback cuya
inferencia rechazó el guard antes de otro proveedor. [Contrato fijado](experiments/NATIVE-OPERATIONAL-QUALIFICATION.md),
[rechazo semántico](runs/native-operational-mWI9Fs/semantic-disposition.json).
Desarrollo posterior opt-in de presentación separada y piso9 aún en pruebas;
no coincide con34f1053b ni hereda su regresión. No repetir mWI9Fs.

Instalado244d749e/PID2703657 intacto. Soak16:45:04.748:39muestras/35sanas/
4fallidas; segmento observado90m22.69s, sin reinicio del servicio. La modificación
posterior de Store altera una dependencia de la sonda; una futura muestra deberá
registrar esa diferencia, no heredar continuidad de una versión de probe anterior.
No acredita disponibilidad continua,72horas de desarrollo ni cierre del mandato.
# Cierre posterior de presentación — 14 septiembre 17:12 UTC

La corrección versionada c989e75b supera globalZzKrIb:1980tests/1979PASS/0FAIL/1SKIP,
350pins auditados. Piso9NOTe9H rechaza runtime viejo; copia5joak0 conserva97registros
y aceptación antigua sin inferencia nueva. LIVEVj7vZz cerrado17:06:54.116,
auditado17:08:32.114 y revisado semánticamente: dos casos nuevos conocidos,
cuatro turnos reales/5unidades/68.833tokens. Entrega exacta y evidencia separada
funcionan en esos casos; no se modifica el resultado de los ensayos fallidos.
[Disposición y límites](runs/presentation-operational-Vj7vZz/semantic-disposition.json).
Sigue sin instalarse; 244d749e permanece activo. No prueba de eficiencia general.
