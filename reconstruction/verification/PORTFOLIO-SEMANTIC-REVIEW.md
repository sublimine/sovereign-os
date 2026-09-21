# Revisión de contenido de los prerrequisitos Astra

## Recuperación final — 9 septiembre, 23:58 UTC

La copia privada `b0zgffSZ` terminó COMPLETED: 21 controles de integración,
226/226 casos externos y los mismos tres hashes indicados en esta nota. El juez
`review:efd35d3c-4714-447e-aeb6-401b0fbf3ed2` revisó los 33 criterios, releyó
los tres archivos, repitió la ejecución y aceptó citando el historial que faltaba.
No hubo nueva producción ni escrituras. Los estados anteriores se conservan como
historia, no se corrigen retroactivamente a éxito.

El total genealógico de 1.084.948 tokens incluye las dos recuperaciones; la última
añade una revisión y 124.408 tokens. El éxito no acredita eficiencia ni una
ejecución nueva desde cero del runtime 4793e99c. El oráculo externo se ejecutó
después del juez y se mantiene separado de su conocimiento.

## Lectura previa — 22:48 UTC

9 septiembre 2026, 22:48 UTC. Lectura íntegra del modelo de decisión (23.238 bytes)
y los seis contraejemplos del ensayo `sovereign-portfolio-live-GVMb9wMM` por el
agente de reconstrucción. Esta lectura no suplanta el juez registrado ni cambia
la aceptación de la misión; el código integrado todavía no está entregado.

## Modelo de decisión

`artifact:3e4c4562-c262-498b-a3af-363c0b6f7cad`, aceptado por su juez independiente.
El contenido desarrolla cuatro alternativas distintas: greedy por incremento,
enumeración exhaustiva, branch-and-bound y programación dinámica/Pareto. No las
presenta como cuatro nombres intercambiables. Explica por qué un presupuesto
safe-integer no hace viable una tabla indexada por presupuesto; por qué una cota
igual del beneficio robusto no permite podar ignorando los otros desempates; y
por qué el mínimo de sumas no equivale a sumar mínimos individuales.

La elección exhaustiva está justificada por n≤16: 65.536 máscaras como máximo.
El argumento enlaza validación global, cierre transitivo, exclusión simétrica,
bijección máscara/selección e invariante del mejor candidato. Conserva las cuatro
prioridades y comparación de arrays por strings JS, no por locale ni máscara.
La suma segura se comprueba antes de sumar; todos los proyectos participan en la
validación global aunque luego sean inviables. Reconoce el caso vacío y distingue
solución inviable de entrada malformada. Los límites de trabajo/espacio corresponden
a su representación propuesta, no a velocidad empírica o código todavía inexistente.

Se considera adecuado como base de implementación de este problema acotado.
No acredita economía real de agentes ni superioridad frente a todos los algoritmos.

## Contraejemplos: significación además de etiquetas

Candidato `artifact:c3159755-a0f6-4935-b11b-a545ec5b1df6`, hash
`e944a2795fe6d757500dd271918e5281300357e5a671de0639a08fac2acbea52`.
Permanece UNKNOWN en el ensayo original por evidencia de aislamiento, no por
matemática. Los seis resultados completos coinciden con el oráculo exhaustivo
externo ejecutado localmente sobre sus datos, sin ejecutar código del modelo.

| Caso | Por qué activa realmente el fallo |
|---|---|
| greedy-trap | A tiene ratio 2 y consume 6 de 10; elegirlo impide B+C, cuyo coste 10 y beneficio robusto 18 superan 12. Define el greedy concreto refutado, no todos los greedy. |
| transitive-dependency | A→B→C cuesta 4 y excede presupuesto 3; una expansión incompleta A+B parecería mejor que D. El segundo salto cambia el ganador. Aclara que comprobar aristas directas de todos los seleccionados sí impone transitividad. |
| asymmetric-exclusion | Sólo A declara excluir B; requerir declaración mutua admitiría indebidamente la pareja y cambiaría el resultado. |
| robust-not-sum | R obtiene mínimo 6/total 12; S mínimo 5/total 25. La elección difiere estrictamente por prioridad robusta, con igual coste. |
| prefix-tie | [A] y [A,B] empatan en las tres prioridades numéricas porque B tiene coste/beneficio cero; vence el prefijo más corto. No está resuelto antes por otro desempate. |
| infeasible-required | A obligatorio exige y excluye B simultáneamente; cabe en presupuesto pero ninguna selección satisface ambas restricciones. La entrada es válida y debe devolver infeasible, no un error de validación. |

Todos los casos son pequeños, de entrada válida y con justificación manual de
factibilidad y ganador. No se observan etiquetas vacías ni expectativas circulares
copiadas de una ejecución del futuro programa. La evidencia de admisión del
productor se cualifica por separado antes de permitir que el código los consuma.

## Lectura de la implementación integrada

Lectura completa posterior en `7NHFBdRo`: implementación 214 líneas, tests 412 y
README 109. Los bytes observados a las 23:27 UTC quedan identificados por SHA256:

- portfolio.mjs: `0623ea46f0cca49bb8ad19e08806d69adb8b6b3f96008094ee24f22e883b73ed`.
- portfolio.test.mjs: `ac8548647b3f5520d9f266ff8bda9be7e6120edce481d0e38ac79a792a940d62`.
- README.md: `94faab769c77c459ea8e68ad1349d4a00d4d200dde662486de0c0c1badcecfb3`.

El código separa validación completa de selección; guarda antes de sumar, valida
todos los componentes de requires, simetriza exclusiones y calcula cierre en
orden de dependencias. Enumera todas las máscaras incluyendo cero y usa los
cuatro desempates explícitos. Ordena sólo registros propios, no arrays del caller.
Los tests no derivan expectativas del selector; conservan los seis casos aceptados
y añaden fronteras numéricas, esquema, listas, permutaciones, congelación y n=16.
El README vincula los dos prerrequisitos exactos y distingue prueba matemática,
ejecuciones observadas y limitaciones de Proxies/accessors fuera del contrato.

El oráculo externo posterior pasó 226/226 sobre esos bytes, sin cargar el código
en el controlador. La revisión independiente calificó PASS todo salvo el historial
de aceptación anterior, cuyo único criterio quedó UNKNOWN. Ese hueco del controlador
no se oculta: misión WAITING_CAPABILITY, no entrega aceptada. Véase
[registro de gates](../design/DEPENDENCY-GATES.md).
