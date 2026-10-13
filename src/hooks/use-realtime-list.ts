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

import { originIdentityChanged, mergeOriginUpdate } from '@/lib/origin-state';
import { notifyOriginsChanged } from '@/lib/origin-refresh';
import { useOriginRefresh } from './use-origin-refresh';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useWebSocket } from './use-websocket';

/**
 * Subscribes to WS events for a domain and keeps a list state in sync.
 * Handles created, updated, deleted, and restored events.
 */
export function useRealtimeList<T extends { id: string }>(
  domain: string,
  items: T[],
  setItems: React.Dispatch<React.SetStateAction<T[]>>,
  refresh?: () => unknown,
) {
  const originDomain = ({ note: 'notes', contact: 'contacts', event: 'events', email: 'emails' } as Record<string, string>)[domain] ?? domain;
  useOriginRefresh(originDomain, refresh ?? (() => {}));
  const current = useRef({ items, refresh });
  useLayoutEffect(() => { current.current = { items, refresh }; }, [items, refresh]);
  const wsCreated = useWebSocket(`${domain}.created`);
  const wsUpdated = useWebSocket(`${domain}.updated`);
  const wsDeleted = useWebSocket(`${domain}.deleted`);
  const wsRestored = useWebSocket(`${domain}.restored`);

  useEffect(() => {
    if (!wsCreated) return;
    if (current.current.refresh && !wsCreated.data.origins) { notifyOriginsChanged({ domains: [originDomain] }); return; }
    setItems(prev => {
      if (prev.some(item => item.id === wsCreated.data.id)) return prev;
      return [wsCreated.data as T, ...prev];
    });
  }, [wsCreated, setItems, originDomain]);

  useEffect(() => {
    if (!wsUpdated) return;
    if (current.current.refresh && !wsUpdated.data.origins && current.current.items.some(item => item.id === wsUpdated.data.id && originIdentityChanged(item, wsUpdated.data))) {
      notifyOriginsChanged({ domains: [originDomain] });
    }
    setItems(prev =>
      prev.map(item =>
        item.id === wsUpdated.data.id ? mergeOriginUpdate(item, wsUpdated.data) : item,
      ),
    );
  }, [wsUpdated, setItems, originDomain]);

  useEffect(() => {
    if (!wsDeleted) return;
    setItems(prev => prev.filter(item => item.id !== wsDeleted.data.id));
  }, [wsDeleted, setItems]);

  useEffect(() => {
    if (!wsRestored) return;
    if (current.current.refresh && !wsRestored.data.origins) { notifyOriginsChanged({ domains: [originDomain] }); return; }
    setItems(prev => {
      if (prev.some(item => item.id === wsRestored.data.id)) return prev;
      return [wsRestored.data as T, ...prev];
    });
  }, [wsRestored, setItems, originDomain]);

  // Return the items array for chaining (identity — no transform)
  return items;
}
