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

// ─── El cuerpo HTML de un correo, preparado para pintarse sin avisar al remitente ──
//
// PORQUÉ EXISTE ESTE FICHERO. Un correo en HTML trae sus imágenes de un servidor
// del REMITENTE, así que pintarlo tal cual le CONFIRMA que lo has abierto: la
// hora, tu IP y tu navegador. No es teoría — medido en este box, abrir un solo
// correo pasaba de 4 peticiones externas (las fuentes del dash) a 36, entre
// ellas píxeles de apertura literales (`open.aspx`, `open.gif`).
//
// Lo que hacen los clientes serios: Thunderbird/Apple Mail/Outlook BLOQUEAN y
// ponen una barra «Mostrar»; Gmail no bloquea pero PROXEA todo por sus
// servidores. Aquí se hacen las dos cosas: bloquear por defecto y, al pulsar
// «Mostrar», pedir las imágenes POR EL SERVIDOR (`GET /emails/:id/inline`), que
// es lo que impide que el remitente vea la IP y el navegador del usuario.
//
// DOS MECANISMOS, A PROPÓSITO, y ninguno sobra:
//   1. Una CSP dentro del propio documento (`<meta http-equiv>`) — medido: corta
//      los CUATRO vectores a la vez (src, srcset, background-image de CSS y el
//      atributo `background` de <table>): 4 peticiones → 0. Las `data:` pasan.
//   2. Neutralizar los `src` remotos en el DOM antes de serializar. Así no hay
//      ni iconos rotos ni una petición que dependa de que el navegador respete
//      una CSP en un `<meta>`. Es el cinturón; la CSP es los tirantes.
//
// Y ESTE FICHERO ES COMPARTIDO por los DOS sitios que pintan un correo (el panel
// de lectura y cada mensaje de una conversación). Antes la constante de estilos
// estaba DUPLICADA en ambos y ya había divergido; con la política de bloqueo
// duplicada, un arreglo en un sitio dejaría el otro avisando al remitente.

import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiResponse } from '@/types/api';

/** GIF 1×1 transparente. Ocupa el hueco de una imagen bloqueada sin pedir nada. */
export const PIXEL_VACIO =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export type VarianteCuerpo = 'panel' | 'hilo';

export interface AdjuntoRef {
  filename: string;
  source_id?: string;
  content?: string;
}

export interface OpcionesCuerpo {
  /** Id del correo: sin él no se puede proxear nada (la ruta va por correo). */
  emailId: string;
  /** false = las remotas se piden por el proxy de Core. */
  bloquearRemotas: boolean;
  /** El panel de lectura tiene fondo propio; en una conversación es transparente. */
  variante?: VarianteCuerpo;
  /**
   * La lista de adjuntos del correo, EN SU ORDEN (el backend direcciona por
   * posición). Con ella se pueden pintar las imágenes `cid:`, que son partes del
   * propio correo y no tienen nada que ver con la privacidad.
   */
  adjuntos?: AdjuntoRef[];
}

export interface CuerpoPreparado {
  /** Documento completo listo para `srcDoc`. */
  doc: string;
  /**
   * SOLO el cuerpo ya transformado (sin CSP ni estilos). Lo consume la ventana de
   * impresión / «abrir en ventana nueva», que es un documento REAL y no un
   * `srcDoc`: si ahí se metiera el HTML crudo, imprimir seguiría avisando al
   * remitente por una puerta lateral.
   */
  cuerpoHtml: string;
  /** Cuántas imágenes remotas DISTINTAS trae el correo. */
  remotas: number;
  /** Hosts distintos a los que pediría (para explicar al usuario a quién avisa). */
  hosts: string[];
  /**
   * Imágenes `cid:` (adjuntos del propio correo, NO remotas) que NO se han
   * podido resolver. Se cuentan aparte para no mentir diciendo «imágenes
   * bloqueadas» de algo que no viene de fuera.
   */
  cid: number;
  /** Imágenes `cid:` que sí se han casado con un adjunto y se pintan. */
  cidResueltas: number;
}

// ─── Estilos del cuerpo ──────────────────────────────────────────────────────

