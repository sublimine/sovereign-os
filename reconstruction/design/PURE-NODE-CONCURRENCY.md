# Concurrencia acotada de productos sin efectos

9 septiembre 2026. Cambio **opt-in**, cualificación real completada en `Ikayye8G`.

## Por qué y frontera

El plan de cartera distingue una base matemática y unos contraejemplos que no
deben consumirla. Ambos son prerrequisitos reales de la implementación, pero
antes el motor esperaba la aceptación de uno para empezar el otro aunque el
grafo no lo exigiera. No se corrige eliminando la revisión ni fingiendo que la
implementación pueda empezar antes de recibir ambos resultados.

`maxParallelPureNodes` (CLI `--parallel-pure-nodes`) permite de 1 a 4 productos
ya listos a la vez. El valor ausente mantiene la ejecución serial previa.
El límite es de recursos simultáneos, no una cuota de roles que haya que llenar.
La selección usa el plan congelado: **cada nodo y todos sus antepasados** deben
tener herramientas vacías y ninguna obligación de archivo/ejecución. Se excluye
incluso un nodo con sólo permiso de lectura. Operaciones con efectos, snapshots
heredados y trabajo autorizado para adquirir información continúan exclusivos.
Es una frontera conservadora, no un planificador paralelo de archivos arbitrarios.

## Contrato

- El ledger decide qué está listo; no se altera ningún arco ni propósito.
- Si el primer trabajo listo requiere efectos, se ejecuta solo. Si es puro,
  pueden acompañarlo otros listos puros hasta el límite, en orden estable.
- Cada productor/revisor usa su propio contexto y principio de autoridad. Las
  fichas no se combinan por concurrencia; no se expone el producto de un hermano.
- Se mantienen revisión independiente, criterios completos, CAS, fencing y
  aceptación antes del consumo. El consumidor común no empieza en esa tanda.
- Cuota/fallo fatal cancela el resto de la tanda y espera **todos** los cierres
  antes de publicar el estado terminal/de espera o soltar el propietario SQLite.
  La cancelación de un compañero no consume presupuesto de fallo de calidad.
- Un producto ya aceptado queda conservado al reanudar; un candidato durable
  puede continuar su revisión. No se repiten efectos ni se roba un lease vivo.
- Un rechazo corregible se conserva y consume el presupuesto habitual. No se
  cambia por ACCEPT para que avance una rama dependiente.
- La selección queda fijada en la política e identidad idempotente de envío.
  Cambiarla con el mismo request ID se rechaza; las misiones antiguas no cambian.

## Verificación y límites

Pruebas dirigidas de motor/selector: 40 PASS. Incluyen solapamiento observable de
proveedores simulados, contexto separado, barrera de aceptación doble, cancelación
y limpieza por cuota, reanudación con presupuesto de calidad de un intento y
conservación exacta de un hermano aceptado. Cinco pruebas CLI/SQLite PASS, incluida
configuración durable, rangos e idempotencia. Ninguna de estas pruebas acredita
simultaneidad del proveedor real ni ahorro de tokens.

Preparado `run-live-pure-parallel.mjs`: dos problemas matemáticos cerrados e
independientes y una integración con referencias exactas. Oráculos fijados antes
de la inferencia, observación del solapamiento desde el journal, revisión de los
tres productos, ausencia de herramientas y reentrada. Comprueba también que la
propuesta omite copias de criterios que el controlador restaura antes de revisión.
Sol/high, suscripción, una base nueva; no cambia las cualificaciones de cartera
Astra/Sol en curso. Es una prueba de orquestación, **no** sustituto del mandato ni
una comparación causal de latencia serial/paralela.

## Resultado real

`sovereign-pure-parallel-live-Ikayye8G/summary.json`: COMPLETED, 15 controles
PASS, runtime c9549da4 y harness sin cambios. Journal: dispatch de los dos
productores en 212/222; primera finalización en 242, segunda en 265. Las
aceptaciones preceden al consumidor y ambos hashes exactos se consumen; la
reentrada no produce inferencias ni efectos nuevos. La propuesta final tenía
cero criterios locales y el controlador incorporó los veinte requisitos completos
antes de la revisión del plan. No hay herramientas en la misión.

Lectura de los argumentos públicos realizada: el hitting set mínimo se prueba
con dos conjuntos disjuntos como cota inferior y enumeración de los cuatro pares
posibles; sólo [a,c] y [b,d] sirven. Para las ordenaciones, a/b ocupan los dos
primeros lugares, seguidos obligatoriamente de c/d. La integración conserva ambos
resultados exactos. Son problemas pequeños para verificar coordinación, no una
medida de estrategia de alto nivel.

Diez inferencias completadas, 227.261 tokens totales observados. Se conservaron
dos reparaciones internas de revisión: citas parcialmente parafraseadas del plan
y formato de evidencia final. No se presenta el coste o tiempo integral como
eficiente ni el solapamiento como comparación causal frente a ejecución serial.
