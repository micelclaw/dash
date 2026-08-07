---
doc_type: as-built
status: vigente
created: 2026-08-07
updated: 2026-08-07
---

# Gateway → Models

La sección **Gateway → Models** es interfaz propia del Dash de Micelclaw para
administrar el catálogo y la configuración de modelos de OpenClaw. No es el
Control UI upstream de OpenClaw.

## Reconocerla

La pantalla muestra la cabecera `Gateway`; los tabs `Overview`, `Channels`,
`Models`, `Sessions`, `Cron`, `Devices`, `Heartbeat`; y, dentro de Models,
`Configured`, `Catalog`, `Advanced` y `Search providers…`.

## Código propietario

| Responsabilidad | Ruta |
|---|---|
| Tabs de Gateway | `src/modules/gateway/GatewayPage.tsx` |
| Orquestación de Models | `src/modules/gateway/tabs/ModelsTab.tsx` |
| Grid de proveedores y filas de modelo | `src/modules/gateway/tabs/models/` |
| Alta de credenciales / custom provider | `src/modules/gateway/components/ModelSetupWizard.tsx` |
| Estado | `src/stores/gateway.store.ts` |
| Cliente HTTP | `src/services/gateway.service.ts` |

El grid se deriva de los modelos del catálogo y del overview de proveedores. Las
tarjetas de alta no sustituyen las tarjetas de proveedores ya presentes: la
deduplicación usa tanto configuración declarada como credencial disponible.

## Contrato con Core

El Dash carga el catálogo mediante `GET /gateway/models/catalog` a través de
`getModelCatalog()`. Core mantiene la caché, mezcla el catálogo de OpenClaw con
los proveedores declarados y expone el resultado desde:

- `micelclaw-os/core/src/routes/gateway/models.routes.ts`
- `micelclaw-os/core/src/routes/gateway/models-registry.routes.ts`

Las mutaciones normales de modelos y proveedores pasan por Core y su límite
Gateway RPC/config-patch. No escribas `~/.openclaw/openclaw.json` ni invoques
la CLI de OpenClaw para mutar configuración de producto.

## Diagnóstico

1. Busca primero la etiqueta visible o el proveedor en `tabs/models/`.
2. Sigue el estado por `gateway.store.ts` y el request por `gateway.service.ts`.
3. Solo después cruza el endpoint de Core y el estado real del Gateway.
4. Para una discrepancia de catálogo, distingue UI, respuesta de Core y runtime
   antes de aplicar un arreglo.
