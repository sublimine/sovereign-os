# Instalación del cursor recuperable

14 septiembre 2026, auditoría **06:22:16.278 UTC**. Instalado
`926c524d3d9ffcaa467fc68ed8a3ffa8fec7ba641ec11a3500edeb6363eb097b`:
428 archivos y 24.221.107 bytes, idénticos al snapshot cualificado.
[Auditoría completa](runtime-deployment-926c524d.json).

## Evidencia previa y cambio

- Global G50Fbx cerrada: 1654 tests, 1653 PASS, cero FAIL, un SKIP;
  320 entradas fijadas. Cuatro streams y dos owners ausentes comprobados.
- Ensayo de suscripción bSXjkB: tres llamadas, 46.762 tokens observados,
  20 controles y quince usos de citas comprobados. Recuperó el mismo lote
  después del SIGKILL sin repetir el listado; final y revisión independientes.
  [Alcance y revisión sustantiva](PRODUCER-CURSOR-RESULTS.md).
- Preflight 06:19:16.520: 68fd4472 activo en el gestor canónico, PID 2475293,
  único holder; una misión/cola históricas COMPLETED, cero efectos, 159 versiones,
  journal 414. Ninguna misión nueva iniciada para justificar el cambio.
- Parada 06:20:14.588: proceso anterior ausente, cero holders, cola liberada;
  journal 415 y 160 versiones. Los 58 heads materiales permanecían idénticos.
- Copia privada coherente 06:20:32.074, verificada antes de cambiar referencias:
  `/home/cardeex/.local/state/sovereign-factory/backups/before-926c524d-KZP9TD/state.sqlite`.
  SHA-256 `4fae5c33c7f2650d6cf58ad1aa4f18c256852ba41a37c3661a9bbda789c5a236`.
- Sólo se sustituyó el ID del paquete en wrapper, WorkingDirectory,
  ExecCondition y ExecStart. La unidad se validó antes del daemon-reload y arranque.
  Permisos, entorno y argumentos restantes preservados; paquetes anteriores retenidos.

## Resultado observado

Captura instalada 06:21:52.595 y auditoría 06:22:16.278: PID **2505335**,
boot `2a077981-8aea-444e-8eff-44fa69814267`, startTicks `55082629`.
Gestor/cgroup canónicos, único holder, enabled y NRestarts=0 en esa consulta.
No es una prueba de uptime continuo, reinicio de VPS o cierre de sesión.

Se conservaron todas las 159 versiones previas y las 160 del backup. Sólo se
añadieron queue-owner/exclusive versiones 30 (liberación) y 31 (nuevo propietario).
Estado final: 161 versiones, mismos 58 heads materiales, journal 416 con hash
`31d3b734d60343b4555ff3bc127d9680790cd6081fad32a12e634d0d0316fbdf`.
Base instalada sigue en protocolo **2** porque no se inició producción nueva:
origen ordinario futuro exige 3, el opt-in del cursor exige 4. No bajar la cabecera.

`--help`, `queue` y `report` instalados se ejecutaron y se conservaron completos.
El informe histórico mantiene once inferencias del 9 de septiembre; no son
inferencias de esta instalación. Durante el cambio: **cero misiones, inferencias
y efectos nuevos**. Wrapper SHA-256
`8d87d75e5e35105b44039cca5973cbdc47a031e147ca87810fc9fa8e7ef61a0b`;
unidad `539b6b5140b1ae58adf6aec4cf31f2564fa6ad10e815ebf5d117a50050849ae7`.

Evidencia de fases y comandos:
[tjBwAm](runs/cursor-runtime-installation-tjBwAm/installed.json).
Nunca restaurar automáticamente el backup sobre trabajo posterior. El cursor
es opt-in, no una ampliación retroactiva de las misiones previas. Esta instalación
no cierra R01–R16 ni demuestra perfección, superioridad o eficiencia universal.
