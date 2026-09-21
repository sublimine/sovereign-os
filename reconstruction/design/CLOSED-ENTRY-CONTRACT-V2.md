# Contrato propio para entrada cerrada — implementado opt-in, sin promoción

13 septiembre 2026. Motivación: auditoría de `verification/FULL-ROUTE-spVGwI.md`.
El ensayo congelado terminó no cualificado a01:47:20.802; se preservan todos sus
inputs, misiones, resultados y runtime. La implementación posterior está sólo
en desarrollo: no cambia el preset instalado ni reinterpreta el historial v1.

## Problema concreto

La entrada v1 asigna omega_02/omega_23 sin planificación ni artefactos de entrada
aceptados. Ω23 exige esos artefactos para síntesis. El juez del plan documental
rechazó una asignación equivalente; un resultado numérico correcto en entrada
cerrada no autoriza una excepción tácita. El compilador permite seleccionar
facetas pertinentes, pero no registra una adaptación de ese prerrequisito.

No resolverlo cambiando la ficha original, eliminando el control, atribuyendo
pericia matemática al CEO o escribiendo un plan ficticio aceptado. Tampoco añadir
un plan LLM obligatorio a cada transformación sólo para satisfacer una ficha
que no debía haberse asignado. Hace falta una responsabilidad distinta cuyo
contrato admita explícitamente datos cerrados proporcionados por el usuario.

## Reutilización y elección

Reutilizar compilación de prefijos, registro de exposición, protocolo de entrada,
codec, límites, recibos y revisión independiente existentes. El contrato de
especialista autónomo actual requiere un plan aceptado: no se debe falsificar
esa procedencia para reutilizar su ruta. Compartir utilidades puras de compilación
cuando proceda, no la autorización de una clase de actor distinta.

Propuesta: `closed-response-production-v1`, contrato confiable del controlador,
no ficha original del catálogo ni especialista creado por el modelo. Cubre sólo
evaluar elegibilidad y producir una respuesta cerrada candidata. El contenido
empírico suministrado sigue atribuido al usuario; no se convierte en hecho
externamente verificado. Revisor omega_22 separado conserva todos los criterios
originales y no tiene que aceptar previamente su propia aceptación.

## Responsabilidad observable

- Entrada: intención original completa e inmutable, definiciones suministradas,
  contrato de elegibilidad, criterios previos y límites operativos.
- Método: identificar exactamente la transformación/derivación/composición;
  preservar todos sus requisitos; producir sólo cuando la petición íntegra es
  cerrada. La autocorrección es preliminar, nunca una aceptación independiente.
- Salida: la misma gramática `answer/body/reason` o `plan/body=""/reason`;
  ningún informe ficticio, proceso certificado, herramienta o excepción oculta.
- Falsificador: premisa material no suministrada, necesidad factual externa,
  efecto/archivo/revisión externa requerida, omisión de un requisito, cálculo
  incorrecto o formato incumplido. Devolver a planificación cuando la
  elegibilidad sea falsa o incierta; conservar un rechazo material real.
- Fin: candidato disponible para juicio separado, o derivación sin producto.
  El productor nunca marca la misión COMPLETED.

## Vinculación antes de inferir

El registro de contrato debe fijar versión, misión, nodo cerrado, modo productor,
hash de intención, hash del contrato de entrada y criterios, propósito y ausencia
de herramientas/artefactos/sources de entrada. La configuración de trabajador
conserva ese vínculo y el hash del prefijo completo; cada inferencia lo revalida
contra la misión y el contrato almacenado. No aceptar una bandera genérica que
permita a un productor normal eludir la selección de fichas o la planificación.

`roleIds:[]` necesita una discriminación explícita entre este contrato del
controlador y una carta autónoma respaldada por plan. El caso nuevo no debe
entrar accidentalmente en el validador actual de especialistas autónomos ni
servir como bypass para ellos. El campo no puede coexistir con fichas de catálogo,
una carta de plan o overlays aprendidos evaluados para otros prefijos.

La prohibición de herramientas debe verificarse también al conceder leases y
al admitir observaciones/productos, aunque la misión que luego derive al plan
tenga source.fetch o execution.run autorizados. El actor de entrada no hereda
esas facultades. El contexto incluye la petición completa, no una versión
abreviada elaborada por otro modelo.

## Compatibilidad y promoción

Introducir una versión de entrada opt-in distinta. No reinterpretar registros
v1, reutilizar sus hashes para v2 ni cambiar el significado de una misión ya
creada. Conservar lectura, resultados y deuda conocida de v1. Nuevos ensayos
v2 deben tener política/criterios/hashes fijados antes de inferir. No mover el
servicio instalado ni cambiar el preset adaptativo hasta decidir con evidencia.

El rol de origen debe aparecer explícito en informes/inspector, con responsabilidad
y procedencia del controlador; `[]` no significa productor inexistente o
especialista autónomo planificado. Las inferencias siguen siendo reales o
simuladas según sus recibos, nunca se clasifican como nativas deterministas por
tener un contrato fijo.

