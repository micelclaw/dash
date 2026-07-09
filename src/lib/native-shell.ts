/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

/**
 * Ajustes de "chrome" nativo cuando el dash corre DENTRO del envoltorio Capacitor
 * (APK móvil). El envoltorio conserva el puente Capacitor al navegar al dash, así
 * que aquí usamos el puente inyectado en runtime (window.Capacitor.Plugins.*) sin
 * importar ningún paquete de Capacitor (el dash no es un proyecto Capacitor y se
 * sirve también como PWA). No-op en web/PWA/escritorio (window.Capacitor ausente).
 */
interface StatusBarBridge {
  hide?: () => Promise<void>;
  setOverlaysWebView?: (o: { overlay: boolean }) => Promise<void>;
}
interface CapacitorBridge {
  isNativePlatform?: () => boolean;
  Plugins?: { StatusBar?: StatusBarBridge };
}

export function configureNativeShell(): void {
  const cap = (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  const sb = cap.Plugins?.StatusBar;
  if (!sb) return;
  // Oculta la barra de estado del sistema (hora/batería/cobertura/wifi/notch) → el
  // dash ocupa toda la pantalla y deja de solaparse con la TopBar. Se revela
  // deslizando desde el borde superior. Complementa el padding-top de safe-area de
  // la TopBar (que despeja el recorte de cámara cuando la barra se revela).
  try {
    void sb.setOverlaysWebView?.({ overlay: true });
    void sb.hide?.();
  } catch {
    /* no-op */
  }
}
