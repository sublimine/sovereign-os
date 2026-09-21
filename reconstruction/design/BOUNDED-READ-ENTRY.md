# Entrada acotada con lectura: contrato de construcción

14 septiembre 2026. **Candidato en construcción, no instalado ni cualificado.**
No modifica closed-response-v1/v2 ni adaptive-v1/v2; selección explícita nueva
`bounded-read-response-v1`. El servicio conserva b7cb510c.

## Motivo y alternativas

LFYIrU empleó 78.083 de 152.181 tokens en inspección de fichas, planificación y
juicio del plan para verificar un archivo. Es una observación de un caso conocido,
no ahorro prometido. El diccionario corto sólo mejoró un par sintético un 3,28 %.
La alternativa aquí es evitar construir un plan cuando toda la tarea cabe en un
contrato previamente delimitado; no reducir esfuerzo del modelo ni quitar jueces.

Se revisaron closed-entry, WorkerService.produce, conservación de propuestas,
cursores, input-file-review y el contrato original. Se reutilizan esos mecanismos
del núcleo, no otro framework/journal. Las alternativas externas ya contrastadas
en RESEARCH-DECISIONS.md no resuelven la elegibilidad material específica de esta
ruta. Ampliar las herramientas del actor v2 se rechaza: cambiaría su contrato
histórico y sus pruebas de ausencia de efectos. Preleer archivos arbitrarios del
VPS, resumir su contenido o declarar una lectura como archivo producido tampoco
son alternativas válidas.

## Alcance y orden

La petición original completa llega a un productor con contrato propio del
controlador. Sólo puede proponer una respuesta cerrada, una lectura autorizada
del workspace de esa misión o el paso al plan completo. No finge ejecutar una
ficha incompatible ni inventa un plan aceptado. Si utiliza un archivo, debe ser
el único archivo solicitado explícitamente, UTF-8 completo de hasta 65.536 bytes.
La selección semántica es falible y debe volver a juzgarse, no se certifica con
una coincidencia regex. El broker sigue cerrando escapes de ruta y permisos.

El tope de una intención de lectura y 65.536 bytes limita esta ruta experimental,
no el tamaño o calidad del encargo global: superar su alcance lleva al plan
completo sin truncar datos ni ampliar permisos. No crea un presupuesto global de
inferencias ni modifica el existente. La lectura no autoriza hechos externos:
los datos locales siguen siendo premisas atribuidas, no realidad verificada.

Después del candidato: el revisor en otro thread recibe la petición y el producto,
relee las entradas por input-file-review-v1 y debe citar esa lectura propia de la
misma versión. Verifica elegibilidad, cobertura de todas las cláusulas y resultado
material. Ni un hash ni un recibo acreditan por sí solos corrección semántica.
Después del juicio: controles del registro y del snapshot antes de entregar.
Un rechazo material va al plan completo una vez, nunca a otra votación del mismo
resultado. Los candidatos y razones rechazados no se admiten al plan como datos;
el historial auténtico de operaciones no se borra.

Investigación externa, archivos de salida, ejecución, varios archivos/productos,
blindaje, procesos ordenados o cualquier condición dudosa requieren planificación.
Una petición que sólo aporta texto puede resolverse sin herramientas si satisface
los mismos criterios de cierre. Una URL no equivale a su contenido.

## Durabilidad y fronteras

- Contrato de entrada original v1, mandato y política vinculados; cambios fallan.
- Respuestas, cierre del proveedor y operaciones usan los protocolos existentes.
- Recuperar un final retenido no compra otra inferencia ni vuelve a leer la entrada.
- Un productor de reemplazo sólo hereda observaciones autenticadas, no conversación,
  autoridad, aceptación ni una versión supuesta vigente.
- Cuota, cancelación, efectos inciertos, cierre no confirmado o integridad rota no
  se convierten en éxito ni en permiso para gastar un plan alternativo.
- Lecturas cambiadas o ambiguas conservan el fallo explícito; no se borra evidencia.
- Sin overlays de aprendizaje no evaluados para esta compilación/revisión.
- Presets antiguos, núcleos congelados y ensayos históricos permanecen intactos.
- La creación de una misión que selecciona esta ruta requiere protocolo 6 en la
  misma transacción que su política original; esperar a crear el primer actor
  dejaría que un ejecutor antiguo recibiera una política que no entiende. Los
  nuevos lectores de input-review y contabilidad aceptan 6 conservando sus mínimos
  5 y 4 respectivamente. No se promociona por consultar ni se cambia la base instalada.

## Criterios previos de cualificación

Antes de un LIVE: probar ruta sin archivos y con uno; denegación de lectura sin
permiso; bloqueos de escritura/ejecución/red/listado; exceso de lectura/tamaño;
inyección en el archivo; retorno por alcance; rechazo y plan sin candidato
contaminante; juez sin cita, versión cambiada, cancelación, quota y cierre incierto;
reapertura en fronteras de respuesta/efecto/candidato/juicio, sin duplicación.
Comprobar informe, CLI, cola, antiguos modos y separación de aprendizaje.

Sólo después definir un ensayo real con criterios semánticos y de consumo fijados
antes del despacho, comparar el mismo encargo completo y registrar todo consumo
conocido y desconocido. No instalar por pasar tests simulados ni llamar eficiencia
general a un caso. R01–R16 siguen abiertos.
