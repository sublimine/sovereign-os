# Desarrollo completo con confirmación de arranque

Prerregistro13septiembre2026,18:43UTC. **Sin ejecutar todavía**.
Actualización anterior a inferencias18:48: C5d78Q cerrada18:47:08.140,
1312tests1311PASS/0FAIL/unSKIP512855.011733ms.287entradas/started/cuatro capturas/
owner ausente reconciliados18:47:29.393. SummarySHA256
ca02ed45d380870e2b61462c3582f826d62d8c59b8ad82a9ab84c40a22ab2fc1.
La regresión incluye el workflow de desarrollo simulado con ejecución nativa;
no implica que el lanzador anidado o el proveedor real hayan sido ejecutados.
Después de cerrar la regresión del arranque y congelar su runtime, observar UNA
ruta completa del caso merge-integer-windows de full-route-cases.mjs. Ese brazo
no llegó a iniciarse en spVGwI; no se reabre aquel ensayo ni se considera aprobado
su conjunto de cuatro brazos. Caso conocido, no holdout ni prueba de superioridad.

## Lo que se conserva

Petición completa, tres nombres de archivo, API coalesceRanges, contrato de
enteros seguros, adyacencia, tipos/estructuras, -0, inmutabilidad, comando exacto,
documentación y revisión independiente. Reutilizar runFullRouteCase,
fullRoutePolicy, linaje, reentrada y oracle externo existentes, sin duplicar ni
debilitar esos evaluadores. El modelo no recibe el código ni el gold del oracle.

Política existente adaptive-v1, gpt-6-astra/ultra por suscripción oficial,
compact-json-v1, node-contract-v1, máximo dos ramas puras, dos intentos de plan y
dos por nodo. Techo total18inferencias y deadline90min. No aumentar límites por
fallo, sustituir el modelo o repetir hasta obtener verde. Este ensayo NO activa
on-demand-v1; CS6jHM cualificó ese protocolo sólo en planificación, por separado.
No se presenta este ensayo como prueba combinada de la opción de inspección.

La misión sólo puede listar la raíz, leer/escribir merge-windows.mjs,
merge-windows.test.mjs y README.md, y ejecutar node --test merge-windows.test.mjs.
No fuentes, paquetes, red, API, credenciales, publicación ni comandos auxiliares.
Las comprobaciones externas del operador corren en otro snapshot desechable con
el aislamiento existente; ese permiso no se transfiere al productor o revisor.

## Evidencia exigida

- Engine.run entrega COMPLETED con linaje y criterios completos aceptados;
  ninguna etapa simulada en el brazo real.
- Tres archivos exactos, pruebas reales de productor y revisor contra la misma
  versión; independencia de actores/contextos e intención íntegra en cada llamada.
- Todos los nuevos recibos de ejecución y el oracle tienen confirmación de
  arranque ligada al snapshot. No equiparar error del bootstrap con exit1.
- Oracle externo conservado:3193comprobaciones, referencias/mutantes cubiertos
  por la regresión; no importar el código del modelo en el controlador.
- Reentrada sin nuevas inferencias/operaciones/material, salvo los registros
  de ownership/validación y permisos de lectura ya comprobados por el harness.
- Recibos, fallos y limpieza de cada proveedor conservados; faltas de uso no
  contadas como cero. Auditar manualmente los tres archivos, casos efectivos,
  complejidad alegada, cartas/roles elegidos y pasajes de todos los juicios.

No basta el número de pruebas o el exit0 para aprobar documentación y semántica.
Un fallo del oracle conserva la aceptación que realmente hubiera registrado la
misión, pero suspende la cualificación. No cambiar retrospectivamente criterios,
historia o resultado. No instalar el runtime por una aprobación de este ensayo.

## Preflight

El lanzador anidado exige runtime/regresión cualificados y fija su propio código
y este documento aparte del inventario global. Modo preflight: comprueba esas
ligaduras y la disponibilidad del ejecutor sin iniciar modelo o misión. No es
otra simulación del workflow. El workflow simulado con ejecuciones nativas se
comprueba en tests/factory/full-route-harness.test.mjs dentro de la regresión.
El modo live requiere el directorio de ese preflight cerrado con los mismos pins,
runtime y resumen de regresión. Una base privada NUEVA, sin tocar bckJet, CS6jHM,
misiones ordinarias, copia instalada o servicios existentes.
