# Compatibilidad de actualización: copia, lectura y retorno

Contrato previo al ensayo, 13 septiembre 2026, 23:41 UTC.

Origen instalado: `10bbffa0e97b63c0246ab338857987943a89d285cff137b65e0a91a0d041a7c4`.
Destino aislado: `08fe308664a490433b9ec1df7f07dbb029bdf5e3c69ff4ef27702c051ae56c51`,
regresión `suite-4KDODc`, 1447 PASS/un SKIP.

Sólo la base instalada conocida: journal 410,
`2f54d5b7cc105de79871c8de1aa03d036ae574e9258bebc7094ba2e853c46f1a`;
misión `mission:78afdee6-1b1c-4b97-a68e-bdbce1d0bb86`, COMPLETED,
cola COMPLETED y workspace vacío. Si cambió, no adaptar este ensayo sobre la marcha.

1. Abrir origen sólo lectura; validar journal y obtener copia coherente mediante
   backup SQLite. No copiar a mano un archivo principal ignorando su WAL.
2. Preservar todos los registros originales y sus hashes. Relocalizar únicamente
   el workspace vacío EN LA COPIA, con nuevo registro y evento explícitos.
3. Tres procesos independientes: lectura con runtime original; lectura y reentrada
   COMPLETED con destino; lectura y reentrada COMPLETED con original (retorno).
4. Proveedores y broker de efectos sustituidos por sentinelas que FALLAN si se
   intentan usar. La comprobación local de snapshot vacío sigue siendo real.
5. Mandato/política, planes, candidatos, revisiones, cola e historial de inferencias
   deben permanecer idénticos. Sólo ownership de motor y validaciones de workspace
   pueden añadirse durante la reentrada. Todos los registros históricos conservados.
6. Fuera de la copia: ninguna instalación, reinicio, escritura en DB original,
   llamada al modelo, misión nueva, publicación o cambio de credenciales.

Aceptación acotada: los tres procesos terminan correctamente; no inferencias ni
efectos; todos los hashes materiales conservados; original y código íntegros.
Un fallo se conserva y se diagnostica. No se relaja el contrato para obtener PASS.

Limitación explícita: una misión histórica sin archivos ni fuentes no demuestra
compatibilidad de todas las misiones activas, migración de nuevos registros hacia
un runtime viejo, despliegue, rollback de servicio ni estabilidad prolongada.
