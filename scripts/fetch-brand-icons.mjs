#!/usr/bin/env node
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

// ─── Vendoring de logos de marca a color (proveedores de correo/calendario/
// contactos) ─────────────────────────────────────────────────────────────
//
// Descarga UNA VEZ los logos oficiales de cada proveedor y los versiona en
// `src/assets/brand-icons/`. Nada de CDN en runtime (CSP / offline-first):
// el componente consumidor (`src/config/data-provider-icons.tsx` o su
// sucesor) importa estos ficheros como assets estáticos de Vite.
//
// Cuatro proveedores (gmx, migadu, mail.com, disroot) NO tienen fichero
// aquí a propósito: ya existen como export en el paquete `simple-icons`
// (dependencia ya instalada), y el consumidor los pinta como
// `<path d={si.xxx.path} fill={'#' + si.xxx.hex} />` — eso YA es el logo
// real de marca a color, sin necesidad de vendorizar un fichero.
//
// Ejecutar: `node scripts/fetch-brand-icons.mjs` desde la raíz de `dash/`.
// Sin dependencias nuevas — usa `fetch` nativo de Node ≥18.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'src', 'assets', 'brand-icons');

const UA = 'micelclaw-dash-icon-vendor/1.0 (+https://micelclaw.com; contacto: vgvaldunciel@gmail.com)';

/**
 * Cada entrada: { slug, service, url, filename, source }
 *
 *  - slug:     id del proveedor tal cual aparece en provider-meta.ts (core).
 *  - service:  'provider' (logo genérico del proveedor) o el dominio
 *              concreto ('mail' | 'calendar' | 'contacts' | ...) cuando es
 *              el icono de un SERVICIO específico dentro de ese proveedor.
 *  - url:      URL final ya resuelta (sin redirects) de la que se descarga.
 *  - filename: nombre de fichero de salida dentro de brand-icons/.
 *  - source:   nota corta de dónde sale, para el resumen + ATTRIBUTION.md.
 */
