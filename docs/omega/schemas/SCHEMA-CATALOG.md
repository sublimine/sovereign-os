# Catálogo de Schemas

| Schema | Propósito | Owner | Compatibilidad |
|---|---|---|---|
| artifact-envelope | metadatos/versionado universal | Ω7/Ω24 | aditiva en minor |
| mission | intención, activación, budget y autoridad | Ω2/Ω4 | cambios de objetivo crean versión |
| claim | claim atómico, estado y confianza | Ω11/Ω12 | estados requieren migración |
| evidence | evidencia y cadena de custodia | Ω7 | inmutable |
| contradiction-case | conflicto explícito | Ω11/Ω12 | inmutable por versión |
| packet | interfaz entre agentes | Ω2 | consumidores toleran campos aditivos |
| event | event sourcing/audit | Ω3/Ω24 | eventos nunca se reescriben |
| specialist-mandate | delegación efímera | Ω4/Ω21 | default deny |
| agent-charter | configuración Ω | Ω21/Ω24 | cambio de authority es major |

Todos usan JSON Schema 2020-12. Un cambio incompatible incrementa major,
requiere migration, shadow run y rollback. Los schemas activos se cargan desde
el registry por ID+version, nunca “latest” en una misión en curso.

