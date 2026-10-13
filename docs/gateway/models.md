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
| Auth dinámica OpenClaw | `src/modules/gateway/components/ProviderAuthWizard.tsx` |
| Custom provider / servidores locales | `src/modules/gateway/components/ModelSetupWizard.tsx` |
| Estado | `src/stores/gateway.store.ts` |
| Cliente HTTP | `src/services/gateway.service.ts` |

El grid consume un catálogo unificado propiedad de OpenClaw. Muestra dos
secciones: proveedores instalados y plugins oficiales disponibles para instalar.
Los modelos estáticos de los manifiestos se muestran incluso antes de autenticar
el proveedor; el catálogo vivo gana cuando está disponible. `Custom Provider` y
`OmniRoute` son las dos extensiones explícitas de Micelclaw.

## Contrato con Core

El Dash carga modelos, proveedores instalados, métodos de autenticación y
proveedores instalables mediante `GET /gateway/models/catalog` a través de
`getModelCatalog()`. `?refresh=1` fuerza la reconstrucción. Core conserva el
último snapshot válido si OpenClaw está temporalmente inaccesible y expone el
resultado desde:

- `micelclaw-os/core/src/routes/gateway/models.routes.ts`
- `micelclaw-os/core/src/routes/gateway/models-registry.routes.ts`

Las mutaciones normales de modelos y proveedores pasan por Core y su límite
Gateway RPC/config-patch. No escribas `~/.openclaw/openclaw.json` ni invoques
la CLI de OpenClaw para mutar configuración de producto.

Los flujos de API key, OAuth y device code se ejecutan dentro de OpenClaw a
través de `claw-provider-bridge`; el Dash solo representa prompts opacos y nunca
recibe credenciales ya almacenadas. Los ids que OpenClaw clasifica como
`cliBackendIds` se ocultan del catálogo general, salvo referencias legacy ya
configuradas. Esas tarjetas ofrecen una migración al proveedor canónico que
conserva la ejecución CLI mediante una política `agentRuntime` por modelo.

## Diagnóstico

1. Busca primero la etiqueta visible o el proveedor en `tabs/models/`.
2. Sigue el estado por `gateway.store.ts` y el request por `gateway.service.ts`.
3. Solo después cruza el endpoint de Core y el estado real del Gateway.
4. Para una discrepancia de catálogo, distingue UI, respuesta de Core y runtime
   antes de aplicar un arreglo.
