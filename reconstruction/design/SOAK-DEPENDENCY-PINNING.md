# Sonda estable frente al desarrollo

14 septiembre 2026. Corrección de R14, sin cambiar el servicio instalado.

La sonda importa Store, contratos, inspección de systemd y verificación de releases
desde factory/ mutable. Su probeHash incluye cuatro de esos archivos. Al modificar
Store por el protocolo9 cambia la identidad de la sonda aunque el servicio siga
ejecutando244d749e. El cambio debe conservarse como PROBE_CHANGED; no es un reinicio
del servicio ni se puede adjudicar continuidad entre versiones del observador.

La corrección fija las dependencias a la release local c989e75b ya congelada y
cualificada por ZzKrIb. No la instala ni la ejecuta como worker: sólo reutiliza sus
lectores/verificadores y Store para el diario separado de observación. Se verifica
el paquete completo, incluidas dependencias transitivas, antes y después de la
captura. No se elige automáticamente la última versión ni se cae al árbol mutable
si la release falta o difiere. No se admiten overrides de ruta o entorno.

La identidad incluye los archivos de la sonda y de su binding, además del paquete
fijo. La primera muestra nueva reinicia el segmento con PROBE_CHANGED; se mantienen
política72h, cadencia máxima45min, todos los registros y todos los fallos previos.
Una lectura fallida o alteración de dependencias produce muestra fallida, nunca
una apariencia de continuidad. Versionar la sonda de nuevo seguirá separando sus
segmentos. No es protección contra un administrador hostil ni integridad de memoria.

Pruebas exigidas: dependencia exacta/transitiva; copia aislada con módulos mutable
que fallan si se importan; edición de esos módulos no cambia identidad; edición,
archivo extra, enlace o ausencia en paquete fijo sí falla; captura detecta cambios;
diario viejo se lee y conserva byte a byte en copia, primera muestra nueva corta
el segmento, siguiente muestra misma versión acumula sólo el tiempo observado.
Mantener tests existentes de procesos, archivos, huecos, reloj y diario. Ningún
test debe parar el servicio, crear misiones o invocar el modelo. Cualificación real
posterior sólo captura observación y compara estado instalado sin modificarlo.

## Resultado comprobado

Siete tests nuevos; dirigido final28PASS/0FAIL/0SKIP,3460.133074ms. Se conservan
el inicial4FAIL por ausencia de la función, el dirigido intermedio25PASS y el fallo
de sintaxis del fixture ampliado21PASS/1FAIL antes de corregir su cierre/escape.
La sonda ahora fija sus helpers a c989e75b, verifica439archivos/24.317.563bytes,
rechaza enlaces de padres y detecta cambios de sus dos archivos tras cargarlos.
No se copiaron funciones nuevas al servicio ni se modificó factory/.

CopiaOUt5JJ auditada17:20:44.959:11pins de entrada/7archivos de cierre,
owner ausente,40muestras/41registros originales exactos y origen sin cambios.
Dos muestras con tiempo sintético sólo en la copia prueban separación de versión
y acumulación posterior; no añaden horas reales. CopiaqDOdjR falló antes de añadir
muestras por filas SQLite de prototipo nulo en el fixture; se corrigió su proyección
a objetos planos sin cambiar canonical ni el diario. Negativo conservado.

Primera captura real17:20:57.766 saludable:
soak-sample:2e280c10-d124-4c76-8df1-de691a289882,
probeHash d05ddf42388bbf8fe6e63ced6700398e06137c55bd04156d8bae65388884a3da.
41muestras/37saludables/4fallidas. PROBE_CHANGED registrado; segmento actual0,
máximo histórico5422690ms. Diario de observación83/eventos, head
00117c21fdfc490f226295445ece3d53126bbc171cb9616019b3a9db0fc15fba.
Servicio244d749e/PID2703657/start57762768, NRestarts0 y diario instalado424/head
d0c3d7bf1bd1e2cb27a92979fa5dc368141017263890fe3a117ddc40ef7f0793 sin cambios.
No inferencia, misión, instalación o reparación. Próxima muestra periódica no
antes de17:50UTC, salvo incidente/cambio material. Persistencia prolongada pendiente.

Regresión global posterior1YR91T/92042 cerrada17:34:37.629:
1987tests/1986PASS/0FAIL/1SKIP,516767.233283ms. Auditoría17:35:33.323
con352pins/cuatrostreams y owners ausentes. El runtime sigue siendo c989e75b
exacto; la sonda y sus tests están fuera del paquete instalado. No nueva inferencia.

Segunda captura real17:51:04.257 saludable, mismo probeHash y servicio instalado:
soak-sample:099735d7-5745-4f6d-9629-b2a0aae7350d.42muestras/38saludables/4fallidas;
segmento actual1806480ms (30min6,480s), mayor histórico5422690ms.
Diario de observación85/head70d591c0c69764d78dca5d07493bf5a6f4263f595bb9d6845cbb4ac16410677e.
No reinicio, misión o cambio del diario instalado424. La nueva edición de CLI
posterior está fuera del paquete c989e75b fijado por la sonda: el siguiente
checkpoint comprobará esa separación de nuevo sin afirmar tiempo no observado.
Captura completa en experiments/soak-pinning-second-real-checkpoint.json.
