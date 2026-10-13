/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

// ─── Los logos de los proveedores de datos, a color ─────────────────────────
//
// Petición del usuario: "todos con su icono a color, igual que hicimos con los
// modelos de inteligencia artificial". Aquello usa `@lobehub/icons`, que es un
// catálogo de marcas de IA — de los proveedores de correo solo tenía Apple,
// Google y Microsoft, y encima monocromo. Así que aquí el logo real, a color,
// está VENDORIZADO como asset propio (`src/assets/brand-icons/`, generado por
// `scripts/fetch-brand-icons.mjs` — ver `ATTRIBUTION.md` en ese directorio
// para la procedencia de cada fichero) y el orden de resolución es de tres
// capas, cada una un escalón por debajo de la anterior:
//
//  1. **`BRAND_ASSETS`** — el logo oficial a color, vendorizado (SVG o PNG),
//     tanto del proveedor (`google.svg`) como de un servicio suyo concreto
//     (`google--gmail.svg`, `google--calendar.svg`…) para `DataServiceIcon`.
//  2. **`SIMPLE_TINTED`** — para el puñado que no se vendorizó porque
//     `simple-icons` (CC0, dominio público) ya lo cubre con su hex de marca:
//     un `<path>` pintado con `fill={#hex}`. Sirve de red para lo que quede
//     fuera del manifest de `fetch-brand-icons.mjs`.
//  3. **`LETTERMARK`** — inicial de marca sobre su color, para lo que no está
//     en ninguna de las dos anteriores: `generic` (el motor puro sin marca) y
//     `onedrive`/`onenote`/`s3`, que son de otros dominios (Drive/Notes,
//     todavía sin conectar) y por eso quedan fuera del vendorizado de este
//     arco de correo/calendario/contactos. Es fea a propósito: nunca cae a un
//     icono genérico que haría que dos proveedores distintos parecieran el
//     mismo.
//
// `@lobehub/icons` YA NO hace falta aquí: `microsoft.svg` está vendorizado en
// `BRAND_ASSETS` a color, así que la capa LOBEHUB (mono, solo Microsoft) se
// quitó entera de este fichero. Sigue viva en `config/provider-icons.tsx` para
// los proveedores de modelos de IA — es un catálogo distinto, no la toques.
//
// Regla al añadir un proveedor nuevo: una línea en el manifest de
// `scripts/fetch-brand-icons.mjs` y volver a correr el script. Si no hay
// fuente de color decente, cae a `SIMPLE_TINTED` (si `simple-icons` lo tiene)
// o a `LETTERMARK` con su color de marca. Nunca un SVG a mano.

import type { CSSProperties, ReactNode } from 'react';
import * as si from 'simple-icons';
import { Calendar, CheckSquare, Mail, Users } from 'lucide-react';

interface SimpleIcon {
  path: string;
  hex: string;
  title: string;
}

/**
 * Todo lo vendorizado en `src/assets/brand-icons/`: slug de proveedor
 * (`google`) o slug compuesto proveedor--servicio (`google--gmail`) → URL
 * servida por Vite. `eager: true` porque son unas pocas decenas de iconos
 * pequeños — no vale la pena el code-split de una carga perezosa.
 */
const brandAssetModules = import.meta.glob('../assets/brand-icons/*.{svg,png}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const BRAND_ASSETS: Record<string, string> = Object.fromEntries(
  Object.entries(brandAssetModules).map(([path, url]) => {
    const filename = path.split('/').pop() ?? path;
    const key = filename.replace(/\.(svg|png)$/, '');
    return [key, url];
  }),
);

/**
 * Lo que no se vendorizó porque `simple-icons` ya lo cubre con el hex de
 * marca oficial: un `<path>` pintado con `fill`. Confirmado contra la versión
 * instalada — si un export no existe aquí, `npx tsc -b` lo delata en build.
 *
 * `aol` NO está aquí a propósito: `simple-icons` retiró `siAol` de la
 * librería, así que se vendorizó como asset real (`aol.png`, apple-touch-icon
 * oficial de aol.com) y vive en `BRAND_ASSETS`.
 */
const SIMPLE_TINTED: Record<string, SimpleIcon | undefined> = {
  gmx: si.siGmx as SimpleIcon | undefined,
  migadu: si.siMigadu as SimpleIcon | undefined,
  mailcom: si.siMaildotcom as SimpleIcon | undefined,
  disroot: si.siDisroot as SimpleIcon | undefined,
  todoist: si.siTodoist as SimpleIcon | undefined,
  notion: si.siNotion as SimpleIcon | undefined,
  trello: si.siTrello as SimpleIcon | undefined,
  ticktick: si.siTicktick as SimpleIcon | undefined,
  asana: si.siAsana as SimpleIcon | undefined,
  clickup: si.siClickup as SimpleIcon | undefined,
  jira: si.siJira as SimpleIcon | undefined,
};

