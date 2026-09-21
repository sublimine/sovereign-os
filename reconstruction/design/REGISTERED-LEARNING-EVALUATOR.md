# Ejecución explícita del evaluador registrado

Diseño previo a implementación, 14 septiembre 2026. Componente de R11/R16,
no acreditación de mejora general ni autorización para activar instrucciones.

## Hueco observado

`LearningService.evaluate` necesita un callback de confianza. `evaluatorId` en
el dataset sólo es una identidad congelada, no un módulo ejecutable. El motor y
la CLI aún no conectan ambos: `learn-propose` termina en PROPOSED. El evaluador
de suscripción existente ya conserva petición exacta, recibos, cierre y fallos;
se reutiliza, no se sustituye por otra integración o una API.

## Contrato

- Registro cerrado de implementaciones mantenidas, no importación de rutas,
  código del modelo ni resolución aproximada de nombres.
- Primer contrato `exact-json-value-v1`: compara el valor JSON completo contra
  `case.expected` por serialización canónica. Ignora sólo orden de claves de
  objetos; conserva tipos, orden de arrays, espacios y Unicode de strings.
  No tolerancias, normalización de contenido, matching parcial ni metadatos
  escondidos dentro de expected. Métrica única `exactMatch`, higher, umbral 1.
- El validador de transporte comprueba únicamente datos JSON canónicos; no
  consulta expected ni envía feedback de corrección al agente. El esquema
  congelado sigue enviado literalmente como restricción de generación. Este
  evaluador no es un validador general de JSON Schema: el propietario del dataset
  debe justificar la verdad y adecuación del expected y del esquema. Igualdad
  no acredita semántica, procedencia externa ni representatividad del dataset.
- Preflight completo de todos los casos antes de adquirir el coordinador o
  consumir una comparación. Dataset, IDs, hashes, métricas e implementación
  reconocida. Incompatibilidad conserva PROPOSED sin dispatch ni escrituras.
- `learn-evaluators` muestra compatibilidad y máximo de llamadas de una pareja
  por caso (sin llamarlo estimación de tokens ni prueba de calidad). No devuelve
  expected, entradas privadas ni ejemplos holdout.
- `learn-evaluate CICLO` sólo compara una propuesta ya guardada. No diagnostica,
  no propone, no promueve, no exporta ni cambia política. El comando previo
  learn-propose mantiene su alcance. El modelo/razonamiento de cada caso se
  conserva, sin override por flags del comando.
- Reingresar en evaluación incompleta la reconcilia como interrumpida, sin
  repetir; evaluación completa se reconcilia con su binding; terminal no se
  vuelve a ejecutar. Señal cancelada no crea llamada. Exclusión de propietario
  permanece en LearningConductor. Verificar estado también bajo esa exclusión.
- Reutilizar SubscriptionCaseEvaluator y las firmas originales. Implementación
  versionada en ID; frozen dataset incluye ese ID. No alterar implementación
  del ID después de cerrar su contrato; un cambio semántico exige otro ID.
- Simulación sólo por inyección explícita del test, imposible de activar por
  flags de la CLI. Pruebas SIM no acreditan aprendizaje real.

## Pruebas de aceptación del componente

Comparación correcta y fallida, no mejora, regresión holdout; aislamiento de
expected y tipo/orden/Unicode; evaluator desconocido, ruta maliciosa y criterio
incompatible rechazados antes de gastar; caso/dataset alterado; rechazo SIM
predeterminado; estado OBSERVED/PROPOSING sin propuesta accidental; exclusión,
cancelación, persistencia y reentrada sin replay; CLI real sobre estado privado
y proveedor SIM explícito de pruebas. Paquete y regresión global antes de dar
este componente por integrado. Ningún dominio operativo se crea ni instala aquí.
