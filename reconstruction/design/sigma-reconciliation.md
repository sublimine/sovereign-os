# Reconciliación de capacidades Σ01–40 con Ω y departamentos

Propuesta de diseño, no arquitectura aprobada ni implementación. `sigma-reconciliation.json` cubre individualmente los 40 puestos: capacidad canónica propuesta, pares de Ω/VERITAS/ADVERSUM, facetas preservadas, ejecución compartible, aceptación independiente y dependencias de artefactos/estado. La matriz no representa un número objetivo de sesiones, agentes ni servicios.

## Base y criterio de consolidación

Se usan exclusivamente las auditorías del borrador original: `audit/sigma` (Σ01–19), `audit/sigma-complement` (Σ20–40), `audit/omega` y `audit/departments`. Las conclusiones Ω proceden de su auditor, sin atribuirme repetición de sus pruebas. La lectura directa de este auditor comprende los departamentos y Σ20–40; para Σ01–19 la reconciliación consume las fichas y síntesis del auditor correspondiente. Hashes de estas entradas están en el JSON. Los históricos y la congruencia machine/schema siguen pendientes según manifest.

Se propone una capacidad canónica cuando el efecto y el objeto coinciden, no porque los títulos se parezcan. Una capacidad tiene facetas de dominio y protocolos; una sesión puede ejecutar varias facetas compatibles. La autoridad de aceptar un producto material debe conservar independencia del productor aunque ambos usen la misma biblioteca, proveedor o proceso anfitrión. Compartir motor no equivale a compartir contexto, credenciales o derecho de commit.

## Qué se puede compartir y qué no

### Mando, requisitos y colección

Σ01/02 se integran como vistas de alcance de Ω02/04, no como otra cadena obligatoria de jefes. Preservan aceptación departamental, liveness, camino crítico, backpressure y continuidad del objetivo. Ω01 conserva decisiones reservadas, Ω20 recursos y Ω21 autoridad. No duplicar una aprobación idéntica de mandato por cada título; tampoco convertir el scheduler en autor del objetivo o juez factual.

Σ03/05 y Ω05 pueden compartir intake con dos productos explícitos: modelo de intención reconocido y requisitos observables. La disponibilidad de fuentes no redefine la pregunta. Una exploración legítima no necesita un consumidor decisor ficticio. Σ04 calcula cobertura a partir de requisitos y raíces reales; no es scoring de confianza ni autorización de ampliar presupuesto.

Σ06/07/12 son facetas de Ω06: portfolio de métodos, descubrimiento y recuperación causal. Σ08/09/10/11 son métodos diferenciados de colección/extracción, no cuatro departamentos gerenciales adicionales. Elicitación conserva consentimiento e interacción; geoespacial conserva CRS/oclusiones; sensor conserva calibración/spoofing; documento conserva literal/versión/OCR. Las facetas no se borran por compartir ejecutor.

### Frontera de evidencia

Σ13 handling y Ω21 autoridad deben preceder acceso/efecto. Σ14 es una frontera técnica mínima obligatoria, no un juez LLM que se invoca por costumbre para toda URL. Parse aislado no certifica veracidad; un sello de seguridad tampoco legitima el acceso.

Σ17/Ω07/VERITAS03 justifican **un registro de procedencia canónico con vistas**, no tres cadenas independientes que puedan divergir. Σ16/Ω10/VERITAS05 justifican un servicio de dependencia de evidencia a nivel claim/campo. El grafo de procedencia dice de dónde viene; el grafo de dependencia estima raíces comunes; el de red Σ20 describe relaciones del mundo. Pueden compartir biblioteca, no semántica de edges.

Σ15 fiabilidad vectorial no se fusiona lógicamente con Ω11/VERITAS06: una fuente fiable puede errar y una sospechosa decir verdad. Σ18 identidad, Σ19 tiempo, Σ21 medición, Σ22 ontología y Σ23 interpretación son transformaciones que pueden cambiar la afirmación. Sus outputs materiales se aceptan antes de ser fundamento de red/fusión/causalidad; labels de origen no sustituyen ese control.

### Análisis y adversarialidad

Σ24 comparte matriz claim/evidencia con VERITAS02/06/10 y Ω11/12. La fusión conserva una vista inferencial, mientras el veredicto factual conserva predicado/soporte/estado. No hacer dos fact-checks idénticos por etiqueta; sí revisar la nueva inferencia producida por combinar hechos aceptados.

Σ25 comparte actores con estrategia y amenazas, sin convertir incentivo en intención demostrada. Σ26/27 comparten representación con Ω08/16, pero contexto, identificación causal y simulación son productos distintos. Σ28/Ω13/15/ADVERSUM04 comparten generación y discriminación de alternativas, con contexto ciego para prueba independiente. Σ29/ADVERSUM05/06 analiza engaño externo; Σ30/Ω03/14/19 preserva investigación interna protegida. Fusionar ambas bajo el dueño posiblemente comprometido destruye el control.

