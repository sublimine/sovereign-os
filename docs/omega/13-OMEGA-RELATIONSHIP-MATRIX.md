# Matriz de Relaciones Ω 24×24

Fuente de verdad machine-readable: **config/relationships.json**. La tabla
representa edges dirigidos: fila actúa sobre columna. Una celda puede tener
múltiples códigos: C commands, R reports_to, Q requests, V verifies, A audits,
H challenges, B blocks, E escalates_to, F feeds, I independent_from, S self.
“·” significa que no hay relación directa institucional; la comunicación debe
pasar por packet routing.

| from\to | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 | S | C | I | · | · | · | · | · | · | · | · | · | · | · | · | · | Q | · | Q | Q | Q | Q | Q | · |
| 02 | R/E | S | Q/I | C | C | C | C | C | C | C | C | C | C | C | C | C | C | C | C | C | C | C | C | C |
| 03 | A/I | A/I | S | A | A | A | A | A | A | A | A | A | A | A | A | A | A | A | A | A | A | A | A | A |
| 04 | · | R/F | · | S | Q | · | · | · | · | · | · | · | · | · | · | · | · | · | · | Q | Q | · | F | · |
| 05 | · | R | · | F | S | Q/F | · | Q | · | · | · | · | · | · | · | · | F | · | · | · | · | · | F | · |
| 06 | · | · | · | · | R | S | F | · | · | F | F | · | · | · | · | · | · | · | · | · | · | · | · | · |
| 07 | · | R | · | · | · | V/B | S | · | F | F | F/B | · | · | · | · | · | · | · | · | · | · | F/B | V/B | · |
| 08 | · | R | · | · | · | · | · | S | · | · | · | · | Q | · | Q | F | F | F | · | · | · | · | · | · |
| 09 | · | R | · | · | V | V | · | V | S | F | F | F/B | · | · | · | V | · | · | · | · | · | F/B | · | · |
| 10 | · | R | · | · | · | V/H | · | · | V | S | F | F/B | · | · | · | · | · | · | · | · | · | F/B | · | · |
| 11 | · | R | · | · | V | V | · | V | · | · | S | F/B | · | · | · | V | V | V | V | V | · | F/B | V/B | · |
| 12 | · | R | · | · | · | · | · | · | V | V | V | S | · | · | · | · | · | · | · | · | · | F/B | F/B | · |
| 13 | · | R | · | H/B | H | · | · | H | · | · | · | · | S | · | F | H | H/B | H | H | H | · | F | · | · |
| 14 | · | R | · | H | · | · | · | H | · | · | · | · | · | S | · | H/B | H/B | H | F/H | · | Q | F/B | · | H |
| 15 | · | R | · | · | F | · | · | F | · | · | · | · | · | · | S | F | F/H | · | · | · | · | F | · | · |
| 16 | · | R | · | · | · | · | · | Q | · | · | · | · | · | · | · | S | F | F | F | · | · | F | F | · |
| 17 | R/F | R | · | · | · | · | · | · | · | · | · | · | · | · | · | · | S | Q | Q | Q | Q | · | F | · |
| 18 | · | R | · | · | · | · | · | · | · | · | · | · | · | · | · | · | F | S | F | · | F | F/B | F | · |
| 19 | R/E/F | R | · | · | · | · | · | · | · | · | · | · | · | Q | · | Q | B/F | · | S | · | F | F/B | F | · |
| 20 | R/E/F | F/B | · | F/B | · | · | · | · | · | · | · | · | · | · | · | · | F | · | · | S | · | F | F | · |
| 21 | R/E/F | F/B | F | · | · | B | · | · | · | · | · | · | · | B | · | · | F/B | · | F/B | · | S | F/B | F | V/B |
| 22 | R/E/F | F/B | · | V/B | V/B | V/B | V | V/B | V | V | V | V | V | V | V | V/B | V/B | V/B | V/B | V | V | S | V/B | V/B |
| 23 | F | R/F | · | · | · | · | Q | · | · | · | Q | Q | Q | · | · | · | Q | Q | Q | Q | Q | Q | S | · |
| 24 | R/E | R | Q | · | · | · | · | · | · | · | · | Q | · | Q | · | · | · | · | · | Q | Q | Q | F | S |

La matriz no es simétrica. Por ejemplo, Ω22 verifica Ω17, pero Ω17 no verifica
Ω22; Ω3 audita Ω1, aunque Ω3 no manda sobre Ω1; Ω2 commands significa activar
y coordinar la misión, no dictar un veredicto epistémico.

