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

import { useState, useEffect, useCallback, useRef } from 'react';
import { listMessages, type Message } from '@/services/messages.service';

const PAGE_SIZE = 50;

/**
 * Merge two message lists (kept newest-last for rendering) deduping by id,
 * so an optimistic send, a poll refetch and a "load older" page that overlaps
 * on a boundary timestamp never produce duplicates or gaps.
 */
function mergeById(a: Message[], b: Message[]): Message[] {
  const map = new Map<string, Message>();
  for (const m of a) map.set(m.id, m);
  for (const m of b) map.set(m.id, m);
  return Array.from(map.values()).sort(
    (x, y) => new Date(x.sent_at).getTime() - new Date(y.sent_at).getTime(),
  );
}

const isOptimistic = (m: Message): boolean => m.pending === true || m.id.startsWith('optimistic-');

/**
 * Reconcilia las burbujas optimistas ("sending…") con su fila CONFIRMADA cuando
 * el poll la trae: la optimista lleva `id='optimistic-<ts>'` y la confirmada un
 * UUID real → `mergeById` (que deduplica por id) NO las une y quedaría el mensaje
 * DUPLICADO ("sending…" + confirmado). Empareja cada burbuja optimista `sent` con
 * la PRIMERA confirmada `sent` del mismo contenido cuya marca de tiempo sea
 * ~concurrente-o-posterior (ventana de 60s para el desfase de reloj dash↔servidor)
 * y aún no usada, y descarta la optimista. Si no hay confirmada todavía, la deja
 * (sigue "sending…"). El emparejado `used` evita colapsar dos envíos iguales.
 */
function reconcileOptimistic(list: Message[]): Message[] {
  const confirmedSent = list.filter((m) => !isOptimistic(m) && m.direction === 'sent');
  if (!confirmedSent.length) return list;
  const used = new Set<Message>();
  return list.filter((m) => {
    if (!isOptimistic(m)) return true;
    const optTs = new Date(m.sent_at).getTime();
    const match = confirmedSent.find(
      (c) => !used.has(c) && c.content === m.content && new Date(c.sent_at).getTime() >= optTs - 60_000,
    );
    if (match) { used.add(match); return false; } // la confirmada la reemplaza → tira la optimista
    return true; // aún sin confirmar → sigue "sending…"
  });
}

/**
 * Un chat se identifica por (platform, platform_channel_id) — el mismo id puede
 * existir en dos plataformas (p.ej. el Session ID de un contacto aparece en
 * «Session · identidad propia» y en «Session · tu móvil»). Sin `platform` los
 * dos hilos se mezclan en la misma vista.
 */
export function useChannelMessages(channelId: string | null, platform?: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const initialLoadDone = useRef(false);

  const fetchLatest = useCallback(
    async (isPolling = false) => {
      if (!channelId) {
        setMessages([]);
        setHasMore(false);
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (!isPolling && !initialLoadDone.current) setLoading(true);

      try {
        const { messages: page, total } = await listMessages({ channel_id: channelId, platform: platform ?? undefined, limit: PAGE_SIZE });
        if (controller.signal.aborted) return;
        // API returns newest-first; render oldest-first. Merge (not replace) so a
        // poll doesn't drop an in-flight optimistic message; reconcile drops the
        // "sending…" bubble once its confirmed row lands (evita el duplicado).
        setMessages((prev) => (isPolling ? reconcileOptimistic(mergeById(prev, page)) : page.slice().reverse()));
        setHasMore(total > page.length);
        setError(null);
        initialLoadDone.current = true;
      } catch (err) {
        if (controller.signal.aborted) return;
        setError((err as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [channelId, platform],
  );

  useEffect(() => {
    initialLoadDone.current = false;
    setMessages([]);
    fetchLatest();
    return () => abortRef.current?.abort();
  }, [fetchLatest]);

  /** Cursor pagination: fetch the page BEFORE the oldest message we hold. */
  const loadOlder = useCallback(async () => {
    if (!channelId || !hasMore || loadingOlder) return;
    const oldest = messages[0];
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const { messages: page } = await listMessages({
        channel_id: channelId,
        platform: platform ?? undefined,
        limit: PAGE_SIZE,
        before: oldest.sent_at,
      });
      // `before` is inclusive → the boundary row repeats; mergeById drops it.
      setMessages((prev) => mergeById(page.slice().reverse(), prev));
      // If the page only contained the boundary row(s) we already had, we're done.
      const fresh = page.filter((m) => m.id !== oldest.id);
      setHasMore(fresh.length > 0 && page.length >= PAGE_SIZE);
    } catch {
      // transient — keep what we have; the button stays available to retry
    } finally {
      setLoadingOlder(false);
    }
  }, [channelId, platform, hasMore, loadingOlder, messages]);

  const appendOptimistic = useCallback((msg: Message) => {
    setMessages((prev) => mergeById(prev, [msg]));
  }, []);

  const refetch = useCallback(() => fetchLatest(true), [fetchLatest]);

  return { messages, loading, loadingOlder, hasMore, loadOlder, refetch, appendOptimistic, error };
}
