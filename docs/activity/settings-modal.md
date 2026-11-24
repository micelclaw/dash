# Activity Center — Settings modal

> **AS-BUILT (2026-08-04).** Escrito en la Sesión 8. Corregido: la lista de
> reglas no son 4, son las que devuelve el registro de Core más el fallback;
> el recuento 64+1 era una observación histórica, no un límite; y la justificación de por qué "Erase my
> data" usa PATCH ya no se sostiene. Contraste parcial de privacidad el 2026-11-23:
> se inspeccionó el código local, sin comprobar el comportamiento en el producto cargado.

Modal admin-only abierto desde el icono ⚙ del sidebar del Activity
Center, o vía `?settings=open` en el querystring. Cuatro secciones:

## 1. Storage & Retention

- Input numérico para el presupuesto total en MB (rango 10…10240,
  `BUDGET_MIN`/`BUDGET_MAX`).
- Botón "Aplicar" llama a `PATCH /activity/settings { budget_mb }`.
- Tabla read-only con asignaciones de MB calculadas por bucket (events /
  gateway / containers / core); no son una medición de uso.
- La UI presenta un texto sobre retención y presupuesto. La retención temporal
  de Events actúa por separado; el cálculo inspeccionado devuelve cero bytes para
  ese bucket y no acredita un techo por tamaño para esas filas. El job recorta
  archivos activos de Gateway/Core y selecciona logs de contenedores por antigüedad.
  Revisar el texto de UI y la limitación con producto.

## 2. Notifications — built-in rules

Lista **TODAS** las plantillas que devuelve `GET /activity/notification-rules`
— el modal las mapea sin filtrar (`rules.map(...)`). Las plantillas proceden del
registro (`core/src/services/notifications/notification-registry.ts`) y se añade
el **fallback genérico** (`system.fallback`). El número puede cambiar con el registro;
una inspección de fuente no acredita la configuración cargada.

- Toggle ON/OFF que dispara `PATCH /activity/notification-rules/<key>`
  con el `enabled` actual (manda también el `threshold` vigente).
- **Bloque de thresholds en filas con `defaults`:** el modal genera inputs desde las
  claves declaradas. El registro inspeccionado incluye, entre otras,
  `auth.brute_force.detected` y `sandbox.sql.rejected.repeated`, además de
  `system.fallback`. No se ha probado que la edición numérica represente correctamente
  `severity_floor`, cuyo default en Core es una cadena: el modal genera un input
  numérico y usa `parseInt`. El cambio dispara PATCH on change; S01/S03 deben revisar
  ese contrato sin afirmar que la edición funciona.
- Badge "override" cuando hay fila en `notification_rule_overrides`.
- Botón "Reset" — vive **dentro del bloque de thresholds**, así que solo
  aparece en filas que (a) declaran `defaults` y (b) tienen override.
  Llama a `resetNotificationRule()`, que es un PATCH con
  `{ enabled: true, threshold: {} }`, y luego recarga la lista entera. No equivale
  en general a eliminar el override: el contrato admite defaults desactivados,
  aunque la plantilla así identificada no muestra actualmente este botón.

El backend intenta emitir `activity.settings.changed` y el subscriber recarga la
caché de forma asíncrona; si falla la lectura, la vacía y usa defaults. Una respuesta
no acredita que todos los consumidores hayan aplicado el cambio.

## 3. Backup & Export

- "Eventos (mis filas)" → abre `GET /agent-events/by-user/<id>/export`
  en nueva pestaña (admin o self). Devuelve como máximo las 50.000 filas más
  recientes de `agent_events`, en JSON con payloads y sin paginación en la ruta
  inspeccionada: no es copia íntegra ni restaurable. La nueva pestaña depende de
  la autenticación disponible en ella; no añade el Bearer de `api.ts`.
  `truncated` indica posible truncamiento cuando se devuelven exactamente 50.000
  filas; la consulta no comprueba una fila adicional.
- Gateway / Core / Containers raw export quedan deshabilitados con
  tooltip "Próximamente".

## 4. Privacy & GDPR

- "Export my data" — idéntico al export de Backup.
- "Erase my data" — solicita confirmación para borrar el historial del usuario;
  el resultado del borrado desde el modal no está acreditado.
  **Deuda conocida:** el modal sigue llamando `api.patch()` sobre
  `/agent-events/by-user/<id>` (`ActivitySettingsModal.tsx:146`) aunque
  `api.delete()` **ya existe** en el cliente (`services/api.ts:285`) y se usa
  en decenas de sitios del dash. La vieja justificación ("el cliente sólo expone
  GET/POST/PATCH") es falsa hoy; la corrección funcional requiere revisar también
  permisos, alcance y confirmación del borrado.
- El DELETE existente en Core elimina físicamente las filas de `agent_events` del
  usuario indicado y exige el rol `admin`; no es una anonimización. La UI inspeccionada
  envía PATCH, por lo que esta lectura no acredita que el borrado funcione desde el modal.
  El texto visible afirma anonimización y requiere corrección de producto. No se
  ha comprobado el tratamiento de archivos o copias históricas.

## Apertura del modal

- Botón ⚙ del header del sidebar → `setSettingsOpen(true)`.
- `?settings=open` en la URL al cargar el módulo → estado inicial
  abierto. Después de cerrar el modal, el querystring NO se reescribe
  (es deeplink-only).

## Decisiones

- **No editor de regla custom**: el plan eliminó esa parte (el módulo
  `/triggers` se retiró en la Sesión 9 — el trigger engine sigue activo
  server-side pero sin CRUD visual).
- **Bandera `overridden`**: señala una fila en `notification_rule_overrides`;
  `enabled=true` no siempre coincide con el default de la plantilla. Borrar
  el override mediante DELETE es una operación distinta del Reset del modal.
- **Inputs numéricos vivos**: PATCH on change. Ediciones rápidas pueden competir;
  no se ha acreditado una política de resolución ni su resultado en runtime.
