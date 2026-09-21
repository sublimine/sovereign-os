# Admisión literal instalada

14septiembre2026. **3305fe6155767301a822ed88af4ec91e9b46a5aab3b504fe976e6d8e53841a0a**
instalado,435archivos/24.260.040bytes. Sustituye25d34 sólo en CLI y manual.
No cambios en motor, fichas, proveedor, protocolos o permisos; tampoco inferencias
nuevas atribuidas a pruebas históricas. R01–R16 siguen abiertos.

## Pruebas y defectos conservados

- Contraejemploat1Rlg: instalado25d34 sustituyó61c328→61efbfbd28 en petición
  sintética y cola privada nunca servida. No daño observado a datos del usuario.
- Dirigidos: primero15tests/3PASS/12FAIL, preservado. Diez diferencias de admisión
  y dos errores del autor del test (byte cap y workspace vacío habitual); no
  doce defectos del motor. Después60PASS y, con14falsificadores nuevos,74PASS.
- Regresión2v6ckJ/35755:1837tests/1836PASS/0FAIL/1SKIP,490822.072406ms;
  cerrado13:22:32.609, auditado13:23:21.851,339pins/cuatrostreams/owners ausentes.
  SHA summary1fb19f53be6b4cffcdc2099dab68e6599cf62d5d4ffeda340bfd11a04ba4ba11.
- PaqueteiSRH2a/77097: seis comandosCLI reales sobre colas privadas. Inválidos
  rechazados ENCODING en submit/run antes de crear misión,39bytes válidos exactos,
  idempotencia y conflicto conservan original, protocolo2 y cero inferencias.
  Auditoría13:25:00.610: bases byte-idénticas; nueve enlaces del manual válidos.

[Regresión](runs/suite-2v6ckJ/post-close-audit.json),
[paquete](runs/request-file-package-iSRH2a/post-close-audit.json),
[contrato literal](../design/REQUEST-FILE-ADMISSION.md).
No sumar suites solapadas ni equiparar pruebasSIM con modelo real.

## Instalación reconciliada BJWPFq

Preflight13:25:26.599:25d34/PID2647060 como único holder del estado, una misión
histórica COMPLETED, cero efectos,165versiones/58heads materiales,protocolo2.
Parada13:25:42.422: escritor anterior ausente, cero holders, ownership liberado,
166versiones y journal421. Ninguna tarea activa interrumpida.

Backup13:25:56.347 privado y coherente:
`/home/cardeex/.local/state/sovereign-factory/backups/before-3305fe61-py9XP8/state.sqlite`.
SHA`d29bcf4fc1e3449629df05c3ffc32d613b488d565021016943ab1e581e2da2ec`.
Nunca restaurar sobre trabajo posterior. Sólo cambiaron los IDs de release del
wrapper y WorkingDirectory/ExecCondition/ExecStart; verificación systemd PASS.

Capturainstalled13:26:55.669: PID2690559/start57634304, boot
`2a077981-8aea-444e-8eff-44fa69814267`, gestor/cgroup canónicos y único holder.
167versiones,58heads materiales idénticos; todos los165originales y166detenidos
conservados. Únicas adiciones: queue-owner/exclusive versiones36/37. Protocolo2,
journal422/head`5024d0a1b255c9b9769cd706fed1fa8883848ac38b84387982e58c85259da34b`.
Cero misiones ordinarias, inferencias o efectos nuevos. Las11llamadas del reporte
pertenecen a la misión histórica, no a esta instalación.

La primera auditoría no pudo leer la capturaJSON del reporte por truncación de
salida de la terminal. Fallo y captura parcial preservados; se repitió sólo la
consulta read-only con capacidad suficiente,102274caracteres de JSON válido,
sin cambiar predicados del auditor. Auditoría completa13:28:31.520 PASS:
[evidencia final](runs/request-file-installation-BJWPFq/post-install-audit.json).

WrapperSHA`8736f964cdbf1ea88c225fa1b6e597dde3d13a875127fe27394a80c1d0e81029`;
unidadSHA`fbabce01d9c240cfa7437ae8f3c4fc7ca2e9f6690296a148559fd6e37e6e03b3`.
Skill actualizada con UTF-8 estricto/256KiB/sin enlaces; validación estructural
PASS. Manual vigente15563bytes, SHA
`5ccfd6b44d1f418349f77280c31a4b88cc986c1462b62ced5e7364be768856f6`.
Anterior744líneas conservado íntegro, sin borrar historia o fallos.

## Límites pendientes

Corrige fidelidad de admisión, no eficiencia general ni calidad epistemológica.
El experimento5a5e sigue rechazado. Uso de intentos nativos interrumpidos sin
contador propio permanece desconocido. El nuevo proceso reinicia el segmento
muestreado del soak: instalación no prueba72horas, logout o reboot real.
Se mantienen presets, autoridad explícita, no-API, no créditos, no publicación
GitHub y preservación de package.json/src/runtime/tests/runtime del usuario.
