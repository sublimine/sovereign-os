# Selección de contexto sin pérdida

14 septiembre 2026. **Candidato rechazado por mayor consumo real y retirado
del núcleo activo.** Diseño histórico conservado debajo; no es una opción
instalada. [Resultado y archivo recuperable](../verification/ADAPTIVE-CONTEXT-RESULTS.md).
R04 y el mandato completo siguen pendientes.

## Decisión y medida

Se reutiliza el códec existente. La política `lossless-json-adaptive-v1` compara
exactamente dos empaquetados de la misma entrada completa: el v2 actual, con
umbral de 1024 bytes, y v2 con umbral de 256. El menor gana; empate conserva
el original. No cambia el formato de decodificación, las instrucciones de rol,
las fuentes, el orden, los tipos, las condiciones ni los límites lógicos.
Se registran ambos tamaños y la selección, no un supuesto ahorro de tokens.

La alternativa sólo puede quedar descartada por el límite explícito de expansión
después de validar el original. Un fallo de integridad/esquema no se silencia.
El trabajo adicional se limita a un empaquetado, sin llamadas al modelo.

Medida reproducible sobre las siete solicitudes reales conservadas de LFYIrU:
[reporte offline](../verification/experiments/adaptive-context-cost-LFYIrU.json),
SHA-256 `10eb2196f5343e3e77cf67ad6a16148468bba187c900d3ee7190f9239a3cb561`.

- Cuerpo de entrada original agregado: 318.821 bytes.
- Selección contrafactual: 301.122 bytes, reducción 17.699 (5,55 %).
- Instrucciones 127.265 y esquemas 34.426 bytes se mantienen aparte.
- Los 152.181 tokens son consumo histórico observado del brazo original,
  no el consumo de una ejecución adaptativa ni una medida de ahorro.
- Caché 27.392 forma parte de la entrada observada; no se resta del consumo.

La tabla de catálogo de columnas compartidas conservaría las 154 entradas y
reduciría 14.282 bytes de esas solicitudes. Se aplaza: requiere interpretación
nueva y da una reducción menor aquí. No se eliminan fichas ni capacidades.
Los dos ahorros contrafactuales no se suman. Tampoco se adopta el prototipo de
estructuras conjuntas cuyo ensayo real anterior falló.

Esta mejora acotada no resuelve por sí sola la desproporción del coste total.
La medición de bytes no demuestra comprensión, menor tokenización ni latencia.

## Fronteras de integración

La selección pertenece a la política durable de una misión nueva y al alcance
de compilación del actor. El mismo decodificador no autoriza reutilizar overlays
evaluados con otra política. Misiones y respuestas retenidas antiguas conservan
su codificación, sin reinterpretación ni regeneración para conseguir ahorro.

Se aplica a productores, jueces, entrada cerrada, especialistas y réplicas
selladas, conservando cada frontera de exposición. Las réplicas no reciben
intención global ni historial privado. La revisión documental conserva sus
ventanas y su catálogo; esta política no concede permisos de acceso.

Antes de empaquetar se mantiene el techo del contexto lógico original.
La selección nunca autoriza incluir más evidencia de la permitida ni eliminar
datos para pasar el límite. Las citas se contrastan con las cadenas originales.

## Comprobación

Prueba inicial roja: módulo todavía inexistente. Después, 21 pruebas de códecs
PASS, incluidas cadenas JSON con lexemas numéricos no normalizables, marcadores
hostiles, identidades distintas, contradicciones y expansión limitada.
Dirigida de integración 54511 cerrada: 19 PASS, 9656,480336 ms. Incluye CLI/SQLite,
recuperación sin nueva inferencia, lectura propia del juez y rechazo de cita
ausente, exposición sellada y conservación de la política tras reapertura.
Los modelos y HTTP de esas pruebas están simulados; archivos/registro son reales.

La regresión global QdBxBN posterior pasó (1713 PASS/0 FAIL/1 SKIP), pero la
comparación real TRLzD8 aumentó los tokens y rechazó la instalación. El núcleo
se restauró exactamente a b7cb510c; el paquete b5f506aa y el archivo de los 19
inputs cambiados conservan el candidato. Ninguna medida offline rehabilita ese
resultado ni autoriza repetir el mismo ensayo para conseguir un PASS.
