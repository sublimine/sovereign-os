# Cualificación previa: recuperación de la entrada rápida por el motor

14 septiembre 2026. Ensayo único conocido de recuperación; no holdout,
comparación de ahorro ni aceptación de toda la fábrica.

## Entradas y versión

Se exige regresión `suite-MUS7Oc` completa/aprobada y snapshot correspondiente,
con inventario y hashes concordantes. Antes de la ejecución real debe cerrar una
simulación aprobada con el mismo launcher, adaptador de captura, caso, documento,
runtime y política. Sus hashes se fijan antes del primer despacho.

Caso conocido reutilizado: `closed-v2-revision-case.mjs`, transformación de trece
registros con selección por revisión, desempate por última aparición, filtro
posterior, ceros/negativos y orden de puntos de código Unicode. No se transfiere
la respuesta anterior. El oracle externo, ausente del input del modelo, sigue
siendo el original; no se cambia por un resultado observado.

Entrada closed-response-v2, contrato íntegro del controlador y juez Ω22 completo.
gpt-6-astra/ultra, perfil scoped-v1 y formatos sin pérdida. Ninguna herramienta,
archivo del agente ni fuente externa. Dos reservas globales como máximo, un
intento de nodo y plan, cero reparaciones del juez. Veinte minutos totales.

## Secuencia fija

1. Proceso hijo ejecuta engine.run desde la petición natural. Sólo se admite la
   respuesta cerrada `answer`. Después de guardar respuesta y recibo, cerrar el
   proveedor y guardar su cierre, se registra el punto de corte y el hijo se
   envía SIGKILL antes de materializar candidato.
2. Padre verifica identidad muerta y reabre. engine.run debe recuperar el mismo
   productor, enviar el candidato exacto a un juez independiente y completar.
   Sólo queda autorizada una llamada, de revisión; no productor nuevo ni plan.
3. Oracle fijo del contenido y siete controles de aceptación (tres sustantivos,
   cuatro de runtime). Sin efectos. La respuesta no se reescribe desde el arnés.
4. Tercer proceso reabre la misión completada con modelo y broker vetados:
   identidad de artefacto y presupuesto intactos, cero llamadas adicionales.

PASS exige todos los puntos, hashes e inventarios íntegros, dos recibos reales,
threads separados, cierre observado de ambos proveedores y cero efectos. Un
rechazo, cambio de ruta, falta de cierre o agotamiento permanece fallo; no se
repite el brazo para obtener otra etiqueta. Auditoría posterior de citas y
contenido independiente del booleano del arnés.

El corte real sólo se aplica tras cierre confirmado; no deja intencionadamente
un proceso de modelo abierto. Las ventanas anteriores sin confirmación están
probadas con SIGKILL y modelos simulados, donde bloquean. Este ensayo no instala
servicios, no prueba reinicio de OS, reconciliación de cierre desconocido ni días
de operación. Es engine.run completo para esta petición cerrada, no un plan
material completo ni todas las rutas adaptativas.
