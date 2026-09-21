# Resultado de compatibilidad de copia histórica

`upgrade-compatibility-xKgKjB`, cerrado 13 septiembre 2026 23:43:29.061 UTC,
sesión 52097 exit 0. Los tres procesos terminaron correctamente:
baseline 2341223, target 2341281, rollback 2341289. Sin inferencias ni efectos.

Auditoría independiente posterior sólo lectura: 23:44:46.651. Propietario y tres
procesos ausentes por PID/boot/startTicks; código, contrato y capturas concordantes.
Las 155 versiones de registros originales están presentes con hashes idénticos
en la copia. Sus heads materiales (misión, política, plan, candidatos, revisiones,
cola e inferencias) permanecen iguales. La copia conserva 162 versiones después
de relocalización explícita de workspace vacío y controles de reentrada.

Original: journal 410 / `2f54d5b7cc105de79871c8de1aa03d036ae574e9258bebc7094ba2e853c46f1a`.
Copia cerrada: journal 420 / `901da4606f56e708726c2a7eb4e64eae1497ce1bde0ef2c1a6c3ecab2c709d17`.
Resumen SHA-256: `e5c73b9efd087d9bf607613b64f53d9e5b7a8f3b9b6db4d5ac0d48fe2cf2fbfc`.

[Auditoría de cierre](runs/upgrade-compatibility-xKgKjB/post-close-audit.json).
[Contrato previo](UPGRADE-COMPATIBILITY-QUALIFICATION.md).

No se instaló ni reinició nada. El ensayo cubre una misión histórica sin fuentes
ni archivos; no acredita todos los estados activos, nuevas políticas/formatos,
rollback de servicio ni operación prolongada. La base original sólo se abrió en
modo read-only y se copió mediante backup SQLite, sin ignorar el WAL.
