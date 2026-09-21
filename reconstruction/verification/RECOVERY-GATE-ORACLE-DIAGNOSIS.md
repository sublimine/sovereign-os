# Diagnóstico del comprobador de gates — 10 septiembre 2026

Detectado mientras bcdf33e4 todavía es CANDIDATE y su revisión está pendiente.
Los harnesses monpYO0G/b6jLY0q2 exigen `finalGates.dependencies.length===2`.
Ese contador incluye **también el plan aceptado**, además de los dos productos.
La implementación de dependencyGates lo declara y lo conserva expresamente.
El comprobador original desde cero seleccionaba los dos padres materiales por
ID y no confundía el plan con un tercer producto. La regresión se introdujo en
el nuevo harness de recuperación, no en el protocolo de aceptación del motor.

No se modifica el harness ni el runtime en vuelo. Su resultado original se
conservará incluso si esa expresión produce un false negativo. La comprobación
de sólo lectura observa tres referencias: cd852b48, c6d28e1b y 48cf599c. Todas
tienen aceptación anterior al **primer** intento de integración, juicios PASS
completos y exposición del revisor independiente. No falta una aceptación ni
hay un producto adicional inventado.

El oráculo separado `recovery-gates.mjs` exige el conjunto exacto de tres
ID/hash/purpose fijados por el contrato: rechaza extra, ausencia, duplicado,
versión/finalidad cambiada, aceptación tardía o juicio incompleto/no independiente.
Dos tests locales PASS comprueban esas condiciones. La lectura del candidato
con ese oráculo pasa, pero no afirma aún que la revisión final esté aceptada.

Después del cierre se registrará una auditoría adicional sobre los archivos
originales, sin sobrescribir checks.gates ni passed en el summary congelado y
sin otra inferencia. Se separarán resultado del motor, error del harness y
conclusión del oráculo corregido. No es relajación de un criterio del usuario.
