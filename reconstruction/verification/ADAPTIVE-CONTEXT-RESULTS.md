# Contexto adaptativo: resultado negativo conservado

14 septiembre 2026. **REJECTED_COST; no instalado.** No es cierre de R04/R16.

La hipótesis reutilizaba el códec v2 con dos umbrales y escogía el menor cuerpo
JSON. [Medida offline](experiments/adaptive-context-cost-LFYIrU.json): 17.699 bytes
menos de 318.821 en siete entradas históricas. Eso no acreditaba menos tokens.

## Ensayo real cerrado

[TRLzD8](runs/adaptive-context-live-TRLzD8/summary.json), 09:07:56.502–09:08:31.473.
Cuatro llamadas reales, dos casos sintéticos conocidos y orden alternado.
Idénticos rol completo, instrucciones, esquema, modelo, razonamiento y perfil;
sólo cambiaba la representación de la misma entrada. Cero misiones, efectos o
fuentes nuevos. Cero reintentos para cambiar el resultado.

| Medida observada | Original | Adaptativo |
|---|---:|---:|
| Respuestas correctas | 2/2 | 2/2 |
| Tokens de entrada | 13.203 | 13.569 |
| Tokens de salida | 288 | 315 |
| Tokens totales | 13.491 | 13.884 |
| Entrada en caché | 0 | 0 |

La entrada subió 366 tokens y el total 393. Se cumplió la corrección de estos
casos, pero no el criterio prospectivo de coste. No se reinterpretó el fallo.
Las cuatro respuestas públicas completas fueron inspeccionadas: contradicción
activa correctamente detectada, condiciones inactivas y otros grupos excluidos,
copias no contadas como fuentes nuevas, instrucciones hostiles ignoradas y
raíces independientes no establecidas. Esto no es calibración universal.

[Auditoría](runs/adaptive-context-live-TRLzD8/post-close-audit.json),
09:09:55.823: owner 2582596/startTicks 56082619 ausente, cuatro clientes distintos
cerrados, 326 pins de regresión y cinco experimentales. Summary SHA-256
`183ad653456f03122525935230ecee7419c6cb3f884b3a6829cf6b2b3a842ec9`.
[Disposición sustantiva](runs/adaptive-context-live-TRLzD8/semantic-disposition.json)
09:11:58.988: REJECTED_COST.

Antes, SIM AWHgQd cerró cuatro respuestas simuladas y la global QdBxBN aprobó
1713 pruebas, con una omitida. La global no capturó PID/startTicks originales;
su [auditoría](runs/suite-QdBxBN/post-close-audit.json) distingue cierre registrado
del hijo y ausencia actual de comandos coincidentes de una identidad histórica
no capturada. No se inventa esta última ni se repite la batería por ese dato.

## Retirada verificable

Se retiraron sólo dos archivos nuevos del selector y se restauraron los otros
17 archivos modificados a sus bytes originales. Ningún cambio ajeno, historial,
resultado fallido o ficha fue eliminado. Primero se conservó y comprobó cada
uno de los 19 miembros del [archivo recuperable](runs/adaptive-context-live-TRLzD8/rejected-development-sources.tar.gz)
(143.453 bytes, SHA-256
`0347579b5c9d13695135cd4244b0dd4a5c2a2bc54dea3bce117b6a5ae850e3ed`).
La primera comprobación de archivo esperaba erróneamente 20 entradas y abortó
antes de escribir; se sustituyó por la lista exacta de las 19 rutas comprobadas.

[Restauración](runs/adaptive-context-live-TRLzD8/restoration-audit.json) verificada
a las 09:14:41.309: los 324 inputs e inventario actuales vuelven a coincidir
exactamente con TymHUs y b7cb510c. No se afirma una nueva regresión: se comprobó
la identidad con la ya aprobada. El servicio no cambió durante este ensayo.
El freeze b5f506aa conserva también el candidato rechazado y **no se instala**.

Los cinco archivos del experimento permanecen inalterados. Son código histórico
ligado a b5f506aa, no comandos para ejecutarse contra el núcleo b7cb510c restaurado.

## Próxima hipótesis, todavía no solución

Cada entrada adaptativa sintética introdujo tres claves y ocho referencias de
64 caracteres: 704 caracteres hexadecimales. Es una pista concreta sobre el
coste de la representación, no una atribución causal exacta de tokens. Comparar
claves cortas primero offline, conservando identidades y hashes de las fuentes.

Se consultó también [TOON](https://github.com/toon-format/toon): su propio proyecto
recomienda medir con los datos reales y señala que las estructuras anidadas o
irregulares pueden favorecer JSON compacto. No se adopta su benchmark como
resultado de esta fábrica ni se introduce otro formato por una cifra publicitaria.
