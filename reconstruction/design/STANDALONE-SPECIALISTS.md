# Especialistas con ficha propia y aceptación previa

## Causa observada, no una ampliación para forzar ACCEPT

El ensayo congelado Cli4mRSN conservó dos devoluciones materiales: veritas_07
no aporta un contrato general de producción combinatoria y omega_23 requiere
artefactos previamente aceptados. En su tercer intento el planificador propuso
dos especialistas con pregunta, métodos, falsificador, aporte y cierre propios,
sin ninguna faceta de producción incompatible. El runtime 87472cfc los rechazó
con `SCHEMA: roles must be a bounded array`, antes de crear un candidato de plan.
Ese resultado queda intacto. No se convierte en un plan aceptado retrospectivo.

Era una limitación de R12: el sistema permitía complementar un rol existente,
pero no crear un productor para una competencia ausente del catálogo. Obligar
a seleccionar una ficha que exige otras entradas o produce otro producto no
resuelve esa ausencia. Tampoco corresponde cambiar las 154 fichas originales
para que parezcan haber descrito siempre esa nueva competencia.

## Contrato de desarrollo posterior

- `roleIds:[]` sólo es válido en un nodo con ficha `specialist` completa.
  Los revisores siguen siendo roles de catálogo no vacíos. Los productores
  ordinarios con roles conservan las comprobaciones de compatibilidad.
- El juez del plan ve la ficha propuesta como asignación independiente del
  catálogo y contrasta su pregunta, métodos, falsificador, aporte esperado y
  cierre con el nodo y la petición íntegros. Debe devolver métodos irrelevantes
  o imposibles. La declaración no demuestra pericia ni implementación.
- Al crear el trabajador, la ficha se obtiene del plan **ya aceptado**, no de
  un argumento libre. Coinciden misión, propósito, nodo programado, cuerpo del
  plan y artefacto expuesto. Se conservan ID/hash del plan, hash del nodo y ficha.
- Antes de cada inferencia se reconstruye esa vinculación y se comprueban
  ficha, scope, prefijo y hash. Revocar el plan, sustituir el nodo o adulterar
  la ficha impide el despacho. No se cambian los registros históricos.
- El prefijo conserva controles comunes, ficha completa y decodificación del
  contexto. Respeta también el límite lógico previo a compactar. No hereda
  overlays de roles del catálogo ni pretende haber aprendido una ficha nueva.
- Herramientas, efectos, criterios, separación y aceptación material siguen
  pasando por los controles existentes. No hay nueva llamada sólo para crear
  una ficha, ni un producto ceremonial adicional. Dos especialistas pueden
  producir en paralelo si el DAG y la autoridad lo permiten.
- El informe identifica «especialista de misión» y muestra su ficha, modo y
  vinculación real por ejecución, en lugar de dejar la producción sin explicar.

El directorio de planificación incorpora el propósito literal de cada ficha;
sigue siendo un índice, no una ficha resumida ni un certificado de capacidad.
En recuperación se adjuntan, deduplicadas e íntegras, las fichas de los roles de
planes rechazados. No se pide al planificador que vuelva a adivinar condiciones
que el juez ya señaló. Se conservan hashes de esos planes y del conjunto de
fichas. No se afirma ahorro de tokens sin una comparación real controlada.

## Verificación y límites

Dos pruebas nuevas fallaron antes de la implementación. Después pasan:
admisión desde plan aceptado, propósito/nodo/entrada exactos, prefijo íntegro,
rechazo antes de inferir si se cambia la ficha, revocación, reentrada SQLite sin
repetición, informe con ficha y dos productores paralelos con métodos propios
no expuestos al hermano. También se comprueban fichas incompletas, revisor vacío,
roles ciegos incompatibles, formatos/techos y recuperación con fichas íntegras.
Los proveedores y los juicios de esas pruebas son **simulados**; la persistencia,
coordinación y comprobaciones de contexto son reales. La regresión completa y
cualificación con proveedor real se registran por separado en STATUS.

Esto no implementa réplica ciega sellada. No concede permisos, nuevos binarios,
acceso de red ni formación del modelo. Tampoco prueba que el juez detecte toda
ficha mal planteada o que un especialista sea mejor que una faceta existente.
Una petición que requiera una capacidad realmente ausente conserva su bloqueo;
no debe disfrazarse como especialista ni desaparecer de los criterios finales.
La cualificación Cli4mRSN usa un paquete anterior y no acredita este cambio.