const MANIFEST = [
  // ── Proveedores (logo genérico) ──────────────────────────────────────
  // 'generic' (Otro proveedor/servidor propio) NO es una marca — no lleva
  // entrada aquí a propósito, ya tiene su icono "+" gris de fallback.
  {
    slug: 'icloud',
    service: 'provider',
    url: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/icloud.svg',
    filename: 'icloud.svg',
    source: 'dashboard-icons (homarr-labs), svg/icloud.svg',
  },
  {
    slug: 'fastmail',
    service: 'provider',
    url: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/fastmail.svg',
    filename: 'fastmail.svg',
    source: 'dashboard-icons (homarr-labs), svg/fastmail.svg',
  },
  {
    slug: 'nextcloud',
    service: 'provider',
    url: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/nextcloud.svg',
    filename: 'nextcloud.svg',
    source: 'dashboard-icons (homarr-labs), svg/nextcloud.svg',
  },
  {
    slug: 'synology',
    service: 'provider',
    url: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/synology.svg',
    filename: 'synology.svg',
    source: 'dashboard-icons (homarr-labs), svg/synology.svg',
  },
  {
    slug: 'google',
    service: 'provider',
    url: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/google.svg',
    filename: 'google.svg',
    source: 'dashboard-icons (homarr-labs), svg/google.svg',
  },
  {
    slug: 'microsoft',
    service: 'provider',
    url: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/microsoft.svg',
    filename: 'microsoft.svg',
    source: 'dashboard-icons (homarr-labs), svg/microsoft.svg',
  },
  {
    slug: 'proton',
    service: 'provider',
    url: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/proton.svg',
    filename: 'proton.svg',
    source: 'dashboard-icons (homarr-labs), svg/proton.svg',
  },
  {
    slug: 'zoho',
    service: 'provider',
    url: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/zoho.svg',
    filename: 'zoho.svg',
    source: 'dashboard-icons (homarr-labs), svg/zoho.svg',
  },
  {
    slug: 'mailbox_org',
    service: 'provider',
    url: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/mailbox.svg',
    filename: 'mailbox_org.svg',
    source: 'dashboard-icons (homarr-labs), svg/mailbox.svg (= marca mailbox.org, verde #abe659)',
  },
  {
    slug: 'yahoo',
    service: 'provider',
    url: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/yahoo.svg',
    filename: 'yahoo.svg',
    source: 'dashboard-icons (homarr-labs), svg/yahoo.svg',
  },
  {
    slug: 'yandex',
    service: 'provider',
    url: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/yandex.svg',
    filename: 'yandex.svg',
    source: 'dashboard-icons (homarr-labs), svg/yandex.svg',
  },
  {
    slug: 'aol',
    service: 'provider',
    url: 'https://s.yimg.com/cv/apiv2/aolfp/images/favicon/v4/180.png',
    filename: 'aol.png',
    source:
      'Icono oficial de AOL Mail servido desde el propio aol.com (apple-touch-icon 180x180, fondo amarillo + wordmark AOL), vía s.yimg.com (CDN de Yahoo/Yahoo Inc, dueño actual de la marca AOL). ' +
      'Preferido sobre selfhst/icons/svg/aol.svg porque ese SVG no tiene relleno de color (negro por defecto) y no representa la identidad visual amarilla/negra actual de AOL.',
  },
  {
    slug: 'posteo',
    service: 'provider',
    url: 'https://posteo.de/images/app-icons/android-chrome-512x512.png',
    filename: 'posteo.png',
    source:
      'Icono oficial de la app/PWA de Posteo, servido desde posteo.de/site.webmanifest (android-chrome-512x512.png: círculo verde con marca "//P."). ' +
      'PENDIENTE original: Wikimedia Commons solo tenía un banner promocional de 2013 (File:Posteo.png, colores desactualizados, forma no cuadrada) — se descartó a favor de este icono actual y con forma de icono.',
  },
  {
    slug: 'webde',
    service: 'provider',
    url: 'https://s.uicdn.com/uimag/1.0.0/assets/favicon/webde/android-chrome-512x512.png',
    filename: 'webde.png',
    source:
      'Icono oficial de la app/PWA de WEB.DE, resuelto siguiendo el redirect de https://web.de/apple-touch-icon.png hasta el CDN de United Internet (s.uicdn.com): cuadrado amarillo #FFD800 con la Puerta de Brandenburgo + wordmark WEB.DE. ' +
      'PENDIENTE original: de.wikipedia.org tiene Datei:Web.de_logo.svg (no-free, uso nominativo) — se descartó a favor de este PNG servido por el propio proveedor, de mayor resolución y sin restricción de "NoCommons".',
  },

  // ── Servicios específicos (mismo proveedor, icono distinto por dominio) ─
  {
    slug: 'google',
    service: 'gmail',
    url: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/gmail.svg',
    filename: 'google--gmail.svg',
    source: 'dashboard-icons (homarr-labs), svg/gmail.svg',
  },
  {
    slug: 'google',
    service: 'calendar',
    url: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/google-calendar.svg',
    filename: 'google--calendar.svg',
    source: 'dashboard-icons (homarr-labs), svg/google-calendar.svg',
  },
  {
    slug: 'google',
    service: 'contacts',
    url: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/google-contacts.svg',
    filename: 'google--contacts.svg',
    source: 'dashboard-icons (homarr-labs), svg/google-contacts.svg',
  },
  {
    slug: 'microsoft',
    service: 'outlook',
    url: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/microsoft-outlook.svg',
    filename: 'microsoft--outlook.svg',
    source: 'dashboard-icons (homarr-labs), svg/microsoft-outlook.svg',
  },
  // NOTA: no hay icono oficial suelto de "Microsoft 365 Calendar" ni de
  // "Microsoft People/Contacts" en dashboard-icons ni en selfhst/icons —
  // se probaron los slugs outlook-calendar, microsoft-outlook-calendar,
  // microsoft-people, microsoft-calendar, outlook, microsoft-contacts,
  // microsoft-365-calendar (todos 404). Ver "notFound" en el resumen final:
  // el consumidor debe caer a microsoft--outlook.svg + un glifo pequeño.
  {
    slug: 'synology',
    service: 'mail-plus',
    url: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/synology-mail-plus.png',
    filename: 'synology--mail-plus.png',
    source: 'dashboard-icons (homarr-labs), png/synology-mail-plus.png (no existe como svg)',
  },
  {
    slug: 'synology',
    service: 'calendar',
    url: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/synology-calendar.png',
    filename: 'synology--calendar.png',
    source: 'dashboard-icons (homarr-labs), png/synology-calendar.png (no existe como svg)',
  },
  {
    slug: 'synology',
    service: 'contacts',
    url: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/synology-contacts.png',
    filename: 'synology--contacts.png',
    source: 'dashboard-icons (homarr-labs), png/synology-contacts.png (no existe como svg)',
  },
  {
    slug: 'proton',
    service: 'mail',
    url: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/proton-mail.svg',
    filename: 'proton--mail.svg',
    source: 'dashboard-icons (homarr-labs), svg/proton-mail.svg',
  },
  {
    slug: 'proton',
    service: 'calendar',
    url: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/proton-calendar.svg',
    filename: 'proton--calendar.svg',
    source: 'dashboard-icons (homarr-labs), svg/proton-calendar.svg',
  },
  {
    slug: 'zoho',
    service: 'mail',
    url: 'https://cdn.jsdelivr.net/gh/selfhst/icons/svg/zoho-mail.svg',
    filename: 'zoho--mail.svg',
    source: 'selfh.st/icons, svg/zoho-mail.svg (dashboard-icons no tiene zoho-mail.svg suelto, 404)',
  },
];

