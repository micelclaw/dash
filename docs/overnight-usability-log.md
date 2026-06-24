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
| users-groups | ✅ revisado (1ª pasada) | 2026-06-23 16:11 |
| search | ✅ revisado (1ª pasada) | 2026-06-23 17:22 |
| network (dns/proxy/vpn) | ✅ 1ª pasada (it6/12/13/14/15): ESC + borrados destructivos confirmados en VPN/proxy/dns. Pulida profunda de secciones grandes = pendiente | 2026-06-23 22:10 |
| inventory | ✅ revisado (1ª pasada) | 2026-06-23 18:10 |
| automation | ✅ revisado (1ª pasada) | 2026-06-23 18:39 |
| projects | ✅ revisado (1ª pasada) | 2026-06-23 19:11 |
| embed-corner | ✅ revisado (1ª pasada) | 2026-06-23 19:39 |
| command-palette | ✅ revisado (1ª pasada) | 2026-06-23 20:10 |

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

---

## Iteración 4 — 2026-06-23 16:11 — módulo `users-groups`

**Ubicación:** `src/components/settings/sections/users-groups/` (no vive en `src/modules`).
**Ficheros:** `UsersListView.tsx`, `GroupsListView.tsx`

**Implementado:**

1. **`ux(users-groups): botón Eliminar honesto (exige 1 seleccionado)`** — commit `baa9e7a`
   El botón "Eliminar" de la barra de usuarios se habilitaba con 2+
   usuarios seleccionados (`disabled` solo con `length===0`), pero su
   `onClick` solo actúa si `length===1` → con varios seleccionados parecía
   clicable y no hacía NADA (botón muerto). Ahora exige exactamente 1
   (`disabled length!==1`), igual que el "Editar" de su misma barra y que
   el "Eliminar" de la vista de Grupos (que ya lo hacía bien). Mantiene el
   guard de no auto-borrarse.

2. **`ux(users-groups): aria-label en botones de acciones por fila`** — commit `5ad1d21`
   Los disparadores del menú de acciones (icono `MoreVertical`,
   `size="icon"`) no tenían nombre accesible → un lector de pantalla los
   anuncia como "botón" sin contexto. Se añade `aria-label` con el nombre
   de la fila (usuario/grupo) en ambas vistas.

**Descartado (NO implementado, anotado como hallazgo):**

- **2+2 errores TS pre-existentes `noUncheckedIndexedAccess`** en estos
  ficheros (`UsersListView` 122-123, `GroupsListView` 92-93): `selectedX[0]`
  es `T | undefined` aunque el `disabled` garantiza `length===1` al
  clicar. VERIFICADO por stash que son PRE-EXISTENTES (parte de los ~132,
  no los reportaba `tsc -b` incremental porque nunca había re-chequeado
  estos ficheros). No los toqué: son deuda TS, no usabilidad. Fix trivial
  (`!` justificado por el guard) para una pasada de tipos dedicada.
- **Exportar CSV ignora el filtro** (`UsersListView.exportCsv` usa `users`,
  no `rows`): si filtras y exportas, salen TODOS. Ambiguo (exportar-todo vs
  exportar-visible) → decisión de producto, no lo cambio unilateralmente.

**Verificación:** `tsc -b` → 0 errores NUEVOS en ambos ficheros (los 4
mostrados son pre-existentes, confirmado por stash de mis cambios). Sin
Playwright (Firefox roto en WSL); gate = type-check diferencial.

---

## Iteración 5 — 2026-06-23 17:22 — módulo `search`

**Ficheros:** `src/modules/search/SearchResultsList.tsx`, `src/modules/search/SearchPage.tsx`

**Implementado:**

1. **`ux(search): arregla crash en fallback de miniatura rota (ImageIcon sin importar)`** — commit `964b49b`
   `PhotoThumb` renderiza `<ImageIcon>` cuando una miniatura de foto falla
   al cargar (`onError` → `setErr`), pero `ImageIcon` NO estaba en el import
   de lucide-react → referencia indefinida → React crashea justo en el
   camino de imagen-rota (el que más necesita el fallback). Se añade al
   import existente. Bonus: elimina uno de los ~132 errores TS
   pre-existentes (`SearchResultsList:85 'Cannot find name ImageIcon'`).
   **No era cosmético: era un bug de runtime real.**

2. **`ux(search): indicador 'Searching…' mientras carga`** — commit `d85545b`
   La búsqueda cross-módulo (`searchAdvanced`) no daba ningún feedback
   mientras estaba en vuelo: solo se veían los estados vacío/error/
   resultados, nunca un "buscando". En una búsqueda que puede tardar, se
   siente como que no pasa nada. Se añade un indicador con spinner
   (`Loader2` + `animate-spin`) mientras `loading=true`; el estado "No
   results" ya estaba guardado por `!loading`, así que no hay conflicto.

**Descartado (NO implementado, anotado como hallazgo):**

- **Escape no limpia el input de búsqueda** (solo el botón X). Mejora de
  teclado menor; pendiente.
- **Botón X (limpiar) sin `aria-label`**. a11y menor.
- **Resultados stale durante re-búsqueda**: al re-buscar, los resultados
  previos siguen visibles bajo el spinner "Searching…". Decidí mantenerlos
  (mejor que parpadear a vacío); si se prefiere, se podrían atenuar.

**Verificación:** `tsc -b` → 0 errores nuevos; además el módulo search
pasa de 1 error pre-existente a 0 (resuelto el de ImageIcon). Sin
Playwright (Firefox roto en WSL); gate = type-check diferencial.

---

## Iteración 6 — 2026-06-23 17:40 — módulo `network` → submódulo `vpn`

**Nota:** "network" agrupa 3 submódulos grandes (dns ~4900 líneas, proxy
~5200, vpn ~4400). Esta iteración cubre **VPN**; dns y proxy quedan para
pasadas posteriores (marcado 🟡 parcial en la tabla).

**Ficheros:** `vpn/components/AddPeerDialog.tsx`, `vpn/components/PeerDetailDialog.tsx`, `vpn/sections/WgPeersSection.tsx`

**Implementado:**

1. **`ux(vpn): ESC cierra los diálogos de peer (Add / Edit)`** — commit `7a696f6`
   `AddPeerDialog` y `PeerDetailDialog` son modales que cerraban con X,
   Cancel o backdrop, pero no con Escape. Se añade keydown→Escape en ambos
   (AddPeer resetea vía `handleClose` como la X; PeerDetail llama `onClose`),
   con guard de `open` y cleanup. El efecto va ANTES del early return para
   respetar Rules of Hooks.

2. **`ux(vpn): ESC cierra los modales de config y QR de peer`** — commit `d300f7e`
   El `ModalOverlay` compartido (modal de configuración + modal de código
   QR de un peer) SOLO cerraba clicando el backdrop: sin Escape y sin botón
   X visible → había que adivinar que se cierra clicando fuera. Se añade
   keydown→Escape en el componente compartido, así ambos modales lo heredan.

**Descartado (NO implementado, anotado como hallazgo):**

- **`ModalOverlay` sin botón X visible.** Solo backdrop + (ahora) ESC.
  Añadir una X requiere reestructurar el layout de los children → futuro.
- **Fallo silencioso al crear peer.** `AddPeerDialog.handleSubmit`: si
  `onAdd` devuelve `null` (fallo) no se muestra error en el diálogo (queda
  por confirmar si el hook ya hace toast). Pendiente de revisar el hook.
- **Botón submit con cursor pointer mientras `submitting`** (disabled pero
  visualmente clicable). Polish menor.
- **dns y proxy enteros** sin revisar (submódulos grandes).

**Verificación:** `tsc -b` → 0 errores nuevos en los 3 ficheros de vpn.
Sin Playwright (Firefox roto en WSL); gate = type-check diferencial.

---

## Iteración 7 — 2026-06-23 18:10 — módulo `inventory`

**Ficheros:** `inventory/components/ItemDrawer.tsx`, `inventory/tabs/CatalogTab.tsx`

**Implementado:**

1. **`ux(inventory): Escape cierra el drawer de item`** — commit `fcff051`
   El `ItemDrawer` (panel lateral, 1397 líneas) solo se cerraba con la X;
   Escape no hacía nada a nivel de panel. Se añade un keydown global que
   cierra (`selectItem(null)`) en Escape, PERO ignora el evento si el foco
   está en `input/textarea/select/contenteditable` → respeta el Escape
   interno de los formularios de medidor (`resetMeterForms`, líneas 731/802)
   y no cierra el panel a media edición.

