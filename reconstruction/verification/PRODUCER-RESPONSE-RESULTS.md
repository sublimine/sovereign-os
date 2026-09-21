# Persistencia del final de productor: resultados

## Preflight inicial conservado

`producer-response-sim-aRsAdG`, 7493, exit 2. Tres llamadas simuladas; respuesta
original y recibo persistidos, SIGKILL real, recuperación correcta sin nueva
producción. Falló la preparación de la revisión: el simulador sólo pedía lectura,
aunque el contrato exige un listado propio del juez. No se invocó la suscripción.
El juez ordinario relista directorios presentes en las observaciones del producto;
no inventa listados ausentes. Se hizo explícita la preparación list/read para
ambos proveedores antes del siguiente preflight, sin quitar criterios.

Global previa nmUPLE: 1487 tests, 1486 PASS, cero FAIL, un SKIP;
auditoría de 305 entradas y cuatro streams cerrada. Runtime congelado d6f5dd47,
424 archivos, 24.139.333 bytes. No instalado. Cualificación real posterior abajo.

## Preflight corregido

`producer-response-sim-v0Hzv8`, 84394, exit 0, cierre 01:09:38.389 UTC.
Cuatro llamadas simuladas, dieciocho controles aprobados; SIGKILL real después
de persistir final/recibo, padre materializa el candidato sin llamadas/herramientas,
juez separado y tercer proceso reabre el mismo artefacto aceptado sin replay.
Misma cifra/oracle y criterios originales; listado preparatorio declarado.
La simulación no acredita calidad semántica ni uso de la suscripción.

## Ensayo real cerrado y auditado

`producer-response-live-j4OB9h`, 87010, exit 0. Del 14 septiembre 2026
01:10:11.246 al 01:14:13.326 UTC. Dieciocho controles aprobados, tres llamadas
reales, 45.228 tokens observados: 9.257 + 14.194 + 21.777. El productor propuso
el lote list/read permitido y luego su final; el juez utilizó otra llamada.
Tres reservas de seis, ninguna devuelta ni reiniciada. No reutilización de threads.

SIGKILL real después de observar el cierre del proveedor. La propuesta quedó en
el evento 67, corte en el 68 y materialización de candidato en el 69, bajo el mismo
productor. Ninguna producción ni herramienta de productor después del corte.
El juez tuvo sus propias lectura/listado posteriores al candidato. Tercer proceso
reabrió el mismo artefacto aceptado con modelos y broker vetados, sin otro gasto.

[Auditoría sólo lectura](runs/producer-response-live-j4OB9h/post-close-audit.json),
01:14:27.327 UTC: tres propietarios ausentes, 305 pins de regresión y tres del
ensayo íntegros, doce usos de citas resueltos contra el input exacto del juez,
peticiones/recibos/cierres/reservas concordantes. SQLite conservó los mismos bytes:
`e8c90fc676a8c48f9e0bd55ee037a26f0b48204e9fbf528040c5a27470d43426`.
136 eventos, head `104312a44e53bfc2e6acf2c08d080e450aa7ac1a7eab1e4f277d67ca10e7b0ab`.

Producto `artifact:8f6d4d38-defd-4e5e-87bb-e0aca5524584`, payload
`c98e10fc83569400ab1bc8f871fbf80ba4d6c8dcecda6b584d6296ebd04495f0`.
Revisión `review:ff9f155d-d46b-4eac-9f3f-f544b9b17672`.
Resumen cerrado `355c5a0b67c4e7963b91c2d9596d73da483cbd4be246a85c2a06fbe913fc258a`.

## Auditoría de contenido

Se leyó íntegro el final público del productor y el juicio guardado. El informe
calcula 1200 + 250 + 5000 = 6450 mg, discrepancia declarada menos calculada +50 mg,
consistent=false. Conserva las unidades, fórmula y SHA-256 del archivo original;
sus supuestos no introducen redondeo ni incertidumbre instrumental. Los límites
niegan comprobación física, causa conocida y aceptación propia. El juez explicita
su recálculo y cita tanto la entrada observada por él como el contenido examinado.
No se detectó incumplimiento material del contrato acotado.

Esto cualifica workers y recuperación del final ordinario bajo d6f5dd47. La misión
permanece **NEW** deliberadamente: no hubo planificador real ni engine.run completo.
No convierte la simulación del coordinador en ejecución real, ni prueba caída de
OS, todas las rutas, ahorro causal/general o cierre R01–R16. El coste sigue siendo
alto para este caso pequeño. No se instaló ni reinició el servicio.
