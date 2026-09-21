# Compatibilidad de copia histórica b7cb510c → 3d2f562a

14 septiembre 2026. [3EleeI/44298](runs/bounded-read-upgrade-copy-3EleeI/summary.json)
cerrado con seis controles aprobados. Auditoría de sólo lectura
**10:55:19.101 UTC**: propietario y tres hijos ausentes, 331 inputs de regresión
y dos inputs experimentales intactos, capturas exactas, originales conservados.

Se copió coherentemente por backup SQLite el estado instalado; nunca se ejecutó
su motor ni se modificó su base. Sólo en la copia se relocalizó el workspace vacío
y se compararon tres procesos: lectura con b7, reentrada con 3d2 y reentrada con b7.
No se creó proveedor de modelo ni se invocó el broker. Los contadores históricos
de inferencias del informe no se presentan como trabajo nuevo.

- Original: **163 versiones**, **58 heads materiales**, protocolo **2**,
  journal 418 / `304bc1a76b1310fdecad4e3e6274685fa9abff65c50d3f27c46206aa137738df`.
- Copia: **170 versiones**, mismas 58 cabezas materiales, protocolo **2**,
  journal 428 / `bc58032422da57c75b487f53fe34abf5d66e7598e61933f50e08a2d5fb8a84ce`.
- Las 163 versiones originales permanecen con idénticos hashes. Las adiciones
  pertenecen a relocalización explícita y controles de reentrada sólo en la copia.
- Los tres ejecutores observaron el mismo estado final/política histórica. La
  auditoría confirmó la base original sin cambios y preservó sus bytes leídos.

[Auditoría completa](runs/bounded-read-upgrade-copy-3EleeI/post-close-audit.json).
Los archivos `bounded-read-upgrade-copy.mjs` y
`BOUNDED-READ-PROMOTION-PREFLIGHT.md` quedan fijados como entradas históricas de
esta prueba; no actualizarlos para aparentar que se ensayaron otras condiciones.

Esto cubre una misión histórica COMPLETED sin archivos/efectos. No cualifica
todos los estados activos ni permite volver a b7 una vez que una misión nueva
promueva la base a protocolo 6. Tampoco es instalación, reinicio del servicio,
uptime prolongado ni aceptación del mandato. La aplicabilidad LIVE GoZbep seguía
en curso al obtener esta evidencia; no se promovió nada anticipadamente.
