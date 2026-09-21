# h53t6RZV — resultado y auditoría semántica

Misión `mission:30ccdd94-3493-47bb-a6e7-50491b0037a4`, 03:08:47–03:27:23 UTC
del 10 septiembre 2026, paquete inmutable f4867dc0. Los archivos originales en
`/home/cardeex/codex-workspace/sovereign-node-plan-view-live-h53t6RZV` se conservan
sin reescribir. `summary.json` mantiene su campo original semanticAudit=PENDING;
este documento es el suplemento posterior, no una modificación del ensayo.

## Resultado acotado

14 comprobaciones mecánicas PASS: tres productos exactos, proyecciones de nodo,
ausencia de consumo cruzado de los dos productos iniciales, aceptaciones previas
a integrar, revisiones, cero herramientas, proveedor real, captura antes del
envío, hashes congelados y ausencia de repetición al reentrar en COMPLETED.
Doce inferencias reales, 199.174 tokens de entrada y 243.421 totales observados.
Cuatro correcciones internas de los productores; no es una ejecución sin
incidencias ni una comparación causal de eficiencia.

Las siete solicitudes de producción conservan la vista exacta del nodo y los
requisitos aplicables, sin enviar el cuerpo completo del plan bajo su hash.
Los dos productores iniciales no reciben productos del otro; el integrador
recibe ambos IDs/hashes aceptados y todos los requisitos. La independencia de
estos productos no equivale a que sus revisores trabajen a ciegas.

## Lectura semántica

Se leyeron completos requisitos, tres nodos, productos y razones/citas de los
cuatro juicios: cinco criterios de plan, tres por prerrequisito y veintidós del
final. La solución del hitting set tiene tamaño mínimo 2, elegida [a,c] y familia
completa [a,c],[b,d]: los conjuntos disjuntos ab/cd dan la cota inferior y el
descarte de las otras parejas prueba exhaustividad. El grafo tiene sólo abcd y
bacd: a/b preceden c y c precede d. La integración conserva los resultados y no
inventa IDs, herramientas o pruebas. Los gates observados de los prerrequisitos
ocurren en secuencias 370 y 347, antes del integrador en 379.

**Asignación de rol NO CONFORME**: el plan calificó como apropiado veritas_04,
pero sus revisores reciben el candidato antes de inferir; uno incluso declara
que no es réplica ciega sellada. La ficha de veritas_04 requiere precisamente
ese método. Su catálogo íntegro y el ACCEPT del plan no lo implementan.
El caso no califica esa capacidad ni la fidelidad general del enrutamiento.
[Diagnóstico y control correctivo](../design/ROLE-EXECUTION-COMPATIBILITY.md).

Las cuatro correcciones preservadas son dos UNSUPPORTED_INFERENCE y dos
UNDECLARED_PREMISE: cuerpos matemáticos correctos, pero claims sin premisas
resolubles y luego IDs de requisitos/vacío usados como claimId. La respuesta
final usa argumentos públicos completos y claims vacíos, permitido por el
contrato existente para este problema cerrado. Se aclaró el schema sin cambiar
el validador: [contrato](../design/CLOSED-DERIVATION-CONTRACT.md).

## Disposición

Conservar el PASS de las catorce comprobaciones y la corrección de los productos,
sin convertirlos en PASS del método ciego o del mandato. No instalar f486 como
si ese hallazgo estuviera resuelto. La nueva versión debe impedir la asignación
incompatible y demostrar que el flujo ordinario correcto sigue funcionando.
Las pruebas de regresión y un nuevo ensayo deben identificarse por separado.
