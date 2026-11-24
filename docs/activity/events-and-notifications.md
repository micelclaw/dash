# Activity Center — Events + Notifications tabs

> **Registro histórico (2026-08-04); contraste estático posterior, sin prueba runtime.** Escrito en la Sesión 6. Corregido: el tab
> Notifications NO se alimenta de 4 tipologías fijas, sino de todos los tipos
> indexados por el registro de notificaciones de Core (el recuento de 64 era histórico).

## Events tab

- Adapter: [`adapters/events.adapter.ts`](../../src/modules/activity/adapters/events.adapter.ts).
- Snapshot: `GET /api/v1/agent-events?limit=200` (el `limit` lo pone el
  hook compartido, `DEFAULT_LIMIT`). Devuelve los eventos más recientes del usuario que consulta
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
  La ruta Core inspeccionada exige rol `admin` literal y consulta por fecha/tipo
  sin filtro por usuario, por lo que puede incluir payload y `user_id` de otros.
  Dash también permite entrar a `owner`, pero esa ruta concreta puede rechazarlo.
  Core devuelve los eventos del bus **cuyo `type` está indexado por alguna
  plantilla del registro de notificaciones** — el filtro es
  `inArray(agentEvents.type, notificationEventTypes())`
  (`core/src/routes/activity.ts:121-125`), derivado de las plantillas
  de `core/src/services/notifications/notification-registry.ts`. No son 4
  tipologías fijas. Cada fila recibe una `rule_key` asociada al tipo; no acredita qué regla produjo
  un envío ni que se haya enviado una notificación.
- **`rule_key` ≠ `type`.** El registro mapea eventos a reglas, y el nombre
  cambia en el camino. Dos ejemplos reales:
  - evento `system.error.unhandled` → regla `system.error.critical`
  - evento `auth.login.failed` → regla `auth.brute_force.detected`
  El mapeo dispone de `system.fallback` para tipos desconocidos, pero el snapshot
  filtra antes por tipos indexados y no incluye necesariamente todos esos eventos.
- Filtros: regla. **El desplegable tiene 4 opciones hardcodeadas en el
  adapter** (`notifications.adapter.ts:18-23`: `system.error.critical`,
  `lifecycle.service.failed`, `auth.brute_force.detected`,
  `billing.plan_limit.exceeded`) — un subconjunto del registro, cuyo tamaño puede cambiar.

  > ⚠️ **Requiere validación humana:** ¿ese subconjunto de 4 reglas en el
  > filtro es deliberado (solo interesan las críticas) o quedó desactualizado
  > al crecer el registro? No hay comentario, commit ni ADR que lo diga. Si es
  > deliberado, documentarlo aquí como decisión; si no, es deuda: el filtro
  > debería derivarse del registro (`GET /activity/notification-rules` ya lo
  > devuelve entero).

- Live: el tab se suscribe a `notification.new` (el mismo WS que
  alimenta el bell de Shell). Al insertar filas live se deduplica por
  `source_event_id`; la llegada posterior de un snapshot reemplaza las filas,
  por lo que no se garantiza una mezcla sin pérdida en cualquier orden.
- Detalle (drawer): snapshot y live pueden diferir. La transformación live conserva
  plantilla y título, no el payload completo, y descarta frames sin ID y tipo fuente.

## Hook compartido `useActivityRows`

[useActivityRows.ts](../../src/modules/activity/useActivityRows.ts):
- Llama a `adapter.fetchSnapshot()` cuando cambian filtros / search /
  rango de tiempo, con `limit: DEFAULT_LIMIT` (200).
- Suscribe a un WS pattern (opcional) y prepende filas
  transformadas.
- Aplica filtros y búsqueda al snapshot limitado y buffer cliente; no busca en todo el
  histórico. Sin resultados no demuestra ausencia de coincidencias anteriores.
- Respeta `paused` (no añade filas live mientras la UI esté pausada).
- Un rango predefinido fija el límite superior al seleccionarse; los frames con timestamp fuera de ese intervalo quedan fuera, aunque lleguen
  después; un frame recibido tarde con fecha dentro del rango puede incluirse. El hook conserva el error del snapshot, pero estos
  tabs no lo presentan mediante ese estado.
- Guarda monótona: si dos snapshots se solapan, solo gana el de la
  petición más reciente.

Cada tab pasa su propio `transform(event) → Row | null`; el resto
de la mecánica vive en el hook.

## Aproximación deliberada en Notifications

El centro Core no persiste los pushes despachados en una tabla
dedicada. La sesión 6 NO añadió migración nueva — en su lugar deriva
el "histórico" filtrando `agent_events` por tipo. Evita una tabla nueva, pero consultar y conservar eventos tiene coste; además, una fila aparece aunque la regla esté desactivada. El envío
omite la plantilla desactivada; si ninguna otra coincide, puede intervenir el
fallback según la severidad y su propia configuración.
Si en el futuro persistimos pushes a una tabla `notifications`,
este endpoint se mantiene como compatibilidad y el adapter cambia
una línea.
