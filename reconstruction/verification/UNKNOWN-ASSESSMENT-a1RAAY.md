# Evaluación real del intento inconcluso histórico

12 septiembre 2026. **No cualificada:** se conservó y bloqueó una decisión
formalmente incompatible con su hallazgo material. No hubo apertura ni réplica
nueva. El fallo integrado rB9KdY tampoco cambia de resultado.

## Ejecución y lectura

Una copia SQLite exacta del journal 456/2c216328 de rB9KdY se evaluó bajo el
runtime congelado 6d7c033d. Una llamada real gpt-6-astra/ultra de
13:18:44.713 a 13:24:28.423 UTC; hilo 01a095c5-3929-7341-a557-f300c10bbfed.
36.841 tokens observados: 25.529 entrada y 11.312 salida, incluidos 8.286 de
razonamiento. El intento original no se volvió a calcular. Su sello dde79cc4
permanece idéntico, con resultado vacío, diez controles UNKNOWN y cuatro incógnitas.

El nuevo candidato exacto es artifact:1acb6ae4-1a44-4d7d-bb09-4bb95c52adb3,
hash 273160cac935ff1420688a3ce2f8edfcba7d73e245e9438ea4ac41822676f857.
Se leyeron íntegros los cinco checks, veinte citas, hallazgo, recuperación e
incertidumbre de la respuesta real. El juez distingue correctamente el registro
fiel del intento de la ejecución matemática no realizada. Reconoce la parada
exigida por el protocolo, sin inventar aritmética, prueba de admisión ni aceptación
previa. Sus referencias distinguen el orden real de sello/candidato/binding de
lo que el replicador podía observar cuando emitió la respuesta.

## Defecto observado y protección que funcionó

El juez emitió ACCEPT y cinco PASS, pero también un finding de severity=material
que atribuye a C01/C02/C09/C10 el defecto de ejecutabilidad aguas arriba. El
diagnóstico de ese defecto concuerda con A01. **La contradicción es con el contrato
del formato de revisión**, que no admite una categoría de hallazgo material no
bloqueante o atribuible a otro artefacto: cualquier hallazgo material prohíbe ACCEPT.
No se interpreta el fallo como incapacidad matemática ni como falsedad de todo
el análisis del juez.

ArtifactRegistry rechazó la combinación con FAILED_GATE antes de comprometer una
aprobación. La respuesta exacta se conserva en worker-rejected-review; su hash es
c2ac3f897685a36684896469d035452903b11c409e0ea67dde2c9b1c32af4f8a.
El candidato sigue CANDIDATE, el workflow NEEDS_RECONCILIATION, y el intento
INCONCLUSIVE. La misión no se reescribió. Una llamada, un sello, cero aperturas,
cero comparaciones y cero efectos; no se pidió otro voto para obtener aceptación.

[Reconciliación sólo en lectura](runs/unknown-assessment-live-a1RAAY/reconciled-assessment.json)
a las 13:28:49.624 UTC: base fuente intacta por fingerprints coherentes de eventos,
registros y heads; journal de la copia 540/50b479a1. Se conserva failure.json.
El primer fallo de preflight separado 5KXCJL tampoco se borra: ocurrió antes de
copiar la base o enviar una inferencia, por filas SQLite de prototipo nulo.

## Corrección futura y alcance

Se hace explícita la regla que ya impone el registro: si el juez conserva un
hallazgo material, incluso aguas arriba, debe devolver RETURN, sin rebajar su
severidad ni alterar checks para conseguir ACCEPT. Las razones deben distinguir
la responsabilidad del defecto de la fidelidad del candidato. No se añade una
excepción retroactiva ni se transforma el juicio guardado en RETURN o ACCEPT.
Una futura separación tipada de diagnósticos upstream necesitaría un contrato
versionado y evaluado, no omitir automáticamente un problema material.

Contraprueba simulada reproduce y conserva ACCEPT + material, y no permite otro
voto ni apertura al reentrar. La primera versión del fixture intentó leer una
respuesta expandida que superaba el límite de retención de 65.536 bytes; se usa
el codec de catálogo del caso real, manteniendo ese límite, sin ampliar capturas.
Prueba posterior PASS, 0,80 s. No prueba mejora estadística de jueces reales.
