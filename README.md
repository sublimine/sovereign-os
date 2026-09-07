# Sovereign OS — Departamento Ω v2

Especificación institucional y técnica de una cúspide multiagente soberana,
independiente del runtime. Este repositorio es una especificación ejecutable:
los documentos normativos definen la semántica; los JSON Schema definen los
contratos; las configuraciones declaran cada autoridad; las pruebas detectan
deriva, huecos y violaciones constitucionales.

## Orden de precedencia

1. **docs/omega/00-OMEGA-CONSTITUTION.md**
2. Decisiones vigentes en **docs/omega/decisions/**
3. Schemas con estado **ACTIVE**
4. Charters de agentes
5. Configuraciones de runtime
6. Adaptadores de proveedor

Un artefacto inferior que contradiga uno superior es inválido. Las versiones
anteriores se conservan; nunca se sobrescribe historia institucional.

## Mapa

- **docs/omega/00–12**: núcleo normativo y operacional.
- **docs/omega/agents/**: especificación conceptual y el índice operativo Ω1–Ω24.
- **config/agents/charters/**: 24 prompts/charters de producción firmables.
- **config/state-machines-v2.json**: 24 máquinas de estado ejecutables.
- **config/quality-gates-v2.json**: gates y prohibiciones de waiver por rol.
- **config/fmea-v2.json**: recuperación efectiva por fallo y agente.
- **schemas/**: contratos JSON Schema 2020-12.
- **tests/omega/**: validadores estructurales, de autoridad y cobertura.
- **docs/omega/simulations/**: siete misiones de referencia.
- **docs/omega/diagrams/**: autoridad, información, verificación, delegación,
  escalado y recuperación.
- **docs/omega/evaluations/**: catálogo de pruebas y auditorías.

## Principio operativo

Los roles Ω no ejecutan el trabajo departamental ordinario. Emiten mandatos,
construyen misiones, encargan especialistas efímeros, juzgan evidencia,
bloquean fallos, deciden y preservan el registro. La ejecución intensiva
pertenece a departamentos inferiores o a especialistas temporales limitados.

## Madurez y validación

La versión 2 alcanza **D2 DETERMINISTIC_TESTED**: schemas, hashes, autoridad,
leases, contexto blind, estados, gates, FMEA, oracles y traces conceptuales se
validan localmente. D3–D5 requieren ejecutar la batería contra modelos reales,
shadow missions y resultados de producción; se registran como deuda de
validación, no como éxito ficticio.

Con Node.js:

~~~powershell
node tests/omega/run-all.mjs
node tests/omega/run-model-evals.mjs path\to\model-responses.json
~~~

La ausencia de dependencias externas es deliberada: las pruebas basales deben
poder ejecutarse durante recuperación de desastre.

La última suite reconcilia además overlays, charters, schemas, métricas del
release y Command Center; una vista visual no puede declarar más madurez que su
certificación machine-readable.

## Departamento Σ — Inteligencia Estratégica

Σ es el primer departamento bajo la cúspide Ω. Convierte necesidades soberanas
en inteligencia decision-relevant mediante requisitos, colección multivía,
control de fuentes, fusión, análisis, estimación, warning, disenso, productos y
aprendizaje. No decide estrategia ni absorbe Research, Data, Engineering,
Security, Legal u Operations.

- **[Constitución Σ](docs/sigma/00-SIGMA-CONSTITUTION.md)** y
  **[arquitectura](docs/sigma/01-SIGMA-SYSTEM-ARCHITECTURE.md)**.
- **[Dossiers v3 de 40 agentes](docs/sigma/agents/v3/)** y
  **[estándar exigible](docs/sigma/agents/AGENT-DOSSIER-V3-STANDARD.md)**.
- **[Matriz v3 de relaciones 40×40](docs/sigma/04-SIGMA-V3-RELATIONSHIP-MATRIX.md)** y
  **[autoridad 40×24](docs/sigma/matrices/SIGMA-AUTHORITY-40x24.md)**.
- **[Interfaces departamentales](docs/sigma/24-SIGMA-DEPARTMENT-INTERFACES.md)**.
- **[Auditoría adversarial v3](docs/sigma/SIGMA-ARCHITECTURE-ADVERSARIAL-AUDIT.md)**,
  **[auditoría cruzada](docs/sigma/SIGMA-V3-CROSS-COHERENCE-AUDIT.md)** y
  **[release manifest](docs/sigma/SIGMA-RELEASE-MANIFEST.md)**.
- **[Command Center visual](visual/sigma-intelligence-center.html)**.
- **[Atlas visual unificado Ω + Π + Σ](visual/sovereign-atlas.html)**: mapa navegable de las 104 autoridades, con nodos, mando y conectores filtrables.

La certificación local de Σ v3 alcanza como máximo
`S2_V3_DETERMINISTICALLY_AUDITED`.
S3–S5 requieren ejecuciones de modelos, shadow missions, infraestructura y
resultados reales; permanecen explícitamente como deuda.

## Departamento Π — Estrategia, cartera y transformación

Π es el departamento de primer nivel que convierte mandato, inteligencia,
restricciones y señales de outcome en espacios de opción, casos estratégicos,
carteras, programas, capacidades y handoffs. Son cuarenta autoridades con
fronteras explícitas: Π recomienda y diseña; Ω/humano decide, Σ establece la
realidad, Ω20 conserva la asignación de recursos y Ω21 la determinación legal.

- **[Constitución Π](docs/pi/00-PI-CONSTITUTION.md)** y
  **[arquitectura](docs/pi/01-PI-SYSTEM-ARCHITECTURE.md)**.
- **[Sistema operativo del Council](docs/pi/06-PI-COUNCIL-OPERATING-SYSTEM.md)**:
  asientos, desacuerdos, bloqueos, escalados y paquete mínimo de decisión.
- **[Mapa de génesis Π01–Π40](docs/pi/07-PI-AGENT-GENESIS-MAP.md)**:
  pregunta irreductible, producto único, fallo contrafactual y contraparte
  limitante de cada autoridad.
- **[Arenas de decisión](docs/pi/08-PI-DECISION-ARENAS.md)**: dónde las
  autoridades entran en conflicto real, qué impide cerrar y qué obliga a
  reconsiderar cada decisión material.
- **[Estándar de dossier](docs/pi/agents/AGENT-DOSSIER-V3-STANDARD.md)** y
  **[40 dossiers v3](docs/pi/agents/v3/)**.
- **[Matriz de relaciones 40×40](docs/pi/04-PI-V3-RELATIONSHIP-MATRIX.md)**,
  **[matriz de autoridad](docs/pi/03-PI-AUTHORITY-MATRIX.md)** y
  **[interfaces departamentales](docs/pi/24-PI-DEPARTMENT-INTERFACES.md)**.
- **[Auditoría cruzada](docs/pi/PI-V3-CROSS-COHERENCE-AUDIT.md)**,
  **[simulaciones A–J](docs/pi/simulations/PI-V3-SIMULATIONS-A-J.md)** y
  **[release manifest](docs/pi/PI-RELEASE-MANIFEST.md)**.
- **[Command Center Π](visual/pi-strategy-center.html)** y
  **[Atlas soberano](visual/sovereign-atlas.html)**.

La certificación local de Π v3 alcanza como máximo
`S2_PI_V3_DETERMINISTICALLY_AUDITED`. No afirma ejecución de modelos,
autorización externa, financiación, legalidad ni éxito operativo.

~~~powershell
npm.cmd run certify:sigma
npm.cmd run build:sigma:v3
npm.cmd run test:sigma
npm.cmd run certify:pi
npm.cmd run build:pi:v3
npm.cmd run test:pi
npm.cmd test
~~~
