# Overnight Usability Log

Bitácora del loop nocturno de usabilidad (`/loop` cada 30 min, rama
`feat/overnight-usability`). Cada iteración revisa UN módulo del dash e
implementa mejoras de usabilidad de bajo riesgo. Reglas: solo `dash/`, nunca
tocar Core, gate de `tsc -b` (mi fichero debe quedar con 0 errores nuevos; el
dash arrastra ~132 errores pre-existentes documentados en pending-debt), un
commit por fix, staging selectivo, sin push.

## Cobertura de módulos

| Módulo | Estado | Última pasada |
|---|---|---|
| finance | ✅ revisado (1ª pasada) | 2026-06-23 12:11 |
| multimedia | ✅ revisado (1ª pasada) | 2026-06-23 12:45 |
| office | ✅ revisado (1ª pasada) | 2026-06-23 15:38 |
| users-groups | pendiente | — |
| search | pendiente | — |
| network (dns/proxy/vpn) | pendiente | — |
| inventory | pendiente | — |
| automation | pendiente | — |
| projects | pendiente | — |
| embed-corner | pendiente | — |
| command-palette | pendiente | — |

---

## Iteración 1 — 2026-06-23 12:11 — módulo `finance`

**Ficheros:** `src/modules/finance/FinanceEmbed.tsx`, `src/modules/finance/FinanceLauncher.tsx`

**Implementado:**

1. **`ux(finance): credenciales 'shown once' copiables de un clic`** — commit `e78cc8f`
   El banner que aparece tras instalar Firefly/SolidInvoice muestra el
   email y la contraseña de admin UNA SOLA VEZ. Estaban como `<code>`
   pasivo, sin forma de copiarlos de un clic → el usuario tenía que
   seleccionarlos a mano y, si descartaba el banner, los perdía. Ahora
   cada credencial es un botón click-to-copy con feedback (icono
   `Copy`→`Check` durante 2s) y `aria-label`, imitando el patrón de
   `AgentTokensSection`.

2. **`ux(finance): feedback de hover en las tarjetas del launcher`** — commit `27cb36b`
   Las tarjetas del FinanceLauncher declaraban `transition: border-color`
   pero ningún estado cambiaba el borde → transición muerta, sin feedback
   de hover en elementos clicables. Se activa el hover (borde → color de
   la app) que el autor pretendía + `aria-label`.

**Descartado (NO implementado, requiere decisión del usuario):**

- **Inconsistencia de idioma.** El `FinanceLauncher` está en español
  ("En marcha", "Detenida", "Suite financiera self-hosted…") pero el
  `FinanceEmbed` está en inglés ("Checking…", "Install", "Login (shown
  once)", "Back", "Retry", "Service took too long to start"…). El dash en
  conjunto es MIXTO (inventory/multimedia en inglés, office en español),
  así que no hay convención clara que seguir. No voltear el idioma
  unilateralmente: es una decisión de política i18n del usuario. **Acción
  pendiente para Víctor:** decidir idioma único del producto (o dejarlo
  explícitamente mixto por módulo) y entonces unificar.

**Verificación:** `tsc -b` → 0 errores en `modules/finance` (los 132
errores del proyecto son todos pre-existentes). Sin verificación visual
Playwright (Firefox roto en WSL); el gate efectivo fue el type-check.

---

## Iteración 2 — 2026-06-23 12:45 — módulo `multimedia`

**Ficheros:** `src/modules/multimedia/MultimediaPage.tsx`, `src/modules/multimedia/MediaDownloads.tsx`

**Implementado:**

1. **`ux(multimedia): feedback al pulsar refresh del estado`** — commit `cc15bdd`
   El botón de refresh del launcher no daba feedback al pulsarlo: `loading`
   solo es `true` en el montaje inicial, así que un clic manual refrescaba
   en silencio (sin giro ni `disabled`), aunque la clase `.mm-spin` ya
   existía sin usarse ahí. Ahora un estado `refreshing` hace girar el icono
   + deshabilita el botón durante la petición + `aria-label`. El poll de
   fondo de 30s se mantiene silencioso para no parpadear cada medio minuto.

