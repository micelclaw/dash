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

import { prepararCuerpoSeguro, type OpcionesCuerpo, type CuerpoPreparado, type AdjuntoRef } from './mail-body';
export { PIXEL_VACIO, indiceAdjuntoDeCid } from './mail-body';
export type { VarianteCuerpo, OpcionesCuerpo, CuerpoPreparado, AdjuntoRef } from './mail-body';

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
export function prepararCuerpo(bodyHtml: string, opts: OpcionesCuerpo): CuerpoPreparado {
  return prepararCuerpoSeguro(bodyHtml, opts, { remote: urlProxy, attachment: urlAdjunto, origin: origenApi() });
}

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
