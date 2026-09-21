# Petición --file sin sustitución silenciosa

14 septiembre 2026. Hallazgo durante reconciliación del manual, no un fallo
observado sobre datos del usuario. La CLI instalada25d34 usa readFileSync(...,
'utf8') tanto en submit como en run. Ese decodificador sustituye bytes inválidos
por U+FFFD antes de crear y vincular el encargo. La captura estricta existente de
adjuntos sí rechaza los mismos bytes. No basta declarar UTF-8 en el manual.

Contraejemplo cerrado12:57:31.914: request-file-decoding-at1Rlg. CLI inmutable
instalada, --state-dir privado y cola sin consumidor. Original hexadecimal61c328
guardado como61efbfbd28, salida CLI0; una misión sintéticaQUEUED, cero actores,
inferencias y efectos. captureMissionInputs devuelveENCODING sobre el mismo
archivo. El resultado de la prueba queda retenido como evidencia operativa
privada; este documento conserva su contrato reproducible.
No se sirvió esa cola ni se modificó el estado instalado. Conservar el negativo.

Reutilización prevista: la captura de archivos ya existente, con identidad,
archivo regular/no enlaces, límite de bytes, doble lectura y UTF-8 sin pérdida.
No introducir otra biblioteca o lector paralelo. Un helper de admisión de texto
del encargo para ambas ramas CLI debe devolver únicamente el texto exacto, no
registrar la petición como adjunto, preparar copias de entrada o elevar protocolo7.
El workspace vacío habitual de una misión sin adjuntos no cambia. --text conserva
su conducta; SDK/misión y encargo máximo256KiB UTF-8 no cambian. La cota1MiB del
capturador admite todo archivo dentro de ese máximo; después se conserva la
validación en bytes de la misión. La primera prueba confundió unidades UTF-16
con bytes y ausencia de adjuntos con ausencia de workspace: ambas expectativas
eran errores de la prueba, no defectos del motor. No modificar el motor por ello.

La restricción de archivos regulares sin symlink/hardlink para --file es un
cambio de admisión explícito: documentarlo y probarlo; no convertir un rechazo
en falta de cuota, autorizar otra ruta, seguir el enlace o sustituir contenido.
Ficheros especiales tampoco deben leerse sin límite. Antes de despachar un
proveedor deben rechazarse inválidos, inexistentes, alterados o sobredimensionados.

Pruebas previas a promoción: UTF-8 válido con BOM, CRLF, espacios y Unicode
compuesto/descompuesto conservados; inválidos y enlaces rechazados en submit
y run sin misión/cola/inferencia; idempotencia de archivo válido y cambio de
texto rechazado bajo el mismo ID; --text y --inputs no confundidos; longitud
del encargo intacta y sin floor7 sólo por --file. Reutilizar falsificadores de
carrera de captureMissionInputs, no relajar sus controles ni inventar nuevas
garantías de inmovilidad del host.

El núcleo y los diez inputs de7Q6DCK permanecen congelados hasta cerrar su
auditoría. Implementar después y cualificar el snapshot nuevo. No atribuir
retroactivamente esta corrección al ensayo ni a25d34/5a5e. El manual operativo
pendiente debe reflejar el nuevo contrato sólo cuando realmente se implemente.

## Cierre de esta corrección

Implementada después del cierre negativo de7Q6DCK. Dirigidos74PASS; regresión
2v6ckJ:1837tests/1836PASS/0FAIL/1SKIP,339pins y cuatro streams auditados13:23:21.851.
Paquete3305fe61: sólo CLI/manual difieren25d34. Prueba inmutableiSRH2a cerrada
13:23:36.266 y auditada13:25:00.610: dos rechazos ENCODING antes de publicar,
39bytes válidos idénticos, ID idempotente, conflicto rechazado, cero inferencias.
InstaladoBJWPFq con backup y auditoría13:28:31.520;165versiones anteriores y
58heads materiales conservados, protocolo2. Esto cierra el defecto de admisión,
noR01–R16, ahorro de tokens, equivalencia semántica universal o uptime continuo.
