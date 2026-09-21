# Recuperación acotada de revisión tras timeout

Prerregistro13septiembre2026. Preparación: SIN ejecutar todavía. No reabre ni
rehabilita geTKWd, cuyo resultado original permanece fallido. Pregunta distinta:
¿puede el motor recuperar el candidato durable exacto sin otro productor ni
reescrituras, completar una revisión separada y verificar el mismo producto?

## Base y fronteras inmutables

Origen: runs/development-launch-live-geTKWd/merge-integer-windows-adaptive.
Mission1d560379-de07-4c01-9602-d936b8bea84e. DB SHA256
c53294d47a02b13c1ded203234f8520cffdbf36747ea6dec7a2dcaed55e194ef;
journal695/head d659546268a1b3e2a23f16e59967cb1118a5513bd4e5fa82ae990a5c63b9f62c.
Candidato artifact:7f090f78-e555-4af9-ae10-12a1b8b1bbd6,
payload dc65960253e3f6037509ec19a3dbeb4fc821e6d0686e45caed962b6f59501bc8.
Snapshot e3352061c2c24a9f2a0416951a5b120feb28e19dd7799ac1ce68ffa479847239.
Plan, petición,19criterios, cartas, modelo/ultra, permisos y límites originales
no se modifican. El historial conserva la llamada sin resultado confirmado y
su uso desconocido; ninguna respuesta parcial se convierte en juicio.

Sólo después de regresión global cerrada, reconciliada y runtime congelado.
Ensayo SIMULADO del nuevo harness primero, explícito y separado: revisión de
fixture con historial heredado real, nunca una cualificación semántica real.
Después UN ensayo con proveedor de suscripción y máximo UNA llamada nueva,
sin correcciones automáticas de salida ni segundo intento si vence. Mantener
900000ms por llamada; plazo padre25min para cierre/cleanup/evidencia. No API,
reset, cambio de modelo/razonamiento, instalación, publicación o servicios.

## Copia y autorización local de lectura

Directorio privado nuevo y copia material (no hardlinks) de DB y tres archivos.
Origen cerrado sin owner; no WAL pendiente. Comprobar hash del origen antes y
después. Abrir Store solamente sobre la COPIA. Su journal previo debe coincidir
íntegro con el origen. Conservar todos los registros históricos sin actualizarlos.

Única relocalización explícita: añadir una nueva versión de tool-workspace con
la ruta de la copia y registrar esa operación de preparación, conservando la
versión y ruta anteriores en el historial. Mismo missionId/resource y mismos
bytes/manifiesto. No cambiar payloads, firmas, tool receipts o resultados
históricos para fingir que se produjeron en la ruta nueva.

En engine.run bloquear cualquier llamada de planificación o producción; sólo
se permite un NUEVO reviewer de implementacion para el candidato exacto.
Bloquear todas las escrituras/fetch/search. Permitir sus nuevas lecturas de los
tres nombres, listado raíz y la orden exacta node --test merge-windows.test.mjs.
Son comprobaciones independientes nuevas, no replay de IDs de efectos anteriores.
No operar el filesystem o los servicios de la misión original.

## Condiciones de resultado

- Mismo candidato/payload/producer, mismas tres versiones de archivo, plan,
  criterios e intención en la solicitud completada del nuevo revisor.
- Todos los registros previos conservados; no nuevo producer, plan o candidato.
- Actor y conversación de revisión separados; propios reads/list/exec frescos,
  exactas firmas y STARTED post-exec de la instantánea requerida.
- El modelo cubre todos los criterios y sus citas se contrastan literalmente;
  dictamen RETURN/UNKNOWN o cualquier error cierra este ensayo sin repetirlo.
- Sólo si la copia llega a entrega aceptada, ejecutar el oracle externo existente
  de3193casos en snapshot desechable, sin cambiarlo. No importar código del
  producto en el controlador. Un fallo suspende la cualificación de recuperación.
- Reentrada sin nuevas inferencias/efectos salvo validación y read-leases
  admitidos por compareRouteMaterial; archivos y material previo sin cambios.
- Cierre de proveedor/proceso observado, sin owner vivo, inputs/harness/spec
  fijos. Lectura semántica posterior y reconciliación SQLite de solo lectura.

La recuperación satisfactoria no demuestra una ejecución íntegra correcta desde
la petición inicial ni la causa del timeout. Coste heredado384445tokens más una
llamada de consumo desconocido, y coste nuevo siempre separados. No promete
eficiencia general ni cierra R01–R16. No se modifica la instalación vigente.
