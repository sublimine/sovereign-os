# Corrección del preflight sobre una base vacía

14 septiembre2026,23:43UTC. El candidatoc4513808 pasó sus30pruebas de
registro, selección124PASS, paquetevxHQQK (sieteCLI) y globalqdB6Bw
2201tests/2200PASS/0FAIL/1SKIP. Esa cobertura no incluía una base Store
existente pero todavía sin Authority; no es elegible para instalación sin
corregir el defecto que se observó después.

Proberegistration-empty-probe-g3nQ8b sobre el paquete inmutable: rechazar el
manifiesto{} cambió protocolo1→2, diario0→1, y añadió authority-key. No es un
permiso emitido al modelo ni una base del usuario modificada: se inicializó la
identidad local en una base vacía privada antes de validar. Tres tests nuevos
fallan por la misma causa para JSON roto, manifiesto incompleto y evaluador
incompatible. Se conservan los fallos y la regresión antigua sin reetiquetarla.

La corrección separa preparación y commit. Captura/parseo y validación completa
con LearningService en memoria ocurren antes de construir FactoryEngine.
Sólo la closure privada resultante puede registrar en el servicio destino;
registra de nuevo dentro de la transacción real y verifica el binding exacto.
No vuelve a leer el archivo ni expone datos privados en su respuesta. La función
SDK registerLearningDomain conserva la misma operación componiendo ambas fases.

Pruebas nuevas comprueban protocolo, diario, todos los registros y entradas
del directorio intactos; no sólo que falte learning-domain. Necesita nueva
regresión y cualificación empaquetada antes de considerar cerrado el componente.
No modifica el paquetec451 ni el resultado anterior, no inicia inferencias y
no cambia el servicio08498 instalado.
