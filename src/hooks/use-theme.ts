import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settings.store';

const LIGHT_THEME = {
  '--bg': '#f5f5f7',
  '--surface': '#ebebef',
  '--card': '#ffffff',
  '--surface-hover': '#e0e0e5',
  '--border': '#d1d1d6',
  '--border-hover': '#b8b8c0',
  '--text': '#1a1a1e',
  '--text-dim': '#5a5a6a',
  '--text-muted': '#8a8a9a',
};

const DARK_THEME = {
  '--bg': '#06060a',
  '--surface': '#0c0c12',
  '--card': '#111118',
  '--surface-hover': '#16161f',
  '--border': '#1e1e2a',
  '--border-hover': '#2a2a3a',
  '--text': '#e0e0e8',
  '--text-dim': '#7a7a8a',
  '--text-muted': '#4a4a5a',
};

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
  const resolved = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  const vars = resolved === 'light' ? LIGHT_THEME : DARK_THEME;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  root.setAttribute('data-theme', resolved);
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