Σ31 anomalía, Σ32 forecast, Σ33 warning y Σ34 sorpresa son facetas diferentes: baseline, evento futuro resoluble, umbral de actuación y ruptura de supuestos del modelo. No se activa toda la familia por detectar una cifra rara. Σ35 apertura favorable alimenta estrategia/capital pero no los decide. La revisión adversarial no autoriza explotación ofensiva ni acciones externas fuera de mandato.

### Disenso, producto, calidad y aprendizaje

Σ36/VERITAS08/ADVERSUM09 pueden usar un registro común con facetas factual, interpretiva, de modelo y de valores. No se fuerza consenso ni se concede verdad automática a la minoría. Σ37/Ω23/VERITAS10 comparten síntesis por claims con estado conservado, pero la fidelidad del nuevo producto debe verificarse después de componerlo. Autoría, mecánica de publicación y permiso de difusión son funciones distintas.

Σ38/Ω22 comparten plataforma de criterios y pruebas. Σ38 revisa tradecraft de artefactos analíticos; Ω22 comprueba requisitos/producto final, sin rehacer todas las pruebas ya válidas para esa versión y propósito. Ω03 permanece auditor del funcionamiento de controles, no juez síncrono de cada nodo. El tribunal ADVERSUM10 decide materialidad de hallazgos, no calidad global.

Σ39/Ω02/07 comparten journal, checkpoint, invalidación y notificaciones, evitando múltiples autoridades del estado. Σ40/Ω24/VERITAS09 comparten evaluación y calibración. Σ40 diagnostica efectividad de inteligencia y propone; Ω24 gobierna promoción evaluada. TELOS06/07/10 añade experimento/sombra/evolución en la reconciliación global: no una ruta paralela que pueda promover el mismo cambio sin pasar las mismas condiciones.

## Fusiones dañinas y pruebas discriminantes

| Fusión que se rechaza sin salvaguardas | Pérdida | Prueba propuesta |
|---|---|---|
| Colección + admisión + verdad como una sola aprobación | Raw hostil o afirmación oficial se vuelve hecho | Documento auténtico falso y parser divergente deben producir estados diferentes |
| Procedencia + independencia + red como mismo edge | Copias parecen corroboración o coordinación parece origen común | Veinte mirrors y dos actores relacionados sin fuente común |
| Identidad + red con validación circular | Grafo plausible fuerza false merge | Dividir candidato y medir invalidación de centralidad/actor |
| Medición + causalidad | Cálculo preciso legitima efecto no identificado | Correlación exacta con collider y denominador correcto |
| Fuente fiable + claim verdadero | Reputación reemplaza evidencia | Fuente oficial errónea y fuente interesada con registro verdadero |
| Forecast + warning + sorpresa | Probabilidad se usa como umbral; puntos ciegos desaparecen | Probabilidad alta fuera de ventana y discontinuidad fuera de indicadores |
| Autor/editor + juez | Autocertificación o caveat borrado | Coautoría detectada, reroute limpio, minoría preservada en resumen |
| Investigador + owner investigado | Denuncia o evidencia filtrada/suprimida | Canal del superior comprometido y contención proporcional |
| Memoria + autoridad de efectos | Retry duplica irreversible | Crash después del efecto y antes del receipt |
| Resultado + aprendizaje/promoción | Suerte/Goodhart cambia prompts | Éxito exógeno, task mix distinto y prueba reservada no regresiva |

No son resultados medidos. Cada consolidación se evalúa contra las mismas tareas congeladas, con falsos pases/omisiones y coste/latencia observados. La comparación debe medir pérdida de facetas, no premiar la cantidad de roles.

## Resoluciones propuestas de referencias y contratos

