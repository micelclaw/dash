# Activity Center — Events + Notifications tabs (Sesión 6)

## Events tab

- Adapter: [`adapters/events.adapter.ts`](../../src/modules/activity/adapters/events.adapter.ts).
- Snapshot: `GET /api/v1/agent-events?limit=200`. Devuelve los eventos
  más recientes con `severity` y `schema_version` incluidos
  (añadidos al endpoint en esta sesión).
- Filtros: severity (5 niveles) + domain prefix (auth./system./
  lifecycle./...). El search-bar del header hace filter substring
  sobre el JSON de cada fila.
- Live: el tab se suscribe a `agent.event` vía
  `useWebSocketStore`. Cada frame WS se transforma en una fila y se
  prepende al buffer (dedupe por id, cap 1000).
- Detalle (drawer): muestra event id, type, severity, timestamp y el
  payload completo en `<pre>`.

## Notifications tab

- Adapter: [`adapters/notifications.adapter.ts`](../../src/modules/activity/adapters/notifications.adapter.ts).
- Snapshot: `GET /api/v1/activity/notifications-history?window=24h&limit=200`.
  Core devuelve los eventos del bus de las 4 tipologías que disparan
  las reglas built-in del push subscriber (`system.error.unhandled`,
  `lifecycle.service.failed`, `auth.login.failed`,
  `billing.plan_limit.exceeded`), cada uno con `rule_key` ya
  mapeado.
- Filtros: regla.
- Live: el tab se suscribe a `notification.new` (el mismo WS que
  alimenta el bell de Shell). Las filas live se dedupean con el
  snapshot por `source_event_id`.
- Detalle (drawer): muestra regla, evento fuente, severity,
  timestamp y payload.

## Hook compartido `useActivityRows`

[useActivityRows.ts](../../src/modules/activity/useActivityRows.ts):
- Llama a `adapter.fetchSnapshot()` cuando cambian filtros / search.
- Suscribe a un WS pattern (opcional) y prepende filas
  transformadas.
- Aplica search overlay client-side.
- Respeta `paused` (no añade filas live mientras la UI esté pausada).

Cada tab pasa su propio `transform(event) → Row | null`; el resto
de la mecánica vive en el hook.

## Aproximación deliberada en Notifications

El centro Core no persiste los pushes despachados en una tabla
dedicada. La sesión 6 NO añade migración nueva — en su lugar deriva
el "histórico" filtrando `agent_events` por tipo. Pros: cero coste
operacional; cons: una fila aparece aunque la regla esté
desactivada (la deshabilitación sólo evita el push, no el evento).
Si en el futuro persistimos pushes a una tabla `notifications`,
este endpoint se mantiene como compatibilidad y el adapter cambia
una línea.
