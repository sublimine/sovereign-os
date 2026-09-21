# Retest conocido del esquema corregido — GV6waD

12 septiembre 2026. **Satisfactorio para el contrato diagnóstico acotado**;
no aceptación operativa, holdout nuevo, precisión general ni fin de la fábrica.
[Fallo anterior, corrección y preregistro del retest](CONDITIONAL-ASSESSMENT-U6DHJK.md).

## Resultados leídos y contrastados

| Caso | Objeto copiado | Selección | Fidelidad | Tokens | Duración de llamada |
|---|---|---|---|---:|---:|
| case-0 | DOS solicitado, Registro=1849 | PASS | PASS | 17827 | 72641 ms |
| case-1 | UNO excluido, Registro=1837 | FAIL | PASS | 18459 | 93496 ms |

Dos juicios reales Astra/ultra en hilos distintos, cuatro pasos upstream
simulados explícitos, dos copias nativas de 49 bytes. **36286 tokens / 166137 ms**
sumados de recibos reales; no se suman pasos simulados como inferencias reales.
No es eficiencia satisfactoria ni una comparación causal de rendimiento.
Incluyendo la llamada fallida de u6DhJK, esta corrección consumió **tres llamadas
reales / 53273 tokens**, sin ocultar su coste.

El primer juez comparó el interior DOS con el mandato íntegro, citó el cuerpo
y el requestQuote autenticado; separó este juicio de los PASS de fixture.
El segundo detectó la selección UNO a pesar de la aprobación simulada previa,
identificó el selector del plan como primera causa, asignó la reparación al
productor del plan y especificó comparar un nuevo candidato contra DOS.
Reconoció la fidelidad de la copia equivocada, sin confundirla con selección.
Esa propuesta de retest es una explicación diagnóstica: no se ejecutó una
reparación adicional ni se autorizó otro intento.

Ambos preservaron CRLF, espacios, U+0301 descompuesto y backslashes literales.
Ambos declararon la procedencia upstream SIMULATED y negaron cualificación
operativa/end-to-end. No afirmaron haber ejecutado herramientas o pruebas.

## Controles auditados

Lecturas en transacción readOnly, con ROLLBACK: case-0 a las **23:52:55.698**,
case-1 **23:53:57.082**. Se leyeron íntegramente razones, citas y recibos.

- Nueve citas verificadas contra contenido exacto y referencias vigentes:
  cinco de artefactos y cuatro de runtime. Sin arreglar ni sustituir citas.
- Resultados firmados verificados, vínculos históricos a contrato/run/recibo/
  exposición íntegros, salida cruda idéntica al resultado firmado y guardado.
- Intención original completa, fichas omega_22 completas y prefijo exacto
  `47ff99756428d602d6afa29593b25e6f8d5b99c4d382284aed7b924bd5dc9044`.
- Instrucciones y criterios idénticos al ensayo fallido; el único módulo
  funcional cambiado fue el constructor de esquema. Se comprobó también el
  esquema enviado, no sólo el validador posterior.
- Copias contrastadas independientemente con los segmentos DOS/UNO de la
  petición; origen nativo recalculado idéntico al guardado antes del juicio.
- Dos candidatos siguen CANDIDATE y ambas misiones NEW, sin producto final.
  Cada caso conserva una única aprobación simulada de planificación. Los
  criterios operativos originales siguen íntegros y no fueron sustituidos.
- Cero efectos. Reentrada del diagnóstico sin inferencias, cambios de journal
  ni cambios en artefactos/reviews/orígenes/misión/plan/nodos/efectos.

Hashes de cuerpos: DOS `481c494839671b8d9a1f13224ae7403d02bdc29e35ecdc429b2ba2c9e1af3c4e`;
UNO `1cdb7ebf766de010416e276ddae1199f11c3052c5091adffdf123bbc8700afc4`.
Esto prueba identidad de bytes en estos casos, no veracidad de los textos.

