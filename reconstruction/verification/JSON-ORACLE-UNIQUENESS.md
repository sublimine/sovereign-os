# Oráculo externo: nombres JSON repetidos

Prerregistro posterior al cierre de G1ZuZR, 13 septiembre2026. Su freeze fue
revalidado antes de cambiar código. Mutación externa reproducida12:14:38:
anteponer total999 al objeto correcto cuyo último total es6 pasaba el oráculo.
Los dos cuerpos reales coinciden byte a byte con JSON.stringify(expected),
por lo que este hallazgo no invalida su contenido; sí identifica un negativo
que la verificación automática no cubría.

La norma ECMAScript especifica que los valores previos de un nombre repetido
se sobrescriben al parsear. RFC8259 recomienda nombres únicos y describe las
diferencias de interoperabilidad. Fuentes primarias consultadas13septiembre:
[ECMAScript JSON.parse](https://tc39.es/ecma262/multipage/structured-data.html#sec-json.parse),
[RFC8259 §4](https://www.rfc-editor.org/rfc/rfc8259#section-4).
La prohibición de claves repetidas es aquí una condición explícita de entrega,
no una afirmación de que JSON.parse deba rechazarlas como sintaxis.

Cambio previsto: conservar JSON.parse como analizador de sintaxis y valores;
examinar además los tokens del cuerpo original, con conjuntos de nombres por
objeto y nombres desescapados para reconocer equivalencias Unicode. No usar
reviver ni comparar sólo el objeto ya parseado: ambos han perdido duplicados.
No añadir dependencias, cambiar entrada/oráculo esperado o modificar runtime,
firmas, fuente literal o codec. Sólo endurecer el oráculo de estos casos JSON.

Pruebas primero ROJO: duplicados raíz/anidados, iguales/contradictorios,
equivalentes mediante escapes, misma clave en objetos distintos permitida,
texto citado con llaves/colon/comillas que no es un objeto, Unicode combinado
distinto sin normalizar y nombres especiales sin contaminación de prototipo.
Negativos y equivalencias generados determinísticamente, sin inferencias nuevas.
Los resultados históricos siguen conservados; revalidar cuerpos cerrados con
la comprobación nueva será un diagnóstico posterior separado, no un nuevo
resultado de su ensayo. Nueva regresión completa antes del siguiente ensayo.

## Implementación y comprobación

JSON.parse conserva la validación completa de gramática; un escaneo iterativo
posterior reconoce strings completos con escapes y delimitadores fuera de ellos.
Cada objeto tiene su Set propio y cada nombre se desescapa con JSON.parse;
no recursión, getters ni construcción de objetos mediante claves de entrada.
El rechazo BODY_DUPLICATE_KEYS sucede antes de comparar contenido. El scope
del harness ahora dice un caso/brazo y remite la comparación al prerregistro
exterior; no inventa tres casos/cuatro brazos para los nuevos conductores.

ROJO previo:4tests/1PASS/3FAIL,210.625686ms, rechazados porque el oráculo
antiguo aceptaba duplicados. Tras cambio, sesión31285:45/45PASS,
9180.899521ms, archivos de casos y harness completos con ejecución nativa
de desarrollo y proveedores simulados. Siete dirigidas finales, sesión75826:
7/7PASS,1686.972217ms. Incluyen54pares de mutaciones generadas y sus54
controles con nombres iguales en objetos separados, hechos/scope repetidos
en respuestas documentales y ambos recorridos con juez simulado deliberadamente
equivocado. Se conserva COMPLETED en su historia pero no se cualifica el caso;
cero reparaciones/revotaciones del oráculo y reentrada sin repetición.

Los dos cuerpos cerrados G1ZuZR también pasan la nueva comprobación; la
mutación total999/total6 ahora falla. Lectura externa posterior, sin reescribir
ningún resultado, base o payload del par original. No es todavía regresión
completa ni prueba de que un juez real detecte siempre esos duplicados.

Regresión Nceuel desde12:19:26.209, sesión28086/PID2074194,
boot2a077981-8aea-444e-8eff-44fa69814267/startTicks48591611;274inputs.
No editar/duplicar antes de reconciliar propietario, resumen y streams.

Nceuel cerrada12:25:12.607/sesión28086exit0/propietario muerto:
1077tests/1076PASS/ceroFAIL/unSKIP,346297.167022ms. Verificación12:25:45.744:
274pins, inventario, started/summary/streams parciales y finales íntegros;
resumenSHA63f3d2c840664871eb2ca57b29be5be46f3e15163a88e1f310ebe519005aeb7a.
Releasec561736b no cambia: sólo se modificaron oráculo/harness/pruebas externos,
ningún archivo runtime. Copia413archivos24004816B verificada, no instalada.
