# Atribución de logos de marca (brand-icons)

Todos los ficheros de este directorio son **logos de terceros**, propiedad de sus
respectivos dueños. Se usan aquí para **identificar visualmente** el proveedor de
correo/calendario/contactos que el usuario está conectando en la pantalla de
integraciones de Micelclaw (p. ej. "Conectar con iCloud", tarjeta de Gmail en la
lista de proveedores) — es **uso descriptivo / nominativo estándar** (igual que un
navegador muestra el favicon de un sitio, o un cliente de correo el logo del
proveedor SMTP), **no promocional**: Micelclaw no está afiliado, patrocinado ni
respaldado por ninguna de estas marcas.

Se descargaron **una sola vez** (script `dash/scripts/fetch-brand-icons.mjs`) y se
versionan en el repo — nada se sirve desde un CDN en tiempo de ejecución (CSP /
offline-first).

Regenerar: `node scripts/fetch-brand-icons.mjs` desde `dash/`.

---

## Ficheros vendorizados

### dashboard-icons (homarr-labs)

Repo: <https://github.com/homarr-labs/dashboard-icons> — recopilatorio de logos de
marca para dashboards de self-hosting (tipo Homarr/Dashy). El propio repo **no
relicencia** los logos: cada marca sigue siendo propiedad de su dueño; el repo solo
los distribuye como conveniencia para uso nominativo/identificativo. Servidos vía
jsDelivr (`cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/...`) en el momento de la
descarga.

| Fichero | Slug / servicio | URL de origen |
|---|---|---|
| `icloud.svg` | iCloud (proveedor) | `svg/icloud.svg` |
| `fastmail.svg` | Fastmail (proveedor) | `svg/fastmail.svg` |
| `nextcloud.svg` | Nextcloud (proveedor) | `svg/nextcloud.svg` |
| `synology.svg` | Synology (proveedor) | `svg/synology.svg` |
| `google.svg` | Google (proveedor) | `svg/google.svg` |
| `microsoft.svg` | Microsoft (proveedor) | `svg/microsoft.svg` |
| `proton.svg` | Proton (proveedor) | `svg/proton.svg` |
| `zoho.svg` | Zoho (proveedor) | `svg/zoho.svg` |
| `mailbox_org.svg` | mailbox.org (proveedor) | `svg/mailbox.svg` (nombre de fichero en origen: `mailbox`, es la marca mailbox.org — verde `#abe659`) |
| `yahoo.svg` | Yahoo (proveedor) | `svg/yahoo.svg` |
| `yandex.svg` | Yandex (proveedor) | `svg/yandex.svg` |
| `google--gmail.svg` | Google · Gmail (correo) | `svg/gmail.svg` |
| `google--calendar.svg` | Google · Calendar | `svg/google-calendar.svg` |
| `google--contacts.svg` | Google · Contacts | `svg/google-contacts.svg` |
| `microsoft--outlook.svg` | Microsoft · Outlook (correo) | `svg/microsoft-outlook.svg` |
| `synology--mail-plus.png` | Synology · MailPlus (correo) | `png/synology-mail-plus.png` (no existe en `svg/`) |
| `synology--calendar.png` | Synology · Calendar | `png/synology-calendar.png` (no existe en `svg/`) |
| `synology--contacts.png` | Synology · Contacts | `png/synology-contacts.png` (no existe en `svg/`) |
| `proton--mail.svg` | Proton · Mail | `svg/proton-mail.svg` |
| `proton--calendar.svg` | Proton · Calendar | `svg/proton-calendar.svg` |

### selfh.st/icons

Repo: <https://github.com/selfhst/icons> — mismo espíritu que dashboard-icons
(catálogo de logos para paneles self-hosted), también uso nominativo sin
relicenciar las marcas. Servido vía jsDelivr
(`cdn.jsdelivr.net/gh/selfhst/icons/...`).

| Fichero | Slug / servicio | URL de origen | Nota |
|---|---|---|---|
| `zoho--mail.svg` | Zoho · Mail | `svg/zoho-mail.svg` | dashboard-icons no tiene `zoho-mail.svg` suelto (404) |

### Directo del proveedor (favicon / manifest / apple-touch-icon oficiales)

