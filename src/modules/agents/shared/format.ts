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

// Helpers de presentación compartidos por el módulo Agents. Extraídos de
// AgentActivity.tsx (formatRelativeTime) y ConversationCharts.tsx
// (formatTokens/modelShort/MODEL_PALETTE) para que Activity Center (A),
// Fleet/Analytics (B) y Council (C) los reusen sin duplicar.

/** Tiempo relativo; los consumidores anteriores conservan español por defecto. */
export function formatRelativeTime(dateStr: string | null, locale: 'en' | 'es' = 'es'): string {
  if (!dateStr) return locale === 'en' ? 'never' : 'nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (locale === 'en') {
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years !== 1 ? 's' : ''} ago`;
  }
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'justo ahora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `hace ${months} mes${months !== 1 ? 'es' : ''}`;
  return `hace ${Math.floor(months / 12)} año${months >= 24 ? 's' : ''}`;
}

/** Tokens compactos: 1.2M / 3.4k / 521. */
export function formatTokens(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

/** Último segmento del id del modelo (provider/org/name → name). */
export function modelShort(model: string | null | undefined): string {
  if (!model) return 'desconocido';
  const i = model.lastIndexOf('/');
  return i >= 0 ? model.slice(i + 1) : model;
}

/** Paleta para series/barras por modelo (recharts). */
export const MODEL_PALETTE = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899', '#14b8a6', '#eab308', '#64748b'];
