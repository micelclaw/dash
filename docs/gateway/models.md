---
doc_type: as-built
status: vigente
created: 2026-08-07
updated: 2026-11-24
---

# Gateway → Models

La sección **Gateway → Models** es interfaz propia del Dash de Micelclaw para
administrar el catálogo y la configuración de modelos de OpenClaw. No es el
Control UI upstream de OpenClaw.

## Reconocerla

La pantalla muestra la cabecera `Gateway`; los tabs `Overview`, `Channels`,
`Models`, `Sessions`, `Cron`, `Devices`, `Heartbeat`; y, dentro de Models,
las vistas `Chat`, `Decision`, `Catalog` y `Advanced` (en español, `Conversación`,
`Decisión`, `Catálogo` y `Avanzado`). `Configured` es el identificador interno de
la primera vista y una etiqueta histórica. Contraste estático del checkout; no acredita carga.

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

El grid consume un catálogo unificado propiedad de OpenClaw. Puede mostrar dos
secciones: proveedores instalados y plugins oficiales disponibles para instalar;
la segunda se muestra solo cuando quedan resultados tras el filtro.
Los datos del catálogo pueden incluir modelos estáticos de manifiestos antes de autenticar,
pero las tarjetas que pasan por `handleProviderClick` abren el asistente sin credencial,
no la lista del proveedor. La tarjeta de respaldo de Ollama desconectado abre Avanzado. El catálogo vivo tiene prioridad cuando está disponible. `Custom Provider` y
`OmniRoute` son las dos extensiones explícitas de Micelclaw.

## Contrato con Core

El catálogo de proveedores y métodos de autenticación se consulta mediante
`GET /gateway/models/catalog` a través de `getModelCatalog()`. Conversación consulta
los modelos configurados mediante `GET /gateway/models`; el resumen de proveedores
tiene lectura independiente. Una respuesta de catálogo no acredita las demás. `?refresh=1` solicita reconstrucción. El servicio de metadatos
de proveedores puede conservar un snapshot degradado previo si falla su actualización;
eso no garantiza que el endpoint completo responda con datos previos si falla otra
parte de la construcción. Contraste de fuente, sin prueba en runtime:

- `micelclaw-os/core/src/routes/gateway/models.routes.ts`
- `micelclaw-os/core/src/routes/gateway/models-registry.routes.ts`

Las mutaciones normales de modelos y proveedores pasan por Core y su límite
Gateway RPC/config-patch. No escribas `~/.openclaw/openclaw.json` ni invoques
la CLI de OpenClaw para mutar configuración de producto.

Los flujos genéricos de autenticación de proveedores OpenClaw (API key, OAuth y
device code) usan `claw-provider-bridge`. El formulario de proveedor personalizado
recibe la clave y envía la configuración por otro recorrido; este contraste no
certifica todos los caminos ni la carga del runtime. Los ids que OpenClaw clasifica como
`cliBackendIds` se ocultan del catálogo general, salvo referencias legacy ya
configuradas. Esas tarjetas ofrecen una migración al proveedor canónico que
asigna una política CLI por modelo si `agentRuntime` falta o es `auto`; una política
explícita existente se conserva incluso si selecciona otro runtime. Esto no acredita
ejecución efectiva ni carga.

## Diagnóstico

1. Busca primero la etiqueta visible o el proveedor en `tabs/models/`.
2. Sigue el estado por `gateway.store.ts` y el request por `gateway.service.ts`.
3. Solo después cruza el endpoint de Core y el estado real del Gateway.
4. Para una discrepancia de catálogo, distingue UI, respuesta de Core y runtime
   antes de aplicar un arreglo. El botón de refresco recarga modelos configurados en
   Conversación, Decisión por separado y catálogo con refresh en las demás vistas.
