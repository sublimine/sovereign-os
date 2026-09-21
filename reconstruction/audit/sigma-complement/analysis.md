# Auditoría semántica Σ20–40

Estado: charters y dossiers vigentes de los 21 puestos leídos y analizados. No aprobación de arquitectura, cardinalidad, implementación ni rendimiento. Baseline del mandato: `987c9b54a5676ea21e38ad631ac570466f252eec`. Históricos parcialmente inventariados, no comparados semánticamente. Σ01–19 corresponde al otro auditor.

## Cobertura y trazabilidad

`sources.json` contiene los 42 documentos vigentes, siete fuentes contextuales completas y 42 referencias auxiliares/históricas no declaradas como lectura íntegra. Base literal: `docs/sigma/agents/v3/sigma-20-dossier.md` y su charter. Cada otro documento fue reconstruido byte a byte desde esa base mediante sustituciones literales con todas sus posiciones y bloques residuales íntegros. Se comprobaron igualdad final y SHA-256; se releyeron los fragmentos truncados. Las posiciones y hashes no sustituyeron lectura: documentan qué texto ya leído se comparte y qué cambios se leyeron literalmente. `read-lossless.mjs` preserva diferencias de capitalización y todos los residuales. Derivar candidatos de spelling no normaliza igualdad de fuentes.

`roles.json` contiene una ficha por puesto con métodos, contratos, fronteras, gates, FMEA, contexto, lifecycle y un comentario individual. Tres pruebas propuestas por rol —63 en total— no son pruebas ejecutadas. El contenido doctrinal se conserva para no reducir funciones diferentes a una etiqueta. `individual-notes.mjs` separa interpretación del auditor de transcripción documental; `build-audit.mjs` ensambla esa evidencia, no inventa métodos.

Se leyeron completas la constitución y arquitectura Σ, interfaces Σ/Π, constitución Ω y mandato/protocolo. Los JSON machine-readable se usaron para localizar candidatos de sustitución, no se certifica lectura íntegra ni concordancia de todos sus campos. Tampoco se certifican schemas, runtime ni histórico. Esta auditoría no reutilizó el prototipo retirado.

## Capacidades que no deben perderse

Las referencias siguientes remiten al dossier `docs/sigma/agents/v3/sigma-NN-dossier.md`, especialmente §§1–5,11–16, y al charter homólogo `config/sigma/v3/charters/`.

| Puesto | Diferencia sustantiva | Qué no debe absorber |
|---|---|---|
| Σ20 | Grafo con soporte por edge, tiempo y sensibilidad a missingness | Identidad Σ18, significado Σ22, intención Σ25 |
| Σ21 | Constructo, denominador, comparabilidad y propagación de error | Causalidad o legitimación de premisas falsas |
| Σ22 | Evolución de ontología con raw terms y regresión semántica | Inventar relaciones/identidades de instancia |
| Σ23 | Ambigüedad lingüística/cultural, traducciones ciegas | Atribución de intención o verdad por fluidez |
| Σ24 | Fusión claim×evidencia con dependencia y disenso | Voto de verdad, estimación o eliminación de alternativas |
| Σ25 | Capacidad desplegable, intención y restricciones separadas | Psicología especulativa, acción inferida desde medios |
| Σ26 | Fronteras, stocks/flows, delays y regímenes | Diagrama confundido con identificación causal |
| Σ27 | Estimand, DAGs rivales, identificación y transporte | Correlación/reproducibilidad como causa |
| Σ28 | Hipótesis rivales/nula y discriminantes | Scorecard de confirmación o commit de probabilidades |
| Σ29 | Control deliberado de observables y alternativas benignas | Sospecha como patrocinador identificado |
| Σ30 | Contaminación institucional, evidencia preservada y clean replay | Vigilancia/disciplinas no autorizadas, crítica silenciada |
| Σ31 | Baseline legítima, artefactos y multiplicidad | Outlier como causa, warning o engaño |
| Σ32 | Pronóstico resoluble, base rate y registro previo | Frecuencia de simulación como probabilidad |
| Σ33 | Umbral, ventana, freshness, spoofing y ACK | Forecast como alerta o entrega como uso |
| Σ34 | Ruptura de supuestos compartidos y dominios adyacentes | Fantasía o probabilidad de cola arbitraria |
| Σ35 | Apertura con ventana, capacidades, competencia y validación | Estrategia elegida o capital comprometido |
| Σ36 | Disenso material visible y resolución sin voto | Falso equilibrio, minoría automáticamente verdadera |
| Σ37 | Producto por claim ledger con compresión fiel y recall | Autoría como permiso de difusión o certificación final |
| Σ38 | Auditoría de tradecraft aun cuando se acierte por suerte | Coautoría, verdad soberana, utilidad o auditoría externa |
| Σ39 | Checkpoint semántico, efectos pendientes e invalidación | Transcript como verdad o replay irreversible ciego |
| Σ40 | Utilidad ex post con atribución y cambio controlado | Resultado bueno como método bueno o autopromoción |