function estilos(variante: VarianteCuerpo): string {
  // El panel de lectura pinta sobre su propio lienzo; dentro de una conversación
  // la tarjeta ya tiene fondo y un color opaco recortaría un rectángulo.
  const fondo = variante === 'hilo' ? 'transparent' : '#111118';
  return `<style>
body { background: ${fondo}; color: #e2e2e6; font-family: -apple-system, sans-serif; font-size: 14px; line-height: 1.6; margin: 0; padding: 8px; }
a { color: #d4a017; }
img { max-width: 100%; }
blockquote { border-left: 3px solid #333; margin: 8px 0; padding-left: 12px; color: #999; }
/* Una imagen sin cargar no debe parecer un fallo del visor: se ve como un hueco
   deliberado. Los píxeles de rastreo son de 1×1, así que el min-* NO se les
   aplica (se quedan invisibles) — solo se marca lo que iba a verse. */
img[data-claw-bloqueada] { background: #1a1a22; border: 1px solid #2a2a35; border-radius: 3px; }
img[data-claw-bloqueada]:not([width="1"]):not([height="1"]) { min-width: 18px; min-height: 18px; }
</style>`;
}

// ─── Detección y reescritura ─────────────────────────────────────────────────

function esRemota(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

function hostDe(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** base64url de una cadena UTF-8 (btoa solo traga latin1). */
function b64url(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * ABSOLUTA a propósito: el mismo cuerpo se pinta en un `srcDoc` (cuyo base URL es
 * heredado y no está garantizado) y en la ventana de impresión (`about:blank`).
 * Con la URL entera funciona en los dos sin depender de cómo resuelva cada uno
 * las rutas relativas.
 */
function absoluta(url: string): string {
  if (url.startsWith('/') && typeof window !== 'undefined') return `${window.location.origin}${url}`;
  return url;
}

/**
 * URL del proxy de Core para una imagen remota de ESTE correo. Lleva `?token=`
 * porque el navegador no manda el Bearer en un `<img src>` (mismo patrón que la
 * media proxeada: `plugins/auth.ts` acepta el token por query).
 */
export function urlProxy(emailId: string, urlRemota: string): string {
  return absoluta(api.mediaUrl(`/api/v1/emails/${encodeURIComponent(emailId)}/inline?u=${b64url(urlRemota)}`));
}

/**
 * Origen que hay que autorizar en la CSP para que el proxy pueda pintar. Con el
 * dash sirviendo la API en su mismo origen es `'self'`; si `VITE_API_URL` apunta
 * a otro host, hay que nombrarlo o la CSP bloquearía nuestras propias imágenes.
 */
function origenApi(): string {
  const probe = api.mediaUrl('/api/v1/health');
  if (!probe || probe.startsWith('/')) return "'self'";
  try {
    return new URL(probe).origin;
  } catch {
    return "'self'";
  }
}

/**
 * URL del adjunto nº `idx` de este correo. El backend direcciona por POSICIÓN en
 * la lista guardada, que es la misma que recibe esta función.
 */
export function urlAdjunto(emailId: string, idx: number): string {
  return absoluta(api.mediaUrl(`/api/v1/emails/${encodeURIComponent(emailId)}/attachments/${idx}/download`));
}

/**
 * Casa un `cid:` con la posición de su adjunto. Reglas, en este orden y las dos
 * MEDIDAS sobre correos reales:
 *   1. el cid es el nombre del fichero (`cid:header.png`);
 *   2. el cid es `nombre@dominio-generado` (`cid:image001.png@01DCDD5F.28C1BF90`).
 * Si no casa devuelve null y la imagen se queda como hueco — nunca se adivina un
 * adjunto «parecido»: servir el fichero equivocado sería peor que no servirlo.
 */
export function indiceAdjuntoDeCid(src: string, adjuntos: AdjuntoRef[]): number | null {
  if (!adjuntos.length) return null;
  let valor = src.replace(/^cid:/i, '').trim().replace(/^<|>$/g, '');
  try { valor = decodeURIComponent(valor); } catch { /* se usa tal cual */ }
  const candidatos = [valor.toLowerCase()];
  const corte = valor.lastIndexOf('@');
  if (corte > 0) candidatos.push(valor.slice(0, corte).toLowerCase());

  for (const c of candidatos) {
    const i = adjuntos.findIndex(
      (a) => (a.filename ?? '').trim().toLowerCase() === c && (a.source_id || a.content),
    );
    if (i >= 0) return i;
  }
  return null;
}

/** Deja la imagen inerte: hueco marcado y CERO peticiones. */
function neutralizar(img: Element, motivo: 'remota' | 'cid' | 'otra'): void {
  img.setAttribute('src', PIXEL_VACIO);
  img.setAttribute('data-claw-bloqueada', motivo);
  img.removeAttribute('srcset');
  img.removeAttribute('loading');
}

/** Reescribe los `url(...)` remotos de un fragmento CSS (o los apaga). */
function cssConUrls(css: string, emailId: string, bloquear: boolean): string {
  return css.replace(/url\(\s*(['"]?)(https?:\/\/[^'")]+)\1\s*\)/gi, (_m, _q, u: string) =>
    bloquear ? 'none' : `url("${urlProxy(emailId, u)}")`);
}

/**
 * Prepara el cuerpo de un correo para meterlo en un `srcDoc`. Es la ÚNICA puerta:
 * los dos sitios que pintan correo pasan por aquí.
 *
 * El DOMParser produce un documento INERTE (no pide nada, no ejecuta nada) — es
 * lo que permite contar e inspeccionar las imágenes remotas antes de decidir.
 */
export function prepararCuerpo(bodyHtml: string, opts: OpcionesCuerpo): CuerpoPreparado {
  const { emailId, bloquearRemotas } = opts;
  const variante = opts.variante ?? 'panel';
  const doc = new DOMParser().parseFromString(bodyHtml ?? '', 'text/html');

  const urlsRemotas = new Set<string>();
  const hosts = new Set<string>();
  let cid = 0;
  let cidResueltas = 0;
  const adjuntos = opts.adjuntos ?? [];

  const anotarRemota = (u: string) => {
    urlsRemotas.add(u);
    const h = hostDe(u);
    if (h) hosts.add(h);
  };

  // ── Inertizar ANTES de contar nada ──
  // El sandbox del iframe impide EJECUTAR, pero `cuerpoHtml` acaba en la ventana
  // de impresión, que es un documento REAL, sin sandbox y —al abrirse con
  // `window.open('')`— CON EL ORIGEN DEL DASH. MEDIDO: un `<script>` del correo
  // se ejecutaba ahí y leía el `localStorage` con el token de sesión; en este
  // buzón hay 47 correos con `<script>`, 8 con `onload=` y 4 con `onerror=`.
  // Además ese documento contiene ahora las URLs del proxy CON `?token=`, así que
  // un script del remitente podría llevárselas. La inertización va en el DOM (no
  // en la plantilla) para que valga en los DOS destinos y para no depender de que
  // nadie añada `allow-scripts` al iframe algún día.
  doc.querySelectorAll('script').forEach((el) => el.remove());
  // Un `<meta http-equiv="refresh">` es una NAVEGACIÓN, que ninguna CSP de las de
  // aquí para (y en la ventana de impresión tampoco el sandbox).
  doc.querySelectorAll('meta[http-equiv]').forEach((el) => {
    if (/refresh/i.test(el.getAttribute('http-equiv') ?? '')) el.remove();
  });
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      // `onclick`, `onerror`, `onload`… — cualquiera de los ~70 manejadores.
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      // `javascript:` en un enlace o en el destino de un formulario.
      else if (
        /^(?:href|action|formaction|xlink:href)$/i.test(attr.name) &&
        /^\s*(?:javascript|vbscript|data:text\/html)/i.test(attr.value)
      ) el.removeAttribute(attr.name);
    }
  });

  // Un <base href> del remitente cambiaría a qué servidor resuelven las rutas
  // relativas del correo. Fuera: aquí solo se pinta lo que esté explícitamente
  // permitido (data: o el proxy), nada resuelto contra un tercero.
  doc.querySelectorAll('base').forEach((b) => b.remove());

  // `<picture><source srcset>` y los demás elementos que piden un subrecurso por
  // su cuenta. Hasta aquí solo los tapaba la CSP del iframe — y la ventana de
  // IMPRESIÓN no tiene CSP, así que lo que el DOM dejara pasar se pedía DE VERDAD
  // al remitente. MEDIDO en un correo real de este buzón (support@cults3d.com):
  // al imprimir con el bloqueo puesto, `images.cults3d.com` respondía 200 → el
  // remitente veía la IP. En el buzón hay 106 correos con `<source srcset>` y 2
  // con `<iframe src>`. La neutralización del DOM es la cerradura que vale en los
  // DOS sitios; la CSP sigue siendo la segunda, no la única.
  //
  // El `<source>` se queda SIN srcset/src: el `<picture>` cae entonces a su
  // `<img>` interno, que sí pasa por el tratamiento de abajo (hueco al bloquear,
  // proxy al mostrar) → el usuario ve la imagen igual. No se cuenta como remota
  // aparte porque el recurso que de verdad se pinta es el del `<img>`: sumarla
  // haría que la barra prometiera más imágenes de las que el proxy pide.
  doc.querySelectorAll('source').forEach((s) => {
    s.removeAttribute('srcset');
    s.removeAttribute('src');
  });
  // Ni marcos, ni objetos, ni medios: un visor de correo no los pinta y cada uno
  // es una petición al servidor del remitente por otra puerta.
  doc.querySelectorAll('iframe[src], object[data], embed[src], video[poster], video[src], audio[src], track[src], link[href]').forEach((el) => {
    for (const attr of ['src', 'data', 'poster', 'href']) {
      const v = (el.getAttribute(attr) ?? '').trim();
      if (v && !v.startsWith('data:')) el.removeAttribute(attr);
    }
  });

  // `input type=image` ES una imagen (mismo trato que <img>), solo que con otra
  // etiqueta: sin incluirlo, su `src` remoto se pedía en la impresión.
  // (el valor de `type` casa sin distinguir mayúsculas en un documento HTML)
  doc.querySelectorAll('img, input[type="image"]').forEach((img) => {
    const src = (img.getAttribute('src') ?? '').trim();
    const srcset = (img.getAttribute('srcset') ?? '').trim();

    // `srcset` se retira SIEMPRE: partirlo bien exige tratar comas dentro de la
    // URL y no aporta nada (el `src` lleva la misma imagen). Si no hubiera `src`,
    // su primer candidato hace de src.
    let efectivo = src;
    if (!efectivo && srcset) {
      efectivo = srcset.split(',')[0]?.trim().split(/\s+/)[0] ?? '';
    }
    img.removeAttribute('srcset');

    if (efectivo.startsWith('data:')) return;

    if (esRemota(efectivo)) {
      anotarRemota(efectivo);
      if (bloquearRemotas) neutralizar(img, 'remota');
      else {
        img.setAttribute('src', urlProxy(emailId, efectivo));
        // Sin esto una imagen con `loading=lazy` dentro de un iframe de alto
        // recién calculado puede no disparar nunca su carga.
        img.removeAttribute('loading');
      }
      return;
    }

    // `cid:` NO es remota: es una parte del PROPIO correo, así que pintarla no
    // avisa a nadie (los bytes los pide Core al proveedor con el OAuth del
    // usuario). Del adjunto NO guardamos su Content-ID, solo {filename, mime,
    // size, source_id} — pero medido en los correos reales de este box el cid ES
    // derivable del nombre: `cid:header.png` (Gmail/DIGI) y
    // `cid:image001.png@01DCDD5F…` (Outlook). Cuando casa, se sirve por el
    // endpoint de adjuntos; cuando no (`cid:ii_abc123`), se neutraliza — que
    // además mata el `ERR_UNKNOWN_URL_SCHEME` que ensuciaba la consola.
    if (/^cid:/i.test(efectivo)) {
      const idx = indiceAdjuntoDeCid(efectivo, adjuntos);
      if (idx === null) {
        cid += 1;
        neutralizar(img, 'cid');
      } else {
        cidResueltas += 1;
        img.setAttribute('src', urlAdjunto(emailId, idx));
        img.removeAttribute('loading');
      }
      return;
    }

    if (efectivo) neutralizar(img, 'otra');
  });

  // Atributo `background` (HTML legacy, lo usan las plantillas de newsletter en
  // <table>/<td>): es una imagen remota por otra puerta.
  doc.querySelectorAll('[background]').forEach((el) => {
    const u = (el.getAttribute('background') ?? '').trim();
    el.removeAttribute('background');
    if (!esRemota(u)) return;
    anotarRemota(u);
    if (bloquearRemotas) return;
    const previo = el.getAttribute('style') ?? '';
    el.setAttribute('style', `${previo}${previo && !previo.trim().endsWith(';') ? ';' : ''}background-image:url("${urlProxy(emailId, u)}");`);
  });

  // `style="background-image:url(http…)"` inline.
  doc.querySelectorAll('[style]').forEach((el) => {
    const style = el.getAttribute('style') ?? '';
    if (!/url\(/i.test(style)) return;
    for (const m of style.matchAll(/url\(\s*['"]?(https?:\/\/[^'")]+)['"]?\s*\)/gi)) { if (m[1]) anotarRemota(m[1]); }
    el.setAttribute('style', cssConUrls(style, emailId, bloquearRemotas));
  });

  // Y los `url()` de las hojas `<style>` del propio correo.
  doc.querySelectorAll('style').forEach((tag) => {
    const css = tag.textContent ?? '';
    if (!/url\(/i.test(css)) return;
    for (const m of css.matchAll(/url\(\s*['"]?(https?:\/\/[^'")]+)['"]?\s*\)/gi)) { if (m[1]) anotarRemota(m[1]); }
    tag.textContent = cssConUrls(css, emailId, bloquearRemotas);
  });

  // La CSP va PRIMERO en el <head> — después de cualquier elemento que cargue
  // algo llegaría tarde. `default-src 'none'` cierra todo lo demás (el sandbox
  // del iframe ya prohíbe scripts; esto es la segunda cerradura).
  // Nuestro propio origen se abre SOLO cuando hace falta (imágenes mostradas por
  // el proxy o `cid:` resueltos). Con el bloqueo puesto y sin cid, la política
  // queda exactamente en `img-src data:` — la forma medida que da 0 peticiones.
  const necesitaOrigen = !bloquearRemotas || cidResueltas > 0;
  const imgSrc = necesitaOrigen ? `data: ${origenApi()}` : 'data:';
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${imgSrc}; style-src 'unsafe-inline'; font-src data:">`;

  const cabeza = doc.head?.innerHTML ?? '';
  const cuerpo = doc.body?.innerHTML ?? '';

  return {
    doc: `<!DOCTYPE html><html><head>${csp}<meta charset="utf-8">${estilos(variante)}${cabeza}</head><body>${cuerpo}</body></html>`,
    cuerpoHtml: cuerpo,
    remotas: urlsRemotas.size,
    hosts: [...hosts],
    cid,
    cidResueltas,
  };
}

/**
 * Cuenta sin transformar nada. Existe para poder aseverar el conteo en un test
 * sin depender del documento serializado.
 */
export function contarRecursos(bodyHtml: string, adjuntos: AdjuntoRef[] = []): Omit<CuerpoPreparado, 'doc' | 'cuerpoHtml'> {
  const { remotas, hosts, cid, cidResueltas } = prepararCuerpo(bodyHtml, { emailId: 'x', bloquearRemotas: true, adjuntos });
  return { remotas, hosts, cid, cidResueltas };
}

// ─── Recordar el remitente («Siempre de este remitente») ─────────────────────
//
// Vive en `users.settings.mail.remote_images_allowed_senders`, como el resto de
// las preferencias del dash: `PATCH /settings` hace deepMerge y los arrays se
// REEMPLAZAN, así que la lista completa viaja en cada escritura. NO se crea una
// tabla: es una lista corta de direcciones por usuario, sin consultas propias ni
// relaciones — una tabla solo añadiría una migración y un endpoint para guardar
// lo mismo.

const CLAVE = 'remote_images_allowed_senders';

/** Una dirección se compara siempre en minúsculas y sin espacios. */
export function remitenteNormalizado(addr: string | null | undefined): string {
  return (addr ?? '').trim().toLowerCase();
}

let cachePermitidos: Promise<Set<string>> | null = null;
// El `logout()` del dash NO recarga la página (solo limpia el store), así que un
// módulo cacheado sobrevive al cambio de usuario: sin esta clave, la lista de
// remitentes de confianza de quien salió decidiría mostrar imágenes en los
// correos de quien entra.
let cacheDe: string | null = null;

/** Lee la lista (una vez por usuario y sesión de pestaña; las escrituras la actualizan). */
export function cargarRemitentesPermitidos(): Promise<Set<string>> {
  const uid = useAuthStore.getState().user?.id ?? null;
  if (cachePermitidos && cacheDe !== uid) cachePermitidos = null;
  cacheDe = uid;
  if (!cachePermitidos) {
    cachePermitidos = api
      .get<ApiResponse<Record<string, any>>>('/settings')
      .then((res) => {
        const lista = res?.data?.mail?.[CLAVE];
        return new Set<string>(
          Array.isArray(lista) ? lista.map((x: unknown) => remitenteNormalizado(String(x))).filter(Boolean) : [],
        );
      })
      .catch(() => {
        // Un fallo de lectura NO puede volverse «muestra las imágenes»: se
        // devuelve la lista vacía (y no se cachea, para reintentar).
        cachePermitidos = null;
        return new Set<string>();
      });
  }
  return cachePermitidos;
}

/** Añade un remitente a la lista permitida y devuelve la lista resultante. */
export async function recordarRemitente(addr: string): Promise<Set<string>> {
  const dir = remitenteNormalizado(addr);
  const actuales = new Set(await cargarRemitentesPermitidos());
  if (!dir) return actuales;
  if (actuales.has(dir)) return actuales;
  actuales.add(dir);
  await api.patch('/settings', { mail: { [CLAVE]: [...actuales] } });
  cachePermitidos = Promise.resolve(new Set(actuales));
  cacheDe = useAuthStore.getState().user?.id ?? null;
  return actuales;
}

/** Solo para tests: olvida la lista leída. */
export function _resetCacheRemitentes(): void {
  cachePermitidos = null;
  cacheDe = null;
}
