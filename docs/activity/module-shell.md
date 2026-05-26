# Activity Center — module shell (Sesión 5)

> Frontend del centro unificado de eventos y logs, inspirado en
> Synology Log Center.

## Layout

```
+------------+-------------------------------------------+
|  Sidebar   |  Header (histograma + filtros + pause)   |
|  · Events  +-------------------------------------------+
|  · Notif.  |                                           |
|  · Gateway |          Table (rows + drawer)            |
|  · Cont.   |                                           |
|  · Core    |                                           |
+------------+-------------------------------------------+
```

- **Sidebar izquierda** (`ActivityModule.tsx`): 5 tabs fijos, badge de
  uso (%) por bucket calculado vía `GET /activity/stats`. El botón
  ⚙ abre el modal de Settings (Sesión 8).
- **Header** (`ActivityHeader.tsx`): histograma stacked-bar de la
  última 24h por severity + filtros que el adapter declara + búsqueda
  + toggle Pausar/Reanudar.
- **Table** (`ActivityTable.tsx`): tabla genérica con drawer detalle
  al hacer click en una fila. Las columnas vienen del adapter.

## Adapter contract

Cada tab implementa un `Adapter<Row>` (`adapters/types.ts`):

```ts
interface Adapter<Row> {
  tabKey: 'events' | 'notifications' | 'gateway' | 'containers' | 'core';
  title: string;
  iconLabel: string;
  filters: AdapterFilter[];
  columns: AdapterColumn<Row>[];
  fetchSnapshot(params): Promise<AdapterFetchResult<Row>>;
  renderDetail(row): ReactNode;
  getRowKey?(row): string;
}
```

Sesión 5 deja `buildPlaceholderAdapter()` para los 5 tabs — las
sesiones 6 y 7 implementan los reales:

| Tab          | Adapter (futuro)                                  | Sesión |
|--------------|---------------------------------------------------|--------|
| Events       | `adapters/events.adapter.ts`                      | 6      |
| Notifications| `adapters/notifications.adapter.ts`               | 6      |
| Gateway logs | `adapters/gateway-logs.adapter.ts`                | 7      |
| Containers   | `adapters/container-logs.adapter.ts`              | 7      |
| Core (pino)  | `adapters/core-logs.adapter.ts`                   | 7      |

## Servicios

`services/activity.service.ts` reúne todos los endpoints Core
(`/activity/stats`, `/activity/settings`, `/activity/notification-rules`,
`/agent-events`, `/core/logs`, `/lifecycle/services/...`, `/gateway/logs`).
Cada adapter consume desde aquí — los componentes no hablan con `api.ts`
directamente.

## Admin-gate

La página completa requiere `user.role === 'admin' | 'owner'`. La
entrada del sidebar (`config/modules.ts`) NO se oculta — la página
muestra un mensaje claro si el usuario no es admin. El backend ya
enforce con `requireAdmin` middleware.

## Routing

- Ruta: `/activity` (lazy import).
- Query string: `?tab=events|notifications|gateway|containers|core`
  sincronizado bidireccionalmente con el estado interno (`useEffect`).
- `?svc=jellyfin` (preset del tab containers, Sesión 7).
- `?settings=open` abrirá el modal de Settings (Sesión 8).
