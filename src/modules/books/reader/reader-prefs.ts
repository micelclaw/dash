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

/**
 * Reader display preferences — persisted to localStorage and applied to the
 * book iframes via foliate's `renderer.setStyles()` (author-level CSS
 * injected into every section document).
 */

export type ReaderTheme = 'light' | 'sepia' | 'dark';
export type ReaderFontFamily = 'serif' | 'sans';

export interface ReaderPrefs {
  /** Font size in percent of the publisher size (80–160). */
  fontSize: number;
  fontFamily: ReaderFontFamily;
  theme: ReaderTheme;
  /** Unitless line-height for body text (1.2–2.2). */
  lineHeight: number;
}

export const DEFAULT_PREFS: ReaderPrefs = {
  fontSize: 100,
  fontFamily: 'serif',
  theme: 'light',
  lineHeight: 1.5,
};

const STORAGE_KEY = 'claw-reader-prefs';

export const READER_THEMES: Record<
  ReaderTheme,
  { label: string; bg: string; fg: string; link: string; dim: string }
> = {
  light: { label: 'Light', bg: '#fafaf9', fg: '#1c1917', link: '#2563eb', dim: '#78716c' },
  sepia: { label: 'Sepia', bg: '#f3e9d2', fg: '#433422', link: '#92400e', dim: '#8a7a5f' },
  dark: { label: 'Dark', bg: '#181818', fg: '#d6d3d1', link: '#7eb0ff', dim: '#8a8a8a' },
};

export function loadPrefs(): ReaderPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<ReaderPrefs>;
    return {
      fontSize: clamp(Number(parsed.fontSize) || DEFAULT_PREFS.fontSize, 80, 160),
      fontFamily: parsed.fontFamily === 'sans' ? 'sans' : 'serif',
      theme: parsed.theme === 'sepia' || parsed.theme === 'dark' ? parsed.theme : 'light',
      lineHeight: clamp(Number(parsed.lineHeight) || DEFAULT_PREFS.lineHeight, 1.2, 2.2),
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: ReaderPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode / quota — non-fatal */
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Build the CSS injected into each section iframe. Modeled on foliate-js's
 * reader demo `getCSS` (MIT) with theme/font/line-height knobs on top.
 */
export function prefsToCSS(prefs: ReaderPrefs): string {
  const theme = READER_THEMES[prefs.theme];
  const family =
    prefs.fontFamily === 'serif'
      ? 'Georgia, "Times New Roman", serif'
      : 'system-ui, -apple-system, "Segoe UI", sans-serif';
  return `
    @namespace epub "http://www.idpf.org/2007/ops";
    html {
        color-scheme: ${prefs.theme === 'dark' ? 'dark' : 'light'};
        font-size: ${prefs.fontSize}%;
    }
    html, body {
        font-family: ${family} !important;
        color: ${theme.fg} !important;
        background: none !important;
    }
    a:link, a:visited {
        color: ${theme.link};
    }
    p, li, blockquote, dd {
        line-height: ${prefs.lineHeight};
        hanging-punctuation: allow-end last;
        widows: 2;
    }
    pre {
        white-space: pre-wrap !important;
    }
    aside[epub|type~="endnote"],
    aside[epub|type~="footnote"],
    aside[epub|type~="note"],
    aside[epub|type~="rearnote"] {
        display: none;
    }
  `;
}

/** Highlight palette offered in the selection popover. */
export const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#facc15' },
  { name: 'Green', value: '#4ade80' },
  { name: 'Blue', value: '#60a5fa' },
  { name: 'Pink', value: '#f472b6' },
] as const;
