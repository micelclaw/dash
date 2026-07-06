/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved. Proprietary — see LICENSE. https://micelclaw.com
 */

// Paleta + iconos del selector de perfil ERP (multi-perfil). Los valores de `color`
// que persiste el backend son claves cortas; aquí mapean a hex para el punto de color.

export const PROFILE_COLORS: { key: string; hex: string }[] = [
  { key: 'blue', hex: '#3b82f6' },
  { key: 'green', hex: '#22c55e' },
  { key: 'orange', hex: '#f59e0b' },
  { key: 'purple', hex: '#a855f7' },
  { key: 'red', hex: '#ef4444' },
  { key: 'teal', hex: '#14b8a6' },
];

export function profileColorHex(color: string | null | undefined): string {
  return PROFILE_COLORS.find((c) => c.key === color)?.hex ?? 'var(--mod-finance)';
}

export const PROFILE_ICONS = ['🏢', '👤', '🏠', '📦', '🧾', '💼', '🚗', '🍽️'];
