/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

// Puente de SESIÓN del envoltorio APK (`window.MicelclawNative`, persiste en el origen
// del dash remoto).
//
// POR QUÉ existe: el "cerrar sesión" del dash solo alcanza a lo que vive en SU origen
// (el del box). En la app, la credencial del dispositivo vive en el origen del paquete
// local y en las preferencias nativas — el dash no puede tocar ninguno de los dos. Sin
// este puente, cerrar sesión en el teléfono te dejaba en el login del dash y al reabrir
// la app volvía a entrar sola con el emparejamiento: no había forma de repetir el
// proceso de conexión. Sin puente (escritorio / PWA / navegador) es no-op y el dash
// hace su cerrar sesión normal.

interface SessionBridge {
  resetAccess?: () => string;
}

function bridge(): SessionBridge | undefined {
  const b = (window as unknown as { MicelclawNative?: SessionBridge }).MicelclawNative;
  return b && typeof b.resetAccess === 'function' ? b : undefined;
}

/** True solo en el APK: el envoltorio puede soltar el acceso y volver a la conexión. */
export function hasNativeAccessReset(): boolean {
  return !!bridge();
}

/**
 * Suelta la credencial de ESTE dispositivo y devuelve al flujo de conexión.
 *
 * El lado nativo para el servicio de avisos, borra el espejo de credenciales y navega
 * al onboarding; la navegación la hace él, así que quien llame no debe redirigir
 * después. Devuelve false si no hay puente (y entonces toca el cerrar sesión normal).
 */
export function nativeResetAccess(): boolean {
  const b = bridge();
  if (!b) return false;
  try {
    b.resetAccess?.();
    return true;
  } catch {
    return false;
  }
}
