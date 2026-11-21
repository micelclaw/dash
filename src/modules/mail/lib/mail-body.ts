/** Pure mail HTML preparation shared by the ordinary reader and isolated MCP Apps. No API, auth or session imports. */
export interface MailBodyUrls { remote(emailId: string, url: string): string; attachment(emailId: string, index: number): string; origin: string }

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
function cssConUrls(css: string, emailId: string, bloquear: boolean, urls: MailBodyUrls): string {
  return css.replace(/url\(\s*(['"]?)(https?:\/\/[^'")]+)\1\s*\)/gi, (_m, _q, u: string) =>
    bloquear ? 'none' : `url("${urls.remote(emailId, u)}")`);
}

/**
 * Prepara el cuerpo de un correo para meterlo en un `srcDoc`. Es la ÚNICA puerta:
 * los dos sitios que pintan correo pasan por aquí.
 *
 * El DOMParser produce un documento INERTE (no pide nada, no ejecuta nada) — es
 * lo que permite contar e inspeccionar las imágenes remotas antes de decidir.
 */
export function prepararCuerpoSeguro(bodyHtml: string, opts: OpcionesCuerpo, urls: MailBodyUrls): CuerpoPreparado {
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
        img.setAttribute('src', urls.remote(emailId, efectivo));
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
        img.setAttribute('src', urls.attachment(emailId, idx));
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
    el.setAttribute('style', `${previo}${previo && !previo.trim().endsWith(';') ? ';' : ''}background-image:url("${urls.remote(emailId, u)}");`);
  });

  // `style="background-image:url(http…)"` inline.
  doc.querySelectorAll('[style]').forEach((el) => {
    const style = el.getAttribute('style') ?? '';
    if (!/url\(/i.test(style)) return;
    for (const m of style.matchAll(/url\(\s*['"]?(https?:\/\/[^'")]+)['"]?\s*\)/gi)) { if (m[1]) anotarRemota(m[1]); }
    el.setAttribute('style', cssConUrls(style, emailId, bloquearRemotas, urls));
  });

  // Y los `url()` de las hojas `<style>` del propio correo.
  doc.querySelectorAll('style').forEach((tag) => {
    const css = tag.textContent ?? '';
    if (!/url\(/i.test(css)) return;
    for (const m of css.matchAll(/url\(\s*['"]?(https?:\/\/[^'")]+)['"]?\s*\)/gi)) { if (m[1]) anotarRemota(m[1]); }
    tag.textContent = cssConUrls(css, emailId, bloquearRemotas, urls);
  });

  // La CSP va PRIMERO en el <head> — después de cualquier elemento que cargue
  // algo llegaría tarde. `default-src 'none'` cierra todo lo demás (el sandbox
  // del iframe ya prohíbe scripts; esto es la segunda cerradura).
  // Nuestro propio origen se abre SOLO cuando hace falta (imágenes mostradas por
  // el proxy o `cid:` resueltos). Con el bloqueo puesto y sin cid, la política
  // queda exactamente en `img-src data:` — la forma medida que da 0 peticiones.
  const necesitaOrigen = !bloquearRemotas || cidResueltas > 0;
  const imgSrc = necesitaOrigen ? `data: ${urls.origin}` : 'data:';
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

