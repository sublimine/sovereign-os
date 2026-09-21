# Entrada adaptativa cerrada — contrato experimental

Fecha: 2026-09-10. Implementación opt-in `closed-response-v1`; no cambia el
predeterminado ni está acreditada su calidad/eficiencia general. Ensayo real
emparejado terminado, con alcance limitado descrito abajo. No es una sustitución
del mandato de la fábrica.

## Problema observado y decisión

El ensayo natural `Q7iZzelI` gastó 28.141 tokens en planificar y revisar un plan
de un solo producto para calcular la media de 12, 7 y 5. Todavía no había producido
la respuesta. Reducir el número de nodos no elimina esas dos llamadas iniciales.

Se reutilizan WorkerService, ArtifactRegistry, SQLite, el propietario exclusivo,
la revisión independiente y el proveedor oficial de suscripción existentes.
Los mecanismos de routing/continuación de LangGraph considerados en el estudio
de alternativas no proporcionan estos contratos propios de exposición, recibos y
aceptación; incorporar otro coordinador sólo para una bifurcación duplicaría
estado y recuperación. No se añade un SDK, servicio, dependencia o proveedor.

La nueva entrada intenta resolver sólo una petición cerrada en una llamada y
envía ese candidato a un juez separado. Puede pedir planificación directamente.
El juez también puede rechazar la elegibilidad aunque el texto resulte plausible.
En cualquiera de esos dos casos, el planificador completo recibe la petición
original, **no la respuesta descartada, su resumen ni las razones del primer
productor**. El historial de la entrada sigue disponible para auditoría local.

## Por qué estas responsabilidades

- Ω02 aporta custodia del encargo y rechazo de sustitutos; Ω23, transformación y
  síntesis fiel. Se compilan sus fichas completas en el mismo productor porque
  comparten exactamente la petición y el único candidato cerrado, sin producto
  intermedio distinto ni potestad de aceptación.
- Ω22 se ejecuta en otra identidad e hilo de inferencia. No recibe conversación
  privada; compara el candidato con la petición íntegra y con criterios congelados
  antes de producir. Debe comprobar sustancia, no sólo forma o elegibilidad.
- Una necesidad factual externa, archivos, ejecución, productos independientes,
  método vinculante por etapas o una premisa material ausente fuerza la vía de
  planificación. Allí permanece el catálogo completo y la especialización por
  misión; estos tres roles **no constituyen la fábrica entera**.

No se crea un plan ficticio ni una revisión de plan que no haya ocurrido. El
informe identifica la entrada, su disposición y `plan: null` si entrega por esta
ruta. Para una respuesta elegible, la revisión independiente sigue precediendo
a la entrega. No existe un consumidor de material no aceptado en la ruta cerrada.

## Frontera de aceptación

El contrato fijo tiene tres criterios semánticos: elegibilidad de la petición
entera, cobertura de cada obligación original y corrección/fidelidad comprobada.
Añade cuatro controles atómicos: independencia y ausencia de escrituras,
ejecución e investigación externa. El juez no puede inventar esos controles.
El productor no puede modificar ninguno de los siete criterios.

Sólo se permiten transformación textual, composición creativa o derivación
formal cerrada a partir de los datos/definiciones explícitos. Ningún hecho empírico
externo, aunque el modelo crea recordarlo, puede acreditarse por esta ruta.
Una URL no es su contenido. Las afirmaciones aportadas por el usuario siguen
atribuidas; no se convierten en fuentes independientemente comprobadas. Los
artefactos no registran claims factuales nuevos. La ausencia de claims no es
una prueba de ausencia de hechos en el texto: eso sigue siendo juicio semántico.

No hay handler de herramientas en la entrada. Un JSON que proponga una escritura
se rechaza como esquema inválido antes de cualquier operación. El broker y las
obligaciones tipadas sólo se habilitan posteriormente por el proceso planificado
normal, sin heredar certificaciones de ausencia de efectos de un intento rechazado.

## Persistencia y fallos

