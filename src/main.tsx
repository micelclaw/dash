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

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { consumeMobileHandoff } from './lib/mobile-handoff';
import { configureNativeShell } from './lib/native-shell';
import './index.css';

// App móvil → dash: si venimos con sesión en el hash (#mmauth=), rellena el store
// de auth ANTES de montar React/AuthGate (no-op en la web/PWA normal).
consumeMobileHandoff();
// Dentro del APK: oculta la barra de estado del sistema (no-op en web/PWA).
configureNativeShell();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Remove PWA splash screen: show for 2s after React mounts, then fade out
const splash = document.getElementById('splash');
if (splash) {
  setTimeout(() => {
    splash.style.transition = 'opacity 0.5s ease';
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 500);
  }, 2000);
}
