# Activity Center — module shell

> **AS-BUILT (2026-08-04).** Se escribió durante la Sesión 5, cuando los tabs
> eran placeholders; los 6 adapters llevan meses implementados. El contrato
> `Adapter<Row>` que describe **sigue siendo la arquitectura real** — lo que se
> ha corregido aquí es el número de tabs (6, con `live` por defecto), el header
> (gráfico de líneas, no histograma de 24h), el admin-gate y la desaparición de
> `buildPlaceholderAdapter()`.

> Frontend del centro unificado de eventos y logs, inspirado en
> Synology Log Center.

## Layout

```
+------------+-------------------------------------------+
|  Sidebar   |  Header (líneas + rango + filtros + pause) |
|  · Live    +-------------------------------------------+
|  · Events  |                                           |
|  · Notif.  |          Table (rows + drawer)            |
|  · Gateway |                                           |
|  · Cont.   |                                           |
|  · Core    |                                           |
+------------+-------------------------------------------+
```

- **Sidebar izquierda** (`ActivityModule.tsx`): 6 tabs fijos, badge de
  uso (%) por bucket calculado vía `GET /activity/stats` — **solo los
  4 tabs que tienen bucket** (`events`, `gateway`, `containers`,
  `core`); `live` y `notifications` no persisten nada propio. El botón
  ⚙ abre el modal de Settings. En móvil (`useIsMobile()`) el rail
  vertical se convierte en una tira horizontal.
- **Header** (`ActivityHeader.tsx`): **gráfico de líneas** (recharts)
  calculado sobre las filas ACTUALES del tab (snapshot + live), una
  línea por bucket que el adapter proyecta con `histogramOf`
  (severity / log level / stream de docker…). La granularidad se elige
  sola según el rango de datos: `< 3h` → minuto, `< 7d` → hora,
  `≥ 7d` → día; los huecos se rellenan con cero explícito para que la
  línea no se rompa. Junto al gráfico: `TimeRangePicker` (ventana
  explícita `from`/`to` que se propaga a `fetchSnapshot` de todos los
  tabs), los filtros que declara el adapter, la búsqueda y el toggle
  Pausar/Reanudar.
- **Table** (`ActivityTable.tsx`): tabla genérica con drawer detalle
  al hacer click en una fila. Las columnas vienen del adapter.

## Adapter contract

Cada tab implementa un `Adapter<Row>` (`adapters/types.ts`):

```ts
interface Adapter<Row> {
  tabKey: 'live' | 'events' | 'notifications' | 'gateway' | 'containers' | 'core';
  title: string;
  iconLabel: string;
  filters: AdapterFilter[];
  columns: AdapterColumn<Row>[];
  fetchSnapshot(params): Promise<AdapterFetchResult<Row>>;
  renderDetail(row): ReactNode;
  getRowKey?(row): string;
  /** Filtro cliente aplicado al snapshot Y a cada fila live. */
  matchesFilters?(row, filters): boolean;
  /** Proyección para el gráfico de líneas del header. */
  histogramOf?(row): { time: string; bucket: string } | null;
}
```

Los 6 adapters están implementados (`buildPlaceholderAdapter()` ya no
existe en el repo):

| Tab           | Adapter                              | Origen de datos |
|---------------|--------------------------------------|-----------------|
| Live          | `adapters/live.adapter.ts`           | **Solo WS** (`activity.tool`) — sin snapshot REST, sin bucket, sin persistencia: se reinicia al recargar la página |
| Events        | `adapters/events.adapter.ts`         | `GET /agent-events` + WS `agent.event` |
| Notifications | `adapters/notifications.adapter.ts`  | `GET /activity/notifications-history` + WS `notification.new` |
| Gateway logs  | `adapters/gateway-logs.adapter.ts`   | `GET /gateway/logs` + WS `gateway.logs.entry` |
| Containers    | `adapters/container-logs.adapter.ts` | `GET /lifecycle/services/...` (polling 5 s, sin WS) |
| Core (pino)   | `adapters/core-logs.adapter.ts`      | `GET /core/logs` + WS `core.logs.entry` |

## Servicios

`services/activity.service.ts` reúne todos los endpoints Core
(`/activity/stats`, `/activity/settings`, `/activity/notification-rules`,
`/agent-events`, `/core/logs`, `/lifecycle/services/...`, `/gateway/logs`).
Cada adapter consume desde aquí — los componentes no hablan con `api.ts`
directamente.

## Admin-gate

La página completa requiere `user.role === 'admin' | 'owner'`, y el gate
es de **dos capas**:

1. La entrada del sidebar **SÍ se oculta** para no-admin: el registro
   declara `adminOnly: true` (`config/modules.ts:71`) y ambos caminos
   que construyen la navegación lo filtran —
   `components/shell/Sidebar.tsx:187` y
   `hooks/use-visible-modules.ts:33` (`if (m.adminOnly) return isAdmin;`).
2. La propia página (`ActivityModule.tsx`) repite el check y muestra un
   mensaje claro — eso cubre la **navegación directa por URL**, que es
   lo único que el filtro del sidebar no puede impedir.

El backend enforce con el middleware `requireAdmin`.

## Routing

- Ruta: `/activity` (lazy import).
- Query string: `?tab=live|events|notifications|gateway|containers|core`
  sincronizado bidireccionalmente con el estado interno. **Sin `?tab=`,
  el tab por defecto es `live`** (`ActivityModule.tsx:69`); un valor
  desconocido también cae en `live`.
- `?svc=jellyfin` (preset del tab containers).
- `?settings=open` abre el modal de Settings (deeplink-only: al cerrar
  el modal el querystring no se reescribe).
