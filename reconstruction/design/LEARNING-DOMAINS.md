# Dominios independientes para una misma ficha

Contrato previo14septiembre2026,21:50UTC. No es una declaración de implementación.
El experimento cerrado learning-domain-cardinality-0jwFUq confirma en50a629c2
que una segunda finalidad para omega_22 se rechaza con LEARNING_EXISTS. La
primera queda intacta; no se ejecutó modelo/evaluador ni se escribió en la instalación.

## Cambio y límites

Separar ficha (rol de catálogo) y política de aprendizaje (dominio). Una misma
ficha puede tener dominios con ámbitos o modelos/esfuerzos disjuntos, cada uno
con dataset, padre, comparación, aprobación y reversión propios. No se crean
copias del agente ni se quitan campos del ámbito para conseguir coincidencia.

La API legacy por roleId conserva sus IDs y comportamiento. Una API nueva
registerDomain recibe domainId, roleId, scope y datasetSpec. Genera un policyId
estable separado del rol. Los registros genéricos de evaluación se vinculan a
esa política; las fichas y overlays enviados al agente siguen identificando el
rol verdadero. Las autorizaciones de promoción/reversión se dirigen a la
política exacta, no se hereda una concesión al rol legacy.

El registro exige un ámbito completo, targets explícitos y ausencia de otra
política para el mismo rol/ámbito con targets solapados. Resolver selecciona
como máximo una política exactamente coincidente; nunca por cercanía, nombre,
orden de inscripción o nota. Un registro corrupto no se ignora para escoger otro.
Los dominios evaluation-only siguen sin activarse. Las exclusiones actuales de
rutas adaptativas permanecen: múltiples registros no cualifican esas rutas.

Conductor y configuración histórica conservan policyId y rol real cuando usan
un dominio. La observación exige un target completado compatible para dominios
nuevos; una configuración de modelo supuesta no equivale a ejecución observada.
No se copian ensayos fallidos/SIM a la instalación como oportunidades reales.

## Compatibilidad y pruebas previstas

La primera inscripción de dominio opta por protocolo11 en su transacción; no
reescribe registros antiguos. El ejecutor50a real debe rechazar apertura y
escritura sobre11 antes de efectos. Una base sólo legacy sigue con su piso
anterior. Mecanismos de fuentes, archivos, budgets y transporte reconocen el
nuevo piso únicamente en el ejecutor que entiende dominios.

Pruebas: dos ámbitos/mismo rol, disjunción de targets, solapamientos/IDs,
promoción/reversión por política sin contaminación, prefijos de productor y
evaluador exactos, snapshots viejos inmutables, permisos del dominio equivocado,
evaluation-only, corrupción, observación y exclusiones adaptativas conservadas.
Se requiere regresión completa y prueba con paquetes antiguos/copia histórica
antes de instalación. No registrar dominios ni reiniciar0ec8 en este cambio.
Esta capacidad no demuestra mejora del modelo ni completa por sí sola R11.

## Resultado del primer corte y continuación

14septiembre22:11UTC:4456 quedó cualificado como componente mediante96pruebas
dirigidas, regresiónsuite-p1Ta1T2122/2121PASS/0FAIL/1SKIP y dos comprobaciones
con paquetes reales: rechazo de ejecutor50a sobre protocolo11(qyTNIO) y copia
del historial instalado0ec8→4456→0ec8 conservando protocolo2(W6UYfG). Todos
cerrados y auditados; no instalado ni promoción real de instrucciones.
El historial de negativos y alcances queda en verification/STATUS.md.

Siguiente comprobación, antes de editar exportActive: dos políticas con el mismo
overlay/version comparten ahora nombre de directorio. Una exportación nueva debe
separar políticas mediante identidad estable y mostrar rol real, dominio, política
y ámbito. Debe mantener permisos exactos, CAS, exportación sólo de promociones,
raíz privada y archivos antiguos sin sobrescribir. La relectura idempotente de
una exportación histórica conserva su formato; nuevos archivos por dominio no
deben heredar permisos ni instrucciones de otro. Esta corrección se prueba con
fixtures declaradas SIM, no mediante una promoción operacional inventada.

22:12UTC, resultado que corrige la hipótesis anterior: la prueba de dos overlays
idénticos SÍ obtiene rutas separadas antes de cualquier cambio; instructionHash
ya incluye la política. No se cambia esa ruta ni se atribuye un fallo inexistente.
El fallo real1test/0PASS/1FAIL es la cabecera que identifica al agente con el
policyId y omite dominio/ámbito. Corrección limitada a nuevas exportaciones:
rol real, dominio/política, dataset/ámbito/targets evaluados y metadatos enlazados.
Formato histórico sin etiqueta permanece idempotente, sin reescrituras.
