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

export const AGENT_PALETTE = [
  '#d4a017', // amber
  '#3b82f6', // blue
  '#22c55e', // green
  '#a855f7', // purple
  '#f97316', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
  '#64748b', // slate
];

/** Nombre legible de cada color de la paleta (para el color picker del agente). */
export const AGENT_COLOR_NAMES: Record<string, string> = {
  '#d4a017': 'Ámbar',
  '#3b82f6': 'Azul',
  '#22c55e': 'Verde',
  '#a855f7': 'Morado',
  '#f97316': 'Naranja',
  '#ec4899': 'Rosa',
  '#14b8a6': 'Turquesa',
  '#64748b': 'Pizarra',
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function getAgentColor(name: string, customColor?: string): string {
  if (customColor) return customColor;
  const index = hashString(name) % AGENT_PALETTE.length;
  return AGENT_PALETTE[index]!;
}
