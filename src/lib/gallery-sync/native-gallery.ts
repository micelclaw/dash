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

// ─── MicelclawGallery — puente nativo por window.MicelclawNative ────────────
// APRENDIDO EN DISPOSITIVO (verificado por CDP en el Redmi): el dash se carga
// en REMOTO dentro del APK y ahí `window.Capacitor` es UNDEFINED — el puente de
// Capacitor NO se inyecta en el origen remoto. El ÚNICO puente disponible es
// `window.MicelclawNative` (addJavascriptInterface, persiste entre navegaciones),
// el mismo que usa "Compartir". Por eso la galería cuelga de aquí, no de un
// @CapacitorPlugin.
//
// Reparto de trabajo (arquitectura robusta): el dash solo hace UI + picker +
// permisos + DISPARAR; el trabajo pesado (enumerar, hashear, subir fotos Y
// vídeos por streaming, dedup, avanzar cursor) lo hace el GallerySyncWorker
// NATIVO (Java), que lee la credencial de mm-widget-auth y ya sabe subir 2GB.
// El progreso se refleja sondeando /gallery-sync/devices (synced_count).
//
// Métodos del puente (SÍNCRONOS, devuelven JSON string; requestPermissions es
// async vía callback global window.__mcGalleryPerm):
//   galleryDeviceInfo()        -> {install_id, model, manufacturer, android_version}
//   galleryCheckPermissions()  -> {state}
//   galleryRequestPermissions()-> "pending"  (resuelve window.__mcGalleryPerm(state))
//   galleryOpenSettings()      -> "ok"
//   galleryAlbums()            -> {albums:[{bucket_id,name,count,last_date_added}]}
//   gallerySyncNow()           -> "started"  (encola el worker one-time expedited)
// Un APK viejo (puente solo-share) NO tiene galleryAlbums → capable=false →
// tarjeta "Requiere actualizar la app".

export type GalleryPermissionState = 'granted' | 'limited' | 'denied' | 'prompt';

export interface GalleryAlbum {
  bucket_id: string;
  name: string;
  count: number;
  last_date_added: number;
}

export interface GalleryDeviceInfo {
  install_id: string;
  model: string;
  manufacturer: string;
  android_version: string;
}

interface GalleryNativeBridge {
  galleryDeviceInfo(): string;
  galleryCheckPermissions(): string;
  galleryRequestPermissions(): string;
  galleryOpenSettings(): string;
  galleryAlbums(): string;
  gallerySyncNow(): string;
}

declare global {
  interface Window {
    MicelclawNative?: Partial<GalleryNativeBridge> & Record<string, unknown>;
    __mcGalleryPerm?: (state: string) => void;
  }
}

/** El puente nativo si expone la API de galería (APK nuevo). undefined en web / APK viejo. */
function bridge(): GalleryNativeBridge | undefined {
  const b = window.MicelclawNative;
  return b && typeof b.galleryAlbums === 'function' ? (b as GalleryNativeBridge) : undefined;
}

function parse<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

/** Corremos dentro del envoltorio APK (haya o no soporte de galería). */
export function isNativeShell(): boolean {
  return !!window.MicelclawNative;
}

/** El APK soporta sincronización de galería (puente con los métodos nuevos). */
export function isGalleryCapable(): boolean {
  return !!bridge();
}

export function getDeviceInfo(): GalleryDeviceInfo | null {
  const b = bridge();
  if (!b) return null;
  const info = parse<Partial<GalleryDeviceInfo>>(b.galleryDeviceInfo(), {});
  return info.install_id ? (info as GalleryDeviceInfo) : null;
}

export function checkPermissions(): GalleryPermissionState {
  const b = bridge();
  if (!b) return 'denied';
  return parse<{ state: GalleryPermissionState }>(b.galleryCheckPermissions(), { state: 'prompt' }).state;
}

/** Dispara el diálogo nativo de permisos y resuelve con el estado final (o 'prompt' si expira). */
export function requestPermissions(timeoutMs = 60000): Promise<GalleryPermissionState> {
  const b = bridge();
  if (!b) return Promise.resolve('denied');
  return new Promise((resolve) => {
    let done = false;
    const finish = (s: GalleryPermissionState) => { if (!done) { done = true; delete window.__mcGalleryPerm; resolve(s); } };
    window.__mcGalleryPerm = (state: string) => finish((state as GalleryPermissionState) || 'denied');
    try { b.galleryRequestPermissions(); } catch { finish('denied'); }
    setTimeout(() => finish(checkPermissions()), timeoutMs);
  });
}

export function openAppSettings(): void {
  try { bridge()?.galleryOpenSettings(); } catch { /* no-op */ }
}

export function getAlbums(): GalleryAlbum[] {
  const b = bridge();
  if (!b) return [];
  return parse<{ albums: GalleryAlbum[] }>(b.galleryAlbums(), { albums: [] }).albums ?? [];
}

/** Encola el worker nativo para que sincronice YA (fotos y vídeos). No-op fuera del APK. */
export function triggerNativeSync(): boolean {
  const b = bridge();
  if (!b) return false;
  try { b.gallerySyncNow(); return true; } catch { return false; }
}