2. **`ux(multimedia): progreso de descargas en vivo (auto-poll)`** — commit `f61a076`
   La lista de Media Downloads solo cargaba al montar → una descarga en
   curso nunca actualizaba su `%` salvo refresh manual, la lista se sentía
   congelada. Se añade poll cada 3s SOLO mientras haya descargas
   `pending`/`downloading` (guard `hasActive`: si el endpoint no existe,
   `downloads` queda `[]` y no se sondea nada). El intervalo se limpia al
   completar.

**Descartado (NO implementado, anotado como hallazgo):**

- **Fallo silencioso de start/stop tras timeout.** En `MultimediaPage.handleAction`
  el bucle de polling (30s) sale en silencio si el servicio nunca alcanza el
  estado esperado: el spinner para y la card se queda como esté, sin mensaje
  de "se agotó el tiempo". Arreglarlo bien exige distinguir timeout de éxito
  (riesgo medio) → diferido para no meter lógica nueva de noche.
- **Botón de borrar descarga sin nombre accesible** (`MediaDownloads`, icono
  `Trash2` sin `aria-label`/`title` ni hover). Trivial, pero queda para una
  pasada de a11y dedicada para no mezclar concerns en el commit de polling.
- **Sin barra de progreso visual** en descargas (`%` solo como texto). Mejora
  de "progreso percibido", pero es más feature que fix → futuro.

**Verificación:** `tsc -b` → 0 errores nuevos en `modules/multimedia`. Sin
Playwright (Firefox roto en WSL); gate efectivo = type-check.

---

## Iteración 3 — 2026-06-23 15:38 — módulo `office`

**Ficheros:** `src/modules/office/OfficeLauncher.tsx`, `src/stores/office.store.ts`

**Implementado:**

1. **`ux(office): ESC cierra el diálogo Rename y los menús contextuales`** — commit `78215ec`
   Los overlays transitorios del launcher (RenameDialog, FileContextMenu,
   PdfActionMenu) solo se cerraban con clic fuera o acción. Se añade
   `Escape` → `onClose` en los tres (keydown + cleanup). En un modal de
   texto como Rename, ESC es comportamiento esperado.

2. **`ux(office): spinner de carga en recientes (evita falso 'vacío')`** — commit `99cfb31`
   `fetchRecentDocs` no marcaba ningún loading (el flag `loading` del store
   solo cubre crear-documento), así que en la primera carga el launcher
   mostraba el estado vacío ("No recent files" / "Create your first
   document") HASTA que resolvía el fetch → flash engañoso. Se añade
   `docsLoading` al store (set true/false alrededor del fetch) y el
   launcher muestra un spinner mientras carga y aún no hay datos; el vacío
   real solo aparece cuando el fetch terminó sin documentos.

**Descartado (NO implementado, anotado como hallazgo):**

- **Datos stale al cambiar de pestaña.** Al cambiar de tab, `recentDocs`
  retiene los documentos de la pestaña anterior hasta que resuelve el
  nuevo fetch → se ven brevemente bajo la cabecera nueva. El spinner del
  Fix 2 solo cubre el caso `length === 0`. Arreglarlo (limpiar
  `recentDocs` al cambiar de tab) introduce flicker propio; queda como
  decisión de diseño (spinner-en-cada-cambio vs. swap silencioso).
- **Tabs sin roles ARIA** (`role="tablist"`/`role="tab"`/`aria-selected`).
  Mejora de a11y para lectores de pantalla; pendiente de una pasada de
  accesibilidad dedicada.
- **Botón "New" deshabilitado sin estilo disabled** (sigue con `cursor:
  pointer` y color pleno cuando `loading`; solo cambia el icono a
  spinner). Polish menor.

**Verificación:** `tsc -b` → 0 errores nuevos en `modules/office` ni
`stores/office.store`. Sin Playwright (Firefox roto en WSL); gate = type-check.
