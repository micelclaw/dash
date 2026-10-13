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

import type { DreamingStatus } from './types';

/**
 * Frases de la burbuja de pensamiento de la escena, ancladas a lo que cada
 * fase del dreaming hace de verdad (no decoración arbitraria). `phase` filtra
 * la frase si esa fase está deshabilitada en la config.
 */
interface Phrase { text: (s: DreamingStatus) => string; phase?: 'light' | 'deep' | 'rem' }

const PHRASES: Phrase[] = [
  { text: () => 'conectando puntos entre conversaciones lejanas…', phase: 'rem' },
  { text: () => 'repasando lo que más recordaste hoy…', phase: 'light' },
  { text: () => 'puliendo las señales del registro diario…' },
  { text: () => 'decidiendo qué merece pasar a la memoria duradera…', phase: 'deep' },
  { text: () => 'buscando patrones que se repiten noche tras noche…', phase: 'rem' },
  { text: () => 'soltando el ruido de la memoria a corto plazo…' },
  { text: () => 'escribiendo una página nueva del diario de sueños…' },
  {
    text: (s) => {
      const n = s.total_signal_count ?? 0;
      return n > 0 ? `consolidando ${n} señales en recuerdos duraderos…` : 'esperando señales nuevas que consolidar…';
    },
  },
];

export function pickPhrases(status: DreamingStatus | undefined): string[] {
  const s = status ?? {};
  const phases = s.phases ?? {};
  const active = PHRASES.filter(p => !p.phase || phases[p.phase]?.enabled !== false);
  const list = active.length > 0 ? active : PHRASES;
  return list.map(p => p.text(s));
}
