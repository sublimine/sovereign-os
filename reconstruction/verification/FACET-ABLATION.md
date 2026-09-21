# Aportación marginal de facetas — protocolo previo

2026-09-10. Pregunta: ¿añadir la ficha especializada al juez Ω22 cambia sus
decisiones, su diagnóstico o el coste para los mismos datos y candidato?
La cantidad de fichas, los nombres o la longitud de las instrucciones no
acreditan valor. Tampoco una observación por celda permite descartar una faceta.

## Diseño

Cuatro problemas sintéticos cerrados, cada uno con candidato materialmente
correcto y otro incorrecto. Dos brazos: Ω22, o Ω22 más la faceta completa.
Total previsto: 16 inferencias reales, todas en hilos nuevos, mismo modelo
Astra/ultra, perfil scoped-v1, misma entrada y schema por par. Orden de brazos
y candidatos alternado. No hay búsqueda, archivos producidos por el modelo,
ejecución ni otras fuentes. No es una misión completa de adquisición.

| Caso | Faceta añadida | Operación que se contrasta |
|---|---|---|
| Masa e intervalos | VERITAS_07 | Conversión de unidades y extremo posible frente al valor nominal |
| Raíces y error común | VERITAS_05 | Copias, adquisiciones distintas, origen desconocido y calibración compartida |
| Contradicción condicionada | VERITAS_08 | Unidad equivalente, instante de medida, fecha de publicación y prueba discriminante |
| Calibración agrupada | VERITAS_09 | Frecuencia global frente a bandas prospectivas y Brier frente al comparador |

Las fichas completas se leyeron antes de elegir cada intervención. Su cometido
motiva la hipótesis, no predetermina su eficacia. `facet-ablation-cases.mjs`
contiene oráculo y entradas; `inputFor` excluye labels, variante, rol añadido y
respuestas esperadas del contexto del proveedor. Candidatos, fuentes, criterios,
preguntas numéricas, schema, cada prefijo y solicitudes se congelan antes de
la primera inferencia. Las cantidades se recomputaron en tests independientes.

## Evaluación y disciplina

- Cada criterio requiere decisión y cita literal; las preguntas de diagnóstico
  se resuelven independientemente del candidato. Decisión correcta sin diagnóstico
  correcto no se convierte en PASS global. Respuestas y hashes se conservan.
- La comparación decimal sólo normaliza ceros y signo redundantes, exactamente;
  no redondea un valor cercano hacia la respuesta esperada.
- Las razones públicas se leerán después contra las fuentes. Que una cita sea
  literal no garantiza por sí solo que justifique el motivo del juez.
- No hay reparación ni reintento automático. Fallo de proveedor/cuota deja su
  registro y frena este ensayo; no se sustituye por una API, otro modelo o otra
  cuenta. La salida fallida no se elimina del denominador.
- Se miden decisiones, criterios, probes, literalidad, falsas aceptaciones y
  falsos rechazos, tokens observados y hilos separados. No se inventa el consumo
  de llamadas fallidas. No es una prueba estadística de equivalencia o superioridad.
- El resultado no cambia automáticamente routing, fichas, instrucciones aprendidas
  ni misiones. Una diferencia merece confirmación; empate no es permiso para borrar
  funciones. La generalización a tareas amplias queda expresamente abierta.

No hay resultado real todavía en este protocolo previo; véase STATUS para su
despacho y los resultados posteriores. No sobrescribir protocolo, casos o harness
durante el ensayo.
