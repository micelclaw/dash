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

// Helpers de navegación para conseguir el comportamiento de enlace "de toda la
// vida" en una SPA: click izquierdo simple → navegación interna (React Router);
// click central (rueda), ctrl/cmd/shift+click → el navegador abre en nueva
// pestaña/ventana. La condición necesaria es que el elemento sea un <a> con un
// href REAL (ruta de app), para que el navegador tenga algo que abrir.

import type { MouseEvent } from 'react';

/** Click izquierdo "limpio" (sin modificadores) → lo gestiona la SPA. */
export function isPlainLeftClick(e: MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

/**
 * onClick para un <a href> que navega dentro de la SPA. En click izquierdo
 * simple: previene la navegación nativa del navegador y ejecuta `go()` (p.ej.
 * navigate(to)). En click central o con modificadores: NO hace nada → el
 * navegador abre el href en nueva pestaña/ventana de forma nativa.
 */
export function handleSpaAnchorClick(e: MouseEvent<HTMLAnchorElement>, go: () => void): void {
  if (e.defaultPrevented) return;
  if (!isPlainLeftClick(e)) return; // middle/ctrl/cmd/shift → comportamiento nativo
  e.preventDefault();
  go();
}

/**
 * Para elementos que NO pueden tener un href de app real (p.ej. las chips
 * inline del editor con esquema `claw://`): detecta el gesto de "nueva pestaña"
 * (rueda / ctrl / cmd) y abre la ruta resuelta con window.open. Devuelve true
 * si lo gestionó (el caller debe parar ahí); false si es un click normal.
 */
export function openInNewTabOnAuxClick(
  e: MouseEvent,
  route: string,
): boolean {
  const wantsNewTab = e.button === 1 || e.metaKey || e.ctrlKey;
  if (!wantsNewTab) return false;
  e.preventDefault();
  window.open(route, '_blank', 'noopener');
  return true;
}
