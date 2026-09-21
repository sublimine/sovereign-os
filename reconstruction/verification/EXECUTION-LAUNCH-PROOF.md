# Arranque solicitado frente a arranque observado

Estado13septiembre2026,18:38UTC: corrección implementada en desarrollo,
NO instalada. Prueba nativa primero RED0/1FAIL914.786446ms: faltaba el rechazo.
Protocolo24/24PASS1659.516396ms/sesión32194; tres nativas dirigidas3/3PASS
2994.860206ms/sesión89289. Batería de los tres archivos CERRADA61/61PASS,
43435.469902ms/sesión64049exit0. Incluye broker FAILED durable/sin replay,
cinco salidas inmediatas, ejecuciones Node/Python, salida7 legítima, controles de
aislamiento/límites y recuperación tras matar realmente al controlador.
Regresión global C5d78Q CERRADA18:47:08.140/sesión36232exit0:
1312tests1311PASS/0FAIL/unSKIP512855.011733ms;287entradas/started/cuatro capturas/
owner2212962 ausente reconciliados18:47:29.393. SummarySHA256
ca02ed45d380870e2b61462c3582f826d62d8c59b8ad82a9ab84c40a22ab2fc1.
Freeze posterior ba2662d3746e2f501f0078a43a55680bfdf56747bceddb4842b2abba553eff4a
NO instalado. Ensayo geTKWd cerrado19:22:14.715 con timeout del juez, no entrega:
tres ejecuciones reales de productor/revisor sí tienen STARTED post-exec ligado
a sus versiones y firmas/jobs reconciliados19:24:01.492. Sin oracle externo.
Ver [resultado limitado](DEVELOPMENT-LAUNCH-LIVE-geTKWd.md); el fallo del ensayo
no se borra ni se interpreta como cualificación completa del workflow.

### Diagnóstico previo — 18:31

Defecto REPRODUCIDO, todavía no corregido en ese corte.
No es explicación del EAGAIN puntual de6dsE55 ni una explotación observada.

18:28:08.359–18:28:09.329, runtime congelado3ac05deddcbd3fa562aaaae6ae5dc0cbbed4f1fb2206a2a1fbece8554324d6fa:
IsolatedExecutionRunner, snapshot vacío, argv["./sovereign-missing-executable-canary"],
cwd".". No existe ese ejecutable en el snapshot. Python Popen devuelve
FileNotFoundError/ENOENT. Sin embargo, run devuelve sovereign.execution.v1,
exitCode1,stdout vacío,validatorAccepted=true y la interpretación de que se
observó ejecutar argv. Limpieza y terminación se confirmaron correctamente.
Es un falso origen de ejecución, no un test aprobado (el exit no es cero).

Razón en el código: programStarted pasa a true al enviar GO tras comprobar el
sandbox, antes de subprocess.Popen. El estado de salida observado pertenece al
bootstrap; no prueba que se haya lanzado el programa. Puede confundir error de
arranque con un exit no cero legítimo del programa solicitado.

Corrección prevista: señal de arranque emitida por el supervisor confiable sólo
después de que Popen confirme el exec, separada del READY previo y ligada a nonce
y snapshot. Conservar stdout/stderr del programa sin contaminarlo con el control.
GO emitido, arranque confirmado y terminación son hechos distintos. Un fallo
sin señal de arranque no produce recibo de ejecución; no afirmar que una señal
perdida demuestra ausencia de ejecución. No aumentar TasksMax ni desactivar
aislamiento, herramientas o restricciones para superar la prueba.

Primero prueba roja del ejecutable inexistente; después parser segmentado,
fronteras adversarias y ejecuciones nativas positivas/no-cero. El defecto queda
separado del EPERM de node:test y del EAGAIN original, cuyas causas no se declaran
resueltas por este cambio. No modifica ni reetiqueta recibos históricos.