/** Los que no están en ninguna librería: inicial sobre el color de la marca. */
const LETTERMARK: Record<string, { text: string; color: string }> = {
  // No forman parte del catálogo de 19 proveedores de mail/calendar/contacts
  // de este arco (son de los dominios Drive/Notes, aún sin conectar — ver
  // `data-types.ts`), así que no se vendorizaron aquí. Se dejan intactos por
  // si ya los usa o los va a usar ese otro dominio (confirmado sin llamadas
  // activas a día de hoy, pero no es este arco quien decide retirarlos).
  onedrive: { text: 'OD', color: '#0078D4' },
  s3: { text: 'S3', color: '#FF9900' },
  onenote: { text: 'ON', color: '#7719AA' },
  // "Otro proveedor / servidor propio" — la baldosa del motor puro. No es una
  // marca, así que va en gris del tema y no en un color inventado.
  generic: { text: '+', color: 'var(--text-dim)' },
  monday: { text: 'M', color: '#6161FF' },
};

/**
 * Slugs cuyo logo vendorizado tiene poco contraste contra un fondo oscuro
 * (verificado con Chrome headless en el vendorizado, no con un grep de hex —
 * ver `ATTRIBUTION.md`). Se envuelven en un chip circular blanco para que el
 * logo siga siendo legible sobre el tema oscuro del dash.
 */
const DARK_THEME_RISK = new Set(['disroot', 'notion']);

export interface ProviderIconProps {
  slug: string;
  size?: number;
  style?: CSSProperties;
}

/**
 * Slugs cuyo SVG vendorizado es notablemente más ancho que alto (logotipo tipo
 * banner, no un icono cuadrado) — medido de verdad en el vendorizado:
 * `nextcloud.svg` 512.2×233.5 (~2.19:1), `zoho.svg` 1024×450 (~2.28:1, el del
 * PROVEEDOR — `zoho--mail.svg` es 512×512, cuadrado, no necesita esto).
 * Forzar un box cuadrado con `objectFit:'contain'` los aplastaba a una banda
 * de ~6-7px de alto a los tamaños pequeños (cabecera de grupo, 15px) —
 * hallazgo de la revisión adversarial. Aquí se les da ANCHO proporcional al
 * alto en vez de estrujarlos en un cuadrado que no es su forma real.
 */
const WIDE_ASPECT_RATIO: Record<string, number> = {
  nextcloud: 512.2 / 233.5,
  zoho: 1024 / 450,
};

function brandImg(key: string, url: string, alt: string, size: number, style?: CSSProperties) {
  const ratio = WIDE_ASPECT_RATIO[key];
  const width = ratio ? Math.round(size * ratio) : size;
  return (
    <img
      src={url}
      alt={alt}
      width={width}
      height={size}
      style={{ objectFit: 'contain', ...style }}
    />
  );
}

/** Envuelve un logo en el chip blanco de rescate de contraste para tema oscuro. */
function withDarkChip(node: ReactNode, size: number) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#fff',
        padding: Math.round(size * 0.12),
      }}
    >
      {node}
    </span>
  );
}

/**
 * El logo del proveedor. Nunca devuelve `null`: si no hay logo, hay inicial.
 * Un icono genérico repetido haría que dos proveedores distintos parecieran el
 * mismo, que es peor que una letra.
 */
export function DataProviderIcon({ slug, size = 28, style }: ProviderIconProps) {
  const key = slug.toLowerCase();

  const assetUrl = BRAND_ASSETS[key];
  if (assetUrl) {
    const img = brandImg(key, assetUrl, key, size, style);
    return DARK_THEME_RISK.has(key) ? withDarkChip(img, size) : img;
  }

  const simple = SIMPLE_TINTED[key];
  if (simple) {
    const svg = (
      <svg
        role="img"
        aria-label={simple.title}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={style}
      >
        <path d={simple.path} fill={`#${simple.hex}`} />
      </svg>
    );
    return DARK_THEME_RISK.has(key) ? withDarkChip(svg, size) : svg;
  }

  const letra = LETTERMARK[key] ?? {
    text: (slug[0] ?? '?').toUpperCase(),
    color: 'var(--text-dim)',
  };
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 'var(--radius-sm)',
        border: `1.5px solid ${letra.color}`,
        color: letra.color,
        fontSize: Math.max(9, Math.round(size * 0.38)),
        fontWeight: 700,
        letterSpacing: '-0.02em',
        fontFamily: 'var(--font-sans)',
        ...style,
      }}
    >
      {letra.text}
    </span>
  );
}