Estos tres **no** estaban en dashboard-icons ni selfh.st con calidad/actualidad
aceptable (ver sección "Investigación" más abajo), así que se resolvieron yendo
directamente a los assets públicos que cada proveedor sirve para su propia
app/PWA — la fuente más autorizada posible, y explícitamente pensada por el
proveedor para ser embebida por terceros (favicons/app-icons son recursos
públicos de identificación, sin control de acceso ni robots.txt que lo prohíba).

| Fichero | Proveedor | URL de origen | Qué es |
|---|---|---|---|
| `aol.png` | AOL (proveedor + correo) | `https://s.yimg.com/cv/apiv2/aolfp/images/favicon/v4/180.png` | apple-touch-icon 180×180 de aol.com (CDN de Yahoo Inc., dueño actual de la marca AOL). Fondo amarillo `#FFD800` + wordmark "AOL" en negro — identidad visual actual. |
| `posteo.png` | Posteo (proveedor + correo) | `https://posteo.de/images/app-icons/android-chrome-512x512.png` | Icono 512×512 declarado en `posteo.de/site.webmanifest`. Círculo verde `#a4ce4e`-ish con la marca "//P." y punto naranja — identidad visual actual de Posteo. |
| `webde.png` | WEB.DE (proveedor + correo) | `https://s.uicdn.com/uimag/1.0.0/assets/favicon/webde/android-chrome-512x512.png` | Icono 512×512 resuelto siguiendo el redirect de `web.de/apple-touch-icon.png` hasta el CDN de United Internet. Cuadrado amarillo `#FFD800` con la Puerta de Brandenburgo + wordmark "WEB.DE". |

**Licencia/uso de estos tres:** logo de marca registrada de su respectivo dueño
(AOL → Yahoo Inc.; Posteo → Posteo e.K.; WEB.DE → 1&1/United Internet). No hay
licencia libre explícita — se usan bajo uso nominativo (identificar el servicio de
un tercero al que el usuario se conecta), igual que el resto de logos de este
directorio. Si en el futuro algún proveedor objeta el uso, sustituir por el
lettermark de fallback ya existente en el consumidor.

---

## No vendorizados a propósito (van por `simple-icons`, ya en package.json)

Estos cuatro **no tienen fichero** en este directorio — el componente consumidor
los pinta por código con `import * as si from 'simple-icons'` y
`<path d={si.xxx.path} fill={'#' + si.xxx.hex} />`. Para un logo de una sola
tinta, esto **es** el logo real de marca a color (su hex oficial), sin necesidad
de vendorizar un SVG aparte.

| Slug | Export de `simple-icons` | Hex de marca | Título |
|---|---|---|---|
| `gmx` | `siGmx` | `#1C449B` | GMX |
| `migadu` | `siMigadu` | `#0043CE` | Migadu |
| `mailcom` | `siMaildotcom` | `#004788` | mail.com |
| `disroot` | `siDisroot` | `#50162D` | Disroot |

`simple-icons` es **CC0** (dominio público) — <https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md>.
Sin roce de licencia con el resto del repo (propietario).

⚠️ **Nota de contraste (tema oscuro):** `disroot` (`#50162D`, granate muy oscuro)
tiene una luminancia relativa baja, cercana a la de un fondo de UI oscuro típico
— en un chip circular sin fondo claro de por medio puede perder contraste. Ver
`dark_theme_risk` en el resumen JSON del script. El resto de hex de este grupo
(`#1C449B`, `#0043CE`, `#004788`) tienen luminancia suficiente para leerse bien
sobre fondo oscuro.

---

## `generic` — sin logo, a propósito

`generic` ("Otro proveedor / servidor propio") no es una marca — ya tiene su
icono de fallback "+" en gris del tema. No se ha tocado ni se ha buscado logo
para él.

---

## Servicios sin fuente encontrada

**Microsoft 365 Calendar / Contacts (People) — icono suelto**: no existe como
fichero independiente ni en dashboard-icons ni en selfh.st/icons. Se probaron los
slugs `outlook-calendar`, `microsoft-outlook-calendar`, `microsoft-people`,
`microsoft-calendar`, `outlook`, `microsoft-contacts`, `microsoft-365-calendar`
(los siete devuelven 404). El consumidor debe caer a `microsoft--outlook.svg` +
un glifo pequeño superpuesto (calendario/contacto) para diferenciar el servicio,
tal y como ya contempla el encargo original.

