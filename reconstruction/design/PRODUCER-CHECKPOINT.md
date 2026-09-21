# Checkpoint determinista de producción: propuesta pendiente

Actualización21:07: se implementó la alternativa menor y explícita
`PRODUCER-READ-TEST-BATCH.md`, sobre los lotes existentes. No integra este
compilador ni satisface su propuesta de checkpoint/reserva/reanudación. Permite
seleccionar lecturas concretas y una ejecución fijada sin repetir automáticamente
todos los archivos tras una reparación; mantiene los límites originales. Su
cualificación está separada, y no se presenta como ahorro causal ya demostrado.

13 septiembre 2026. Diseño de la siguiente reducción de coordinación, NO
implementado ni activado. El ensayo geTKWd continúa con su política congelada.
No se amplía retrospectivamente action=batch: su prohibición de ejecutar comandos
dependientes sigue vigente. No es permiso para instalar o repetir ese ensayo.

Actualización20:02: geTKWd ya está CERRADO/FAILED, no continúa ejecutándose.
La frase inicial describe la preparación histórica. Hay un compilador PURO
experimental separado en verification/experiments/producer-checkpoint-contract.mjs:
20testsPASS230.270657ms. Sólo calcula propuesta/ámbito/hash/presupuesto; ningún
worker lo importa y no despacha, observa, reserva ni recupera operaciones.
Perfil de llamadas reales en DEVELOPMENT-COORDINATION-PROFILE.md. El coste de
12operaciones existente impide repetir dos checkpoints completos sin presupuesto
adicional: la v1 debe rechazar esa segunda propuesta, no aumentar el límite.

## Problema observado, no ahorro supuesto

En geTKWd, las llamadas reales 4–6 produjeron tres archivos, pidieron leerlos y
pidieron ejecutar la orden de tests ya fijada en el plan. Después de reparar
el test, las llamadas 7–9 volvieron a separar escritura, lectura y orden. Cada
paso reenvía contexto al modelo antes de proponer otra operación cuyos argumentos
ya se conocen. La revisión independiente realiza sus lecturas y ejecución de
forma determinista; no necesita una inferencia para elegir cada ruta de archivo.

Esto permite formular una hipótesis de reducción de llamadas de coordinación,
NO calcular tokens ahorrados restando turnos históricos. Cambiar el protocolo
cambia los contextos siguientes y quizá el comportamiento. La reparación de la
barrera de38casos requirió juicio y no debe eliminarse como si fuera ceremonia.
La primera ejecución y la versión corregida deben seguir siendo distintas.

## Responsabilidades y orden propuestos

1. El plan aceptado congela rutas de archivo, orden argv/cwd, permisos y criterio
   de salida. Un requisito de ejecución no equivale a autorización nueva.
2. El productor genera o repara los archivos mediante el broker normal. Una
   escritura observada sigue sin demostrar lectura, ejecución o calidad.
3. Un opt-in explícito permite que el productor solicite UN checkpoint de sus
   obligaciones declaradas. El controlador propone cero criterios o comandos
   adicionales: lista el ámbito, lee las rutas completas y ejecuta cada orden
   permitida en una instantánea desechable. Todos los efectos son individuales,
   autorizados, presupuestados y conservados; la secuencia no es transaccional.
4. El productor recibe íntegros los recibos, bytes leídos, manifiesto, estado
   de arranque y salida real. Decide reparar, bloquearse con causa o emitir
   candidato. El controlador no escribe una conclusión semántica en su nombre.
5. Un revisor separado repite sus propias lecturas/ejecuciones después del
   candidato. Nunca hereda el checkpoint del productor como prueba propia.

El ahorro potencial está entre operaciones ya determinadas, no entre datos y
verificación ni entre producción y aceptación. La verificación sucede después
de observar los archivos; la planificación sólo comprueba que el futuro orden
de evidencia es posible y preserva el mandato.

## Fronteras necesarias antes de implementación

- Política versionada opt-in, ligada a misión/worker-config/solicitud. Los
  escenarios sin archivos o comandos siguen sin ejecutar nada. Sin activar
  opciones al reanudar misiones antiguas, cambiar modelo o rebajar razonamiento.
- Validar todas las obligaciones, permisos, presupuesto y argumentos antes del
  primer efecto. No placeholders, shell, paquetes, red o comandos deducidos de
  texto libre. No ordenar operaciones del productor fuera de node.tools.
- El productor señala la base observada de sus archivos mediante recibos propios;
  no inventa hashes. Antes de ejecutar, las lecturas actuales y el manifiesto
  deben coincidir en las rutas pertinentes. Cambios externos o de versión no
  se convierten en evidencia del candidato anterior.
- Registrar solicitud pública de checkpoint/cursor/operación antes del efecto.
  Reapertura no vuelve a ejecutar una orden ya cerrada; un efecto incierto se
  reconcilia o espera dirección. No crear IDs nuevos para repetir fallos.
- Contar CADA lectura/listado/ejecución en el presupuesto de herramientas,
  aunque no cueste una llamada de modelo. Reservar el conjunto requerido sin
  resetear contadores tras caída, nueva propuesta o recuperación.
- Detener la secuencia ante denegación/fallo de transporte/integridad. Conservar
  los éxitos parciales y la operación fallida. Exit distinto del requerido
  conserva su resultado real y vuelve a diagnóstico, nunca a aceptación.
- Si existe ejecución real pero falla la persistencia del cursor/recibo, no
  comprar otra inferencia ni ejecutar otra vez para conseguir un resultado.
- Ningún recibo entra en una exposición de inferencia pendiente; primero cerrar
  la inferencia que propuso el checkpoint, después registrar observaciones y
  emitir la siguiente solicitud con el hash actualizado.

## Cualificación necesaria

Primero pruebas de fronteras con fixtures declarados: política apagada, ausencia
de permisos, límite insuficiente, ruta/comando no congelado, archivo cambiado,
fallo del primer/segundo efecto, exit no cero, arranque ausente, recibo distinto,
revocación y aborto. Incluir caídas REALES entre reserva, efecto y commit,
recuperación sin replay y separación productor/revisor sobre la misma versión.
No tratar el proveedor simulado como comportamiento semántico real.

Después regresión completa, freeze y preregistro de un par con igual mandato,
modelo, criterios y límites; conservar ambos resultados aunque discrepen. Medir
llamadas, herramientas, uso observado, tiempos y corrección externa. Comparar
las obligaciones cumplidas y recuperaciones, no sólo un contador más pequeño.
No reusar geTKWd como brazo prospectivo del nuevo protocolo ni retocar su oracle.

La propuesta no resuelve por sí sola selección de roles/modelos, independencia
epistemológica, aprendizaje útil, Node/EPERM o EAGAIN. No cierra R01–R16.
