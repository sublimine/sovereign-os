# Orden de evidencia y orden de productos

El fallo real [MztBjXHC](../verification/ROLE-CONTRACT-RESULTS.md) demuestra que
un DAG válido de productos puede exigir evidencias inaccesibles en sus gates.
No se soluciona certificando ausencia a partir de una instrucción del plan.

`reviewEvidenceBoundary()` declara al planificador la semántica real de
WorkerService.review: candidato y ascendencia aceptada, con historiales propios
fijados antes de cada candidato; no hermanos ajenos, resultados futuros ni una
revisión previa del candidato que se está revisando. No es un recibo prospectivo.

`planReviewEvidenceContext()` valida el candidato exacto y deriva, para cada
nodo, la clausura transitiva de sus dependencias y el complemento no expuesto.
El juez del plan recibe ese mapa, además de las fichas completas. Debe contrastar
los criterios con esa disponibilidad y devolver dependencias imposibles.
No se amplían contextos productores ni revisiones materiales con otros productos.

Para ramas independientes A y B, el orden justificado es:

1. Producir A y comprobar la corrección y el historial propio de A.
2. Producir B y comprobar la corrección y el historial propio de B. Estos dos
   recorridos no se ordenan entre sí por conveniencia del juez.
3. Sólo con ambas aceptaciones, producir la integración y revisar la obligación
   conjunta contra los dos candidatos exactos, sus historiales y gates previos.

Cada requisito original sigue íntegro en el contrato final. No se cambia una
restricción explícita del usuario sobre qué debe ocurrir antes: si no puede
satisfacerse con esta arquitectura queda pendiente. Tampoco se modifica un plan
ya aceptado ni una política histórica. Los paquetes congelados siguen intactos.

La asignación semántica de una frase al gate adecuado sigue requiriendo juicio.
El mapa es determinista, no un certificado de interpretación. Los tests cubren
clausura, deduplicación, límites, integridad, ausencia de contaminación y coincidencia
del mapa con exposiciones reales del coordinador usando un juez simulado.
La cualificación con planificación y jueces reales está pendiente.
