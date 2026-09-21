# Reconciliación del manual operativo

14 septiembre 2026, durante la comparación 7Q6DCK. No modifica ese ensayo,
su núcleo congelado ni la instalación. Problema de uso observado por lectura
completa de las 744 líneas de factory/OPERATIONS.md y del help instalado capturado
en mission-input-installation-tc2qyW/help-command.json.

El manual mezcla historia y órdenes vigentes. Sus adjuntos dicen «todavía no
promovido» aunque 25d34 está instalado; bounded-read dice «no instalada»; otra
sección afirma que 68fd4472 «sigue instalado»; el encabezamiento operativo cita
efbdb0e9 como observación principal. STATUS documenta las instalaciones posteriores.
Estas contradicciones pueden llevar al operador a usar desarrollo, interpretar
mal disponibilidad o confundir una prueba histórica con el estado presente.

Corrección prevista después del cierre del ensayo: conservar el manual íntegro
en un archivo histórico con hash; sustituir la entrada operativa por instrucciones
coherentes, ancladas al wrapper real, help y STATUS. Separar disponibilidad de
alcance cualificado. Mantener explícitos permisos, suscripción, originales/copias,
versiones de protocolo, incertidumbre, cuotas, recuperación, no sincronización
del host, independencia, aprendizaje y fronteras de las rutas opcionales.
No trasladar al usuario la coordinación ordinaria ni añadir una nueva misión.

No eliminar del historial resultados negativos, límites ni métodos. Los contratos
detallados del diseño siguen enlazados. Verificar cada comando contra el help y
todos los enlaces locales; conservar literalmente el archivo anterior y demostrar
que no cambian JS, esquema, fichas ni solicitudes por este ajuste documental.
El documento forma parte del paquete: un paquete con él tendrá un ID distinto,
y no se atribuirá a ese ID una ejecución histórica del paquete anterior. Si se
transporta cualificación del núcleo, declarar y verificar la diferencia sólo
documental por inventario/hash, sin fingir nuevas inferencias o una suite repetida.