Esta tabla no prescribe una sesión por fila. El motor de grafos, la persistencia, estadísticas, búsqueda, renderizado y validadores pueden compartirse. La aceptación material independiente no se comparte con su productor bajo la misma identidad/contexto sin salvaguardas verificables.

## Orden causal y gates distintos

La constitución Σ separa inteligencia candidata de aceptación soberana Ω. El flujo no es «40 pasos para toda petición». Identidad/tiempo/semántica y source-dependency sustentan el objeto que el análisis consume; sólo las capacidades que afectan al caso necesitan activarse. Ejemplo: Σ18/19/22 aportan versiones a Σ20; un cambio de identidad puede invalidar centralidad y luego intención Σ25. Una traducción Σ23 distinta puede alterar un claim, sin que ello autorice modificar ontología o acusar engaño.

Admisión técnica de input, trazabilidad, verificación factual, evaluación de inferencia, aceptación de producto y autoridad de publicación son predicados diferentes. Un hash válido no demuestra que una cita implique un claim; una fuente independiente no demuestra identificación causal; reproducir un cálculo no legitima su denominador; una explicación plausible no demuestra causalidad; una revisión de estilo no certifica producto.

Los estados internos de §6 permiten avanzar cuando el output es schema-valid. Esto es admisible para operaciones internas provisionales, no para entregar como fundamento aceptado un producto material sin revisión. R07 del mandato requiere aceptación antes de cada consumidor dependiente. La revisión final Σ38/Ω22 no remedia haber construido diez inferencias sobre una premisa rechazada. Se puede explorar sobre provisional si cada descendiente conserva ese estado y no se presenta como conocimiento validado.

Σ24 debe conservar contradicciones con owner, no forzar su resolución para publicar un parcial. Σ28 discrimina hipótesis; Σ36 protege desacuerdo; ninguno adjudica hechos por mayoría. Σ32 produce forecast; Σ33 activa warning por reglas y ventana; Σ34 busca puntos ciegos que esas reglas no cubren. Σ35 valora una apertura; Ω17/20 conservan decisión/capital.

Σ37 §§3,4,10 aclara publicación bajo lease y difusión sensible con aprobación externa explícita; M9 exige aprobación de calidad/release distinta del autor. La facultad de seleccionar producto no habilita autocertificación ni destinatarios nuevos. Σ38 es control interno; Ω22 final institucional y auditor humano externo no son intercambiables.

## Desajustes verificables que requieren resolución

1. **Destinatarios Ω/Σ equivocados.** Σ26 §3 atribuye impactos a Σ18, que es identidad; parece Ω18. Σ34 §3 atribuye riesgo existencial a Σ19, que es cronología; parece Ω19. Son propuestas de corrección, no cambios ya aplicados.
2. **Gates citados pero ausentes.** Σ24 C3 §16 usa `INDEPENDENCE`, no listado en §11. Σ39 C2 usa `VERSION_LINKAGE`, no listado allí. Resolver referencia exacta o añadir gate necesario con propietario; no contar caso como ejecutable.
3. **Productores inconsistentes.** `EstimateRecords` en Σ33/36/37 §5 atribuye Data/Research/especialista mientras Σ32 conserva ownership. Σ24 `DissentRecords` genérico frente custodio Σ36. Un especialista puede aportar cálculo, no adjudicarse el commit canónico sin contrato explícito.
4. **Dependencias universales excesivas.** EstimateRecords obligatorio para todo producto/disenso fuerza pronóstico aun cuando no procede. BaselineModels, política de warning, decision window, clasificación y constraints aparecen opcionales en lugares donde pueden ser semánticamente obligatorios. Reemplazar opcionalidad incondicional por condiciones del tipo de producto; no fabricar input para pasar schema.
5. **Umbrales que no prueban su gate.** Σ25 DECISION_UNIT usa precisión/errores; Σ27 CAUSAL_QUERY/IDENTIFIABILITY/DESIGN_VALIDITY usan reproducción; Σ36 RESOLUTION_PLAN usa precisión; Σ38 METHOD_SUITABILITY usa reproducción y CALIBRATION precisión; Σ39 LEASE_EXPIRY usa TTL de claims. Se conservan checks útiles pero hacen falta predicados del objeto propio.
6. **Autoridad propia y límites.** Σ38/39 MODIFY_POLICY=C no puede interpretarse como cambio silencioso contra sus fronteras; Σ40 explícitamente X. ISSUE_ALERT=P de Σ20 no lo convierte en propietario de WarningNotice, prohibido por su frontera. Distinguir alerta operativa y warning analítico.
7. **Autorrevisión y recursión.** Σ38 gates nombran sigma_38, y NO_SELF_CERTIFICATION sigma_38_or_omega. El texto califica esos PASS como self-check. Una instancia distinta con contexto limpio o un owner Ω competente debe cerrar la aceptación; de lo contrario se autocertifica o genera cadena infinita de jueces.
8. **FMEA por rotación.** Cambios de variables/falsificadores desplazan asociaciones entre fault/método/gate. Se leyó cada cambio, pero recomputar una variable cualquiera no demuestra contener el fault cuyo nombre encabeza el bloque. Cada caso requiere ataque causal y oracle ajeno al productor, no sólo etiqueta `DETECT_CONTAIN_ROOT_RECOVER`.