/** Proveedores/servicios sin fichero: van por `simple-icons` (ya en package.json). */
const SIMPLE_ICONS_ONLY = [
  { slug: 'gmx', exportName: 'siGmx' },
  { slug: 'migadu', exportName: 'siMigadu' },
  { slug: 'mailcom', exportName: 'siMaildotcom' }, // provider-meta.ts: "mailcom" == mail.com
  { slug: 'disroot', exportName: 'siDisroot' },
];

/** Proveedores que se probaron y NO tienen fuente limpia (fallback: lettermark). */
const NO_SOURCE = [];

// ─── Descarga + validación ─────────────────────────────────────────────

function looksLikeSvg(buf) {
  // Tolera BOM / whitespace / XML prolog / comentarios antes de <svg.
  const head = buf.subarray(0, 512).toString('utf8').trimStart().toLowerCase();
  return head.startsWith('<?xml') ? head.includes('<svg') : head.startsWith('<svg');
}

function looksLikePng(buf) {
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return buf.length > 8 && buf.subarray(0, 8).equals(PNG_SIG);
}

function looksLikeErrorPage(buf) {
  // CDNs a veces devuelven 200 con un cuerpo HTML de "not found" en vez de
  // un 404 limpio. Si el content-type dice imagen pero el cuerpo empieza
  // por <html o <!doctype, es una trampa.
  const head = buf.subarray(0, 256).toString('utf8').trimStart().toLowerCase();
  return head.startsWith('<!doctype html') || head.startsWith('<html');
}

async function fetchAsset(entry) {
  const res = await fetch(entry.url, { headers: { 'User-Agent': UA } });
  if (!res.ok) {
    return { ok: false, reason: `HTTP ${res.status}` };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) {
    return { ok: false, reason: 'cuerpo vacío' };
  }
  if (looksLikeErrorPage(buf)) {
    return { ok: false, reason: 'cuerpo es una página HTML de error disfrazada de imagen' };
  }
  const isSvg = entry.filename.endsWith('.svg');
  const isPng = entry.filename.endsWith('.png');
  if (isSvg && !looksLikeSvg(buf)) {
    return { ok: false, reason: 'no empieza por <svg (¿HTML de error?)' };
  }
  if (isPng && !looksLikePng(buf)) {
    return { ok: false, reason: 'no tiene la firma binaria PNG válida' };
  }
  return { ok: true, buf };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const downloaded = [];
  const failed = [];

  for (const entry of MANIFEST) {
    const label = entry.service === 'provider' ? entry.slug : `${entry.slug}--${entry.service}`;
    process.stdout.write(`→ ${label} (${entry.filename}) … `);
    try {
      const result = await fetchAsset(entry);
      if (!result.ok) {
        console.log(`FALLO (${result.reason})`);
        failed.push({ label, filename: entry.filename, url: entry.url, reason: result.reason });
        continue;
      }
      await writeFile(join(OUT_DIR, entry.filename), result.buf);
      console.log(`OK (${result.buf.length} bytes)`);
      downloaded.push({
        label,
        slug: entry.slug,
        service: entry.service,
        filename: entry.filename,
        url: entry.url,
        bytes: result.buf.length,
        source: entry.source,
      });
    } catch (err) {
      console.log(`FALLO (${err.message})`);
      failed.push({ label, filename: entry.filename, url: entry.url, reason: err.message });
    }
  }

  // Confirma que las exportaciones de simple-icons existen de verdad (no
  // escribe fichero — el consumidor las importa por código).
  let simpleIconsCheck;
  try {
    const si = await import('simple-icons');
    simpleIconsCheck = SIMPLE_ICONS_ONLY.map((e) => ({
      slug: e.slug,
      exportName: e.exportName,
      available: Boolean(si[e.exportName]),
      hex: si[e.exportName]?.hex ?? null,
      title: si[e.exportName]?.title ?? null,
    }));
  } catch (err) {
    simpleIconsCheck = SIMPLE_ICONS_ONLY.map((e) => ({
      slug: e.slug,
      exportName: e.exportName,
      available: false,
      error: err.message,
    }));
  }

  const summary = {
    outDir: OUT_DIR,
    downloaded,
    failed,
    simpleIconsOnly: simpleIconsCheck,
    noSource: NO_SOURCE,
    posteoWebdeResolution: {
      posteo: MANIFEST.find((e) => e.slug === 'posteo')?.url ?? 'no_source',
      webde: MANIFEST.find((e) => e.slug === 'webde')?.url ?? 'no_source',
    },
    totals: {
      manifestEntries: MANIFEST.length,
      downloadedOk: downloaded.length,
      downloadedFailed: failed.length,
      simpleIconsAvailable: simpleIconsCheck.filter((e) => e.available).length,
      simpleIconsMissing: simpleIconsCheck.filter((e) => !e.available).length,
    },
  };

  console.log('\n──────── RESUMEN ────────');
  console.log(JSON.stringify(summary, null, 2));

  if (failed.length > 0 || simpleIconsCheck.some((e) => !e.available)) {
    process.exitCode = 1;
  }
}

main();
