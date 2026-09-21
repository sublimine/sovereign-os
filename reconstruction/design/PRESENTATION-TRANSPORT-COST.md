# Coste observado y siguiente comparación

14 septiembre2026. La corrección de presentación no certifica eficiencia.
Los resultados reales cerrados de Vj7vZz dan:

| Caso/actor | Instructions bytes | Input bytes | Schema bytes | Input tokens reales | Output tokens reales | Tiempo del recibo |
|---|---:|---:|---:|---:|---:|---:|
| Fracciones/productor nativo | 13817 | 13757 | 2929 | 20413 | 784 | 30,999s |
| Fracciones/revisor | 11258 | 31583 | 9540 | 17881 | 5989 | 184,196s |
| Literal/productor nativo | 13817 | 12657 | 2929 | 9689 | 213 | 10,049s |
| Literal/revisor | 11258 | 17092 | 9118 | 12441 | 1423 | 46,409s |

Fuente: los cuatro request-N.json y response-N.json de
verification/runs/presentation-operational-Vj7vZz. Bytes medidos en UTF-8 de cada
campo; schema serializado en JSON compacto. No son estimaciones de tokens ni
coste monetario. El recibo nativo incluye su continuación; no dividir inputTokens
por los bytes de su petición inicial para inferir un tokenizer. Caché observada:
9728tokens en el productor de fracciones, cero en los otros tres.

Hay mucho contexto fijo incluso en una reproducción de26bytes. La revisión del
literal consumió13.864tokens y su productor9.902. Esto no satisface una promesa
de eficiencia universal. Una parte mantiene requisitos importantes (mandato,
fichaΩ22, independencia, alcance, citas/lecturas); otra es documentación general
y copias de contratos. No se eliminarán fichas ni controles sólo para bajar una
cifra. La guía anterior5a5e ya falló su criterio de ahorro y no se rehabilita.

La diferencia operacional del transporte es concreta: el ordinario pide la
lectura mediante una propuesta y necesita otro turno de proveedor para usarla;
el nativo recibe el resultado en una continuación de la sesión. Ambos conservan
tres unidades lógicas: propuesta, continuación/segunda propuesta y juez. Dos
turnos reales no significan dos unidades de presupuesto ni ahorro demostrado.

Por eso la siguiente comparación mantiene el contrato9 corregido, la misma
petición/archivo/modelo/ficha/criterios en ambos brazos y sólo cambia el transporte.
Intervalos semiabiertos y circuito ternario son nuevos, con oráculos explícitos
comprobados aparte. No se usan nuevamente fracciones, literal, DAG, revisiones
ni Unicode de ensayos anteriores. AB/BA reduce un sesgo de orden pero no acredita
causalidad ni significancia con dos casos. [Prerregistro](../verification/experiments/PRESENTATION-PAIRED-QUALIFICATION.md).

La CLI/skill actualmente usa adaptive-v2 con entry-mode bounded-read-response-v1
explícito; los presets son versiones inmutables y no se cambia una misión al
reanudarla. NativeReadTransport y presentación separada siguen opt-in de SDK en
desarrollo, no instalados. Integrarlos en una selección pública requiere una
decisión y cualificación propias; este ensayo no reconfigura usuarios ni servicio.

## Resultado cerrado y decisión posterior

bDrx5k cerró17:55:57.757 y se auditó17:56:30.762. Los cuatro productos conocidos
pasaron la revisión pública completa y el recálculo independiente. Contadores
finales baseline97812/native88090, con diez llamadas de proveedor y doce unidades
lógicas en total. El primer juez baseline registra retry/secuencia133 por
responseStreamDisconnected; no consta cobertura de consumo del intento cortado.
Según el prerregistro, comparaciónINCONCLUSIVE: estos contadores no permiten
promover ahorro. No se repite el par ni se altera su nota.

La corrección de formato se separa de esa decisión de transporte. Candidato
84e7f687 expone sólo --bounded-read-presentation separate-evidence-v1, opt-in
de creación con entrada bounded. NativeReadTransport no recibe flag ni preset
conjunto; adaptive-v1/v2 permanecen iguales. CLI21tests dirigidos PASS, con
ejecución SIM y broker real. GlobalLkgzmK aún debe cerrar; sin instalación.

La consulta de cuota18:19UTC marca90% semanal consumido/10%restante compartido.
No es un presupuesto reservado para este proyecto. Las comprobaciones locales
de paquete/copia no lanzan inferencias de suscripción; no gastar el saldo en
repeticiones de ensayos cerrados buscando una nota distinta.

Actualización18:57UTC: globalLkgzmK, paquete/copia e instalación0ec8 cerrados y
auditados; sólo la selección explícita de presentación se expuso en CLI/skill.
El transporte nativo sigue sin seleccionarse. [Instalación](../verification/PRESENTATION-CLI-INSTALLATION-2026-09-14.md).
La medición posterior de subárboles idénticos terminó localmente con diez
reconstrucciones exactas pero ahorro de bytes modesto y una petición que crece
al contar instrucciones: **no integración ni nuevo LIVE**.
[Medición, alternativas y resultado](FIXED-CONTEXT-DUPLICATION.md).