## Pruebas exigidas antes de promoción

1. Rechazo de misión/nodo/modo/propósito/versión/hash/criterios alterados; nada
   se envía al modelo ante incoherencia y no se reautoriza por cambiar el nombre.
2. Sin herramientas incluso si la misión tiene autoridad para una ruta posterior;
   sin herramientas ocultas, observaciones inventadas o autopromoción de artefactos.
3. Petición y criterios completos en el contexto, prefijo reproducible, recibo
   exacto, revisor separado, formatos existentes y candidatos incorrectos
   rechazables por oracle externo sin reescribir la decisión histórica.
4. Reentrada de resultado sin inferir ni operar otra vez; cuota, cancelación,
   pérdida de checkpoint y recuperación preservan intentos y consumo incierto.
5. Compatibilidad negativa: no sustituye especialistas de plan, réplica ciega,
   aprendizaje/promoción ni revisiones ordinarias. v1 queda intacta y distinguida.
6. Ensayos prospectivos nuevos: transformaciones con fidelidad no trivial,
   derivación formal, composición con restricciones, y necesidades externas
   que deban derivarse. No basta repetir el par conocido ni medir sólo tokens.

## Pendientes

Diagnóstico relacionado: las solicitudes reales de planificación de spVGwI
muestran que el directorio inicial conserva propósito pero no el requisito de
entrada aceptada de Ω23; el contrato íntegro sólo aparece tras el primer rechazo.
Evaluar un preflight de restricciones críticas con referencias a la ficha y
controles estructurales de entradas, antes de proponer una asignación. No asumir
que sólo añadir texto resuelve la selección; se necesita contraste prospectivo.
No tratar un plan aceptado como el artefacto factual maduro que exige esa ficha.
La ausencia de una incompatibilidad codificada nunca debe ser un certificado
de compatibilidad general, y las fichas originales permanecen completas.

## Implementación y verificación posterior al ensayo

`closed-entry-spec.mjs` conserva los criterios, esquema e instrucciones v1
exactos: hash contractual f3650cab63bba8302702ee9f2025fa2c127ff38425f583a6f587b2e2faec65bd,
igual al registrado en spVGwI. `closed-response-contract.mjs` añade la clase
`closed-response-production-v1`; sólo una misión `closed-response-v2` explícita
puede crear su registro del controlador, versión1, antes del primer actor.

WorkerService distingue catálogo, especialista planificado y contrato cerrado.
Revalida contrato completo/política/intención/propósito/nodo/criterios/prefijo
antes de inferir, prohíbe fuentes/planes/observaciones y leases del productor,
y no admite transferir un overlay aprendido al productor ni a la revisión v2.
El registro impide cambiar contexto o crear productos con otra clase, criterios
debilitados, claims externos, recibos o efectos. El informe muestra origen y
responsabilidad, método, falsificador, cierre, vínculo y prefijo; no lo llama
rol de catálogo, copia determinista o especialista autorizado por un plan.

Se mantienen las rutas v1 y planificada; adaptive-v1 **sigue seleccionando v1**.
La revisión material independiente mantiene Ω22 y los siete criterios originales.
La nueva clase no certifica pericia ni elegibilidad semántica por sí sola.

Pruebas de construcción: 68 pruebas de motor/compatibilidad previas PASS;
ocho escenarios v2 de integración y recuperación PASS. La batería ampliada
23/24 detectó un error del test al leer `.length` sobre ausencia de observaciones;
se corrigió el test, no se inventó una observación. La batería conjunta91/92
detectó otro error del fixture: intentaba introducir más de1MB por un parámetro
string que ya lo prohíbe, en vez de reproducir la fuente recuperada grande.
Se sustituyó por broker/HTTP simulado con bytes reales y recibo; **92/92 PASS**.
La prueba del rechazo de contexto no invoca proveedor, recorta datos ni aumenta
límites. Se añaden cobertura de hash v1 y no transferencia de overlays al juez;
la siguiente batería y regresión integral aún deben reconciliarse.

Evidencia posterior: 94 dirigidas PASS, sesión11344. Regresión oiZzgS cerrada
exit0, 02:09:29.931–02:13:01.966, **887 tests/886 PASS/cero fallos/un SKIP**,
211906.669ms. Los250 inputs, inventario, streams y67 archivos runtime coinciden
a **02:13:43.162**. ResumenSHA256
`f0b872a359ad0a26b1377ec07ee70c829ced2f42d6799a5bc11a6ab2f49a7283`.
Release local no instalada
`8966cef93151a3c36c75061a399468dfb802c8f8c94f06c1fdf42a73faa16caf`,
404archivos/23888222bytes. El núcleo de ventanas se añadió DESPUÉS y no se
atribuye a esa suite/release; requiere su regresión propia.

No hay ensayo real v2, mejora de calidad/coste medida ni promoción. Sigue
pendiente un conjunto prospectivo nuevo, junto a la exposición documental
acotada y el resto de obligaciones R01–R16.