## Identidades y evidencias conservadas

Raíz: `runs/conditional-selection-retest-GV6waD`. Sesión propia **20670 cerrada
exit 0**, ensayo finalizado **23:52:09.774 UTC**. No queda proceso propio en curso.

| Identidad | case-0 | case-1 |
|---|---|---|
| Misión | 995cf555-d1a9-4593-a9b5-a15f6fd41dd8 | 1a602311-9b04-454b-b3e7-2c32f8bda909 |
| Actor diagnóstico | f2d74f2c-5b01-4b25-a20d-24127ad5318c | bcd90e0c-9c9f-4f06-963f-7235a62028fc |
| Candidato | dd393692-7f4c-4a23-b61f-91b38300275b | 9abaaf40-6f2b-4b81-970a-a6cb31094d2c |
| Eventos journal | 85 | 88 |
| Head journal | `947cc11a422c8574e4112711d058db121ca27aef0a2af490b61835ac7ae488b6` | `d4a579da4dc51ac2f98ee5f15836abc31e4eb271e6d3220bb4680bb46b988850` |
| Request hash | `3ce175379431cc13cf0899b28f58d31e6596282a19d8b9068e3860b05c5cdc17` | `8e3a1e0c213976d98f2b2f2d0c39d573939fd14685c894bdf54a27b1ebad8da3` |
| response-2.json SHA-256 | `a4ef3e75c3517125feb366a3cd0f3019e4a842603d0bd2516501dbfd8fdba86b` | `fd575debe98a6cb2a08ef0759508e31fa7d7f3bdc2a20f50034474a833b8580b` |
| assessment-result.json SHA-256 | `c0a3042ed19668e1c3af1195117d8512e226afa6ef1ce428b2b2622cb41f1c6d` | `6f553687b0b179a7fc04a85ebe03bec98ea3231e2817696b34958fb91e73824d` |

Verificación posterior **23:56:03.175 UTC**: 237 inputs, conjunto completo,
resumen de regresión y runtime congelado idénticos; dos hilos reales distintos.
Runtime `14936f68c59dc739101764df8a4a24034280669ae8c0d8b43ef894f22bc05987`,
401 archivos / 23872655 bytes, **no instalado**. Suite GNIRNx: 818 pruebas,
817 PASS, cero fallos, un SKIP live opt-in. Resumen del retest
`89a6f1d3b63eff8ba5eb7a8aeabd2da0524c5968440e1c76232c269d57bf5ec5`;
qualification `06ab4f565b5c093fbacd41c299c4bc093a9b18f73ae6ea3f10991a4a6fe0d44f`.
El campo semanticAudit:PENDING del resumen previo a auditoría se conserva;
este documento registra la auditoría posterior, sin reescribir ese artefacto.

## Lo que no cambia y siguiente trabajo

u6DhJK sigue fallido e intacto; XrlCqq conserva su discrepancia y 24pcUY su
alcance de caso integrado conocido. No repetir esos ensayos para producir
otra etiqueta. Esta vía separa una pregunta diagnóstica de una decisión de
entrega; no debe reemplazar las puertas operativas del motor.

Siguiente trabajo: calibrar rutas completas sobre peticiones representativas,
con criterios, alternativas, costes y límites fijados antes de ejecutarlas.
Contrastar entrada cerrada frente a planificación para una transformación;
comprobar que una petición de hechos externos conserva adquisición/soporte;
y que un encargo de desarrollo conserva producción, pruebas y revisión
independiente. Usar resultados por requisito, no sólo estado COMPLETED, y
decidir cambios de ruta a partir del fallo/coste observado. No convertir estos
dos juicios aislados en motivo para acortar otras misiones o instalar la release.

Sólo un checkpoint de servicio este turno, 23:18. Servicio instalado intacto,
sin compras/API/publicación/reinicio/misión ordinaria nueva. Continuación
existente ACTIVE comprobada; R01–R16 sigue pendiente.
