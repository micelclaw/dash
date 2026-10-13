/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

// Puente nativo de CERTIFICADO (CA) que el envoltorio APK inyecta en el WebView vía
// `addJavascriptInterface` (`window.MicelclawNative`, MainActivity.java). El binding
// PERSISTE en el origen del dash remoto (no como `window.Capacitor`), así que desde el
// dash cargado en el box podemos ofrecer el flujo NATIVO de instalación de la CA
// (instalador de Android directo) en vez de una descarga `.crt` por navegador.
//
// Espejo mínimo de `micelclaw-companions/apps/mobile/src/lib/access.ts` (no importable
// entre repos). Los resultados llegan por CustomEvent en `window`. Sin puente
// (escritorio / PWA / navegador) todo es no-op / false → el llamador cae al camino web.

interface CaBridge {
  downloadCa?: (baseUrl: string) => void;
  installCa?: () => void;
  isCaTrusted?: (baseUrl: string) => void;
  openSecuritySettings?: () => void;
}

function bridge(): CaBridge | undefined {
  const b = (window as unknown as { MicelclawNative?: CaBridge }).MicelclawNative;
  return b && typeof b.downloadCa === 'function' && typeof b.isCaTrusted === 'function' ? b : undefined;
}

/** True solo en el APK con el puente CA disponible (feature-detect, mismo gate que el onboarding). */
export function hasNativeCaBridge(): boolean {
  return !!bridge();
}

function onceEvent<T>(name: string, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: T | null) => {
      if (done) return;
      done = true;
      window.removeEventListener(name, handler as EventListener);
      resolve(v);
    };
    const handler = (e: Event) => finish((e as CustomEvent).detail as T);
    window.addEventListener(name, handler as EventListener);
    setTimeout(() => finish(null), timeoutMs);
  });
}

export interface CaDownloadResult { ok: boolean; sha256?: string; error?: string }

/** Descarga la CA del box a Descargas (evento `mclaw:caDownloaded`). base debe servir /api/v1. */
export async function nativeDownloadCa(baseUrl: string): Promise<CaDownloadResult> {
  const b = bridge();
  if (!b?.downloadCa) return { ok: false, error: 'no-native-bridge' };
  const p = onceEvent<CaDownloadResult>('mclaw:caDownloaded', 15000);
  try { b.downloadCa(baseUrl); } catch { return { ok: false, error: 'bridge-call-failed' }; }
  return (await p) ?? { ok: false, error: 'timeout' };
}

/** Lanza el instalador de CA de Android (ACTION_VIEW del .crt, cae a Ajustes de seguridad). */
export function nativeInstallCa(): void { bridge()?.installCa?.(); }

/** Abre Ajustes → Seguridad (respaldo si el instalador no se abre solo). */
export function nativeOpenSecuritySettings(): void { bridge()?.openSecuritySettings?.(); }

export interface CaStatus { trusted: boolean; reachable: boolean }

/**
 * Estado de confianza del certificado del box para `baseUrl` (evento `mclaw:caTrusted`).
 * `trusted` = la CA es de confianza y responde 200 por https; `reachable` = el box
 * responde por https aunque la CA no esté instalada (SSLException = alcanzable-no-confiable).
 * IMPORTANTE: pasar la URL **https** del box (no el origen http actual), porque una URL
 * http siempre daría `trusted` (no aplica el almacén de CA).
 */
export async function nativeCaStatus(httpsUrl: string): Promise<CaStatus> {
  const b = bridge();
  if (!b?.isCaTrusted) return { trusted: false, reachable: false };
  const p = onceEvent<CaStatus>('mclaw:caTrusted', 8000);
  try { b.isCaTrusted(httpsUrl); } catch { return { trusted: false, reachable: false }; }
  return (await p) ?? { trusted: false, reachable: false };
}