`closed-entry` vincula versión del contrato, criterios, petición, política,
roles, run, respuesta, recibo y candidato exactos. Cuota durante revisión conserva
el candidato y crea una revisión nueva al reanudar, sin volver a producir.
Cancelación no entrega. Revocar una aceptación impide reutilizarla y deriva al
plan completo conservando el resultado invalidado. Cambiar el contrato/política
de una entrada empezada falla explícitamente; no se migra en silencio.

Una caída tras terminar inferencia pero antes de guardar su respuesta puede
obligar a repetir **esa inferencia pura** en un run nuevo. Se conservan el run
anterior, su consumo observado y su incertidumbre; no se promete inferencia
exactly-once. No hay efectos de producto que repetir. Los errores de calidad o
esquema derivan una sola vez al plan completo, sin bucle de intentos directos.
Los fallos de cuota/transporte conservan las reglas de espera existentes.

## Evaluación y límites

Pruebas con proveedor simulado y control real: dos llamadas satisfactorias,
derivación por productor/juez, aislamiento de respuestas descartadas, bloqueo de
herramientas, cuota en ambas fases, reapertura SQLite, cancelación, invalidación
y deriva de política. No demuestran el criterio semántico de un modelo real.

El ensayo preregistrado en `closed-entry-cases.mjs` compara dos productos cerrados
con un oráculo externo exacto, mismos modelo/razonamiento/entrada y transportes,
orden de brazos alternado. Cuatro casos negativos exigen fuentes, archivos/pruebas,
producción ciega o un dato actual mezclado con aritmética. En esos cuatro sólo se
evalúa la decisión de entrada; **no se ejecuta ni entrega el trabajo solicitado**.

La vía completa añade una llamada si el productor deriva inmediatamente, o dos
si primero lo rechaza su juez. Es un coste real que debe medirse, no esconderse.
Una muestra por caso no permite afirmar eficiencia global, óptima selección de
roles, ausencia universal de omisiones o adopción predeterminada. Deben seguirse
ampliando calibración adversaria, representatividad y contraste de resultados.

### Resultado observado — UndLIqUb

Ensayo congelado en runtime `5974b1e4`, 01:12:44–01:24:57 UTC del 10 septiembre.
Ocho ejecuciones/probes, ocho PASS externos; 17 inferencias reales y 209.418 tokens
observados. Los cuatro productos positivos terminaron COMPLETED, con revisión
independiente; los cuatro negativos quedaron PAUSED tras la derivación, no fueron
entregados. Sus registros originales y el campo `semanticAudit: PENDING` no se
reescriben: esta lectura posterior es una anotación suplementaria.

| Producto exacto | Plan completo | Entrada cerrada |
| --- | --- | --- |
| `{"sum":24,"count":3,"mean":8}` | 5 llamadas, 78.920 tokens | 2 llamadas, 19.760 tokens |
| `["árbol","mar","sol"]` | 4 llamadas, 57.964 tokens | 2 llamadas, 19.973 tokens |

El primer brazo planificado contiene una revisión rechazada por transcripción
incorrecta de un hash y su repetición posterior. No se atribuye esa diferencia
entera exclusivamente a la arquitectura. En el segundo no hubo esa repetición.
Los jueces revisaron elegibilidad, contrato íntegro y cálculo/transformación,
además de los controles de independencia y ausencia de efectos. El lector de
esta auditoría es el agente constructor, no una certificación humana externa.

Los negativos identificaron correctamente: URL sin contenido adquirido,
escritura/pruebas, dos cálculos expresamente ciegos antes de comparar, y una
petición mixta de aritmética con meteorología actual. No entregaron una respuesta
parcial para eludir la parte no cerrada. No prueban ejecución completa de esas
cuatro peticiones ni generalización a otras fronteras semánticas.

Evidencia: `/home/cardeex/codex-workspace/sovereign-closed-entry-live-UndLIqUb`.
`qualification.json` SHA256:
`58f137213c9f6de43042d2fb10607c73c172b4423a1b1e112dd0159478cff05e`;
`summary.json` SHA256:
`194e5bcb5b3bc44069873e139d3b830f4b261b99398de993c617f6cf1788ceda`.
