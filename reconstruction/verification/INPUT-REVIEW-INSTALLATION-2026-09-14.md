# Instalación de la revisión independiente de entradas

14 septiembre 2026. Instalado **b7cb510c0dcac9be9f97cb39d7cf6f56d1517c2add9afe89caeecc1db56bf848**,
429 archivos/24.233.481 bytes. [Auditoría completa](runtime-deployment-b7cb510c.json).

## Aceptación previa y alcance

Regresión TymHUs: 1693 tests, 1692 PASS, cero FAIL, un SKIP; 324 entradas
fijadas. SIM whNNS3: siete respuestas y 17 controles. LIVE LFYIrU:
siete llamadas de suscripción, 152.181 tokens observados, 17 controles,
relectura y recálculo propios del juez, 40 usos de citas reconciliados.
[Revisión sustantiva previa](runs/input-review-live-LFYIrU/semantic-disposition.json),
08:31:01.053: ACCEPT_SCOPED_CORRECTION, no certificado de la fábrica completa.
Compatibilidad con el ejecutor anterior y preservación histórica comprobadas.

## Cambio y preservación

- Preflight 08:31:28.710: 926c524d activo, PID 2505335, gestor/cgroup canónicos
  y único holder de la base; una misión/cola histórica COMPLETED, cero efectos,
  161 versiones y journal 416. Ninguna misión activa que interrumpir.
- Parada 08:32:17.569: proceso anterior ausente y cero holders, propietario
  liberado; 162 versiones, journal 417, mismos 58 heads materiales.
- Backup coherente privado 08:32:26.017:
  `/home/cardeex/.local/state/sovereign-factory/backups/before-b7cb510c-NLJWWu/state.sqlite`,
  SHA-256 `bea71b553445433e4a324ad5cbdabf70360839e330718c2dd0222c4735f3d735`.
  Incluye las 162 versiones y protocolo 2. Nunca restaurarlo automáticamente
  sobre trabajo posterior.
- Sólo se cambió el ID de paquete en wrapper, WorkingDirectory, ExecCondition
  y ExecStart. Resto del entorno, permisos y argumentos preservados. Unidad
  validada antes de daemon-reload/arranque. Paquetes anteriores conservados.
- Captura instalada 08:33:28.520, auditoría 08:35:15.077: PID **2564734**,
  boot `2a077981-8aea-444e-8eff-44fa69814267`, startTicks `55875770`,
  gestor canónico, único holder, enabled y NRestarts=0 en esa consulta.

Se conservan las 161 versiones anteriores y las 162 del backup; sólo se añaden
queue-owner/exclusive 32 y 33, liberación y adquisición. Estado final:
163 versiones, mismos 58 heads materiales, journal 418 con hash
`304bc1a76b1310fdecad4e3e6274685fa9abff65c50d3f27c46206aa137738df`.
La base permanece en protocolo **2**, porque no se crea un revisor nuevo durante
la instalación; los futuros revisores exigen 5. No se rebajó ninguna cabecera.

Wrapper SHA-256 `23f8e91e3c12d077f12e50745e40704141ffaeeb5eac03ad9c9ca4559dc7f1cb`;
unidad `3cd0c8e03b32b254dc7b91f7a77b0dd617f00b2f6938458a0c5a08c1557fedef`.
Help, queue, report humano y report --json instalados se conservaron completos.
El primer auditor esperaba JSON pero se había solicitado el formato humano:
su fallo se conserva en `audit-human-report-format-failure.json`; no era un
fallo de la base. Se guardaron por separado ambos formatos, sin sobrescribir
el resultado original. La captura JSON truncada del terminal no se usó como
prueba completa; se obtuvo la salida íntegra antes de cerrar la auditoría.

## Entrada para peticiones nuevas

La skill local sovereign-factory se actualizó después de la instalación para
seleccionar adaptive-v2 en nuevas peticiones y conservar el techo previo de
dos ramas puras. No reconfigura misiones existentes ni cambia las opciones
explícitas del usuario. Explica el conflicto documental/cursor y la política de
entradas nuevas; validación estructural de skill aprobada, no prueba semántica
universal. La CLI mantiene sus presets explícitos y el histórico adaptive-v1.

Cero misiones, inferencias y efectos nuevos durante el cambio. No hay pruebas
o sesiones de inferencia pendientes de esta cualificación. No repetir el ensayo
ni tomar otra muestra idéntica del servicio como siguiente tarea. Continúan
eficiencia proporcional, calibración amplia, aprendizaje y operación prolongada.

Capturas: [l27S5q](runs/input-review-installation-l27S5q/installed.json).
Resultado funcional y límites: [INPUT-REVIEW-RESULTS.md](INPUT-REVIEW-RESULTS.md).
