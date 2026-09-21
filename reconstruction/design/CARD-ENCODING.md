# Fichas completas sin indentación — compact-json-v1

2026-09-10, desarrollo no instalado al crear este documento. La compilación
original introduce las fichas completas como JSON con indentación de dos
espacios. La nueva selección conserva exactamente el objeto, todas sus claves,
valores, arrays y cadenas (incluidos saltos de línea internos), y deja inalterado
el prólogo de control. Sólo cambia whitespace JSON fuera de cadenas. No es un
resumen de fichas ni un cambio de sus métodos o límites.

Medición previa con el propósito frozen-facet-ablation-v1, modo reviewer:
Ω22 pasa de 8.224 a 7.188 bytes; Ω22+VERITAS_07 de 22.216 a 18.222;
Ω22+VERITAS_05 de 22.014 a 18.020. Son bytes del prefijo de catálogo, no tokens
ni la solicitud completa. El ahorro no sustituye la selección de trabajo útil.

La política `cardEncoding` se fija al crear la misión; el CLI sólo permite
seleccionarla en submit/run. Las compilaciones y promociones de aprendizaje
incluyen el formato en su scope; un overlay evaluado en pretty no se aplica a
compact, ni al revés. Las versiones antiguas y adaptive-v1 no cambian. Los
límites lógicos de catálogo/prefijo se comprueban antes de aprovechar el ahorro.

Pruebas: round-trip completo de las 154 fichas en ambos modos, prólogo idéntico,
límites, conservación de overlays, recibo real del proveedor simulado ligado a
sus instrucciones, reapertura SQLite, CLI/idempotencia y evaluación/promoción
simulada exactamente ligada al mismo prefijo. La primera aserción CLI esperaba
incorrectamente IDEMPOTENCY; el guard devolvía correctamente SUBMISSION_CONFLICT.
Se corrigió la expectativa del test, no el comportamiento de idempotencia.

Antes de instalar se compararán prefijos pretty/compact con las mismas fichas,
datos, candidatos, tarea, schema, modelo y esfuerzo. Las decisiones, cálculos,
citas y razones deben comprobarse además de los bytes. El resultado original
se conserva aunque falle. Ninguna igualdad en unos casos demuestra equivalencia
universal del modelo, ni autoriza reducir obligaciones o eliminar especialistas.

## Resultado posterior y activación — 02:57 UTC

ViVoid2v terminó 02:54:40.391 UTC, ocho inferencias, todas con hilos nuevos y
controles PASS. Runtime f452c286 y entradas/casos/harness intactos. Sus registros
están en `/home/cardeex/codex-workspace/sovereign-card-encoding-live-ViVoid2v`.
No se cambia el `semanticAudit: PENDING` del archivo original: esta sección añade
la lectura posterior del coordinador de las ocho razones, citas y probes completos.

| Formato | Juicios correctos | Tokens entrada | Tokens salida | Total |
|---|---:|---:|---:|---:|
| pretty-json | 4/4 | 36.559 | 3.937 | 40.496 |
| compact-json-v1 | 4/4 | 32.886 | 4.134 | 37.020 |

Reducción observada: 3.673 tokens de entrada (10,05 %) y 3.476 totales (8,58 %).
Los tokens de salida aumentan 197; no se oculta esa diferencia ni se generaliza
el porcentaje a todas las tareas. No se eliminó ningún campo o ficha.

La lectura semántica confirma nominal frente a garantía por extremos; dos raíces
frente a error común de calibración; 20 °C equivalentes frente a 22 °C en el mismo
instante; y bandas descalibradas con Brier 0,3125 frente al comparador 0,25. Ambos
formatos conservan los aciertos y rechazan los dos candidatos materialmente
incorrectos. Algunas razones citan operandos en el check anterior del mismo
juicio; el conjunto contiene los datos necesarios. Ninguna promesa de equivalencia
universal se deduce de esta lectura ni de la literalidad de las citas.

f452c286 instalado después de la comparación y de suite-dzGw0g (519 PASS,
cero fallos, un SKIP live). [Prueba de instalación](../verification/runtime-deployment-f452c286.json).
La skill selecciona el formato para nuevas peticiones, respetando opciones
explícitas. El CLI sin opción y la definición adaptive-v1 conservan su conducta;
las misiones y prefijos aprendidos anteriores no se migran. El posterior desarrollo
de vistas de plan NO forma parte de este paquete.
