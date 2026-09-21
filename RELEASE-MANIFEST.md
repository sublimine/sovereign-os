# Sublimine — manifiesto de publicación pública

**Alcance:** arquitectura institucional, fábrica ejecutable, panel de operación,
contratos, fichas, pruebas y documentación publicables.
**Principio:** un commit de fuente debe ser reproducible sin convertir GitHub en
una copia de la memoria privada de una misión.

## Incluido en el repositorio

- Constitución, arquitectura, charters, matrices, contratos y evaluaciones
  deterministas de Ω, Σ y Π.
- Fábrica ejecutable: planificación, catálogo de roles, adquisición controlada,
  revisión, límites de presupuesto, recuperación y ejecución aislada.
- Panel Sublimine, contratos de espacios de proyecto y pruebas de su bóveda de
  documentos.
- Adaptadores de proveedor, comandos de operación portables y plantilla de
  servicio sin rutas personales fijadas.
- Pruebas de runtime, fábrica y panel, junto con fixtures sintéticas,
  selladas y autocontenidas para validar compatibilidad sin publicar un
  historial operativo real.

## Retenido fuera del repositorio público

- Peticiones, adjuntos, conversaciones, documentos subidos, respuestas de
  modelo, recibos y estados SQLite de proyectos reales.
- Grafos derivados, cachés, bytecode, capturas, perfiles y copias de releases
  locales.
- Registros de ejecución y diagnósticos de una VPS concreta que puedan revelar
  rutas, identificadores operativos o datos de uso.

Esos materiales permanecen en el almacenamiento privado de la instalación. No
son una omisión del producto: separarlos es necesario para que una publicación
pública no exponga el contexto de los proyectos del operador.

## Verificación

```sh
NODE_BIN="${NODE_BIN:-node}"
"$NODE_BIN" --test dashboard/test/*.test.mjs
"$NODE_BIN" --test tests/factory/*.test.mjs
pnpm test
```

Las suites deterministas validan contratos y regresiones conocidas. No acreditan
por sí solas calidad universal, operación continua, seguridad absoluta ni
resultados de modelos en dominios no evaluados.
