# Cobertura de uso tras retry nativo

14 septiembre2026. Hallazgo cerrado en el ensayo7Q6DCK, no un nuevo ensayo:
B-baseline call1 contiene worker.provider.retry por responseStreamDisconnected,
evento86 a12:56:33.816. Hubo salida parcial y después respuesta final con contador;
no contador separado atribuible al intento interrumpido. Su coste no se conoce.
Conservar la comparación5a5e rechazada y sus recibos/summary sin cambios.

El proveedor actual no suma actualizaciones acumuladas de tokenUsage; usa el
contador supplied total de su tarea efímera o last si falta total. Workers
registra provider.retry como evento público por runId, pero report sólo lo
deja en timeline. Su resumen providerUsage y los de fases contabilizan respuestas
con contador: no explicitan esa incertidumbre particular. El operador podría
interpretar cobertura de respuestas como cobertura de intentos upstream.

Reutilizar esos eventos y agregadores, sin otra biblioteca, provider, schema de
inferencia, floor o nueva llamada. Cambio sólo de reporte read-only:

- Número de notificaciones de retry pertenecientes a actores de esta misión,
  IDs de actores afectados y referencias a secuencias de evidencia existentes.
- Número correspondiente por fase para localizar el coste con cautela.
- Etiqueta explícita de cobertura de intentos interrumpidos NO ESTABLECIDA por
  contadores finales. Ausencia de notificación no demuestra ausencia de retries:
  no todos los adaptadores/históricos tienen esa telemetría.
- Texto humano correspondiente. No contar notificaciones como intentos
  ejecutados/completados, fallos nuevos, reservas de misión o llamadas nuevas.

Mantener exactamente sumas suministradas, ceros conocidos, contadores de
correcciones, cuotas, clasificaciónLIVE/SIM y recibos históricos. No sumar bytes
de output como tokens, estimar tarifas ni imputar la incertidumbre a un brazo
para cambiar el veredicto. No certificar alcance universal de un total nativo.

Pruebas previas: evento retry seguido de éxito con contador, varios eventos en
un actor sin duplicar inferencias, fases distintas, retry sin respuesta final,
evento ajeno excluido aunque alegue misión, cero notificaciones y reportes
históricos sin campo nuevo. SHA/journal/versiones idénticos tras report/format.
Prueba adicional read-only sobre los registros cerrados7Q6DCK, sin reapertura
del motor, cambios de su evidencia ni nuevas llamadas; verificar contador
numérico idéntico al anterior y exposición de secuencia86 en B-baseline.

Documentación oficial consultada antes del cambio: App Server explica
thread/tokenUsage/updated y responseStreamDisconnected; no establece aquí la
cobertura de un intento cortado. [Contrato oficial](https://learn.chatgpt.com/docs/app-server).
La conclusión es una incertidumbre de cobertura, no una afirmación de subcobro,
sobrecobro o pérdida efectiva de tokens. No editar el instalado3305fe61; cualificar
el nuevo snapshot por separado antes de cualquier futura promoción.
