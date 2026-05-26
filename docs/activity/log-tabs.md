# Activity Center — Gateway / Containers / Core log tabs (Sesión 7)

Las 3 fuentes de logs viven detrás de tabs separados con la misma
mecánica que Events + Notifications: snapshot REST + live append WS.

## Gateway logs

- Adapter: [`adapters/gateway-logs.adapter.ts`](../../src/modules/activity/adapters/gateway-logs.adapter.ts).
- Snapshot: `GET /api/v1/gateway/logs?tail=500`.
- Live: `gateway.logs.entry` — el tab manda `gateway.logs.subscribe`
  al montar y `unsubscribe` al desmontar (idempotente: el broadcaster
  refcounta).
- Filtros: `level` (debug/info/warn/error/trace).
- Drawer: source + raw message en `<pre>`.

## Core (pino) logs

- Adapter: [`adapters/core-logs.adapter.ts`](../../src/modules/activity/adapters/core-logs.adapter.ts).
- Snapshot: `GET /api/v1/core/logs?limit=500&tail_bytes=524288`.
- Live: `core.logs.entry` con subscribe/unsubscribe simétrico.
- Filtros: `level` (trace/debug/info/warn/error/fatal).
- Columnas: time, level, source (pino `name`), reqId (Fastify), msg.
- Drawer: muestra timestamp, level/source/reqId, message y el raw
  frame pino en JSON.

## Container logs

- Adapter: [`adapters/container-logs.adapter.ts`](../../src/modules/activity/adapters/container-logs.adapter.ts).
- Snapshot: dos modos según la selección de `service`:
  - `__merged__` (default): `GET /lifecycle/services/logs?tail_bytes=65536&limit=500`.
  - servicio concreto: `GET /lifecycle/services/<name>/logs?tail_bytes=262144&limit=500`.
- Lista de servicios disponibles: `GET /lifecycle/services/logs/active`
  al montar el tab.
- Sin live WS — Core no broadcastea frames de containers. El tab
  polea cada 5s (cuando no está en pausa) llamando `refresh()` del
  hook compartido.
- Filtros: `service` (selector dinámico), `stream` (stdout/stderr).
- Deep-link: `/activity?tab=containers&svc=jellyfin` preselecciona el
  servicio al primer render.

## Decisiones

- **Sin react-virtual aún**: cada tab cap a 500 filas REST + 1000 en
  buffer (incl. live). Con esos números el DOM no se resiente. Si una
  futura sesión necesita 10k+ rows visibles a la vez, se monta
  `@tanstack/react-virtual` sobre `ActivityTable` en un único punto.
- **Containers sin WS**: añadir un broadcast por frame para cada
  container abriría un firehose. La rotación FIFO ya limita los
  archivos y el polling de 5s es suficiente para una UI de admin que
  no es un terminal en directo.
- **Dedupe**: como los logs no tienen id, cada adapter calcula una
  clave determinista (timestamp + source + slice(message)) que el
  hook usa para no duplicar entre snapshot y live append.
