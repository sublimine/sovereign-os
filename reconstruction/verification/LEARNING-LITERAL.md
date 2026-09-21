# Aprendizaje de citas: recorrido real sin mejora demostrada

10 septiembre 2026. Fuente inalterada: `sovereign-pure-parallel-live-Ikayye8G`.
Copia privada: `/home/cardeex/codex-workspace/sovereign-learning-literal-live-Zno5pAgw`.
Runtime congelado 4793e99c; harness y oráculo fijados antes de la propuesta.

El rechazo real `review-rejection:b8c1322f-b39a-4054-80c0-6ddc5ba4c13e`, hash
`72ed4d3fca81d4f98336bd668555c50364b55e26b3f9806128af6cfb1ebb5765`, contenía
trece citas del plan: dos no eran subcadenas literales de su payload admitido.
El diagnóstico entregó sus posiciones y bindings históricos, sin generar citas
de reemplazo ni exponer respuestas del evaluador.

El conductor produjo una propuesta real que pedía componer primero las citas
desde el cuerpo exacto y separar su interpretación. Se evaluó una vez contra el
prefijo base, con el mismo ámbito omega_22/reviewer/plan, Sol/high y formato de
evidencias. Cuatro casos cerrados de cinco citas cada uno: razonamiento largo,
JSON escapado, Unicode/instrucciones hostiles y versiones casi idénticas. No son
misiones de planificación completas ni pruebas de verdad o entailment semántico.
El oráculo verifica identidad, hash, subcadena, cobertura y valor completo; sus
respuestas no se entregan a ningún modelo. Ambas variantes reciben la misma
tarea. No se debilita la base para favorecer al candidato.

**Resultado: base 4/4, candidato 4/4; REJECTED por NO_MEASURED_IMPROVEMENT.**
Los once controles de integridad pasan: fuente original, rechazo preservado,
diagnóstico, proveedor real, comparación acotada, intentos conservados, ausencia
de activación, reentrada sin repetición y hashes de runtime/inputs. Nueve llamadas
totales (una propuesta y ocho evaluaciones), 72.386 tokens observados. Ningún
AGENTS.md o prefijo de producción fue promovido.

El formato de contexto configurado era lossless-json-v2, que eligió su fallback
v1 más pequeño en los cuatro inputs. No se presenta como ensayo de envoltorios
v2 ni como mejora general del modelo. La medición binaria tiene techo: no
demuestra igualdad de fiabilidad futura ni ahorro causal. El resultado útil es
que la fábrica no acepta una propuesta por ser plausible o haber sido escrita.

Archivos verificables: `qualification.json`, `summary.json` y `state.sqlite` en
la copia privada. Código del ensayo: `run-live-learning-literal.mjs`; oráculo:
`literal-evidence-case.mjs`. Sus tres pruebas adversarias forman parte de
`runs/suite-CUmp0J` (444 pruebas, 443 PASS, un smoke live omitido).
