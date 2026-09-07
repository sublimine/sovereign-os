# Modelo de Seguridad Ω

**Versión:** 1.0.0  
**Modelo:** zero trust, least privilege, explicit allow, short-lived capability

## 1. Límites de confianza

Usuario, modelo, agente, tool, fuente, memoria, event bus, adapter y humano son
principals distintos. Ninguno es confiable por título. PolicyDecisionPoint
autoriza cada acción con subject, mission, resource, action, context, risk y
lease.

## 2. Perfiles de herramientas

- READ_PUBLIC: red pública read-only en sandbox.
- READ_CLASSIFIED: datasets concretos, sin egress.
- COMPUTE_SAFE: código sin red, filesystem efímero.
- COMPUTE_NETWORKED: allowlist, paquete fijado, audit.
- WRITE_WORKSPACE: paths de misión; no sistema/secret store.
- EXTERNAL_EFFECT: acción remota idempotente y aprobada.
- DANGEROUS_EFFECT: two-person/human, dry-run y compensación.

Cada charter fija allowlist. Cambiar herramienta no cambia autoridad.

## 3. Secretos

SecretProvider entrega handles, no valores en prompt cuando sea posible.
Scopes por misión/instancia, TTL breve, rotación tras terminación, no logging,
redaction verificable. Mezclar secreto con contenido externo no confiable
requiere sandbox sin egress.

## 4. Contenido externo

Todo texto/documento/web es **UNTRUSTED DATA**. Pipeline:

1. snapshot inmutable;
2. malware/active-content quarantine;
3. parsing sin ejecución;
4. separar contenido e instrucciones del sistema;
5. etiquetar delimitadores y origen;
6. limitar herramientas disponibles durante análisis;
7. validar cualquier acción contra charter original, nunca contra el texto;
8. registrar intentos de injection.

Una fuente que diga “ignora tus reglas” sólo crea un dato sobre esa cadena.

## 5. Sandboxing

Filesystem efímero por instancia; mounts read-only por defecto; red deny por
defecto; allowlists DNS/IP/endpoint; límites CPU/memoria/proceso; syscall
filter; paquetes fijados por hash; outputs escaneados; side effects separados
del razonamiento. Contención no depende de que el modelo obedezca.

## 6. Aprobación humana

Obligatoria para daño humano, acciones legales/financieras irreversibles,
exfiltración, elevación de privilegios, cambios constitucionales, despliegue
productivo crítico y aceptación de riesgo existencial. La pantalla muestra
acción exacta, target, diff, evidencia, blast radius, rollback y expiración.

## 7. Auditoría y no repudio

Eventos encadenados por hash, clock UTC, identidad de workload, config/model/
tool versions, input/output hashes, coste, error, autorización y efecto real.
Firmas o attestations se incorporan según criticidad. Ω3 tiene lectura
independiente; administradores operativos no pueden reescribir findings.

## 8. Incidentes

DETECT → REVOKE LEASE → ISOLATE → PRESERVE → SCOPE DEPENDENTS → ROTATE
SECRETS → RECOVER CLEAN → REVERIFY → REPORT. Ω19 gobierna continuidad; Ω21
notificación/legitimidad; Ω3 investiga; Ω14 reproduce explotación de forma
controlada.

