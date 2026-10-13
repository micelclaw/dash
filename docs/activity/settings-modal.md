# Activity Center — Settings modal

> **AS-BUILT (2026-08-04).** Escrito en la Sesión 8. Corregido: la lista de
> reglas no son 4, son las que devuelve el registro entero de Core (64
> plantillas + fallback = 65 filas); y la justificación de por qué "Erase my
> data" usa PATCH ya no se sostiene.

Modal admin-only abierto desde el icono ⚙ del sidebar del Activity
Center, o vía `?settings=open` en el querystring. Cuatro secciones:

## 1. Storage & Retention

- Input numérico para el presupuesto total en MB (rango 10…10240,
  `BUDGET_MIN`/`BUDGET_MAX`).
- Botón "Aplicar" llama a `PATCH /activity/settings { budget_mb }`.
- Tabla read-only con el reparto por bucket (events / gateway /
  containers / core) y los MB correspondientes calculados por el
  backend.
- Texto aclaratorio: la rotación temporal de Events (RETENTION_RULES,
  Ola 10) manda; el budget aplica el techo. Logs archivados rotan
  FIFO al 90%.

## 2. Notifications — built-in rules

Lista **TODAS** las plantillas que devuelve `GET /activity/notification-rules`
— el modal las mapea sin filtrar (`rules.map(...)`). Hoy son **64 plantillas**
del registro (`core/src/services/notifications/notification-registry.ts`) más
la fila del **fallback genérico** (`system.fallback`) = 65 filas. No es un
puñado fijo: crece con el registro.

- Toggle ON/OFF que dispara `PATCH /activity/notification-rules/<key>`
  con el `enabled` actual (manda también el `threshold` vigente).
- **Inputs numéricos solo en las filas que declaran `defaults`** — hoy dos:
  - la plantilla `auth.brute_force.detected` (`count`, `window_seconds`), y
  - la fila de fallback `system.fallback` (`severity_floor`,
    `dedupe_window_seconds`).

  El resto de filas no pintan bloque de thresholds. El cambio escribe
  inmediatamente (PATCH on change).
- Badge "override" cuando hay fila en `notification_rule_overrides`.
- Botón "Reset" — vive **dentro del bloque de thresholds**, así que solo
  aparece en filas que (a) declaran `defaults` y (b) tienen override.
  Llama a `resetNotificationRule()`, que es un PATCH con
  `{ enabled: true, threshold: {} }`, y luego recarga la lista entera.

El backend emite `activity.settings.changed` con `change=rule_override`
y el subscriber `push-from-events` recarga el caché sin restart Core.

## 3. Backup & Export

- "Eventos (mis filas)" → abre `GET /agent-events/by-user/<id>/export`
  en nueva pestaña (admin o self, máx 50k filas por llamada).
- Gateway / Core / Containers raw export quedan deshabilitados con
  tooltip "Próximamente".

## 4. Privacy & GDPR

- "Export my data" — idéntico al export de Backup.
- "Erase my data" — `window.confirm` + borrado del historial del usuario.
  **Deuda conocida:** el modal sigue llamando `api.patch()` sobre
  `/agent-events/by-user/<id>` (`ActivitySettingsModal.tsx:146`) aunque
  `api.delete()` **ya existe** en el cliente (`services/api.ts:285`) y se usa
  en decenas de sitios del dash. Cambiarlo a `api.delete()` es un one-liner
  pendiente; la vieja justificación ("el cliente sólo expone GET/POST/PATCH")
  es falsa hoy.
- Texto explicativo: el endpoint anonimiza `user_id`, no borra los
  payloads. Algunas filas archivadas pueden persistir.

## Apertura del modal

- Botón ⚙ del header del sidebar → `setSettingsOpen(true)`.
- `?settings=open` en la URL al cargar el módulo → estado inicial
  abierto. Después de cerrar el modal, el querystring NO se reescribe
  (es deeplink-only).

## Decisiones

- **No editor de regla custom**: el plan eliminó esa parte (el módulo
  `/triggers` se retiró en la Sesión 9 — el trigger engine sigue activo
  server-side pero sin CRUD visual).
- **Bandera `overridden`**: visible en cada regla aunque enabled=true
  + threshold = defaults — la fila en `notification_rule_overrides`
  existe pero el comportamiento es default. Se podría limpiar
  borrando la fila (DELETE) — pendiente.
- **Inputs numéricos vivos**: PATCH on change. Si el usuario edita
  muy rápido, se puede racear; aceptable para un panel admin.