## Ciclos útiles versus bloqueos

Σ24↔Σ28↔Σ36 es un ciclo de evidencia/hypothesis/disenso legítimo si congela versiones y exige nueva evidencia o método distinto para reentrada. No es legítimo repetir hasta consenso. Σ38→productor→Σ38 necesita retorno con defecto raíz y reviewer no coautor, presupuesto reservado y límite de reintentos. Σ39 coordina invalidación, pero owners recalculan: no debe editar juicios ni convertirse en scheduler Σ02.

Σ32 scoring sucede tras resolución futura, no como requisito de entrega de forecast hoy. Σ33 watch puede seguir activo tras terminar un aviso; Σ39 conserva próxima activación y estado. Σ40 puede diferir revisión sin desenlace observable. Confundir estas obligaciones persistentes con COMPLETE inmediato falsea continuidad; esperar eternamente también bloquea una entrega válida.

Ω/Π/Σ pueden entrar en ciclo cuando una capacidad pide output del mismo proceso que espera su aprobación. La salida es separar artefacto candidato, admisión, revisión y aceptación por versiones, no quitar un control para desatascar. IMPERIUM necesita bootstrap de autoridad antes de análisis; no esperar la última etapa para crear el lease que todos exigieron. Los paquetes de datos no transfieren autoridad de actuador.

## Cruce con departamentos auditados

VERITAS comparte atomicidad, procedencia, dependencia y falsificación con Σ14–24, pero admisión operativa/fusión y aceptación factual deben quedar distinguibles. ADVERSUM comparte alternativas, diagnóstico contrario y ataques con Σ28–30/34; adversario externo y contaminación interna requieren alcances/permisos distintos. PRAXIS comparte medición/causalidad/simulación/escenarios con Σ21/26/27/32, sin convertir forecast o simulación en política seleccionada. TELOS comparte aceptación/experimentos/shadow/aprendizaje con Σ38/40; utilidad y calidad no se reducen a una puntuación. IMPERIUM comparte continuidad/contención con Σ30/39, sin que memoria obtenga autoridad de ejecutar efectos.

Las capacidades de revisión pueden ejecutar una misma infraestructura, pero sus predicados y pruebas deben mantenerse separados: factualidad, identificación, fidelidad de compresión, cumplimiento de requisitos y permiso de difusión. Consolidar infraestructura no implica consolidar responsabilidades ni aceptar automáticamente el resultado de otro gate.

## Pruebas prioritarias antes de adoptar arquitectura

- Retractar fuente o dividir identidad que sustenta varias ramas; exigir invalidación de todos los descendientes relevantes, no de ramas ajenas, y impedir consumo stale.
- Presentar fuentes independientes pero inferencia causal no identificada; debe pasar procedencia y fallar causalidad, demostrando separación de gates.
- Comparar routing adaptativo con invocación universal sobre lookup, contradicción, forecast y warning; medir falsos pases/omisiones, coste y latencia reales, no número de roles.
- Introducir coautoría/contexto contaminado en juez y probar reroute limpio; otro nombre o proveedor no demuestra independencia.
- Interrumpir entre intención de efecto y receipt, cambiar proveedor y reordenar evento tardío; no duplicar efecto ni asumir equivalencia del modelo.
- Comprimir producto con minoría material, retractarlo tras distribución y exigir ACK diferenciado de entrega, sin transformar recepción en consentimiento.
- Aprendizaje: congelar previsión y método antes de outcome, usar etiquetas independientes y cohortes comparables, preservar resultados negativos, experimento/shadow/rollback antes de promoción Ω24. Editar AGENTS.md no prueba mejora.

Todos son diseños de prueba, no éxitos demostrados. No se fijó cantidad final de procesos, sesiones o especialistas. La reconciliación global y la evidencia ejecutable siguen pendientes.
