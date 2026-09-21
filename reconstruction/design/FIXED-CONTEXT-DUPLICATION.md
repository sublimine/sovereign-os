# Duplicación exacta del contexto: medición antes de cambiar contratos

14 septiembre 2026. Sólo investigación local. No se modifica factory/, el
paquete instalado, las misiones ni los diez requests originales del par bDrx5k.

## Medición cerrada

[Informe completo](../verification/runs/fixed-context-measurement-FRl5RS/measurement.json),
18:50:27.800UTC, SHA-256
`dd6ce904570652566ab0b0bd21ef8362c59b7d43e352dd9210eb6353dd64da18`.
Trece fuentes intactas y runtime0ec8 verificado antes/después. Ocho pruebas
dirigidas PASS,145.915349ms; error inicial de conteo del fixture conservado.
La captura stdout previa truncada no se presenta como un informe completo.

Diez peticiones ya conocidas:141022bytes de instrucciones,222221bytes de input,
60494bytes de schema, incluidos46454bytes de descripciones de schema. Son
bytes UTF-8: no tokens, coste, velocidad, calidad ni nuevas inferencias.

Las únicas estructuras de schema exactamente repetidas son `{"type":"string"}`
(17bytes) y `false` (5bytes). No hay bloques grandes repetidos que justifiquen
una transformación con `$defs/$ref` en este corpus. Una referencia local como
`{"$ref":"#/$defs/s"}` ya ocupa más que el primero, sin contar el diccionario.
Se descarta esta vía para este conjunto; no se afirma nada sobre todos los planes.
El recorrido distingue posiciones de schema de mapas de propiedades, defaults
y ejemplos. [Reglas primarias de JSON Schema](https://json-schema.org/understanding-json-schema/structuring).

En cambio, el input del juez de intervalos tiene un resultado idéntico de1192bytes
en cinco posiciones: recibo firmado dentro del candidato, resultado observado
del productor, su quoteText, resultado observado del juez y su quoteText. Son
cuatro copias extra de datos, no cuatro acciones sobrantes. Las dos identidades,
sus firmas, fechas, lecturas y ámbitos deben seguir siendo distintos. Circuito
ya comparte el texto largo con el codec v2: su resultado estructural repetido
ocupa215bytes. También se repiten objetos de criterios y listas de efectos.
Los grupos padre/hijo se solapan: NO sumar sus rawRepeatedBytes como ahorro.

## Alternativas y siguiente experimento local

Se inspeccionó [Flatted](https://github.com/WebReflection/flatted): usa un formato
propio de referencias para objetos/arrays/strings y exige su parser correspondiente.
Puede resolver grafos de objetos para programas; no demuestra comprensión de un
modelo ni mantiene por sí solo nuestro contrato de bytes, procedencia y cotas.
No se añade dependencia ni se confunde ese formato con JSON ordinario. Tampoco
se propone resumir fuentes, eliminar jueces o deduplicar sus identidades.

El siguiente laboratorio medirá un diccionario de subárboles exactos sobre el
input ya serializado. Alcance previo:

- Sólo ficheros públicos de pruebas cerradas, sin proveedor o broker.
- Selección determinista de grupos no solapados; conservar orden, texto y tipo.
- Cada valor del diccionario contiene el subárbol original íntegro. No referencias
  recursivas dentro del diccionario ni supuesta autoridad de una referencia.
- Escape explícito de objetos que contengan los marcadores reservados.
- Comprobar reconstrucción byte a byte, digest, cotas de bytes/profundidad/nodos,
  referencias desconocidas, objetos no utilizados, Unicode y ausencia de mutación.
- Comparar el tamaño TOTAL, incluido envelope/diccionario/marcadores. Mantener
  el input original cuando no se reduzca. No acumular grupos padre/hijo.
- No tocar schemas/instrucciones/fichas/criterios, ni seleccionar este formato
  en el runtime. La instrucción adicional para leerlo también tendría coste y
  necesita una evaluación distinta; el laboratorio no demuestra ahorro de tokens.

Aunque reconstruya los diez requests, eso sólo prueba un componente determinista
en casos conocidos. No habilita la promoción, modifica el par INCONCLUSIVE,
acredita R04/R16 completos ni sustituye calibración semántica con casos diversos.

## Resultado del laboratorio; sin integración

[l9rzUX](../verification/runs/subtree-pool-lab-l9rzUX/summary.json) cerrado18:55:39.105,
auditado18:56:50.940. ResumenSHA
`b294d635d0837911a4f357f17848255f487720a8b94a79834bca543fe7123db7`.
Doce pruebas PASS,190.686253ms. Auditor aparte sin importar encoder/decoder:
cinco pins y trece fuentes idénticos,84referencias y todos los campos cotejados
contra las entradas originales. Diez reconstrucciones exactas, cero LIVE/SIM.

Input total222221→203651bytes:18570menos. El contrato adicional mide1015bytes
por petición seleccionada (incluyendo salto),5075bytes en cinco peticiones.
Reducción neta13495/423737bytes de instructions+input+schema, aproximadamente
3,18%. El segundo productor baseline de circuito AHORA ocuparía499bytes más
al contar instrucciones, aunque su input por separado disminuya516bytes.
El resultado negativo queda conservado: no ajustar el umbral y sobrescribir
el laboratorio para presentarlo como uniformemente positivo.

**Decisión: NO INTEGRAR NI PROMOVER.** El laboratorio prueba reconstrucción,
no comprensión del modelo ni ahorro de tokens. El selector local sólo tiene
en cuenta input y no basta para una selección de transporte completa; además
introduce otro nivel de referencias sobre v2. La reducción modesta de bytes no
resuelve la desproporción general de coste. Conservar estos inputs/outputs;
no gastar cuota en repetir el par cerrado ni cambiar roles o criterios.
Los cambios de esta investigación son sólo scripts/documentación/evidencia en
reconstruction/. factory/ y el instalado0ec8 permanecen iguales.

## Medición adicional de la ruta factual con fuentes

14septiembre22:33:59UTC, [5yCQsa](../verification/runs/sourced-context-measurement-5yCQsa/summary.json),
SHA a7cf8974f40ecaf46763029ef3bace4b7068c55fc69433b9e04a8c61a875741c.
Tres llamadas reales de xPHjHG y sólo el juez real de01EeX4; dos productores SIM
excluidos. No se repite ninguna inferencia.87.043tokens históricos observados,
no un coste nuevo ni una división causal entre campos.

Los duplicados de texto grandes YA se comparten con el formato v2: el segundo
productor pasa de142.368bytes lógicos a54.107enviados; el juez positivo pasa
de199.335 a67.411. En lógico, toolObservations ocupa91.180bytes y sources43.689
en ese juez, pero NO se pueden contar otra vez como ahorro pendiente en el wire.
Las identidades/firmas de productor y juez siguen siendo distintas.

El mínimo256 de pooling quitaría29bytes al segundo productor y1580a cada juez:
3189bytes totales, cero al primer productor. El prototipo joint quitaría
717/3902/3915bytes de input, todavía sin contar sus instrucciones adicionales.
Ambas son representaciones contrafactuales con reconstrucción exacta, no pruebas
de comprensión o ahorro de tokens. Sus fallos LIVE previos siguen vigentes.
No se cambia el runtime por estos resultados ni se reducen fuentes/criterios.
Esta medición confirma que otra capa pequeña de compresión no basta por sí
sola para resolver el coste de la ruta. Las decisiones futuras deben justificar
su efecto en la petición completa, no sólo un campo de JSON más corto.
