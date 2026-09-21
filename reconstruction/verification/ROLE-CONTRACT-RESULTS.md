# MztBjXHC: fallo conservado de colocación de evidencia

Cierre 10 septiembre 2026, 03:45:20.096 UTC. Paquete 4506ceeb congelado,
misión `928fdaef-5cd5-47fc-bb5d-ff855409d5c3`, base y solicitudes originales en
`/home/cardeex/codex-workspace/sovereign-role-contract-live-MztBjXHC`.
**WAITING_CAPABILITY, no entrega.** Ocho inferencias reales, 149.204 tokens
observados; ninguna reparación de schema. Hubo dos nuevos intentos de producción
tras juicios materiales y ambos se declararon bloqueados: cero correcciones de
schema NO significa cero repeticiones ni eficiencia conseguida.

## Lectura semántica

Se leyeron requisitos, los tres contratos, criterios finales, tres revisiones
completas con sus citas y razones, cuerpos matemáticos y diagnósticos posteriores.
El plan `artifact:ec67a8b6-bf45-4e85-8bde-bccacb3202a3`, hash de payload
`dddfa8b3f8ffc7b147877ed2968cd8264b2b44573eda2db97243c2362f658f9a`, fue aceptado
por `review:52c73e33-1d9e-4717-bdd8-5583e393eadd`. Ningún rol de réplica ciega
se asignó; eso no evitó el error siguiente.

Los dos productores emitieron a la primera candidatos matemáticamente correctos,
con pruebas públicas y `claims:[]`, sin inventar premisas tipadas. El hitting set
contiene los dos óptimos `[a,c]` y `[b,d]`, mínimo 2: los conjuntos disjuntos
obligan a dos elementos y descartar los otros dos pares cruzados completa la
enumeración. El otro cuerpo enumera exactamente `a,b,c,d` y `b,a,c,d`: las aristas
fuerzan las dos primeras posiciones y después `c,d`. Los jueces confirmaron
forma, matemática, orden y prueba; la aceptación independiente runtime también pasó.

Sin embargo, **ambos nodos raíz incluían un criterio bilateral** que requería
el historial de los dos productores. `WorkerService.review` entrega el candidato
y su ascendencia declarada, no el producto ni el historial de un hermano ajeno.
`artifact-production-scope` mantiene precisamente esa frontera. La revisión
topológica `0341c0bd-19fd-4bde-9f0b-5ffd1f128c06` produjo UNKNOWN; la del hitting
set `cbcb890f-1261-4a49-9b40-53e7730ef768` RETURN, con el criterio de separación
UNKNOWN. Ambas identificaron correctamente la ausencia de evidencia contraria,
no contaminación demostrada. Los productores posteriores no podían suministrarla
y no recalcularon falsamente una solución como reparación. El integrador no empezó.

## Causa, no maquillaje del resultado

La revisión del plan comprobó el DAG de productos, pero no que cada criterio
tuviera sus evidencias **en su propia frontera temporal y de exposición**.
Que el otro candidato exista en SQLite no autoriza a afirmar que el juez lo
observó. Añadir una dependencia de producto entre ramas para obtener su historial
violaría la separación solicitada. Entregar historiales indiscriminadamente
introduciría además una nueva frontera de divulgación y carreras con ramas en curso.

El cambio posterior expone al planificador y al juez del plan un contrato de
disponibilidad y un mapa de ascendencia por nodo. La revisión individual debe
comprobar su propia no-consumición; la obligación bilateral íntegra se comprueba
al converger, con ambos prerrequisitos aceptados y sus historiales. Si el usuario
exige expresamente otro protocolo temporal, se conserva como necesidad pendiente.
Esto no cambia criterios ni aprueba retroactivamente MztBjXHC. No se reintenta este
ensayo hasta verde ni se modifica su resumen original `semanticAudit:PENDING`:
este documento es el suplemento de auditoría, no una sustitución de evidencia.

Persisten límites: metadata no prueba todo texto incidental ni conocimiento previo;
el nuevo contrato requiere cualificación real y no equivale a un comprobador
semántico determinista de cualquier condición escrita en lenguaje natural.
