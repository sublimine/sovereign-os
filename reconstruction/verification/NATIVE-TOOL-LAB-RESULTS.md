# Capacidad nativa observada; no promoción

LIVE1BuFGS/18823,14septiembre2026: inicio14:06:29.440, cierre14:06:57.354,
auditoría14:09:05.551. Una sola pareja, sin reintentos del harness.
[Contrato previo](../design/NATIVE-TOOL-LAB.md),
[auditoría](runs/native-nonce-live-1BuFGS/audit.json).

| Exposición | Respuesta pública | Callback | Tokens notificados |
|---|---|---|---|
| Namespace ordinario | UNAVAILABLE/null | Ninguno | 4.039 |
| Namespace directo explícito | OBSERVED/nonce exacto | Uno, completado | 7.301 |

Mismos GPT6Astra/ultra, petición, esquema y límites. El namespace directo
recibió el nonce sólo a través del callback14:06:50.589; evento de inicio
anterior, final de herramienta14:06:50.645 y final del agente14:06:57.332.
SHA de la respuesta igual al nonce creado en memoria fuera del prompt.
No se habilitaron entornos, shell, code_mode_host, red, MCP, plugins o apps.
El resultado respalda esta vía concreta de exposición en la versión instalada;
no prueba que explique todos los fallos antiguos ni todos los modelos.

El brazo directo notificó primero3.599 y finalmente7.301 tokens acumulados;
se conserva el último total, no la suma de notificaciones. Incluye3.456 tokens
de entrada cacheada. No comparar coste de completar con coste de no poder
ejecutar; no llamar ahorro a esta pareja ni identificar turnos RPC con
respuestas internas del modelo. Retry observado0/0, cobertura de intento
interrumpidoNOT_ESTABLISHED. No se leyó ni guardó razonamiento privado.

Diecinueve pruebas SIM pasan,392.999987ms. La primera ejecución18/17PASS/1FAIL
se conserva: el prototipo aceptaba un dynamicToolCall sólo en el resumen final
sin lifecycle previo. Corregido y ampliado con falsificación de observación
sin callback, sin cambiar el criterio. [Pruebas](experiments/native-nonce-directed-tests.json).

Once inputs congelados intactos. ManifestSHA
a314358d4892eab5d0ba5e1673517604229a565addbfdd1fe82b232ee05a9611;
summarySHA96f70ae9170a43589576bf5d102a5f2d19c0f8f900f9a3e0b4b4e045086dde34.
Owner2709509/start57873945 y proveedores2709531/start57873970,
2709927/start57875664 ausentes tras cierre observado. Todas las169versiones
y64heads de la instalación siguen idénticas, protocolo2, mismoPID2703657.

**No se instala el laboratorio.** Su recibo lleva
laboratory-inference-not-factory-evidence y no existe conexión al broker.
El adaptador es una copia diagnóstica delimitada, no código de producción
promovido ni un permiso nuevo. Para una lectura real siguen pendientes contrato
de exposición incremental, reserva de continuación, permisos del broker,
recuperación, rechazo de repeticiones y revisión propia posterior al candidato.
El núcleo244d749e y el mandatoR01–R16 siguen como estaban.