2. **`ux(inventory): distinguir 'sin items' de 'sin resultados de filtro'`** — commit `eef719d`
   `CatalogTab` filtra del servidor (`fetchItems(filters)`), así que una
   búsqueda/filtro sin coincidencias mostraba el MISMO "No items yet" +
   "Add your first possession" + CTA "+ New item" que el inventario vacío
   → engañoso (sí hay items). Ahora, con filtros activos
   (`hasActiveFilters`), muestra "No matching items" + acción "Clear
   filters" (resetea search+filtros y re-fetch); el vacío real solo
   aparece sin filtros. (Mismo patrón "falso vacío durante filtro" que en
   office, aquí resuelto con microcopy + acción de limpiar.)

**Descartado (NO implementado, anotado como hallazgo):**

- **Tabs grandes sin revisar**: StockTab, MaintenanceTab, LocationsTab,
  LendingTab, ReportsTab, PanelTab (cada una 300-900 líneas). Solo cubierto
  Catalog + el drawer. Quedan para 2ª pasada.
- **Patrón transversal "modal/overlay sin Escape"** ya detectado en office,
  vpn e inventory → merece una pasada global con un hook compartido
  (`useEscapeToClose`) en vez de repetirlo por componente.

**Verificación:** `tsc -b` → 0 errores nuevos en ItemDrawer ni CatalogTab.
Sin Playwright (Firefox roto en WSL); gate = type-check diferencial.

---

## Iteración 8 — 2026-06-23 18:39 — módulo `automation`

**Nota:** "automation" no existe como módulo en `src/modules`. Se sirve vía
el **app-host** (n8n y otras apps L3 dinámicas se embeben en `/app/:appName`).
Superficies revisadas: `app-host/AppModuleHost.tsx` (el embed) +
`settings/sections/AutomationSection`/`CronConfigSection`/`HooksSection`.

**Ficheros:** `src/modules/app-host/AppModuleHost.tsx`

**Implementado:**

