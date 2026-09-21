# Revisión de integración de FactoryEngine

Alcance: `factory/lib/engine.mjs` leído completo con WorkerService, PlanLedger, ArtifactRegistry y contratos de Store/broker pertinentes. Este informe distingue control determinista comprobado de calidad semántica del proveedor. No declara completitud de la fábrica ni sustituye el smoke real que ejecuta el responsable principal.

## Método

`tests/factory/engine.test.mjs` usa SQLite real sobre un directorio temporal, Authority real, ToolBroker real, ArtifactRegistry real y WorkerService real. Sólo el proveedor de inferencia y el transporte HTTP de fuente pública son simulados explícitamente. Cada respuesta simulada respeta el schema solicitado y devuelve recibo marcado `simulation:true`, hash del request exacto y thread/turn distintos. Las herramientas reciben autorización y generan sus recibos firmados reales; los ficheros se escriben y releen realmente. El atacante del caso de prueba stale cambia un fichero del directorio temporal de forma explícita; no es una acción atribuida al modelo.

No se editan estados de aceptación directamente en SQLite. Plan y productos atraviesan creación/revisión en registry y transitions del ledger. Los tests no convierten el texto PASS en evidencia de que un modelo real haya razonado correctamente.

## Casos

- Petición → plan candidato/revisión → escritura real → aceptación con lectura independiente → síntesis dependiente/revisión → COMPLETED. Reapertura SQLite no vuelve a inferir ni producir efectos para resultado todavía válido.
- Consulta factual breve: fuente adquirida por broker antes del claim factual y revisor recibe bytes; retracción posterior impide uso material. No activa estrategia por plantilla.
- Omisión de segundo requisito: revisor simulado detecta el defecto, agota intentos de planificación y deja NEEDS_DIRECTION sin producto ni efectos. Es prueba de respeto a una devolución, no demostración de detección semántica automática de toda omisión.
- RETURN del producto: conserva findings/criterios y entrega feedback al siguiente intento; sólo versión corregida aceptada permite cierre.
- Cuota/reapertura: conserva petición, hash y criterios; no reinterpreta espera como entrega parcial terminada.
- Cancelación: no genera artefacto final y no debe cambiar CANCELLED a FAILED al volver a consultar/ejecutar.
- `execution.run` sin runner acreditado: WAITING_CAPABILITY con recibo FAILED, sin certificación textual de pruebas ejecutadas.
- Cambio del fichero después de observación del revisor: prueba stale no puede cerrar COMPLETED.
- Cuota repetida: no debe consumir presupuesto de correcciones cognitivas.
- Efecto observado sin recibo durable: inyección explícita de fallo en `Store.put` al guardar SUCCEEDED después de una escritura real. El broker conserva DISPATCHED y, tras reabrir SQLite, engine mantiene NEEDS_DIRECTION/EFFECT_UNCERTAIN sin nueva inferencia ni nueva operación. No se altera el estado de aceptación para producir este caso.

## Defectos comunicados al responsable

1. `run()` lanzaba MISSION_CANCELLED dentro del catch general que lo traducía a FAILED; sobrescribía la misión cancelada. Se pidió conservar estado/rechazar sin mutación. Test añadido.
2. Cada QUOTA incrementaba `node.attempt`, que se usaba como presupuesto de métodos; cuotas repetidas acababan en METHODS_EXHAUSTED aunque no hubiera defecto cognitivo. Se pidió separar intentos técnicos de correcciones de calidad. Test añadido.
3. Obligaciones de efectos no estaban tipadas originalmente: permisos para escribir/ejecutar no prueban que el resultado solicitado se haya producido. Otro auditor está incorporando `requiredEffects` al contrato y la suite usa efectos de archivo/ejecución explícitos, no body como sustituto.
4. Prueba stale reproducida: después de que el revisor obtiene `workspace.read`, el fixture adversarial cambia físicamente el archivo durante la inferencia revisora. El JSON devuelve el recibo anterior exacto y el engine cerraba COMPLETED. Un recibo auténtico no acredita vigencia del estado externo: se requiere comprobación del fichero actual al aceptar/consumir o bloqueo por cambio. Comunicado al responsable y auditor de efectos; test negativo conservado.

## Límites importantes

El determinismo puede comprobar cita literal del mandato, cobertura de requisitos declarados, criterios exactos, trazas, independencia de identidad/contexto y validez de entrada; no puede por ello saber que un plan resumió exhaustivamente el significado de la petición. El revisor debe contrastar el original completo y el cierre necesita las obligaciones originales, no sólo una plantilla de plan que omita silenciosamente trabajo. La prueba negativa de omisión simula esa detección; no la atribuye a un modelo real.

La suscripción, latencia, cuotas, disponibilidad de modelos y separación real de sesiones necesitan smoke con proveedor real. El test usa recibos simulados declarados, nunca los presenta como evidencia de servicio externo.

## Resultado final observado

Comando: `/home/cardeex/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/factory/engine.test.mjs`.

Corrida completa después de las correcciones: **11 tests,11 pass,0 fail,0 skip**, duración5449ms. No es suma de ejecuciones parciales. El responsable corrigió persistencia de CANCELLED y presupuesto separado de fallos cognitivos; el auditor de WorkerService incorporó guardia de snapshot actual después de la última espera revisora y antes de aceptación. Ambos defectos originales se reprodujeron antes y ahora sus tests negativos pasan.

RequiredEffects evita que una autorización o un body que diga «creado» reemplacen una obligación de fichero/ejecución. La comprobación de snapshot es local al punto de validación, no promesa de que un actor externo nunca cambiará el archivo después. La reentrega futura debe invocar de nuevo ese control. El caso de reinicio completo comprueba ausencia de nuevas inferencias/efectos cuando las pruebas siguen vigentes; el caso crash-boundary conserva efecto incierto sin replay.

Estos11casos acreditan los caminos de control ensayados con proveedor simulado y efectos locales reales. No acreditan calidad semántica universal, funcionamiento de un runner ausente, lectura de Internet real ni superioridad respecto de otros sistemas.
