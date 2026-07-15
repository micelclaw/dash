/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

// Puente de notificaciones NATIVAS del envoltorio APK (`window.MicelclawNative`,
// persiste en el origen del dash remoto). Arranca/para el servicio self-hosted que
// mantiene el WebSocket a tu box y publica las notificaciones en la barra de Android,
// y le informa si la app está en primer plano y enfocada (para no duplicar: en
// foreground el dash muestra el toast in-app; en background sale la notificación
// nativa). Sin puente (escritorio / PWA / navegador) todo es no-op.

interface NotifBridge {
  startNotificationService?: () => string;
  stopNotificationService?: () => string;
  setAppForeground?: (focused: boolean) => string;
  requestNotificationPermission?: () => string;
  notificationServiceStatus?: () => string;
}

function bridge(): NotifBridge | undefined {
  const b = (window as unknown as { MicelclawNative?: NotifBridge }).MicelclawNative;
  return b && typeof b.startNotificationService === 'function' ? b : undefined;
}

/** True solo en el APK con el puente de notificaciones nativas disponible. */
export function hasNativeNotify(): boolean {
  return !!bridge();
}

export function startNativeNotifications(): void { try { bridge()?.startNotificationService?.(); } catch { /* no-op */ } }
export function stopNativeNotifications(): void { try { bridge()?.stopNotificationService?.(); } catch { /* no-op */ } }
export function requestNativeNotifPermission(): void { try { bridge()?.requestNotificationPermission?.(); } catch { /* no-op */ } }
export function reportAppForeground(focused: boolean): void { try { bridge()?.setAppForeground?.(focused); } catch { /* no-op */ } }
