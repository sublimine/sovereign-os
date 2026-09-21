# Integridad de versiones, heads y journal — 10 septiembre 2026

## Fallo reproducido antes de corregir

En una base **de prueba en memoria**, dos versiones válidas de `item:x` dejaban
el journal intacto. Cambiar por SQL su head de versión 2 a versión 1 no modificaba
los hashes de eventos o registros: `verifyJournal()` seguía devolviendo éxito y
`get()` entregaba el estado antiguo. No se manipuló ninguna base de producción.

Ocho tests nuevos ejecutados contra el código previo fallaron, todos por defectos
esperados de integridad/consistencia: head atrasado, head ausente, registro sin
evento, versión duplicada, padre incorrecto, hueco de versión, reapertura corrupta
y lectura mezclada con una escritura concurrente. El caso concurrente mostró dos
eventos en la misma auditoría que había comenzado con un solo evento.

## Corrección posterior a 87472cfc, todavía no instalada

`Store.verifyJournal` compara ahora tres representaciones en un snapshot SQLite:

- Cadena completa de eventos: secuencia, enlace anterior y hash.
- Cada historia de registro: versión inicial 1, incrementos exactos, padre
  exacto y un único evento por cada fila inmutable; ninguna fila huérfana.
- Heads: cobertura completa y referencia a la última versión comprometida,
  sin claves ausentes, sobrantes o atrasadas.

Las identidades son tuplas serializadas, no concatenaciones ambiguas. Respeta
una transacción existente y cierra/retrocede sólo el snapshot que abrió. No hace
reparación automática ni borra evidencia. Un constructor que rechaza el journal
cierra su conexión. El algoritmo recorre el historial una vez y mantiene un
mapa de la última versión por identidad; no añade revisiones al modelo ni efectos.

Las nueve pruebas nuevas y siete controles anteriores pasan (16/16); regresión
completa suite-oRTl57: 549 pruebas, 548 PASS, cero fallos, un SKIP live, 45,93 s.
El noveno caso cubre claves que colisionarían concatenadas y
conservación de una transacción externa. La suite previa que sólo verificaba la
cadena no acredita este cambio.

## Comprobación no mutante de bases reales

Se usó DatabaseSync con `readOnly:true` y el verificador nuevo, sin construir un
Store que cambiara PRAGMAs o permisos. Las cuatro pasan:

| Base | Eventos | Head |
|---|---:|---|
| Servicio ordinario | 408 | `4c44bfef4a95630266a2476aed7115c47d35b929c7170e8edbd96c9119b52945` |
| MztBjXHC | 342 | `3afa53fbe755e9d76a1c6f56ac2c0023e20556b6dd1030a8d4184aed2a0ee46a` |
| KS0 caso 0 | 47 | `a43e6c5c142351b26f77c57b3af208d028f920ce8f3d1578fcd7213e0f5375c7` |
| KS0 caso 1 | 41 | `edcfa18e1a40a5505f27ba794935eaf0c37603cb2382976d6d25397d8c235d93` |

Duraciones observadas 36/20/2/2 ms en esta lectura, no benchmark general.
El ensayo Cli4mRSN usa el paquete anterior congelado y **no acredita esta
corrección**. Tampoco se afirma que hubiera corrupción en servicio: se encontró
una comprobación insuficiente mediante inyección controlada.

## Límites

No protege contra un administrador que reescriba coherentemente toda la base,
sus hashes y claves: hace falta un ancla externa para detectar un rollback total
consistente. No sustituye copias de seguridad, fsync del sistema, ensayos de
reinicio real ni evidencia de 72 horas. No comprueba la verdad semántica de un
artefacto, sólo la estructura íntegra y consistente de su historia persistida.