---

## Investigación de posteo / webde (el encargo las marcaba como pendientes)

Ambos **sí tienen fuente** — no hizo falta declarar `no_source`:

- **Posteo**: Wikimedia Commons solo ofrecía `File:Posteo.png`
  (`commons.wikimedia.org/wiki/File:Posteo.png`, dominio público /
  PD-textlogo), pero es un **banner promocional de 2013** (803×432, no
  cuadrado, colores más claros que la marca actual) — descartado por no
  representar la identidad visual vigente ni tener forma de icono. En su lugar
  se usó el icono de app oficial servido por el propio `posteo.de`
  (`site.webmanifest` → `android-chrome-512x512.png`), actual y ya en formato
  cuadrado/icono.
- **WEB.DE**: de.wikipedia.org tiene `Datei:Web.de_logo.svg`
  (`de.wikipedia.org/wiki/Datei:Web.de_logo.svg`, alojado localmente como
  "no-free"/`NoCommons`, uso bajo derecho de marca) — usable, pero de menor
  resolución (256×256) y con la restricción explícita de no subirse a
  Commons. Se prefirió el `apple-touch-icon`/`android-chrome-512x512.png`
  servido directamente por `web.de` (vía CDN de United Internet), de mayor
  resolución y sin esa nota de restricción de repositorio.

Wikimedia Commons dio **429 (rate limit)** en los intentos previos a esta
sesión (mencionado en el encargo) — en esta sesión respondió con normalidad al
consultar la API de búsqueda (`action=query&list=search`), pero los resultados
en sí no eran la mejor fuente disponible por los motivos de arriba.

---

## Riesgo de contraste en tema oscuro

Verificado renderizando cada fichero con Chrome headless sobre fondo claro y
oscuro (no solo inspección de código — el renderizador de ImageMagick usado en
una primera pasada dio falsos positivos en `icloud.svg` y `proton--calendar.svg`,
mostrándolos como negro sólido cuando en realidad usan gradientes de color; se
descartó ese método y se repitió con Chrome).

- **`icloud.svg`**: se sospechaba en el encargo que podía tener trazos oscuros.
  Verificado: usa un **gradiente azul** (`#3e82f4` → `#93dcf7`), no negro. Se
  ve bien sobre fondo oscuro. **Sin riesgo.**
- **`proton--calendar.svg`**: a primera vista (miniatura pequeña) parecía casi
  negro; ampliado y con los hex reales (`#6d4aff`→`#06b8ff`,
  `#bfe8ff`→`#bfabff`→`#7341ff`) es un gradiente azul-violeta vívido. **Sin
  riesgo.**
- **`synology.svg`** y **`proton.svg`** (logos de texto/marca genérica) llevan
  un **rectángulo blanco de fondo dibujado dentro del propio SVG** (no
  transparente) — siempre se ven como una placa blanca, en claro o en oscuro.
  No es un riesgo de invisibilidad, pero si el consumidor los envuelve además
  en un chip circular claro, el resultado es una placa blanca dentro de un
  chip claro (redundante pero no roto).
- **`microsoft--outlook.svg`**: su color dominante de fondo es un azul marino
  muy oscuro (`#0a2767`), con luminancia relativa parecida a la de un fondo de
  UI oscuro — en teoría de bajo contraste. Verificado visualmente: el logo
  sigue siendo legible porque el azul marino tiene un tinte de color distinto
  al gris neutro del fondo del dash, y las capas más claras (`#28a8ea`,
  `#50d9ff`, blanco) dominan visualmente el glifo. Contraste bajo pero
  **aceptable**, no se marca como riesgo alto.
- **`disroot`** (vía `simple-icons`, sin fichero): hex `#50162D` (granate muy
  oscuro) — este es el que de verdad tiene luminancia baja y comparable a un
  fondo oscuro típico. Es el único caso real de riesgo detectado. Ver nota en
  la tabla de `simple-icons` arriba.

Ningún fichero vendorizado en este directorio es mayoritariamente negro/casi
negro sin fondo propio. El único riesgo real de contraste detectado es
`disroot` por su hex de marca oscuro (no es un fichero, es el color que pinta
el consumidor vía `simple-icons`).
