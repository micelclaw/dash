# Activity Center — Settings modal (Sesión 8)

Modal admin-only abierto desde el icono ⚙ del sidebar del Activity
Center, o vía `?settings=open` en el querystring. Cuatro secciones:

## 1. Storage & Retention

- Input numérico para el presupuesto total en MB (rango 10…10240).
- Botón "Aplicar" llama a `PATCH /activity/settings { budget_mb }`.
- Tabla read-only con el reparto hardcoded 40/25/20/15 y los MB
  correspondientes calculados por el backend.
- Texto aclaratorio: la rotación temporal de Events (RETENTION_RULES,
  Ola 10) manda; el budget aplica el techo. Logs archivados rotan
  FIFO al 90%.

## 2. Notifications — built-in rules

Lista las 4 reglas built-in devueltas por `GET /activity/notification-rules`:

- Toggle ON/OFF que dispara `PATCH /activity/notification-rules/<key>`
  con el `enabled` actual.
- Inputs numéricos para cada threshold (sólo `auth.brute_force.detected`
  tiene `count` y `window_seconds`). El cambio escribe inmediatamente.
- Badge "override" cuando hay fila en `notification_rule_overrides`.
- Botón "Reset" (sólo en filas con override) re-aplica los defaults
  vía PATCH con threshold `{}`.

El backend emite `activity.settings.changed` con `change=rule_override`
y el subscriber `push-from-events` recarga el caché sin restart Core.

## 3. Backup & Export

- "Eventos (mis filas)" → abre `GET /agent-events/by-user/<id>/export`
  en nueva pestaña. El backend serializa hasta 50k filas.
- Gateway / Core / Containers raw export quedan deshabilitados con
  tooltip "Próximamente" — pendientes de Sesión 10 o post-MVP.

## 4. Privacy & GDPR

- "Export my data" — idéntico al export de Backup.
- "Erase my data" — confirm + `DELETE /agent-events/by-user/<id>`
  vía PATCH (Core ya tiene la ruta DELETE; el cliente del dash sólo
  expone GET/POST/PATCH así que se hace stub temporal con PATCH;
  la ruta DELETE existe server-side, pendiente sumar `api.delete()`
  en una limpieza futura).
- Texto explicativo: el endpoint anonimiza `user_id`, no borra los
  payloads. Algunas filas archivadas pueden persistir.

## Apertura del modal

- Botón ⚙ del header del sidebar → `setSettingsOpen(true)`.
- `?settings=open` en la URL al cargar el módulo → estado inicial
  abierto. Después de cerrar el modal, el querystring NO se reescribe
  (es deeplink-only).

## Decisiones

- **No editor de regla custom**: el plan eliminó esa parte (el módulo
  `/triggers` se retira en Sesión 9 — el trigger engine sigue activo
  server-side pero sin CRUD visual).
- **Bandera `overridden`**: visible en cada regla aunque enabled=true
  + threshold = defaults — la fila en `notification_rule_overrides`
  existe pero el comportamiento es default. Se podría limpiar
  borrando la fila (DELETE) — pendiente.
- **Inputs numéricos vivos**: PATCH on change. Si el usuario edita
  muy rápido, se puede racear; aceptable para un panel admin.
