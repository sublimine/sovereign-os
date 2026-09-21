# Entrega exacta y evidencia en canales separados

14septiembre2026. Diseño correctivo tras un fallo real, no una promoción.

LIVEmWI9Fs devolvió blocked tras leer el archivo: el mandato requería JSON sin
campos extra, pero las instrucciones del productor exigían citas y justificación
dentro de body. La descripción heredada de claims reforzaba esa obligación,
aunque este recorrido sólo admite claims:[]. No fue timeout, falta de archivo,
fallo del callback ni resultado matemático erróneo: no hubo cálculo entregado.
El ensayo queda rechazado operacionalmente, con22.870tokens y un turno completo.

Corrección propuesta: selección explícita al crear la misión
boundedReadPresentation:'separate-evidence-v1', sólo con bounded-read-response-v1.
El cuerpo entregado satisface todos los campos, caracteres y restricciones del
mandato. El registro ya conserva solicitud íntegra, entrada original, observaciones
firmadas y propuesta; el juez separado conserva sus citas y justificación pública
en los checks de revisión. No se inventa un segundo campo de evidencia sin consumidor,
se exige una prueba al propio productor ni se confunde método breve con prueba.

Si el usuario pide citas, pasos o explicación, siguen siendo parte obligatoria
del cuerpo. La separación no permite omitirlos, inventar premisas, usar hechos
externos sin fuentes, saltar planificación obligatoria ni aceptar por esquema.
El juez recalcula y explica en su revisión, comprueba el formato contra el mandato
completo y, si se leyó archivo, cita su propia lectura posterior del mismo contenido.
No crea ni altera el candidato para arreglarlo.

Compatibilidad: modo viejo sin selección conserva exactamente contrato, node,
hash, esquema y prefijos antiguos. El nuevo modifica únicamente la instrucción
de presentación del nodo y el esquema contextual del productor, no los siete
criterios, herramientas, presupuesto, alcance, límite de entrada ni juez. El
contrato y su hash incluyen esa instrucción distinta y la política inmutable;
misiones existentes no se retroadaptan. Piso9 en la misma transacción de creación
impide que un runtime antiguo interprete la selección como vieja semántica.
Rechazo de política inválida antes de crear trabajo; rollback de creación fallida.

Pruebas previas a promoción: igualdad byte a byte del contrato viejo con34f1053b;
selección/downgrade/manipulación y rollback; esquemas de productor ordinario y
nativo sin la obligación contradictoria; juez conserva fichas, criterios, citas y
relectura; cuerpo exacto admitido con prueba de revisión separada; caso sin lectura
no recibe el adjunto; cláusulas de explicación solicitadas siguen presentes.
Una prueba estructural SIM no demuestra que el modelo siga la nueva instrucción.
Regresión global, compatibilidad en copia y un futuro ensayo real prerregistrado
siguen siendo necesarios. No repetir mWI9Fs ni cambiar sus seis inputs congelados.

Desarrollo16:56UTC: selección, contratos, schemas contextuales y piso9 ya están
implementados. Quince tests nuevos; hash exacto del contrato/nodo/binding/schema
no seleccionado coincide con34f1053b. Inicial15/1PASS/14FAIL conservado, de los
cuales tres eran rechazo previoSCHEMA frente al nuevo códigoPOLICY. Dirigido
inicial192/188PASS/4FAIL: errores del fixture tras productos aceptados, no cuatro
fallos de entrega (serialización de callbacks y acceso a review.checks en vez de
review.result.checks). Corregidos sin relajar el controlador.
Dirigido final294PASS/ceroFAIL,31074.89487ms. Sin LIVE del nuevo contrato aún.
Paquetec989e75b11fdf9e708b7ee0b11e9dacb535f8ed7a2c95dba25fb5e7f34b571db,
439archivos/24.317.563bytes; globalZzKrIb/44994 cerrado16:58:22.128 y auditado
16:58:39.497:1980tests/1979PASS/0FAIL/1SKIP,350pins/cuatrostreams/owners ausentes.
NOTe9H: runtime34f1053b rechaza9 al abrir/escribir desde conexión previa;
5joak0:97registros antiguos y aceptación exacta conservados en copia con piso9,
cero modelos/efectos nuevos y original intacto. Auditorías16:59UTC.
SIMqPA3vZ completo y auditado. LIVEVj7vZz/98901 cerró17:06:54.116 y se auditó
17:08:32.114:350+6pins,31archivos de cierre,26usos de citas, cuatro proveedores
y owner ausentes. Dos casos conocidos correctos tras lectura completa de los
contratos/contextos/respuestas públicos y comprobación independiente: nueve
fracciones exactas y literal NFD de26bytes sin leer el adjunto prohibido.
Cuatro turnos/5unidades/una continuación/68.833tokens conocidos. Se acepta este
alcance operacional, no eficiencia, generalización, instalación ni mandato global.
[Disposición completa](../verification/runs/presentation-operational-Vj7vZz/semantic-disposition.json).
