# Cobertura final sin comprobaciones repetidas

9 septiembre 2026. Implementación en `factory/lib/final-coverage.mjs`; aplicada
únicamente a propuestas nuevas, después de validar su estructura y antes de crear
el artefacto de plan que examina el revisor independiente.

## Causa y elección

El motor anterior añadía `req.<requisito>.<criterio>` al final para que ningún
requisito quedase fuera de la entrega. El planificador desconocía esta convención
y redactaba otro juego de criterios locales. Era necesario conservar la cobertura,
pero no cobrar dos juicios por la misma condición literal.

Se conserva el esquema, las fichas y la revisión independiente. El planificador
recibió inicialmente la convención exacta: criterios completos en los requisitos
y copia literal cualificada en el producto final. La revisión de las 22:20 UTC
elimina esa copia en la **propuesta**: el controlador la incorpora antes de la
revisión. Condiciones finales locales sólo cuando añadan una obligación material.
Esto no exige un número de agentes o de criterios ni
autoriza reducir profundidad o casos límite.

La normalización determinista compara texto exacto y evaluador. No recorta espacios,
traduce, resume ni decide equivalencia semántica. Un criterio local puede usar el
identificador del requisito sólo cuando hay una única correspondencia exacta.
Dos requisitos distintos mantienen sus comprobaciones aunque sus textos coincidan.
Condiciones adicionales y etapas intermedias no se eliminan. Un `req.*` con texto
o evaluador cambiado se rechaza incluso si existe otra copia correcta. Las
colisiones por puntos en identificadores también se rechazan, no se fusionan.

El registro `planning.coverage.normalized` vincula hashes de la propuesta y plan,
artefacto, alias y cantidades. El plan normalizado completo pasa por revisión y
queda congelado. Reabrir una misión no normaliza de nuevo su plan ni invalida su
historia para conseguir ahorro. Los criterios omitidos siguen añadidos por el
motor; su juicio sustantivo sigue siendo independiente.

## Evidencia y límites

- Diez pruebas nuevas cubren diferencias de contenido/evaluador, colisiones,
  ambigüedad entre requisitos, condiciones adicionales, revisión del plan final y
  conservación tras reiniciar. Corte completo `suite-XJaCtx`: 356 aprobadas,
  cero fallos y un live smoke omitido expresamente.
- Replay sin inferencia de dos planes reales: 18 → 18 en ambos. Esas condiciones
  se solapan semánticamente, pero no son idénticas: la función no las borra.
  La ausencia de ahorro queda registrada en `final-coverage-historical.json`.
- Comparación real de dos versiones en `sovereign-final-coverage-live-jtd854PN`:
  misma petición, Astra/ultra, perfil y codec; archivos reales exactos, lecturas y
  listado propios del revisor, conservación de cobertura y reentrada sin efectos.
  Se registran consumo y criterios; el resultado no se presupone favorable.
  Es un solo caso apareado, no calibración universal ni permiso de despliegue.

### Resultado real: mejora de cobertura, regresión de coste

El ensayo terminó el 9 de septiembre de 2026 a las 19:54:46 UTC. Ambos recorridos
pasan diez comprobaciones, con los tres archivos exactos, revisión independiente
y reentrada sin nuevos efectos. Baseline: 16 criterios finales, siete inferencias,
138.023 tokens totales. Candidato: diez criterios finales, once inferencias,
233.447 tokens. **95.424 tokens adicionales: no hay ahorro integral demostrado.**

Las propuestas registradas explican una diferencia concreta: el baseline agrupa
las tres escrituras y después las lecturas; el candidato alterna escritura y
lectura por archivo siguiendo su instrucción «Tras cada escritura, leer su
resultado». La petición no requiere bloquear una escritura disjunta hasta leer
la anterior. Se mantiene esta evidencia negativa; no se corrige retrospectivamente
el plan ni el resultado. No permite atribuir toda diferencia al texto modificado:
es un solo par estocástico. La optimización siguiente debe respetar dependencias
reales y demostrar resultados, no simplemente reducir criterios.

La guía oficial de Astra recomienda ajustar las instrucciones al flujo y verificar
cambios en proporción a su alcance. Se usa como orientación, no como prueba de
esta optimización ni como motivo para cambiar el modelo o comprar API.
[OpenAI: instrucciones y verificación](https://developers.openai.com/api/docs/guides/latest-model#prompting-best-practices).

### Propuesta sin repetición — 22:20 UTC, pendiente de cualificación real

El plan real `artifact:464b0ea1-9355-4ecb-b72d-5c41f3e10de8`, hash de payload
`a054928addfb0e9e41e9280bb400ecde7494b5046f9a7101e8e9b3afa587bc08`, repite
sus 33 criterios finales literalmente. Un replay sólo lectura de la base
`sovereign-portfolio-live-GVMb9wMM` elimina únicamente esas copias en memoria:
46.241 → 35.175 bytes JSON. El controlador reconstruye los **33 criterios** y
el plan completo exacto, hash canónico
`7a5bdd0cbff3225451b5525fab2a13192b2c81e632142e426c9207dd73141dff`.
Son 11.066 bytes hipotéticos de respuesta, no tokens ni ahorro medido con modelo.
La misión en curso conserva su runtime/plan; no fue modificada por el replay.

`validatePlanProposal` admite `[]` sólo en los criterios locales del producto
final de una propuesta nueva. Requisitos e intermedios siguen exigiendo criterios
completos; campos ausentes, evaluadores inventados, efectos contradictorios y
reducción del mandato siguen fallando. `validatePlan` permanece estricto para
planes candidatos, guardados y aceptados. La normalización se produce antes de
crear el artefacto: el revisor, el productor y el registro ven el plan completo,
nunca un permiso de aceptación vacío. La reentrada no hace otra normalización.

Tres nuevos tests dirigidos ejercitan esta frontera y conservación de obligaciones;
el corte dirigido de planes/cobertura/motor pasa 59/59. Aún falta observar el
comportamiento de la nueva instrucción en un proveedor real. No cambiar las
cualificaciones Astra/Sol que están usando el runtime anterior fijado.
