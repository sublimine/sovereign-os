# Derivaciones cerradas y premisas tipadas

## Diagnóstico observado

En h53t6RZV, ambos productores matemáticos entregaron cuerpos correctos desde
su primera respuesta, pero añadieron `kind=inference` sin `sources` ni `basis`.
El registro rechazó esos claims con `UNSUPPORTED_INFERENCE`. En el siguiente
intento citaron el plan con un `claimId` vacío o igual al ID de un requisito:
el plan no tiene esos claims, por lo que fallaron con `UNDECLARED_PREMISE`.
Hubo cuatro correcciones, dos por productor, preservadas en SQLite. Finalmente
entregaron las derivaciones públicas completas con `claims:[]`, aceptadas por
revisión matemática independiente. El contenido matemático no cambió de valor.

## Corrección de instrucciones, no relajación del registro

La descripción del campo `claims` del schema que recibe cada productor explica
antes de generar que `basis.claimId` debe existir en `payload.claims` de un
artefacto de entrada declarado y coincidir con su versión. Requisitos, títulos,
pasajes y referencias al plan no se convierten en claims por citarlos.

Para una derivación cerrada desde datos completamente dados, el cuerpo conserva
premisas y demostración pública y puede usar `claims:[]` cuando no existen
fuentes ni claims padres. El registro ya admitía esta representación; la
instrucción explicita el contrato y no incorpora respuestas a ningún problema.
La petición inmutable, el plan y los inputRefs siguen vinculados por el runtime.
La aceptación exige revisión sustantiva del cuerpo, no del array vacío solamente.
No se modifica `ArtifactRegistry.validateClaims`, no se admiten premisas falsas,
ni se permite omitir evidencia empírica o el soporte solicitado por el usuario.

Es una aclaración de interfaz, no aprendizaje promovido automáticamente ni
prueba de ahorro futuro. No ofrece aún citas tipadas a premisas de la petición;
si un producto exige específicamente esa representación, queda una capacidad
pendiente y no se satisface borrando sus claims.
