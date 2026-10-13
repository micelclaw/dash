# Activity Center — Events + Notifications tabs

> **AS-BUILT (2026-08-04).** Escrito en la Sesión 6. Corregido: el tab
> Notifications NO se alimenta de 4 tipologías fijas, sino de todos los tipos
> indexados por el registro de notificaciones de Core (64 plantillas).

## Events tab

- Adapter: [`adapters/events.adapter.ts`](../../src/modules/activity/adapters/events.adapter.ts).
- Snapshot: `GET /api/v1/agent-events?limit=200` (el `limit` lo pone el
  hook compartido, `DEFAULT_LIMIT`). Devuelve los eventos más recientes
  con `severity` y `schema_version` incluidos.
- Filtros: severity (5 niveles) + domain prefix (auth./system./
  lifecycle./...), aplicados **en cliente** (`matchesFilters`). El
  search-bar del header hace filter substring sobre el JSON de cada fila.
- Live: el tab se suscribe a `agent.event` vía
  `useWebSocketStore`. Cada frame WS se transforma en una fila y se
  prepende al buffer (dedupe por id, cap 1000).
- Detalle (drawer): muestra event id, type, severity, timestamp y el
  payload completo en `<pre>`.

## Notifications tab

- Adapter: [`adapters/notifications.adapter.ts`](../../src/modules/activity/adapters/notifications.adapter.ts).
- Snapshot: `GET /api/v1/activity/notifications-history?window=24h&limit=200`.
  Core devuelve los eventos del bus **cuyo `type` está indexado por alguna
  plantilla del registro de notificaciones** — el filtro es
  `inArray(agentEvents.type, notificationEventTypes())`
  (`core/src/routes/activity.ts:121-125`), derivado de las **64 plantillas**
  de `core/src/services/notifications/notification-registry.ts`. No son 4
  tipologías fijas. Cada fila llega con su `rule_key` ya resuelto.
- **`rule_key` ≠ `type`.** El registro mapea eventos a reglas, y el nombre
  cambia en el camino. Dos ejemplos reales:
  - evento `system.error.unhandled` → regla `system.error.critical`
  - evento `auth.login.failed` → regla `auth.brute_force.detected`
  Un tipo sin plantilla propia cae en la regla de fallback `system.fallback`.
- Filtros: regla. **El desplegable tiene 4 opciones hardcodeadas en el
  adapter** (`notifications.adapter.ts:18-23`: `system.error.critical`,
  `lifecycle.service.failed`, `auth.brute_force.detected`,
  `billing.plan_limit.exceeded`) — un subconjunto del registro de 64.

  > ⚠️ **Requiere validación humana:** ¿ese subconjunto de 4 reglas en el
  > filtro es deliberado (solo interesan las críticas) o quedó desactualizado
  > al crecer el registro? No hay comentario, commit ni ADR que lo diga. Si es
  > deliberado, documentarlo aquí como decisión; si no, es deuda: el filtro
  > debería derivarse del registro (`GET /activity/notification-rules` ya lo
  > devuelve entero).

- Live: el tab se suscribe a `notification.new` (el mismo WS que
  alimenta el bell de Shell). Las filas live se dedupean con el
  snapshot por `source_event_id`.
- Detalle (drawer): muestra regla, evento fuente, severity,
  timestamp y payload.

## Hook compartido `useActivityRows`

[useActivityRows.ts](../../src/modules/activity/useActivityRows.ts):
- Llama a `adapter.fetchSnapshot()` cuando cambian filtros / search /
  rango de tiempo, con `limit: DEFAULT_LIMIT` (200).
- Suscribe a un WS pattern (opcional) y prepende filas
  transformadas.
- Aplica search overlay client-side.
- Respeta `paused` (no añade filas live mientras la UI esté pausada).
- Guarda monótona: si dos snapshots se solapan, solo gana el de la
  petición más reciente.

Cada tab pasa su propio `transform(event) → Row | null`; el resto
de la mecánica vive en el hook.

## Aproximación deliberada en Notifications

El centro Core no persiste los pushes despachados en una tabla
dedicada. La sesión 6 NO añadió migración nueva — en su lugar deriva
el "histórico" filtrando `agent_events` por tipo. Pros: cero coste
operacional; cons: una fila aparece aunque la regla esté
desactivada (la deshabilitación sólo evita el push, no el evento).
Si en el futuro persistimos pushes a una tabla `notifications`,
este endpoint se mantiene como compatibilidad y el adapter cambia
una línea.
