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

// ─── Gallery sync engine (dash) ─────────────────────────────────────────────
// APRENDIDO EN DISPOSITIVO: el dash remoto NO puede leer bytes de la galería
// (`window.Capacitor` es undefined → sin convertFileSrc; y base64 no vale para
// vídeos de 2GB). Por eso el trabajo pesado NO se hace aquí: el motor del dash
// solo (1) registra/actualiza el dispositivo en el servidor, (2) DISPARA el
// GallerySyncWorker NATIVO (que enumera, hashea, deduplica y sube fotos Y
// vídeos por streaming, con la credencial de mm-widget-auth), y (3) SONDEA
// /gallery-sync/devices para reflejar el progreso (synced_count/last_sync_at).
// Segundo plano = el mismo worker por WorkManager periódico. Una sola
// implementación de subida (Java), robusta y con vídeo. Cero duplicación.

import { useGallerySyncStore } from '@/stores/gallery-sync.store';
import { gallerySyncService } from '@/services/gallery-sync.service';
import {
  isNativeShell, isGalleryCapable, getDeviceInfo, checkPermissions, triggerNativeSync,
} from './native-gallery';

const POLL_MS = 3_000;
const POLL_MAX = 40;                 // ~2 min sondeando tras disparar
const STABLE_POLLS = 3;              // fin anticipado si nada cambia N sondeos
const MIN_INTERVAL_MS = 5 * 60_000;  // throttle de triggers pasivos
const PERIODIC_MS = 15 * 60_000;

let running = false;
let lastTriggeredAt = 0;

/** Relee el estado del dispositivo+álbumes del servidor y lo vuelca al store. */
async function refreshView(installId: string, model: string): Promise<{ deviceEnabled: boolean; syncedSum: number } | null> {
  try {
    const view = await gallerySyncService.upsertDevice({
      device_key: installId,
      device_name: model,
      platform: 'android',
    });
    const store = useGallerySyncStore.getState();
    store.setDevice(view.device);
    store.setAlbums(view.albums);
    const syncedSum = view.albums.reduce((n, a) => n + (a.synced_count || 0), 0);
    return { deviceEnabled: view.device.enabled, syncedSum };
  } catch {
    return null;
  }
}

/**
 * Dispara el worker nativo y sondea el progreso. Idempotente y single-flight.
 * `reason` solo modula el throttle de los triggers automáticos.
 */
export async function runGallerySync(
  reason: 'boot' | 'visible' | 'interval' | 'manual' | 'album-enabled' = 'manual',
): Promise<void> {
  if (running) return;
  const passive = reason === 'boot' || reason === 'visible' || reason === 'interval';
  if (passive && Date.now() - lastTriggeredAt < MIN_INTERVAL_MS) return;

  const store = useGallerySyncStore.getState();
  if (!isGalleryCapable()) { store.setCapable(false); return; }
  store.setCapable(true);

  const info = getDeviceInfo();
  if (!info) return;

  // Permiso: si no está concedido, la UI muestra el banner — no disparamos.
  const perm = checkPermissions();
  store.setPermission(perm);
  if (perm === 'denied' || perm === 'prompt') return;

  running = true;
  store.setRunning(true);
  lastTriggeredAt = Date.now();
  try {
    const before = await refreshView(info.install_id, info.model);
    if (!before || !before.deviceEnabled) return;

    // Dispara el worker nativo (fotos y vídeos, streaming, dedup, cursor).
    triggerNativeSync();

    // Sondeo del progreso: para cuando el total sincronizado se estabiliza.
    let lastSum = before.syncedSum;
    let stable = 0;
    for (let i = 0; i < POLL_MAX; i += 1) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const now = await refreshView(info.install_id, info.model);
      if (!now) continue;
      if (now.syncedSum === lastSum) {
        stable += 1;
        if (stable >= STABLE_POLLS) break;
      } else {
        stable = 0;
        lastSum = now.syncedSum;
      }
    }
    store.setLastRun(Date.now(), null);
  } finally {
    running = false;
    useGallerySyncStore.getState().setRunning(false);
    useGallerySyncStore.getState().setCurrent(null);
  }
}

// ─── Triggers (main.tsx; no-op fuera del APK) ───────────────────────────────

let configured = false;

export function configureGallerySync(): void {
  if (configured) return;
  configured = true;
  if (!isNativeShell()) return;

  window.setTimeout(() => { void runGallerySync('boot'); }, 8_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void runGallerySync('visible');
  });
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void runGallerySync('interval');
  }, PERIODIC_MS);
}
