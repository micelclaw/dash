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

// ─── Client platform detection ───────────────────────────────────────
// Helper central (antes era navigator.userAgent inline disperso por módulos).

export type ClientOS = 'windows' | 'mac' | 'linux' | 'ios' | 'android' | 'unknown';

export function getClientOS(): ClientOS {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/windows/.test(ua)) return 'windows';
  if (/macintosh|mac os x/.test(ua)) return 'mac';
  if (/linux/.test(ua)) return 'linux';
  return 'unknown';
}

export function osLabel(os: ClientOS): string {
  return { windows: 'Windows', mac: 'macOS', linux: 'Linux', ios: 'iOS', android: 'Android', unknown: 'tu sistema' }[os];
}
