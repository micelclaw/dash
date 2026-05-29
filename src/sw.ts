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

// ─── Micelclaw Service Worker ────────────────────────────────────────
//
// Two responsibilities:
//   1. PWA precache (delegated to workbox via `precacheAndRoute`).
//   2. Web Push handlers: `push` (show notification) + `notificationclick`
//      (focus / open the dash).
//
// We `skipWaiting()` + `clients.claim()` so a new SW version (e.g. with
// updated push handlers) activates immediately without waiting for every
// tab of the dash to close — important because the upgrade window
// between deploys is the only chance to surface a critical push.

/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

// `self.__WB_MANIFEST` is injected at build time by vite-plugin-pwa
// (injectManifest mode). It lists every asset workbox should precache.
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ revision: string | null; url: string }>;
};

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Push handler ───────────────────────────────────────────────────
interface PushPayload {
  template?: string;
  title?: string;
  body?: string;
  severity?: 'info' | 'warn' | 'error' | 'critical';
  source_event_id?: string;
  action?: { label?: string; route?: string };
  ts?: string;
}

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload: PushPayload;
  try {
    payload = event.data.json() as PushPayload;
  } catch {
    // Not JSON — fall back to plain text.
    payload = { title: 'Micelclaw', body: event.data.text() };
  }

  event.waitUntil((async () => {
    // Anti-dup: if a Micelclaw tab is currently visible AND focused, the
    // in-app toast covers it — skip the OS-level notification. Using
    // `focused === true` rather than just `visibilityState === 'visible'`
    // because the OS only has ONE focused window/tab at a time, while
    // multiple tabs can be "visible" in the visibility-API sense.
    const wins = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: false,
    });
    const hasFocusedClient = wins.some(
      (w) => w.visibilityState === 'visible' && w.focused === true,
    );
    if (hasFocusedClient) return;

    const template = payload.template ?? 'system.notification';
    // Dedup tag: for critical errors we tag by `source_event_id` (each
    // incident is unique). For everything else we tag by template so
    // repeated rule fires collapse into a single notification.
    const tag = template === 'system.error.critical'
      ? `sec:${payload.source_event_id ?? Date.now()}`
      : template;

    // `renotify` triggers a re-alert when a notification with the same
    // tag arrives — used for severity:critical so consecutive identical
    // alerts don't go silent. The TS DOM lib doesn't yet list it but
    // every push-capable browser supports it (W3C Notifications API
    // §4.3.6). Cast to bypass the missing property in the type.
    const options = {
      body: (payload.body ?? '').slice(0, 200),
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag,
      renotify: payload.severity === 'critical',
      requireInteraction: payload.severity === 'critical',
      data: {
        route: payload.action?.route ?? '/',
        source_event_id: payload.source_event_id,
        template,
      },
    } as NotificationOptions;
    await self.registration.showNotification(
      (payload.title ?? 'Micelclaw').slice(0, 80),
      options,
    );
  })());
});

// ─── Notification click handler ─────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    const existing = wins.find((w) => w.url.startsWith(self.location.origin));
    if (existing) {
      // Focus the dash. URL routing from `event.notification.data.route`
      // is deferred (G5 plan D3=a). The route is preserved in data for a
      // future G6+ iteration that postMessages it to the focused client.
      await existing.focus();
    } else {
      await self.clients.openWindow('/');
    }
  })());
});