/** ¿Este proveedor tiene logo de marca de verdad (no una inicial)? */
export function hasBrandIcon(slug: string): boolean {
  const key = slug.toLowerCase();
  return Boolean(BRAND_ASSETS[key] ?? SIMPLE_TINTED[key]);
}

export type DataServiceDomain = 'mail' | 'calendar' | 'contacts' | 'tasks';

export interface DataServiceIconProps {
  providerSlug: string;
  domain?: DataServiceDomain;
  size?: number;
  style?: CSSProperties;
}

const DOMAIN_GLYPH: Record<DataServiceDomain, typeof Mail> = {
  mail: Mail,
  calendar: Calendar,
  contacts: Users,
  tasks: CheckSquare,
};

/**
 * El slug compuesto por defecto es `${proveedor}--${dominio}` (p.ej.
 * `proton--calendar`, `zoho--mail`), pero unos pocos assets vendorizados no
 * siguen ese patrón porque el nombre del SERVICIO no coincide con el del
 * dominio genérico: Gmail no se llama "google--mail" sino `google--gmail`,
 * Synology Mail Plus es `synology--mail-plus`, y Outlook es
 * `microsoft--outlook`. Solo hace falta la excepción — el resto de
 * combinaciones (`google--calendar`, `synology--contacts`…) sí coinciden con
 * el patrón por defecto.
 */
const SERVICE_KEY_OVERRIDES: Partial<Record<string, Partial<Record<DataServiceDomain, string>>>> = {
  google: { mail: 'google--gmail' },
  microsoft: { mail: 'microsoft--outlook' },
  synology: { mail: 'synology--mail-plus' },
};

/**
 * Compone el logo del proveedor con un glifo pequeño superpuesto que indica
 * DE QUÉ SERVICIO se trata (correo/calendario/contactos), para cuando el
 * proveedor no tiene un asset a color específico de ese servicio.
 */
function IconWithGlyph({
  logo,
  domain,
  size,
}: {
  logo: ReactNode;
  domain: DataServiceDomain;
  size: number;
}) {
  const Glyph = DOMAIN_GLYPH[domain];
  const glyphSize = Math.round(size * 0.42);
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        width: size,
        height: size,
      }}
    >
      {logo}
      <span
        style={{
          position: 'absolute',
          bottom: -Math.round(glyphSize * 0.2),
          right: -Math.round(glyphSize * 0.2),
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: glyphSize + 4,
          height: glyphSize + 4,
          borderRadius: '50%',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
      >
        <Glyph size={Math.round(glyphSize * 0.72)} />
      </span>
    </span>
  );
}

/**
 * El logo del proveedor, pero del SERVICIO concreto (correo/calendario/
 * contactos) cuando el proveedor tiene más de uno. Usa el asset específico si
 * existe (`google--gmail`, `synology--calendar`…); si no, compone el logo del
 * proveedor con un glifo Lucide del dominio superpuesto.
 *
 * Sin `domain`, es un alias directo de `DataProviderIcon` (uso genérico, p.ej.
 * la cabecera de un grupo de proveedor sin servicio concreto que señalar).
 */
export function DataServiceIcon({ providerSlug, domain, size = 28, style }: DataServiceIconProps) {
  const key = providerSlug.toLowerCase();

  if (!domain) {
    return <DataProviderIcon slug={key} size={size} style={style} />;
  }

  // Assets específicos por servicio, cuando existen — la resolución más fiel.
  const specificKey = SERVICE_KEY_OVERRIDES[key]?.[domain] ?? `${key}--${domain}`;
  const specificUrl = BRAND_ASSETS[specificKey];
  if (specificUrl) {
    const img = brandImg(specificKey, specificUrl, specificKey, size, style);
    return DARK_THEME_RISK.has(key) ? withDarkChip(img, size) : img;
  }

  // Proton no tiene contacts: si alguien lo pide igualmente, cae al logo
  // genérico del proveedor sin componer un glifo que no corresponde a nada.
  if (key === 'proton' && domain === 'contacts') {
    return <DataProviderIcon slug={key} size={size} style={style} />;
  }

  // Microsoft/Zoho sin variante de asset para este servicio: logo del
  // proveedor + glifo del dominio superpuesto.
  const logo = <DataProviderIcon slug={key} size={size} style={style} />;
  return <IconWithGlyph logo={logo} domain={domain} size={size} />;
}
