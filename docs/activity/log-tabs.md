# Activity Center — Gateway / Containers / Core log tabs

> **AS-BUILT (2026-08-04).** Escrito en la Sesión 7. Corregidos los parámetros
> de query de los tres snapshots (estaban mal los cuatro) y el cap de filas por
> tab.

Las 3 fuentes de logs viven detrás de tabs separados con la misma
mecánica que Events + Notifications: snapshot REST + live append WS.
Los tres reciben además `from`/`to` cuando el `TimeRangePicker` del
header tiene una ventana explícita.

## Gateway logs

- Adapter: [`adapters/gateway-logs.adapter.ts`](../../src/modules/activity/adapters/gateway-logs.adapter.ts).
- Snapshot: `GET /api/v1/gateway/logs?limit=500` (+ `from`/`to`).
  **No manda `tail=`** — el service solo traduce `limit`, `from` y `to`
  (`services/activity.service.ts:220-228`).
- Live: `gateway.logs.entry` — el tab manda `gateway.logs.subscribe`
  al montar y `unsubscribe` al desmontar (idempotente: el broadcaster
  refcounta).
- Filtros: `level` (debug/info/warn/error/trace), aplicado en cliente.
- Drawer: source + raw message en `<pre>`.

## Core (pino) logs

- Adapter: [`adapters/core-logs.adapter.ts`](../../src/modules/activity/adapters/core-logs.adapter.ts).
- Snapshot: `GET /api/v1/core/logs?limit=500` + `level` (+ `from`/`to`).
  **El adapter NO manda `tail_bytes`** aunque el service lo soporte.
- El `level` va **server-side** a propósito: `info` domina el fichero
  ~98%, así que un tail ciego nunca sacaría un `warn`/`error` viejo; el
  backend escanea una ventana más ancha cuando se le pasa el nivel.
  `matchesFilters()` reaplica el mismo gate a las filas live para que el
  resultado sea coherente.
- Live: `core.logs.entry` con subscribe/unsubscribe simétrico.
- Filtros: `level` (trace/debug/info/warn/error/fatal).
- Columnas: time, level, source (pino `name`), reqId (Fastify), msg.
- Drawer: muestra timestamp, level/source/reqId, message y el raw
  frame pino en JSON.

## Container logs

- Adapter: [`adapters/container-logs.adapter.ts`](../../src/modules/activity/adapters/container-logs.adapter.ts).
- Snapshot: dos modos según la selección de `service`:
  - `__merged__` (default): `GET /lifecycle/services/logs?tail_bytes=262144&limit=500` (256 KB).
  - servicio concreto: `GET /lifecycle/services/<name>/logs?tail_bytes=1048576&limit=500` (1 MB).
  Los `tail_bytes` están calibrados para que el primer pintado cubra ≥ 1 hora
  de actividad aunque un contenedor hablador domine el fichero. El backend
  capa en **512 KB** (merged) y **4 MB** (por servicio) —
  `core/src/routes/lifecycle-logs.ts`.
- Lista de servicios disponibles: `GET /lifecycle/services/logs/active`
  al montar el tab.
- Sin live WS — Core no broadcastea frames de containers. El tab
  polea cada 5s (cuando no está en pausa) llamando `refresh()` del
  hook compartido.
- Filtros: `service` (selector dinámico), `stream` (stdout/stderr).
- Deep-link: `/activity?tab=containers&svc=jellyfin` preselecciona el
  servicio al primer render.

## Decisiones

- **Sin react-virtual aún**: el cap REST **no es uniforme**. El hook
  compartido pide `DEFAULT_LIMIT = 200` y los tabs de Events y
  Notifications lo respetan; los **tres tabs de logs ignoran ese
  parámetro y hardcodean `limit: 500`** en su `fetchSnapshot`. El buffer
  en memoria sí es común: `MAX_BUFFER = 1000` filas incluidas las live
  (`useActivityRows.ts:20-21`). Con esos números el DOM no se resiente.
  Si una futura sesión necesita 10k+ rows visibles a la vez, se monta
  `@tanstack/react-virtual` sobre `ActivityTable` en un único punto.
- **Containers sin WS**: añadir un broadcast por frame para cada
  container abriría un firehose. La rotación FIFO ya limita los
  archivos y el polling de 5s es suficiente para una UI de admin que
  no es un terminal en directo.
- **Dedupe**: como los logs no tienen id, cada adapter calcula una
  clave determinista (timestamp + source + slice(message)) que el
  hook usa para no duplicar entre snapshot y live append.
