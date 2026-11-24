# Activity Center — Gateway / Containers / Core log tabs

> Contraste documental puntual: 2026-11-24; sin prueba de UI ni acceso a logs reales.

> **Registro histórico (2026-08-04); contraste estático posterior.** Escrito en la Sesión 7. Corregidos los parámetros
> de query de los tres snapshots (estaban mal los cuatro) y el cap de filas por
> tab.

Las 3 fuentes de logs viven detrás de tabs separados. Gateway y Core usan
snapshot REST y eventos WS; Containers usa snapshot REST con polling.
Los tres reciben además `from`/`to` cuando el `TimeRangePicker` del
header tiene una ventana explícita. El rango predefinido fija su extremo al seleccionarlo;
no es una ventana móvil. El filtro usa timestamps y la ausencia de filas no prueba
ausencia de logs fuera del snapshot o de la ventana.

Los logs pueden contener datos sensibles. Las rutas Core y contenedores inspeccionadas
exigen rol `admin` literal; Gateway usa `requireAdmin`, que contempla `owner`/`admin`
y limita scopes. Dash puede permitir acceder a una vista que después reciba 403 en
algunas rutas. Los tabs leen `loading` y filas pero no presentan el error de snapshot
del hook mediante ese estado. Por separado, el despacho WS inspeccionado autentica
la conexión pero no muestra una guarda de rol en las suscripciones de logs de Core
y Gateway; S01/S03 deben revisar esa posible discrepancia sin asumir explotación.
No se han leído logs reales.

## Gateway logs

- Adapter: [`adapters/gateway-logs.adapter.ts`](../../src/modules/activity/adapters/gateway-logs.adapter.ts).
- Snapshot: `GET /api/v1/gateway/logs?limit=500` (+ `from`/`to`).
  **No manda `tail=`** — el service solo traduce `limit`, `from` y `to`
  (`services/activity.service.ts:220-228`).
- Live: `gateway.logs.entry` — el tab manda `gateway.logs.subscribe`
  cuando el socket está conectado y `unsubscribe` al desmontar (idempotente: el broadcaster
  refcounta).
- Filtros: `level` (debug/info/warn/error/trace), aplicado en cliente.
- Drawer: source + raw message en `<pre>`.

## Core (pino) logs

- Adapter: [`adapters/core-logs.adapter.ts`](../../src/modules/activity/adapters/core-logs.adapter.ts).
- Snapshot: `GET /api/v1/core/logs?limit=500` + `level` (+ `from`/`to`).
  **El adapter NO manda `tail_bytes`** aunque el service lo soporte.
- El `level` va **server-side**; el backend escanea una ventana más ancha
  cuando se le pasa el nivel. La proporción de mensajes varía por entorno.
  `matchesFilters()` reaplica el mismo gate a las filas live para que el
  resultado sea coherente.
- Live: `core.logs.entry` con subscribe al estar conectado y unsubscribe al desmontar.
- Filtros: `level` (trace/debug/info/warn/error/fatal).
- Columnas: time, level, source (pino `name`), reqId (Fastify), msg.
- Drawer: muestra timestamp, level/source/reqId, message y el raw
  frame pino en JSON.

## Container logs

- Adapter: [`adapters/container-logs.adapter.ts`](../../src/modules/activity/adapters/container-logs.adapter.ts).
- Snapshot: dos modos según la selección de `service`:
  - `__merged__` (default): `GET /lifecycle/services/logs?tail_bytes=262144&limit=500` (256 KB).
  - servicio concreto: `GET /lifecycle/services/<name>/logs?tail_bytes=1048576&limit=500` (1 MB).
  El intervalo temporal cubierto depende del volumen de logs; una ventana fija
  en bytes no garantiza una hora. El backend
  capa en **512 KB** (merged) y **4 MB** (por servicio) sin rango explícito;
  con `from` o `to`, la ruta intenta leer el archivo actual completo (en merged,
los `.log` encontrados); después filtra y limita a 500 filas en estos adaptadores.
No acredita cobertura de rotaciones anteriores.
  Ver `core/src/routes/lifecycle-logs.ts`.
- Lista de servicios disponibles: `GET /lifecycle/services/logs/active`
  al montar el tab.
- Sin live WS — Core no broadcastea frames de containers. El tab
  configura polling a 5 s cuando no está en pausa mediante `refresh()` del hook.
  Los renders pueden reiniciar el temporizador; no garantiza refresco cada 5 s.
- Filtros: `service` (selector dinámico), `stream` (stdout/stderr).
- Deep-link: `/activity?tab=containers&svc=jellyfin` preselecciona el
  servicio al primer render.

## Decisiones

- **Sin react-virtual aún**: el cap REST **no es uniforme**. El hook
  compartido pide `DEFAULT_LIMIT = 200` y los tabs de Events y
  Notifications lo respetan; los **tres tabs de logs ignoran ese
  parámetro y hardcodean `limit: 500`** en su `fetchSnapshot`. El buffer
  en memoria sí es común: `MAX_BUFFER = 1000` filas incluidas las live
  (`useActivityRows.ts:20-21`). No se ha medido aquí el rendimiento del DOM.
  Si una futura sesión necesita 10k+ rows visibles a la vez, se monta
  `@tanstack/react-virtual` sobre `ActivityTable` en un único punto.
- **Containers sin WS**: añadir un broadcast por frame para cada
  container abriría un firehose. La rotación prevista limita los
  archivos y el polling de 5s fue la decisión histórica; su suficiencia y ejecución
  efectiva no se han medido en este contraste.
- **Dedupe**: como los logs no tienen id, cada adapter calcula una
  clave determinista (timestamp + source + slice(message)) que el
  hook usa al insertar una fila live. Un snapshot posterior sustituye el buffer;
  no se garantiza mezcla sin pérdida en cualquier orden de llegada.
