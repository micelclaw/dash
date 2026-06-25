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

import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settings.store';

const THEMES: Record<string, Record<string, string>> = {
  dark: {
    '--bg': '#050509',
    '--surface': '#111119',
    '--card': '#1a1a24',
    '--surface-hover': '#222230',
    '--border': '#313146',
    '--border-hover': '#424258',
    '--text': '#ededf4',
    '--text-dim': '#a6a6bc',
    '--text-muted': '#8a8a9e',
  },
  light: {
    // Página gris cálida suave → paneles más claros → card el más claro
    // (elevación correcta, sin blanco puro para no deslumbrar).
    '--bg': '#e7e5e0',
    '--surface': '#f1efeb',
    '--card': '#f6f4f0',
    '--surface-hover': '#e1ded7',
    // Bordes/divisores con contraste claro sobre la página clara.
    '--border': '#b2ac9e',
    '--border-hover': '#989183',
    // Texto: primario ablandado (negro puro deslumbraba) y muted bajado
    // hasta cumplir WCAG AA (~4.6:1; antes #8a877e daba ~2.7:1).
    '--text': '#2a2824',
    '--text-dim': '#535148',
    '--text-muted': '#686459',
  },
  // Deep blue-grey, subtle ocean feel
  midnight: {
    '--bg': '#090d19',
    '--surface': '#161e2e',
    '--card': '#202a3c',
    '--surface-hover': '#2a364e',
    '--border': '#3a4966',
    '--border-hover': '#485a7a',
    '--text': '#e5e9f5',
    '--text-dim': '#a6b6ce',
    '--text-muted': '#8c9ab2',
  },
  // Warm charcoal with earthy undertones
  ember: {
    '--bg': '#0f0b09',
    '--surface': '#201a16',
    '--card': '#2a241e',
    '--surface-hover': '#383026',
    '--border': '#504438',
    '--border-hover': '#645648',
    '--text': '#f5ede5',
    '--text-dim': '#c8b8a6',
    '--text-muted': '#ac9c8a',
  },
  // Muted green-grey, forest canopy
  moss: {
    '--bg': '#070b09',
    '--surface': '#141a16',
    '--card': '#1e2620',
    '--surface-hover': '#28322c',
    '--border': '#384640',
    '--border-hover': '#485a52',
    '--text': '#e5f5ed',
    '--text-dim': '#a6ceb6',
    '--text-muted': '#8aaa9a',
  },
  // Cool slate with lavender hints
  lucid: {
    '--bg': '#0b090f',
    '--surface': '#181620',
    '--card': '#22202a',
    '--surface-hover': '#2c2a38',
    '--border': '#3e3c4e',
    '--border-hover': '#504e62',
    '--text': '#edebf5',
    '--text-dim': '#b8b6ce',
    '--text-muted': '#9c9aac',
  },
  // Rosa pastel polvoriento — tema claro más apagado que `light`
  blush: {
    '--bg': '#ead2d8',
    '--surface': '#f2dee2',
    '--card': '#f7e6ea',
    '--surface-hover': '#e2c6cd',
    '--border': '#c39ba7',
    '--border-hover': '#b18796',
    '--text': '#2a1f24',
    '--text-dim': '#4d3c44',
    '--text-muted': '#5a4650',
  },
};

// Light-type themes use 'light' data-theme, rest use 'dark'
const LIGHT_THEMES = new Set(['light', 'blush']);

/** ¿El tema es de familia clara? (light, blush). Usado p.ej. por el picker de
 *  texturas de fondo para mostrar solo las texturas que casan con el tema. */
export function isLightThemeId(theme: string): boolean {
  return LIGHT_THEMES.has(theme);
}

function adjustBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function hexToRgb(hex: string): string {
  const num = parseInt(hex.replace('#', ''), 16);
  return `${(num >> 16) & 0xff}, ${(num >> 8) & 0xff}, ${num & 0xff}`;
}

export function applyTheme(theme: string) {
  const vars = THEMES[theme] || THEMES.dark!;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  root.setAttribute('data-theme', LIGHT_THEMES.has(theme) ? 'light' : 'dark');
}

export function applyAccentColor(hex: string) {
  const root = document.documentElement;
  root.style.setProperty('--amber', hex);
  root.style.setProperty('--amber-hover', adjustBrightness(hex, 20));
  root.style.setProperty('--amber-dim', `rgba(${hexToRgb(hex)}, 0.2)`);
}

export interface DashBackground {
  type: 'none' | 'color' | 'texture';
  value: string;
  /** Alfa del velo del color del tema sobre la textura (0..1). Default 0.6.
   *  Más alto = textura más sutil; más bajo = textura más visible. */
  overlay?: number;
}

/**
 * Applies the custom dash background on top of the active theme.
 * - 'color': overrides the theme's --bg with a solid color.
 * - 'texture': fixed cover image from /backgrounds/ behind a theme-derived
 *   overlay (keeps content readable on every theme, light ones included).
 * - 'none'/undefined: restores the theme's own --bg.
 */
export function applyBackground(bg: DashBackground | undefined, theme: string) {
  const root = document.documentElement;
  const body = document.body;
  const themeBg = (THEMES[theme] || THEMES.dark!)['--bg']!;

  if (bg?.type === 'color' && bg.value) {
    root.style.setProperty('--bg', bg.value);
    body.style.backgroundImage = '';
    root.removeAttribute('data-bg');
    return;
  }

  if (bg?.type === 'texture' && bg.value) {
    // Theme-derived overlay so the texture never hurts legibility. Alfa
    // configurable por el usuario (slider en Settings → Dash); default 0.6.
    const overlayAlpha = bg.overlay ?? 0.6;
    const overlay = `rgba(${hexToRgb(themeBg)}, ${overlayAlpha})`;
    root.style.setProperty('--bg', themeBg);
    body.style.backgroundImage = `linear-gradient(${overlay}, ${overlay}), url(/backgrounds/${bg.value})`;
    body.style.backgroundSize = 'cover';
    body.style.backgroundPosition = 'center';
    body.style.backgroundAttachment = 'fixed';
    root.setAttribute('data-bg', 'texture');
    return;
  }

  // none → restore theme default
  root.style.setProperty('--bg', themeBg);
  body.style.backgroundImage = '';
  root.removeAttribute('data-bg');
}

/**
 * Hook that applies theme + accent + background from settings store on load,
 * and re-applies whenever settings change.
 */
export function useTheme() {
  const settings = useSettingsStore((s) => s.settings);

  useEffect(() => {
    if (!settings?.dash) return;
    applyTheme(settings.dash.theme);
    // Re-apply background AFTER the theme so a theme switch doesn't clobber it.
    applyBackground(settings.dash.background, settings.dash.theme);
  }, [settings?.dash?.theme, settings?.dash?.background]);

  useEffect(() => {
    if (!settings?.dash?.accent_color) return;
    applyAccentColor(settings.dash.accent_color);
  }, [settings?.dash?.accent_color]);
}
