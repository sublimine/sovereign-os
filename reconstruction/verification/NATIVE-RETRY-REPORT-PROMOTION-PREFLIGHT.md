# Promoción condicionada del informe de retries

14 septiembre2026. Corrección de visibilidad, sin alterar recibos, inferencias,
motor, presupuesto ni protocolos. Instalado3305fe61; candidato
244d749e5b151f0a476a9baddb06ea8eb3769311757e1e3f7cc30ecacf31fba7.
Mismo inventario435 archivos, sólo factory/lib/report.mjs debe diferir.

Condiciones antes de cualquier cambio instalado:

1. GlobalzUEZhV/62604 cerrado sin fallo/interrupción,339inputs y cuatro streams
   exactos, ambos owners observados ausentes. No interpretar progreso como PASS.
2. qualify-native-retry-report.mjs debe terminar sobre paquete congelado y
   cuatro DBs cerradas7Q6DCK en read-only. Todo campo anterior del informe idéntico;
   contadores conocidos49491/48555/51758/49763 conservados; retries0/0/0/1,
   actorB-baseline y secuencia86 exactos. CoberturaNOT_ESTABLISHED, sin imputación.
3. Auditoría posterior: owner ausente, DBs/journals/versiones intactos y hashes
   de qualification/summary/audit/semantic-disposition históricos conservados.
   El resultado5a5e no se vuelve a juzgar ni se recrea su ejecución.
4. Preflight actual de la cola instalada, gestor canónico y único holder. Sólo
   misión históricaCOMPLETED sin efectos. Si hay trabajo nuevo/activo, parar este
   procedimiento y reconciliarlo, no interrumpirlo por conveniencia.
5. Parada controlada y cierre de todos los holders; backupSQLite privado
   coherente, historial/material heads intactos antes de cambiar punteros.
6. Reutilizar capture/backup/audit-native-retry-report-*.mjs: sólo IDs y puerta de
   esta cualificación sustituyen a los scripts anteriores. Paquete verificado,
   sólo referencias de release en wrapper/unidad, systemd verify, reload y start.
7. Auditoría final: registros y journal anteriores preservados, sólo release/
   acquire de ownership añadidos, mismo mandato/cola/final histórico,protocol2,
   cero misiones/inferencias/efectos nuevos. Capturar reporteJSON completo: la
   interfaz puede truncarlo aunque el comando termine0; no usar captura parcial.

No hace falta otra inferencia para validar la proyección de datos ya registrados.
No repetir la suite o probe para mejorar un resultado semántico/coste. Ante fallo,
conservar pruebas/backup; nunca restaurar sobre trabajo posterior. No API, cuotas
reiniciadas, sudo, red, GitHub o servicios adicionales. La muestra del proceso
nuevo reinicia el segmento observado, no añade uptime al previo. R01–R16 abiertos.
