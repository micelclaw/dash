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

// Shared formatting utilities for crypto dashboard cards

function number(value: number, locale: string | undefined, minimumFractionDigits: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat(locale ?? 'en-US', { minimumFractionDigits, maximumFractionDigits }).format(value);
}

export function formatBytes(bytes: number, locale?: string): string {
  if (bytes < 1024 ** 2) return `${number(bytes / 1024, locale, 0, 0)} KB`;
  if (bytes < 1024 ** 3) return `${number(bytes / (1024 ** 2), locale, 1, 1)} MB`;
  return `${number(bytes / (1024 ** 3), locale, 2, 2)} GB`;
}

export function formatHashRate(hps: number, locale?: string): string {
  if (hps >= 1e18) return `${number(hps / 1e18, locale, 1, 1)} EH/s`;
  if (hps >= 1e15) return `${number(hps / 1e15, locale, 1, 1)} PH/s`;
  if (hps >= 1e12) return `${number(hps / 1e12, locale, 1, 1)} TH/s`;
  if (hps >= 1e9) return `${number(hps / 1e9, locale, 1, 1)} GH/s`;
  if (hps >= 1e6) return `${number(hps / 1e6, locale, 1, 1)} MH/s`;
  return `${number(hps, locale, 0, 0)} H/s`;
}

export function formatDifficulty(d: number, locale?: string): string {
  if (d >= 1e12) return `${number(d / 1e12, locale, 2, 2)} T`;
  if (d >= 1e9) return `${number(d / 1e9, locale, 2, 2)} G`;
  if (d >= 1e6) return `${number(d / 1e6, locale, 2, 2)} M`;
  if (d >= 1e3) return `${number(d / 1e3, locale, 2, 2)} K`;
  return number(d, locale, 2, 2);
}

export function formatSatVB(fee: number | null, locale?: string): string {
  if (fee == null) return 'N/A';
  const decimalSeparator = new Intl.NumberFormat(locale ?? 'en-US').formatToParts(1.1).find(part => part.type === 'decimal')?.value ?? '.';
  return `~${String(fee).replace('.', decimalSeparator)} sat/vB`;
}

export function formatRelativeTime(unixTs: number, locale?: string): string {
  const diff = Math.floor(Date.now() / 1000) - unixTs;
  const relative = new Intl.RelativeTimeFormat(locale ?? 'en-US', { numeric: 'auto' });
  if (diff < 60) return relative.format(-diff, 'second');
  if (diff < 3600) return relative.format(-Math.floor(diff / 60), 'minute');
  if (diff < 86400) return relative.format(-Math.floor(diff / 3600), 'hour');
  return relative.format(-Math.floor(diff / 86400), 'day');
}

export function formatTraffic(bytes: number, locale?: string): string {
  if (bytes >= 1024 ** 3) return `${number(bytes / (1024 ** 3), locale, 2, 2)} GB`;
  if (bytes >= 1024 ** 2) return `${number(bytes / (1024 ** 2), locale, 1, 1)} MB`;
  return `${number(bytes / 1024, locale, 0, 0)} KB`;
}

export function formatUptime(s: number | null, locale?: string): string {
  if (!s) return '-';
  if (s < 3600) return `${number(Math.floor(s / 60), locale, 0, 0)}m`;
  const h = Math.floor(s / 3600);
  return `${number(h, locale, 0, 0)}h`;
}

export function formatEta(seconds: number | null, locale?: string): string {
  if (!seconds) return '';
  if (seconds < 60) return `${number(Math.round(seconds), locale, 0, 0)}s`;
  if (seconds < 3600) return `${number(Math.round(seconds / 60), locale, 0, 0)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${number(h, locale, 0, 0)}h ${number(m, locale, 0, 0)}m`;
}

export function truncateId(id: string, chars = 8): string {
  if (id.length <= chars * 2 + 3) return id;
  return `${id.slice(0, chars)}...${id.slice(-chars)}`;
}

export function formatMsat(msat: number, locale?: string): string {
  const sats = Math.round(msat / 1000);
  return `${number(sats, locale, 0, 0)} sat`;
}

export function formatXmr(piconero: number, locale?: string): string {
  const xmr = piconero / 1e12;
  if (xmr >= 1) return `${number(xmr, locale, 4, 4)} XMR`;
  if (xmr >= 0.001) return `${number(xmr, locale, 6, 6)} XMR`;
  return `${number(piconero, locale, 0, 0)} pico`;
}

export function formatMoneroVersion(v: string): string {
  return v || 'unknown';
}