- **Σ26 §3, destinatario Σ18 «evaluates impacts Ω role»:** proponer Ω18. La identidad Σ18 puede seguir aportando entidades afectadas, pero no acepta impactos. Validar coherencia de import/export antes de adoptar.
- **Σ34 §3, Σ19 «owns existential risk»:** proponer Ω19. Cronología Σ19 mantiene intervalos, no riesgo existencial.
- **Σ33/36/37 EstimateRecords:** resolver productor canónico Σ32 o servicio forecast delegado con ownership de Σ32; Data/especialista sólo produce cálculo candidato. Hacer requisito condicional al tipo de producto, no obligatorio en disenso puramente factual.
- **Σ24 DissentRecords:** resolver registry Σ36/servicio canónico de disenso; otras fuentes presentan propuestas, no commit sobre su dueño.
- **Σ11 C4 FOUR_TIME_SEPARATION:** importar explícitamente prueba temporal de Σ19 ligada a versión o declarar gate local con contrato equivalente. No aceptar nombre suelto como dependencia.
- **Σ17 C3 ORIGINAL_PRESERVATION:** añadir predicado concreto de original inmutable/hash/derivative linkage a su gate de integridad, o referencia explícita verificada; no inventar PASS.
- **Σ24 C3 INDEPENDENCE:** remitir al EvidenceDependencyAssessment/Σ16 y aceptación independiente correspondiente o declarar el gate; un caso no crea automáticamente un catálogo.
- **Σ39 C2 VERSION_LINKAGE:** declarar check de relación causal versión/evento dentro de resume, ligado al journal; no usar por error gate Σ40 del mismo nombre como sello genérico.
- **Σ38 gates sigma_38:** resolver identidad de instancia revisora, conflictos/coautoría y manifiesto de contexto; si no hay independencia real, Ω competente o estado pendiente. El nombre del rol nunca certifica separación.
- **Σ38/39 MODIFY_POLICY C:** tratar como propuesta autorizable por owner superior, sin facultad autónoma de alterar estándar. Σ40 X se conserva. Reconciliar vocabulario de operaciones con Ω24 antes de implementación.
- **Campos opcionales:** autoridad/consent/clasificación/clock/calibración/receipts se vuelven condicionalmente obligatorios cuando sustentan la operación o claim; ausencia tipada bloquea ese uso, no necesariamente toda exploración.

No se cambiaron documentos originales. Las correcciones son decisiones propuestas a la dirección, no una interpretación permisiva silenciosa.

## Ciclos y bootstrap con estados explícitos

1. **Σ01 aceptación ↔ Σ02 grafo:** mandato inicial permite sólo diseño de alcance conocido. Grafo candidato y capacidad se revisan; CommandDecision aceptada permite ejecución dentro del lease. No usar un lease planeado como autoridad activa.
2. **Σ06 strategy ↔ Σ07 access map:** `DISCOVERY_COMMISSION` limitada produce mapa preliminar; portfolio posterior se acepta antes de adquisición material. No inventar CollectionTask final para generar su propio prerequisito.
3. **Σ04 coverage ↔ resultados:** snapshot inicial vacío con denominador aceptado equivale a gaps pendientes. Sólo resultados observados aceptados incrementan cobertura. No existe suficiencia por bootstrap.
4. **Σ18 identidad ↔ Σ19 tiempo:** constraint solving provisional sobre candidatos/intervalos, sin merges factuales prematuros; discriminante independiente antes de canonicalizar. Después, invalidación bidireccional acotada por versiones, no circularidad como evidencia.
5. **Σ24 fusión ↔ Σ28 hipótesis ↔ Σ36 disenso:** iterar si hay evidence delta o método distinto esperado útil; reentrada versionada y límites/reserva; UNKNOWN legítimo al no poder discriminar. Nunca iterar hasta que desaparezca minoría.
6. **Σ26/27 modelo ↔ Ω16 simulación:** borrador rotulado puede explorar sensibilidad; aceptar modelo identificado/condicional antes de usar salida para decisión. Simulación no revalida retroactivamente sus supuestos.
7. **Σ38 juez ↔ productor:** RETURN con defecto raíz; productor corrige nueva versión; reviewer no coautor retesta. Declarar frontera finita de aseguramiento, sin serie infinita de jueces de jueces ni autocertificación.
8. **Σ32 forecast ↔ resolución/Σ40:** entregar forecast aceptado hoy con obligación de resolución futura. Σ39 registra trigger; Σ40 evalúa cuando haya outcome. No bloquear entrega 18 meses ni fabricar etiqueta para cerrar.
9. **Σ33 watch ↔ Σ39 handover:** instancia de alerta finita con ACK/disposition, suscripción de watch persistente con próximo evento; handover no resetea thresholds ni permite dos propietarios activos sin fencing.
10. **Σ40 propuesta ↔ Ω24 cambio:** evaluación independiente de baseline/candidato y promoción versionada; feedback del candidato no puede actuar como etiqueta/oracle propio. Rechazo también es salida útil.

## Condición común de aceptación

Un consumidor sólo usa como fundamento material un artefacto aceptado para su hash/versión, alcance, finalidad y vigencia. Una admisión técnica no cubre factualidad, una prueba factual no cubre la nueva inferencia, y la inferencia aceptada no cubre fidelidad de síntesis ni permiso de publicación. Reutilizar una prueba exacta evita redundancia; reutilizarla fuera de alcance produce falsa seguridad.

Retracción o cambio material invalida antes del próximo uso. Los consumidores ya servidos reciben corrección/reconciliación documentada; ACK prueba recepción, no consentimiento ni verdad. Un único VPS no demuestra anclaje independiente externo ni continuidad infinita. El requisito de suscripciones sigue vinculante: esta matriz no autoriza fallback API, compras ni extracción de credenciales.