1. **`ux(automation): overlay de carga en el iframe de apps dinámicas`** — commit `01575da`
   `AppModuleHost` montaba el iframe sin feedback: mientras la app carga
   (n8n hace **cold-start del contenedor**, puede tardar) se veía el iframe
   en blanco → parece roto. Se añade overlay con spinner ("Cargando
   <app>…") hasta el `onLoad` del iframe, reseteando el flag al cambiar de
   app (el iframe se remonta por `key`). Es la mejora de latencia percibida
   más relevante del dominio automation.

2. **`ux(automation): aria-label en el botón de volver del embed`** — commit `367c025`
   El botón de volver (icono `ArrowLeft`, solo-icono) no tenía nombre
   accesible. Se añade `title` + `aria-label` "Volver al panel".

**Revisado y YA correcto (no se tocó):**

- **`AutomationSection`**: contenedor limpio con bloques colapsables que
  persisten su estado en localStorage. Sin gaps.
- **`CronConfigSection` / `HooksSection`**: loading manejado vía
  `SectionShell` (no flashean), errores con `describeError`+toast,
  validación de backoff. Ya sólidos → no fabriqué cambios marginales.

**Descartado (anotado como hallazgo):**

- **Botón de volver hardcodea `navigate('/chat')`** en vez de back real
  (`navigate(-1)`); cambiarlo es ambiguo (¿/chat es "home"?) → decisión de
  diseño, no lo toco.

**Verificación:** `tsc -b` → 0 errores nuevos en AppModuleHost. Sin
Playwright (Firefox roto en WSL); gate = type-check diferencial.

---

## Iteración 9 — 2026-06-23 19:11 — módulo `projects`

**Ficheros:** `src/hooks/use-escape-to-close.ts` (NUEVO), `projects/components/CardDetailPanel.tsx`, `projects/components/ShareBoardModal.tsx`

**Implementado:**

1. **`ux(projects): ESC cierra el panel de detalle de tarjeta (+ hook useEscapeToClose)`** — commit `c211785`
   El `CardDetailPanel` (panel lateral de edición de tarjeta) solo cerraba
   con la X. Se **introduce un hook compartido `useEscapeToClose`**
   (`src/hooks/`) que cierra al pulsar Escape e IGNORA el evento si el foco
   está en un campo de texto (respeta el Escape interno de la edición de
   checklist y no cierra a media edición). Resuelve de forma REUTILIZABLE
   el patrón "modal/panel sin ESC" que llevo detectando desde la iteración
   3 (office, vpn×2, inventory). Futuras pasadas pueden retrofittear esos a
   este hook.

2. **`ux(projects): ESC cierra el modal de compartir tablero`** — commit `27ed4da`
   `ShareBoardModal` solo cerraba con X/backdrop. Se aplica
   `useEscapeToClose(onClose, { ignoreWhenTyping: false })` → contrato
   estándar de modal (Escape cierra siempre).

**Descartado (NO implementado, anotado como hallazgo):**

- **Deuda TS pre-existente en projects** (no es usabilidad, no la toco):
  `ShareBoardModal:14` ChevronDown sin usar (TS6133),
  `use-card-context-menu:266` `string|null` vs `undefined` (TS2322),
  `TimelineView` 3× declaraciones sin usar. Candidatas a una pasada de
  lint/tipos dedicada.
- **Vistas grandes sin revisar a fondo**: TimelineView (989), CalendarView
  (537), ListView (471), KanbanBoard (363) — solo cubiertos panel+modal de
  compartir. 2ª pasada.
- **NewBoardModal** ya tenía Escape (en el input); podría unificarse al
  hook en una pasada de consistencia.

**Verificación:** `tsc -b` → 0 errores NUEVOS (el único en mis ficheros es
el ChevronDown pre-existente, confirmado sin cambios). Sin Playwright
(Firefox roto en WSL); gate = type-check diferencial.

---

## Hallazgo transversal (recurrente) — hook `useEscapeToClose`

A partir de la iteración 9 existe `src/hooks/use-escape-to-close.ts`. El
patrón "overlay/panel/modal que no cierra con Escape" apareció en **office
(RenameDialog + menús), vpn (AddPeer/PeerDetail/ModalOverlay), inventory
(ItemDrawer) y projects (CardDetailPanel/ShareBoardModal)**. Recomendación
para 2ª pasada: retrofittear esos componentes al hook compartido para que el
comportamiento sea uniforme y haya un solo sitio que mantener.

---

## Iteración 10 — 2026-06-23 19:39 — módulo `embed-corner`

**Ubicación:** `src/components/shared/EmbedActions.tsx` + `src/hooks/use-embed-fullscreen.ts`
(la "esquina" estándar compartida por TODOS los embeds: multimedia, office,
finance, crypto, vpn, pdf, app-host).

**Ficheros:** `src/components/shared/EmbedActions.tsx`

**Implementado:**

1. **`ux(embed-corner): a11y de los controles del embed (aria-label + aria-pressed)`** — commit `4a86471`
   Los dos controles del corner (toggle pantalla completa + abrir en
   pestaña) eran icon-only con `title` pero sin `aria-label`, y el toggle
   no exponía su estado. Se añade `aria-label` a ambos y `aria-pressed` al
   toggle. Al ser un componente compartido, mejora la lectura por pantalla
   de la esquina en TODOS los embeds del dash de una sola vez.

**Revisado y YA correcto (no se tocó):**

- **`useEmbedFullscreen`**: maneja Escape para salir de fullscreen
  (listener guardado por `fullscreen`), lazy-init desde `?fullscreen=1`,
  `rootStyle` condicional que no toca el layout normal. Sólido.

**Descartado (anotado como hallazgo):**

- **`ExternalLink size={13}` vs `Maximize2/Minimize2 size={14}`**:
  micro-inconsistencia visual (1px), no merece commit.
- **Hit target pequeño** (icono 14 + padding 2 ≈ 18px, < 24px
  recomendado): subir el padding afecta el layout del header en todos los
  embeds → cambio visual transversal, lo dejo para decisión de diseño.
- **`href` vacío**: si un servicio no tiene dominio ni `fallbackUrl` ni
  `openUrl`, el `<a>` quedaría con href vacío. En la práctica los callers
  siempre pasan `fallbackUrl`; marginal.

**Verificación:** `tsc -b` → 0 errores nuevos en EmbedActions. Sin
Playwright (Firefox roto en WSL); gate = type-check diferencial.

---

## Iteración 11 — 2026-06-23 20:10 — módulo `command-palette`

**Ficheros:** `src/components/shell/CommandPalette.tsx`

**Implementado:**

1. **`ux(command-palette): el comando 'Toggle dark/light' ya funciona (era no-op)`** — commit `2e26db5`
   El comando "Toggle dark/light" tenía `action: () => {}` → el usuario lo
   seleccionaba y NO pasaba nada (bug funcional real, no cosmético). Ahora
   alterna entre tema claro y oscuro leyendo `settings.dash.theme` y
   persistiendo con `updateSection('dash', {theme})`; `useTheme` re-aplica
   al cambiar el setting. `isLightThemeId` decide la dirección
   (claro→dark, oscuro/otros→light).

2. **`ux(command-palette): semántica de diálogo para lectores de pantalla`** — commit `5ff1f65`
   El contenedor de la paleta era un `<div>` plano: un lector de pantalla
   no anunciaba que se abría un diálogo modal. Se añade `role="dialog"` +
   `aria-modal="true"` + `aria-label`. (cmdk ya aporta la semántica
   combobox/listbox del input+lista.)

**Revisado y YA correcto (no se tocó):**

- **Estados loading/empty**: modo search y modo domain muestran
  "Searching…" y el "No results" va guardado por `!isSearching` (sin flash
  de falso vacío). Bien.
- **Teclado**: `handleKeyDown` cubre Escape (limpia input → cierra),
  Backspace (sale de modo), Tab (autocompleta dominio); cmdk aporta
  flechas/enter. Cierre al seleccionar (`action(); onClose()`). Sólido.
- **Comando "Download Media from URL"**: dispara `claw:open-download-dialog`
  y SÍ tiene listener en `Shell.tsx:706` → no estaba roto.

**Descartado (anotado como hallazgo):**

- **Import `Boxes` sin usar** (TS6133 pre-existente, línea 20). Lint, no
  usabilidad → pasada de limpieza aparte.

**Verificación:** `tsc -b` → 0 errores NUEVOS (solo el `Boxes`
pre-existente). Sin Playwright (Firefox roto en WSL); gate = type-check
diferencial.

---

## 🏁 1ª PASADA COMPLETA (iteraciones 1–11)

Cubiertos los 11 ítems de la rotación: finance, multimedia, office,
users-groups, search, **network (solo VPN — dns/proxy pendientes)**,
inventory, automation, projects, embed-corner, command-palette.
**~28 commits `ux(...)`**, todos con gate `tsc -b` diferencial (0 errores
nuevos) y staging selectivo (los 83+ ficheros en curso del usuario,
intactos).

### Pendiente para la 2ª pasada / cierre
1. **network: dns y proxy** (submódulos enormes aún sin revisar) — cerrar
   antes de marcar network completo.
2. **Retrofit `useEscapeToClose`**: unificar a este hook los modales que
   resolví inline (office RenameDialog/menús, vpn AddPeer/PeerDetail/
   ModalOverlay, inventory ItemDrawer) — un solo sitio que mantener.
3. **Bugs reales hallados** (ya arreglados): crash `ImageIcon` en search,
   no-op del theme toggle, botón Eliminar muerto en users-groups.
4. **Deuda TS pre-existente** (lint, NO tocada por ser fuera de alcance):
   `Boxes`/`ChevronDown` sin usar, `noUncheckedIndexedAccess` en
   users-groups y projects, etc. → candidata a una pasada dedicada.
5. **Decisión del usuario pendiente**: política de idioma (dash mixto
   ES/EN; ver iteración 1).
6. **Tabs/vistas grandes sin revisar a fondo**: inventory (6 tabs),
   projects (Timeline/Calendar/List/Kanban) → profundizar en 2ª pasada.

---

## Iteración 12 — 2026-06-23 20:39 — `network` (2ª pasada: cerrar dns/proxy) + 1er retrofit del hook

**Ficheros:** `proxy/components/HostEditorDialog.tsx`, `dns/sections/ApplyTemplateModal.tsx`

**Implementado (ambos vía el hook `useEscapeToClose` de la iteración 9):**

1. **`ux(proxy): ESC cierra el editor de host`** — commit `0a37dfc`
   `HostEditorDialog` (crear/editar host del reverse-proxy) cerraba con X/
   Cancel/backdrop, no con Escape. `useEscapeToClose(onClose)` con
   `ignoreWhenTyping` por defecto (es un formulario con muchos campos).

2. **`ux(dns): ESC cierra el modal de aplicar plantilla`** — commit `1feb279`
   `ApplyTemplateModal` cerraba con X/backdrop, no con Escape.
   `useEscapeToClose(onClose)` (ignora Escape mientras se rellenan las
   variables de la plantilla).

**Nota metodológica:** primer uso del hook compartido FUERA de projects →
empieza a pagar el retrofit transversal que recomendé. La 2ª pasada debería
seguir migrando los modales inline previos (office, vpn, inventory) al hook.

**Revisado y YA correcto:**

- `ProxyPage` / `DnsModule`: shells limpios (sidebar + secciones, badges,
  loading propagado). `ZonesSection`: `if (loading) return Loading…` +
  empty `zones.length === 0` bien separados.

**Descartado / pendiente (anotado):**

- **`AddZoneWizard` no tiene prop `onClose`** (lo controla el padre, no es
  un modal auto-cerrable) → no se le puede aplicar el hook sin tocar el
  contrato; queda como hallazgo.
- **`ZoneEditor` (915 líneas)** sin revisar a fondo; secciones grandes de
  proxy (ProxyHostsSection, SubdomainSection, DdnsSection, Dashboard,
  Certificates…) y de dns (LocalDomainsSection 782, DdnsSection 641,
  ProvidersSection 500…) **siguen sin pasada profunda**. Network NO está
  cerrado: solo VPN (it6) + 2 modales (it12).

**Verificación:** `tsc -b` → 0 errores nuevos en ambos ficheros. Sin
Playwright (Firefox roto en WSL); gate = type-check diferencial.

---

## Iteración 13 — 2026-06-23 21:12 — `network`/proxy (2ª pasada, fix sustantivo)

**Ficheros:** `proxy/sections/ProxyHostsSection.tsx`, `proxy/sections/RedirectsSection.tsx`, `proxy/sections/NotFoundHostsSection.tsx`

**Implementado (gap de SEGURIDAD real, no estético):**

1. **`ux(proxy): confirmar antes de borrar un proxy host`** — commit `2b3adf0`
   El botón de borrar host del reverse-proxy llamaba a `onDelete` AL
   INSTANTE, sin confirmación. Es destructivo: borra la ruta y el
   sitio/servicio deja de servirse. Se interpone el `ConfirmDialog`
   compartido (variant danger) nombrando los dominios afectados. (Proxy no
   usaba `ConfirmDialog` en ninguna sección.)

2. **`ux(proxy): confirmar antes de borrar redirecciones y 404 hosts`** — commit `d253eee`
   Mismo gap en `RedirectsSection` y `NotFoundHostsSection` (borraban sin
   confirmar). Mismo `ConfirmDialog`. Consistencia: los TRES tipos de host
   del reverse-proxy confirman ahora el borrado.

**Por qué importa:** borrar un host de reverse-proxy por error tira un
servicio público; un clic accidental no debería poder hacerlo sin red de
seguridad. Es el tipo de fallo que el usuario nota tarde y mal.

**Descartado / pendiente:**
- **Otras secciones de proxy** (Streams, AccessLists, Certificates, Audit,
  Settings, Subdomain, Dashboard, DDNS) — sin pasada profunda.
- **dns completo** sigue pendiente (ZoneEditor 915, LocalDomains 782, DDNS
  641, Providers 500). Network NO cerrado.
- ¿`CertificatesSection`/`AccessListsSection` borran sin confirmar? No
  verificado aún → revisar en próxima iteración de proxy.

**Verificación:** `tsc -b` → 0 errores nuevos en los 3 ficheros. Sin
Playwright (Firefox roto en WSL); gate = type-check diferencial.

---

## Iteración 14 — 2026-06-23 21:38 — `network`/proxy (cierre del patrón de borrado destructivo)

**Ficheros:** `proxy/sections/CertificatesSection.tsx`, `proxy/sections/AccessListsSection.tsx`

**Implementado (cierre del gap de seguridad de it13):**

1. **`ux(proxy): confirmar antes de borrar un certificado TLS`** — commit `95c3ba3`
   `CertificatesSection` borraba al instante. Destructivo: los hosts que
   usan el cert se quedan sin HTTPS hasta reemitirlo. `ConfirmDialog`
   (danger) nombrando los dominios.

2. **`ux(proxy): confirmar antes de borrar una access list`** — commit `fd1ab37`
   `AccessListsSection` borraba al instante. Destructivo: los hosts
   protegidos pierden la restricción de auth/IP (pueden quedar expuestos).
   `ConfirmDialog` (danger) nombrando la lista.

**Patrón CERRADO en proxy:** los **5** borrados del reverse-proxy ahora
confirman (proxy hosts, redirects, 404 hosts [it13] + certificados,
access lists [it14]). Antes, cualquiera era un clic accidental sin red de
seguridad → caída de servicio público o exposición de un host protegido.

**Pendiente para cerrar network:**
- **dns ENTERO** sigue sin pasada profunda (ZoneEditor 915, LocalDomains
  782, DDNS 641, Providers 500, ZonesSection records…). Revisar también si
  los borrados de dns (zonas/registros/dominios locales) confirman.
- Otras secciones de proxy (Streams, Audit, Settings, Subdomain, DDNS,
  Dashboard) — sin pasada profunda, pero las destructivas principales ya
  están cubiertas.

**Verificación:** `tsc -b` → 0 errores nuevos en ambos ficheros. Sin
Playwright (Firefox roto en WSL); gate = type-check diferencial.

---

## Iteración 15 — 2026-06-23 22:10 — `network`/dns (cierre de network, 1ª pasada)

**Ficheros:** `dns/sections/ZoneEditor.tsx`, `dns/sections/DdnsSection.tsx`

**Implementado:**

1. **`ux(dns): confirmar antes de borrar un registro DNS`** — commit `77ea2ee`
   El botón de borrar registro en `ZoneEditor` llamaba a `onDeleteRecord`
   al instante. Destructivo: borrar un A/MX/CNAME/TXT por error rompe web,
   correo o verificaciones. `ConfirmDialog` (danger) nombrando tipo+nombre.
   (La ZONA ya tenía confirm inline; el registro no.)

2. **`ux(dns): confirmar antes de quitar un proveedor DDNS`** — commit `5ed34cb`
   `ProviderRow.onRemove` (DdnsSection) borraba al instante → cortaba las
   actualizaciones automáticas de IP. `ConfirmDialog` (danger) nombrando el
   tipo de proveedor.

**Revisado y YA correcto en dns (confirm inline pre-existente):**
- `ZonesSection`/`ZoneEditor`: borrado de ZONA ("Remove this zone and all
  its records?" inline).
- `LocalDomainsSection`: borrado de dominio local (estado `confirmDelete`).
- `ProvidersSection`: borrado de provider (estado `confirmRemove`).

## ✅ NETWORK CERRADO (1ª pasada) — iteraciones 6, 12, 13, 14, 15

Enfoque: cerrar los **gaps críticos** (no pulir cada píxel de ~14.500
líneas). Hecho en las 3 sub-áreas:
- **VPN** (it6): ESC en AddPeerDialog, PeerDetailDialog y ModalOverlay
  (config/QR).
- **proxy** (it12-14): ESC en HostEditorDialog + **confirmación en los 5
  borrados destructivos** (hosts, redirects, 404, certificados, ACLs).
- **dns** (it12,15): ESC en ApplyTemplateModal + confirmación en borrado de
  registro y de proveedor DDNS (zona/dominios-locales/providers ya tenían).

**Pendiente (pasada MÁS profunda, no crítico):** loading/empty/microcopy
fino de las secciones más grandes (ZoneEditor 915, LocalDomains 782, DDNS
641, Providers 500; proxy Subdomain/Dashboard/Streams/Audit/Settings). Los
fallos de **seguridad** (borrar algo público de un clic) y de **teclado**
(modales sin ESC) ya están resueltos en todo network.

**Verificación:** `tsc -b` → 0 errores nuevos en ambos ficheros. Sin
Playwright (Firefox roto en WSL); gate = type-check diferencial.

---

## Iteración 16 — 2026-06-23 22:41 — 2ª pasada profunda: accesibilidad de teclado en drag&drop

**Ficheros:** `projects/views/KanbanBoard.tsx`, `components/shell/Sidebar.tsx`

**Tema:** barrido transversal de los DnD del dash. La mayoría montaban SOLO
`PointerSensor` → el drag&drop era **exclusivamente de ratón** (inoperable
por teclado). dnd-kit soporta `KeyboardSensor` + `sortableKeyboardCoordinates`
para listas sortable (Espacio coge, flechas mueven, Espacio suelta, Esc
cancela) — coste ~3 líneas, gran ganancia de a11y.

**Implementado:**

1. **`ux(projects): tablero Kanban operable por teclado`** — commit `ba67091`
   `KanbanBoard.useSensors` solo tenía PointerSensor → no se podían
   reordenar tarjetas/columnas sin ratón. Añadido KeyboardSensor. Superficie
   PRINCIPAL de projects.

2. **`ux(sidebar): reordenar módulos por teclado`** — commit `45ff9e8`
   El reordenamiento de módulos del sidebar (sortable, vertical) tenía el
   mismo gap. Añadido KeyboardSensor.

**Auditoría de DnD (los 4 `useSensors` del dash):**
- `KanbanBoard` → ARREGLADO.
- `Sidebar` → ARREGLADO.
- `FlowEditor` → ya tenía KeyboardSensor (correcto, no tocado).
- `PhotosPeople` → usa `useDraggable`/`useDroppable` (drag LIBRE foto→persona,
  NO sortable). `sortableKeyboardCoordinates` no aplica; el teclado para
  draggable/droppable libre necesita un coordinateGetter a medida →
  DIFERIDO como hallazgo (riesgo/complejidad mayor, no es un quick win).

**Verificación:** `tsc -b` → 0 errores nuevos en ambos ficheros. dnd-kit
exporta ambos símbolos (verificado en node_modules). Sin Playwright (Firefox
roto en WSL); gate = type-check diferencial.

---

## Iteración 17 — 2026-06-23 23:09 — 2ª pasada: projects/CalendarView (a11y/teclado)

**Ficheros:** `projects/views/CalendarView.tsx`

**Implementado:**

1. **`ux(projects): aria-label en la navegación del calendario`** — commit `07d3ac4`
   Los botones de mes anterior/siguiente y de año ±/picker eran icon-only
   (Chevrons) sin nombre accesible. `aria-label` + `title` en los 4.

2. **`ux(projects): tarjetas del calendario abribles por teclado`** — commit `561e73e`
   Las tarjetas de evento en las celdas eran `<div onClick>`: no se podían
   enfocar con Tab ni abrir con teclado. Se añade `role="button"`,
   `tabIndex={0}`, `aria-label` (título) y `onKeyDown` (Enter/Espacio →
   `selectCard`). Ahora se navegan y abren sin ratón.

**Revisado:** el `useEffect` "sin deps" de la línea ~158 es un handler de
**wheel** (scroll-para-navegar-mes) y SÍ limpia su listener cada render →
intencional para capturar el último prev/next, no es una fuga. ListView y
TimelineView ya tienen empty state ("No cards yet…"). El calendario no
necesita empty state (un calendario vacío sigue siendo navegable).

**Descartado / pendiente:**
- **Celda de día = `<div onClick>`** (abre el input de nueva tarjeta): no es
  accesible por teclado, pero contiene el input inline de creación →
  hacerla button es más invasivo; diferido.
- Vistas grandes que faltan a fondo: TimelineView (989), ListView (471),
  inventory tabs (Lending/Maintenance/Reports/Stock/Locations).
- `PhotosPeople` drag libre por teclado (it16).

**Verificación:** `tsc -b` → 0 errores nuevos en CalendarView. Sin
Playwright (Firefox roto en WSL); gate = type-check diferencial.

---

## Iteración 18 — 2026-06-23 23:39 — inventory/LocationsTab + INCIDENTE de staging

**Ficheros:** `inventory/tabs/LocationsTab.tsx`

**Implementado:**

1. **`ux(inventory): confirmar antes de borrar una ubicación`** — commit `c29799a`
   El botón Delete de `LocationsTab` borraba la ubicación al instante.
   Destructivo: las ubicaciones tienen jerarquía (sub-ubicaciones) e ítems
   que las referencian, que quedan sin ubicación. `ConfirmDialog` (danger)
   nombrando la ubicación. (`StockTab` ya confirmaba; `LocationsTab` no.)
   Otras tabs (Lending/Maintenance/Reports) no tienen borrados destructivos
   directos.

**⚠️ INCIDENTE de proceso (corregido):** mi primer commit (3c49283,
deshecho) arrastró 2 ficheros de storage del usuario
(`DeleteConfirmDialog.tsx`, `SmartStatusCard.tsx`) que estaban **PRE-STAGED**
en el índice (por el usuario/linter). El patrón `git add <mío> && git
commit` barre TODO lo que ya esté en el índice. Recuperación: `git reset
--soft HEAD~1` → desstagear los 2 de storage → recommit solo el mío
(c29799a) → re-stagear los 2 de storage para restaurar el estado del
usuario. **Nada perdido; commit final limpio (1 fichero).**

**CAMBIO DE PROCESO para el resto del loop:** usar `git commit -- <fichero>`
(commit por pathspec, ignora el resto del índice) en vez de `git add X &&
git commit`, porque el índice del usuario tiene ficheros pre-staged. Este
mismo commit de log se hace así.

**Verificación:** `tsc -b` → 0 errores nuevos en LocationsTab. Sin
Playwright (Firefox roto en WSL); gate = type-check diferencial.

---

## Iteración 19 — 2026-06-24 — 2ª pasada: projects ListView/FilterBar

**Ficheros:** `projects/components/FilterBar.tsx`, `projects/views/ListView.tsx`
(commits por pathspec `git commit -- <f>` para no tocar el índice pre-staged
del usuario; ver incidente it18).

**Implementado:**

1. **`ux(projects): a11y del FilterBar`** — commit `71c0e1d`
   FilterBar es COMPARTIDO por todas las vistas de projects. Sus chips de
   filtro (prioridad/tag/deps/blocked/archived) son toggles que solo
   indicaban estado por color → invisibles para lectores de pantalla. Se
   añade `aria-pressed` a los chips, `aria-expanded` al botón "Filters" (que
   controla la región colapsable) y `aria-label` a la X de limpiar búsqueda.

2. **`ux(projects): la lista muestra la dirección de orden`** — commit `481332a`
   La cabecera ordenable de ListView mostraba `ArrowUpDown` (icono
   bidireccional, AMBIGUO) en la columna activa → no se veía si ordenaba
   ascendente o descendente. Ahora muestra `ArrowUp`/`ArrowDown` según
   `sortDir` (feedback real, no a11y). Ajustado el import (ArrowUpDown era
   su único uso).

**Verificación:** `tsc -b` → 0 errores nuevos en ambos ficheros. Commits
verificados con `git show --stat` (1 fichero cada uno) + `git diff --cached`
(solo storage del usuario, intacto). Sin Playwright (Firefox roto en WSL).

---

## Iteración 20 — 2026-06-24 — 2ª pasada: multimedia (cierre de hallazgos diferidos de la it2)

**Ficheros:** `multimedia/MultimediaPage.tsx`, `multimedia/MediaDownloads.tsx`
(commits por pathspec).

**Implementado (los 2 hallazgos que dejé anotados en la iteración 2):**

1. **`ux(multimedia): no fallar en silencio si start/stop agota el tiempo`** — commit `b695c3f`
   `handleAction` sondeaba 30s a que el servicio alcanzara running/stopped;
   si NO lo lograba, el bucle salía en silencio, el spinner paraba y la card
   se quedaba igual SIN avisar → el usuario no sabía que la acción no
   completó. Ahora un flag `reached` detecta el timeout y muestra el motivo
   en el banner de error ("…may still be starting/stopping. Use refresh to
   check."). Además limpia errores stale al iniciar una nueva acción.

2. **`ux(multimedia): botón de borrar descarga con nombre accesible y hover`** — commit `5e21ef9`
   El botón de papelera de cada descarga era icon-only sin `aria-label`/
   `title` y sin feedback de hover. Se añade `aria-label` (con el título de
   la descarga), `title` y hover a color de error (transición suave).

**Nota:** ambos hallazgos venían anotados desde la it2 ("diferido"). El
loop está cerrando su propia deuda de hallazgos, no solo abriendo nuevos.

**Verificación:** `tsc -b` → 0 errores nuevos. `git show --stat` confirma
1 fichero por commit; `git diff --cached` solo el storage del usuario
(intacto). Sin Playwright (Firefox roto en WSL).

---

## Iteración 21 — 2026-06-24 — 2ª pasada: search (cierre de hallazgos diferidos de la it5)

**Ficheros:** `search/SearchPage.tsx` (commits por pathspec).

**Implementado (hallazgos anotados en la it5):**

1. **`ux(search): Escape limpia el campo de búsqueda`** — commit `5c4dc37`
   El input solo reaccionaba a Enter (lanzar). Escape no hacía nada pese a
   existir una X de limpiar. Ahora Escape (con texto) limpia query +
   resultados, igual que la X. Comportamiento esperado en un buscador.

2. **`ux(search): nombre accesible en la X de limpiar`** — commit `228ccc5`
   El botón X de limpiar era icon-only sin nombre accesible. `aria-label`
   + `title` (que además menciona el atajo Esc recién añadido).

**Verificación:** `tsc -b` → 0 errores nuevos. `git show --stat` (1 fichero
por commit) + `git diff --cached` (solo storage del usuario, intacto). Sin
Playwright (Firefox roto en WSL).

---

## Iteración 22 — 2026-06-24 — 2ª pasada: roles ARIA de tabs (transversal + office)

**Ficheros:** `components/shared/Tabs.tsx`, `office/OfficeLauncher.tsx` (pathspec).

**Implementado (cierra el hallazgo "tabs sin ARIA" de la it3, a 2 niveles):**

1. **`ux(office): roles ARIA de tabs en el componente Tabs compartido`** — commit `73eb451`
   El `Tabs` compartido (usado por ~10 módulos: media, users-groups, drive,
   finance, inventory, dev…) no exponía semántica de pestañas: contenedor
   `<div>` plano y tabs sin `role`/`aria-selected`. Se añade `role="tablist"`
   al contenedor y `role="tab"` + `aria-selected` a cada tab (botón y `<a>`).
   **Un solo sitio → propaga a TODOS los consumidores.**

2. **`ux(office): roles ARIA en la barra de tabs del launcher`** — commit `7d6f1ae`
   `OfficeLauncher` tiene su PROPIA barra de tabs inline (no usa el
   componente compartido): se le añaden `role="tablist"` + `role="tab"` +
   `aria-selected`. Cierra el hallazgo específico de la it3 para office.

**Nota:** alto apalancamiento — el fix del componente compartido mejora la
a11y de pestañas en ~10 módulos a la vez, no solo office.

**Descartado / pendiente:** la navegación por flechas (roving tabindex, el
patrón WAI-ARIA completo de tabs) NO se implementó — las tabs ya son
focusables (botones/enlaces reales) y `role`+`aria-selected` es la mejora
de alto valor/bajo riesgo; las flechas serían una mejora futura más
involucrada.

**Verificación:** `tsc -b` → 0 errores nuevos en ambos. `git show --stat`
(1 fichero por commit) + `git diff --cached` (solo storage del usuario,
intacto). Sin Playwright (Firefox roto en WSL).

---

## Iteración 23 — 2026-06-24 — 2ª pasada: multimedia/MediaDownloads (cierre total + microcopy)

**Ficheros:** `multimedia/MediaDownloads.tsx` (pathspec).

**Implementado:**

1. **`ux(multimedia): barra de progreso visual en descargas en curso`** — commit `d922254`
   El progreso solo se mostraba como texto (NN%). Se añade una barra fina
   que se llena al % (`role="progressbar"` + `aria-valuenow`), visible solo
   en estado `downloading`. Con el auto-poll de la it2 avanza en vivo.
   **Cierra el ÚLTIMO hallazgo diferido de multimedia (it2).**

2. **`ux(multimedia): capitalizar el estado de la descarga`** — commit `9a9e68f`
   La etiqueta de estado mostraba el enum crudo en minúsculas
   ('downloading'/'completed'/'failed'/'pending') directo al usuario. Se
   capitaliza la inicial (Downloading, Completed…). Microcopy.

**Hito:** los 3 hallazgos diferidos de multimedia (it2: timeout silencioso,
botón borrar a11y, barra de progreso) están ya TODOS cerrados (it20+it23).
multimedia = revisado a fondo.

**Verificación:** `tsc -b` → 0 errores nuevos. `git show --stat` (1 fichero
por commit) + `git diff --cached` (solo storage del usuario, intacto). Sin
Playwright (Firefox roto en WSL).

---

## Iteración 24 — 2026-06-24 — 2ª pasada: inventory tabs (Maintenance/Panel)

**Ficheros:** `inventory/tabs/MaintenanceTab.tsx`, `inventory/tabs/PanelTab.tsx` (pathspec).

**Implementado:**

1. **`ux(inventory): ESC cierra los modales de mantenimiento`** — commit `82daee0`
   El `Modal` compartido de MaintenanceTab (usado por "Complete" y
   "Schedule maintenance") cerraba con backdrop/Close pero no con Escape.
   `useEscapeToClose(onClose)` en el componente Modal → ambos heredan ESC.
   Retrofit del hook de la it9.

2. **`ux(inventory): filas del panel accesibles por teclado`** — commit `be40d98`
   `HoverRow` (3 usos en el Overview para abrir un ítem) era `<div onClick>`:
   no focusable ni activable por teclado. Cuando tiene `onClick`, ahora
   expone `role="button"` + `tabIndex={0}` + `onKeyDown` (Enter/Espacio).
   Propaga a las 3 filas. Mismo patrón que las tarjetas del calendario (it17).

**Revisado y YA correcto (no tocado):**
- `StockTab.ModalShell` ya tiene Escape inline (no necesita retrofit).
- `LendingTab`: EmptyState + semáforo de vencidos + flujo de devolución
  (no destructivo) → sólido.
- `ReportsTab`/`LendingTab` sin borrados destructivos directos.

**Descartado / pendiente:** el `<div onClick>` suelto de PanelTab:567
(abre item desde "movimientos recientes") también podría hacerse
keyboard-accesible; menor, anotado. TimelineView (989) y PhotosPeople
teclado siguen pendientes.

**Verificación:** `tsc -b` → 0 errores nuevos. `git show --stat` (1 fichero
por commit) + `git diff --cached` (solo storage del usuario, intacto).

---

## Iteración 25 — 2026-06-24 — 2ª pasada: projects/TimelineView (a fondo)

**Ficheros:** `projects/views/TimelineView.tsx` (pathspec).

**Implementado:**

1. **`ux(projects): el menú de orden de la timeline cierra al clicar fuera`** — commit `e228833`
   El dropdown de orden (`showSortMenu`) solo se cerraba re-pulsando su
   botón; clicar en otro sitio lo dejaba abierto. El `sortMenuRef` estaba
   DECLARADO pero nunca cableado (handler de click-outside sin implementar
   → TS6133). Se cablea el ref + un `useEffect` (mousedown fuera → cerrar).
   **Bonus:** elimina el TS6133 de `sortMenuRef` (el fichero pasa de 3 a 2
   errores pre-existentes).

2. **`ux(projects): fila-label de la timeline accesible por teclado`** — commit `c92c005`
   La fila de la columna izquierda (nombre de la tarjeta) era `<div onClick>`:
   no focusable ni activable por teclado. `role="button"` + `tabIndex={0}` +
   `aria-label` + `onKeyDown` (Enter/Espacio). La tarjeta sin fecha ya era
   `<button>`. La barra draggable se deja (el label ya da acceso por teclado
   a la misma tarjeta).

**Revisado:** el selector de orden YA mostraba la dirección con flechas
direccionales (ArrowUp/ArrowDown) — no como ListView; correcto.

**Descartado / pendiente:**
- **TS6133 restantes en TimelineView** (`ArrowUpDown` import sin usar línea
  14, `idx` línea 665): deuda de lint, NO usabilidad → pasada de limpieza
  aparte.
- **Barra draggable de la timeline** sin teclado para mover (drag por
  teclado es complejo); el label sí abre la tarjeta.
- PhotosPeople teclado, PanelTab:567 div suelto, roving-tabindex en tabs.

**Verificación:** `tsc -b` → 0 errores NUEVOS (sortMenuRef resuelto; quedan
ArrowUpDown/idx pre-existentes). `git show --stat` (1 fichero por commit) +
`git diff --cached` (solo storage del usuario, intacto).

---

## Iteración 26 — 2026-06-24 — inventory/StockTab + HALLAZGO SISTÉMICO (window.confirm)

**Ficheros:** `inventory/tabs/StockTab.tsx` (pathspec).

**Implementado:**

1. **`ux(inventory): reversar movimiento con ConfirmDialog en vez de window.confirm`** — commit `3e99ff9`
   `handleUndo` (revertir un movimiento de stock) usaba `window.confirm()`
   NATIVO: diálogo del SO que rompe el lenguaje visual de la app, bloquea
   el hilo y es incoherente con el `ConfirmDialog` estilado del resto. Se
   sustituye por `ConfirmDialog` (variant warning; explica que el ledger
   nunca borra → añade un contra-asiento). `handleUndo` abre el diálogo,
   `confirmUndo` ejecuta.

**Resuelto sin tocar:** PanelTab:567 (hallazgo de it24) resultó ser un
`HoverRow`, NO un `<div onClick>` suelto → ya quedó keyboard-accesible con
el fix de it24. (El log de it24 lo describió mal.)

## ⚠️ HALLAZGO SISTÉMICO (para una pasada dedicada del usuario)

**~30 sitios usan `window.confirm`/`window.prompt`/`window.alert` nativos**
en lugar del `ConfirmDialog` estilado de la app. Es el mismo anti-patrón
(diálogo del SO, bloqueante, rompe el look). Mapa (excluye storage = tu WIP):

- `settings/sections/DevicesSection.tsx` (×3: remove device, rotate/revoke token)
- `settings/sections/AccountSection.tsx` (×2)
- `settings/sections/PhotoPipelineProgress.tsx` (abort queue)
- `modules/sketches/DiagramToolbar.tsx` (×2: unsaved changes)
- `modules/studio/StudioPage.tsx` (delete project) + `phases/v2/BuildPhase.tsx`
- `modules/notes/NoteEditor.tsx` (a texto plano) + `NoteEditorToolbar.tsx` (×3 `prompt` URL/imagen/YouTube)
- `modules/mail/MailPage.tsx` / `MailComposer.tsx` / `MailReadingPane.tsx` (×3: unsync, discard, delete)
- `modules/crypto/monero/.../ReceiveTab.tsx` (subaddress sin label)
- … (~30 en total)

**Recomendación:** sweep dedicado convirtiendo a `ConfirmDialog` (confirms)
y a un input-modal propio (los `prompt` de URL en notes). NO lo hago aquí
de uno en uno porque (a) están fuera de la rotación y dispersos, (b)
convertir uno al azar es incoherente, (c) 3 están en `storage` que es tu
WIP staged (intocable). StockTab (it26) queda como patrón de referencia.

**Verificación:** `tsc -b` → 0 errores nuevos en StockTab. `git show --stat`
(1 fichero) + `git diff --cached` (solo storage del usuario, intacto).

---

## Iteración 27 — 2026-06-24 — settings/DevicesSection (sweep window.confirm, 1/N)

**Ficheros:** `components/settings/sections/DevicesSection.tsx` (pathspec).

**Implementado:**

1. **`ux(settings): confirmaciones de dispositivos con ConfirmDialog`** — commit `1dd6753`
   `DevicesSection` usaba `window.confirm()` nativo en sus **3** acciones de
   seguridad destructivas (quitar dispositivo, rotar token, revocar token):
   diálogos del SO que rompen el estilo, bloquean el hilo, incoherentes con
   el `ConfirmDialog` del resto. Se sustituyen por UN `ConfirmDialog` dirigido
   por estado discriminado (`ConfirmAction` = remove|rotate|revoke) + mapa
   `CONFIRM_COPY` por acción. Los botones NO cambian: `handleX` ahora abre el
   diálogo, `performX` ejecuta tras confirmar. (3 confirms → 1 patrón.)

**Decisión de alcance:** elegí UN módulo entero (devices, 3 confirms) en vez
de parchear sitios sueltos al azar → coherente y completo. Es el inicio del
sweep del hallazgo sistémico documentado en it26 (~30 `window.confirm`/
`prompt`). Iteración de UN fix por ser sustancial (cirugía cuidada: estado
discriminado, 48 líneas, sin tocar los botones).

**Progreso del sweep window.confirm:** inventory/StockTab (it26) +
settings/DevicesSection ×3 (it27) convertidos. Quedan ~25: settings/Account,
PhotoPipeline, sketches, studio, notes (incl. `prompt` de URL → necesitan
input-modal), mail ×3, crypto. NO toco `storage` (WIP staged del usuario).

**Verificación:** `tsc -b` → 0 errores nuevos en DevicesSection (verifiqué
que los botones siguen llamando handleRemove/Rotate/Revoke). `git show
--stat` (1 fichero) + `git diff --cached` (solo storage del usuario, intacto).

---

## Iteración 28 — 2026-06-24 — settings/AccountSection (sweep window.confirm, 2/N)

**Ficheros:** `components/settings/sections/AccountSection.tsx` (pathspec).

**Implementado:**

1. **`ux(settings): confirmar revocación de sesiones con ConfirmDialog`** — commit `f75b788`
   `ActiveSessionsBlock` usaba `window.confirm()` nativo en 2 acciones de
   seguridad: revocar la sesión ACTUAL (= logout) y revocar las demás/todas.
   → `ConfirmDialog` con estado discriminado `RevokeConfirm` (self|others) y
   descripción dinámica (según si se conoce la sesión actual: "stay logged
   in here" vs "you will be logged out"). La sesión actual confirma; las no-
   actuales se revocan directo (sin cambio de UX). Botones intactos.

**Progreso del sweep window.confirm (it26 → ...):**
- ✅ inventory/StockTab (it26)
- ✅ settings/DevicesSection ×3 (it27)
- ✅ settings/AccountSection ×2 (it28)
- Quedan (~25): settings/PhotoPipelineProgress, sketches/DiagramToolbar ×2
  (unsaved-changes, gatean import/load), studio (WIP, evitar), notes
  (`window.prompt` ×3 → necesitan input-modal propio), mail ×3, crypto.
  NO se toca `storage` (WIP staged del usuario).

**Verificación:** `tsc -b` → 0 errores nuevos. `git show --stat` (1 fichero)
+ `git diff --cached` (solo storage del usuario, intacto).

---

## Iteración 29 — 2026-06-24 — crypto/ReceiveTab (sweep window.confirm, 3/N)

**Ficheros:** `modules/crypto/monero/viewport/tabs/ReceiveTab.tsx` (pathspec).

**Implementado:**

1. **`ux(crypto): crear subdirección sin etiqueta confirma con ConfirmDialog`** — commit `7e41149`
   ReceiveTab (Monero) usaba `window.confirm()` nativo al crear una
   subdirección sin etiqueta. → `ConfirmDialog` (variant warning).
   `createSubaddress` abre el diálogo si no hay etiqueta; `doCreateSubaddress`
   ejecuta (directo si hay etiqueta).

**Por qué este y no sketches/mail:** `DiagramToolbar` (1032L) tiene los
confirms en flujos complejos (closure anidado del `<input type=file>`
onchange + dirty-gate) → refactor arriesgado, NO forzado. `mail` confirms
viven en ficheros de 980L. ReceiveTab (219L, confirm discreto) era la
conversión LIMPIA disponible. No fuerzo cirugía grande en ficheros gigantes.

**Progreso del sweep window.confirm:**
- ✅ inventory/StockTab (it26) · settings/DevicesSection ×3 (it27) ·
  settings/AccountSection ×2 (it28) · crypto/ReceiveTab (it29) = **7 diálogos
  nativos convertidos en 4 módulos**.
- Pendiente COMPLEJO (requiere refactor de flujo, para una pasada dedicada
  con calma): sketches/DiagramToolbar ×2 (import closure + dirty-gate),
  mail ×3 (ficheros 980L), notes `prompt` ×3 (necesitan input-modal),
  PhotoPipelineProgress, studio (WIP). NO se toca `storage` (WIP staged).

**Verificación:** `tsc -b` → 0 errores nuevos. `git show --stat` (1 fichero)
+ `git diff --cached` (solo storage del usuario, intacto).

---

## Iteración 30 — 2026-06-24 — photos/PhotosPeople (borrado destructivo sin confirmar)

**Ficheros:** `modules/photos/PhotosPeople.tsx` (pathspec).

**Implementado:**

1. **`ux(photos): confirmar antes de borrar un grupo de caras`** — commit `40fd93d`
   El item "Delete" del menú contextual de una persona (cluster de caras)
   borraba al instante con un clic, sin confirmación → un clic accidental
   elimina la agrupación. `ConfirmDialog` (variant danger) nombrando la
   persona y aclarando que las fotos se quedan (solo se borra la
   agrupación). `handleDelete` sigue de worker.

**Hallazgo de it16 (DnD por teclado en PhotosPeople) — CERRADO como "no aplica":**
El drag de PhotosPeople sirve para FUSIONAR clusters de caras (arrastrar
una persona sobre otra). NO hay alternativa no-drag a la fusión, pero
añadir un `KeyboardSensor` a un drag LIBRE (no sortable) daría una
experiencia de teclado clunky (mover 25px por flecha por toda la pantalla)
→ **falsa accesibilidad**. La solución correcta sería una opción de menú
"Merge into…" con selector de persona (FEATURE, fuera del alcance del loop),
no un keyboard-drag forzado. Decisión: NO añadir keyboard-drag; documentar
la recomendación (menú Merge) para una mejora futura.

**Verificación:** `tsc -b` → 0 errores nuevos. `git show --stat` (1 fichero)
+ `git diff --cached` (solo storage del usuario, intacto).

---

## Iteración 31 — 2026-06-24 — a11y: iframes sin `title` (WCAG)

**Ficheros:** `mail/MailThreadMessage.tsx`, `mail/MailReadingPane.tsx`,
`feeds/ArticleReader.tsx`, `components/player/YouTubeOverlay.tsx` (pathspec).

**Contexto:** auditoría transversal de iframes. La mayoría YA tenían
`title`; estos 4 NO → fallo WCAG (todo `<iframe>` necesita nombre accesible;
lo flaggea cualquier auditoría a11y / axe). NO se toca `finance` (WIP) ni
`storage` (WIP staged).

**Implementado:**

1. **`ux(mail): title accesible en los iframes del cuerpo del email`** — commit `1e9ce66`
   Los iframes que renderizan el HTML del email (`MailThreadMessage` +
   `MailReadingPane`) sin `title`. → `title={email.subject || 'Email content'}`.

2. **`ux(feeds): title accesible en los iframes de YouTube`** — commit `8bf2216`
   Los embeds de YouTube (`ArticleReader` + player `YouTubeOverlay`) sin
   `title`. → título del artículo / 'YouTube video'.

**Estado del dash en iframes:** tras esto, todos los `<iframe>` (salvo
finance WIP) tienen nombre accesible.

**Nota de fase del loop:** tras 30 iteraciones el dash está muy pulido;
los gaps que quedan son finos (a11y de detalle) o requieren refactor/
feature (sweep window.confirm complejo, merge-por-teclado en photos). Las
mejoras siguen siendo reales pero cada vez más buscadas.

**Verificación:** `tsc -b` → 0 errores nuevos. `git show --stat` (2 ficheros
por commit, coherentes) + `git diff --cached` (solo storage del usuario,
intacto).

---

## Iteración 32 — 2026-06-24 — a11y de formularios (label↔input) + auditorías negativas

**Ficheros:** `modules/bookmarks/BookmarksPage.tsx` (pathspec).

**Auditorías hechas esta iteración (resultado = el dash está limpio):**
- **`<img>` sin `alt`**: 0 reales (el único candidato, `video/EpisodeRow`,
  usa `alt=""` decorativo válido). Imágenes bien cubiertas.
- **Modales de video sin ESC**: `RequestModal` usa Radix `Dialog` (ESC
  nativo); `LibraryGrid`/`RequestsView` con `EmptyState`+loading. Sólido.
- **`SeasonList:28` TS2532**: estrictez `noUncheckedIndexedAccess` con guard
  `length>0` → NO es crash (deuda de tipos, no usabilidad).

**Implementado:**

1. **`ux(bookmarks): asociar labels con sus inputs (htmlFor/id)`** — commit `af38aa8`
   Las 4 etiquetas del form de añadir marcador (URL/Title/Description/Tags)
   estaban visibles pero SIN asociación programática (`htmlFor`/`id`) →
   clicar la etiqueta no enfocaba el campo y un lector de pantalla podía no
   asociarlos (WCAG 1.3.1/3.3.2). Asociadas: ahora la etiqueta es un target
   clicable que enfoca su campo.

**Estado del loop (honesto):** tras 31 iteraciones el dash está muy pulido.
Esta iteración fueron 3 auditorías que salieron limpias + 1 fix fino real.
Los gaps que quedan son a11y de detalle (label↔input en otros forms,
icon-only buttons sueltos) o requieren refactor/feature (window.confirm
complejo, merge-por-teclado). Sigo entregando mejoras reales y verificadas,
pero el ritmo de hallazgos de alto impacto ha bajado claramente — vale la
pena que el usuario decida si redirigir el loop (p.ej. a tests, o a un
sweep dedicado de los pendientes documentados).

**Verificación:** `tsc -b` → 0 errores nuevos. `git show --stat` (1 fichero)
+ `git diff --cached` (solo storage del usuario, intacto).

---

## Iteración 33 — 2026-06-24 — contacts: confirmación de borrado unificada

**Ficheros:** `modules/contacts/ContactsPage.tsx`, `modules/contacts/ContactDetail.tsx` (pathspec).

**Implementado:**

1. **`ux(contacts): confirmación unificada al borrar contacto (ConfirmDialog)`** — commit `ab4cb0a`
   Había DOS vías de borrado inconsistentes:
   - desde la **LISTA** (menú del item → `handleDelete` → `deleteContact`)
     **SIN confirmación** → un clic accidental borraba el contacto;
   - desde el **DETALLE** con `window.confirm` nativo.
   Ahora ambas pasan por UN único `ConfirmDialog` estilado en `ContactsPage`
   (`handleDelete` abre el diálogo nombrando el contacto; `performDelete`
   ejecuta). `ContactDetail` deja de usar `window.confirm` y llama `onDelete`
   directo. **Cierra a la vez un gap destructivo (lista) Y un `window.confirm`
   del hallazgo de it26.**

**Doble valor:** este fix toca dos de los patrones de alto valor de la
sesión — borrado-destructivo-sin-confirmar (la lista) y window.confirm
nativo (el detalle) — con UNA solución unificada (mejor que tener dos
confirmaciones distintas para la misma acción).

**Verificación:** `tsc -b` → 0 errores nuevos en ambos ficheros. `git show
--stat` (2 ficheros coherentes) + `git diff --cached` (solo storage del
usuario, intacto).

---

## Iteración 34 — 2026-06-24 — borrados destructivos: bookmarks + calendar

**Ficheros:** `modules/bookmarks/BookmarksPage.tsx`, `modules/calendar/CalendarMiniSidebar.tsx` (pathspec).

**Escaneo de CRUD no revisados (calendar/notes/diary/bookmarks/books/music):**
- notes: YA confirma (`deleteDialogId`). music/calendar-event: ok/pendiente.
- **bookmarks**: borrado de marcador SIN confirmar → gap real.
- **calendar (mini-sidebar)**: borrar calendario con `window.confirm` nativo.

**Implementado:**

1. **`ux(bookmarks): confirmar antes de borrar un marcador`** — commit `8f69859`
   `handleDelete` borraba el marcador al instante desde el botón Delete del
   item. → `ConfirmDialog` (danger) nombrando el marcador (título o url).

2. **`ux(calendar): borrar calendario con ConfirmDialog (no window.confirm)`** — commit `cc14c95`
   `handleDeleteCalendar` usaba `window.confirm()` nativo. → `ConfirmDialog`
   estilado, PRESERVANDO el mensaje dinámico (cuenta los eventos del
   calendario + "cannot be undone"). Borrar un calendario borra TODOS sus
   eventos → el diálogo deja claro el alcance. (Cierra otro `window.confirm`
   del hallazgo de it26.)

**Pendiente anotado:** verificar si el borrado de un EVENTO concreto
(`CalendarGrid` EventBlock onDelete) confirma; diary (`DiaryEditor` api.delete
×2) y books (`ReaderView` handleDeleteAnnotation) tienen borrados con
`confirms:0` → revisar en próximas iteraciones.

**Verificación:** `tsc -b` → 0 errores nuevos en ambos. `git show --stat`
(1 fichero por commit) + `git diff --cached` (solo storage del usuario, intacto).

---

## Iteración 35 — 2026-06-24 — calendar: borrado rápido de evento (+ juicios)

**Ficheros:** `modules/calendar/CalendarPage.tsx` (pathspec).

**Implementado:**

1. **`ux(calendar): confirmar el borrado rápido de evento desde la rejilla`** — commit `7c1e988`
   El borrado de evento desde la REJILLA (menú/X del `EventBlock` →
   `onEventDelete={deleteEvent}`) era directo, sin confirmación → clic
   accidental = evento borrado. Se añade `ConfirmDialog` (danger) nombrando
   el evento, SOLO para la vía de la rejilla.

**Revisado y NO cambiado (con criterio):**
- **`EventModal` (detalle/edición)**: YA confirma con un patrón two-click
  inline (`confirmingDelete`) → no se toca; el fix cubre solo la rejilla.
- **diary `handleDiscardNarrative`** (botón "Discard"): borra la entrada vía
  API, pero "Discard" convencionalmente NO confirma (semántica de tirar un
  borrador). Añadir confirm podría molestar → JUICIO del usuario, no un gap
  claro. NO lo toco.
- **books `handleDeleteAnnotation`**: borrar un subrayado es una acción
  frecuente de BAJO riesgo (fácil de recrear); confirmar cada una molestaría
  → NO lo toco (confirmar aquí sería peor UX).
- **diary `handleRegenerateNarrative`**: el `api.delete` es intencional
  (borra y regenera) → correcto.

**Nota:** no toda acción destructiva merece confirm — los subrayados y los
"discard de borrador" son excepciones donde confirmar empeora la UX. El
criterio importa tanto como el patrón.

**Verificación:** `tsc -b` → 0 errores nuevos. `git show --stat` (1 fichero)
+ `git diff --cached` (solo storage del usuario, intacto).

---

## Iteración 36 — 2026-06-24 — feeds: desuscripción + a11y del menú

**Ficheros:** `modules/feeds/FeedsSidebar.tsx` (pathspec).

**Escaneo de CRUD restantes (drive/music/feeds/messages/share):**
- drive/dns/music ya confirman (music playlist usa estado `deleting`).
- messages/share: sin borrados destructivos directos.
- **feeds**: "Unsubscribe" SIN confirmar → gap real.

**Implementado:**

1. **`ux(feeds): confirmar antes de desuscribir de un feed`** — commit `519f54b`
   El item "Unsubscribe" del menú de cada feed llamaba a `unsubscribe(feed.id)`
   al instante → un clic accidental pierde la suscripción Y sus artículos.
   `ConfirmDialog` (danger) nombrando el feed.

2. **`ux(feeds): nombre accesible + estado en el botón de opciones`** — commit `bd2b4bb`
   El botón de menú por feed (icono `MoreVertical`) era icon-only sin nombre
   accesible. `aria-label` (con el título del feed) + `aria-haspopup="menu"`
   + `aria-expanded` (refleja si el menú está abierto).

**Veta de borrados destructivos — resumen de la sesión:** confirmaciones
añadidas/unificadas en proxy(5), dns(2), inventory(2), contacts, bookmarks,
calendar(2: calendario+evento), photos(grupo de caras), feeds. Más el sweep
window.confirm (devices×3, account×2, crypto, calendar, contacts).

**Verificación:** `tsc -b` → 0 errores nuevos. `git show --stat` (1 fichero
por commit) + `git diff --cached` (solo storage del usuario, intacto).

---

## Iteración 37 — 2026-06-24 — gateway/CronTab (window.confirm → ConfirmDialog)

**Ficheros:** `modules/gateway/tabs/CronTab.tsx` (pathspec).

**Escaneo (gateway/agents/oauth/micelhub/activity/terminal):**
- **agents/AgentDetail**: borrar agente usa **type-to-confirm** (escribir el
  nombre del agente) → confirmación ROBUSTA, no se toca (es mejor que un
  diálogo simple para algo tan destructivo).
- **micelhub/activity/agents-workspaces**: ya usan estado de confirmación
  (`deleteDialog`/`setConfirmDelete`/`pendingDelete`).
- **oauth/terminal**: sin borrados destructivos directos.
- **gateway/CronTab**: borraba con `window.confirm` nativo → conversión.

**Implementado:**

1. **`ux(gateway): borrar cron job con ConfirmDialog (no window.confirm)`** — commit `0494763`
   `CronTab.handleDelete` usaba `window.confirm()`. → `ConfirmDialog`
   (danger) nombrando el job. `handleDelete` abre el diálogo; `performDelete`
   ejecuta. Cierra otro `window.confirm` del hallazgo de it26.

**Sweep window.confirm — acumulado:** devices×3, account×2, crypto, calendar
(calendario), contacts, gateway-cron. Quedan los COMPLEJOS (sketches import
closure + dirty-gate, mail ×3 en ficheros de 980L, notes `prompt` ×3 que
necesitan input-modal) → para una pasada dedicada con calma, NO de noche.

**Verificación:** `tsc -b` → 0 errores nuevos. `git show --stat` (1 fichero)
+ `git diff --cached` (solo storage del usuario, intacto).

---

## Iteración 38 — 2026-06-24 — mail: borrar email con ConfirmDialog

**Ficheros:** `modules/mail/MailReadingPane.tsx` (pathspec).

**Implementado:**

1. **`ux(mail): borrar email con ConfirmDialog (no confirm nativo)`** — commit `0ded004`
   `handleDelete` usaba `confirm()` nativo. → `ConfirmDialog` estilado
   (danger), manteniendo el mensaje ("can be restored from Trash").
   `handleDelete` cierra el menú de acciones y abre el diálogo;
   `performDelete` ejecuta. Era uno de los `window.confirm` en ficheros
   GRANDES (980L) que había diferido; hecho ahora con cuidado (localizado el
   cierre raíz del render para colocar el diálogo correctamente).

**Sweep window.confirm — quedan SOLO los más enredados:**
- `mail/MailComposer` (discard-on-dirty: gatea el cierre del compositor),
  `mail/MailThreadMessage` (si tuviera confirm),
- `sketches/DiagramToolbar` ×2 (closure anidado del `<input file>` + dirty-gate),
- `notes` `window.prompt` ×3 (URL/imagen/YouTube → necesitan un input-modal
  propio, no un confirm),
- `notes/NoteEditor` confirm "a texto plano".
Todos requieren refactor de flujo o una feature (input-modal) → pasada
dedicada, no de madrugada.

**Verificación:** `tsc -b` → 0 errores nuevos. `git show --stat` (1 fichero)
+ `git diff --cached` (solo storage del usuario, intacto).
