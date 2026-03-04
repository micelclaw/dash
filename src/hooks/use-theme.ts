import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settings.store';

const THEMES: Record<string, Record<string, string>> = {
  dark: {
    '--bg': '#06060a',
    '--surface': '#0c0c12',
    '--card': '#111118',
    '--surface-hover': '#16161f',
    '--border': '#1e1e2a',
    '--border-hover': '#2a2a3a',
    '--text': '#e0e0e8',
    '--text-dim': '#7a7a8a',
    '--text-muted': '#4a4a5a',
  },
  light: {
    '--bg': '#eae8e4',
    '--surface': '#e0ded8',
    '--card': '#f0eee9',
    '--surface-hover': '#d6d4ce',
    '--border': '#c8c5be',
    '--border-hover': '#b0ada5',
    '--text': '#1c1b18',
    '--text-dim': '#5c5a52',
    '--text-muted': '#8a877e',
  },
  // Deep blue-grey, subtle ocean feel
  midnight: {
    '--bg': '#0a0e1a',
    '--surface': '#101828',
    '--card': '#162032',
    '--surface-hover': '#1c2840',
    '--border': '#243350',
    '--border-hover': '#2e4060',
    '--text': '#d8dce8',
    '--text-dim': '#7888a0',
    '--text-muted': '#4a5870',
  },
  // Warm charcoal with earthy undertones
  ember: {
    '--bg': '#100c0a',
    '--surface': '#1a1410',
    '--card': '#201a14',
    '--surface-hover': '#2a2218',
    '--border': '#3a2e22',
    '--border-hover': '#4a3c2e',
    '--text': '#e8e0d8',
    '--text-dim': '#9a8a78',
    '--text-muted': '#6a5a48',
  },
  // Muted green-grey, forest canopy
  moss: {
    '--bg': '#080c0a',
    '--surface': '#0e1410',
    '--card': '#141c16',
    '--surface-hover': '#1a241e',
    '--border': '#22302a',
    '--border-hover': '#2e4038',
    '--text': '#d8e8e0',
    '--text-dim': '#78a088',
    '--text-muted': '#486858',
  },
  // Cool slate with lavender hints
  lucid: {
    '--bg': '#0c0a10',
    '--surface': '#12101a',
    '--card': '#181620',
    '--surface-hover': '#1e1c2a',
    '--border': '#282638',
    '--border-hover': '#363448',
    '--text': '#e0dee8',
    '--text-dim': '#8a88a0',
    '--text-muted': '#5a586a',
  },
};

// Light-type themes use 'light' data-theme, rest use 'dark'
const LIGHT_THEMES = new Set(['light']);

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

/**
 * Hook that applies theme + accent from settings store on load,
 * and re-applies whenever settings change.
 */
export function useTheme() {
  const settings = useSettingsStore((s) => s.settings);

  useEffect(() => {
    if (!settings?.dash) return;
    applyTheme(settings.dash.theme);
  }, [settings?.dash?.theme]);

  useEffect(() => {
    if (!settings?.dash?.accent_color) return;
    applyAccentColor(settings.dash.accent_color);
  }, [settings?.dash?.accent_color]);
}
