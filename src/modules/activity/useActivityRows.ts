/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Shared hook used by every Activity Center tab.
 *
 *  - Calls `adapter.fetchSnapshot()` whenever filters / search change.
 *  - Subscribes to a WS pattern (when provided by the tab) and prepends
 *    new rows on top of the snapshot.
 *  - Honours a `paused` flag so the user can freeze the live feed.
 *  - Applies a client-side search filter (substring on JSON-stringified
 *    row) on top of the adapter's own filters.
 */

import { useEffect, useMemo, useState } from 'react';
import { useWebSocketStore } from '@/stores/websocket.store';
import type { WsEvent } from '@/types/websocket';
import type { Adapter, AdapterFetchParams } from './adapters/types';

const DEFAULT_LIMIT = 200;
const MAX_BUFFER = 1000;

interface Options<Row> {
  adapter: Adapter<Row>;
  filters: Record<string, string>;
  search: string;
  paused: boolean;
  /**
   * Optional WS configuration. When set, the hook listens to the
   * pattern and feeds matching events through `transform` (which may
   * filter via returning null).
   */
  ws?: {
    pattern: string;
    transform: (event: WsEvent) => Row | null;
  };
}

interface State<Row> {
  rows: Row[];
  filteredRows: Row[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function dedupeByKey<Row>(rows: Row[], getKey: (row: Row) => string): Row[] {
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const row of rows) {
    const k = getKey(row);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return out;
}

export function useActivityRows<Row>({ adapter, filters, search, paused, ws }: Options<Row>): State<Row> {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const client = useWebSocketStore((s) => s.client);

  const params: AdapterFetchParams = useMemo(
    () => ({ filters, search, limit: DEFAULT_LIMIT }),
    [filters, search],
  );

  // Snapshot fetch on every filter change + manual refresh
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adapter
      .fetchSnapshot(params)
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError((err as Error).message || 'Snapshot failed');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [adapter, params, refreshTick]);

  // Live WS subscription (when the tab declares one)
  useEffect(() => {
    if (!ws || !client) return;
    if (paused) return;
    const unsubscribe = client.on(ws.pattern, (event) => {
      const row = ws.transform(event);
      if (!row) return;
      setRows((prev) => {
        const getKey = adapter.getRowKey ?? ((r: Row) => JSON.stringify(r));
        const next = dedupeByKey([row, ...prev], getKey).slice(0, MAX_BUFFER);
        return next;
      });
    });
    return unsubscribe;
  }, [adapter, client, paused, ws]);

  // Client-side overlay: adapter filters + free-text search. Applied
  // here (not in the adapter's snapshot) so live WS rows respect the
  // current filter state even though the WS itself fans out unfiltered.
  const filteredRows = useMemo(() => {
    let out = rows;
    if (adapter.matchesFilters) {
      out = out.filter((row) => adapter.matchesFilters!(row, filters));
    }
    if (!search.trim()) return out;
    const needle = search.toLowerCase();
    return out.filter((row) => {
      try {
        return JSON.stringify(row).toLowerCase().includes(needle);
      } catch {
        return false;
      }
    });
  }, [rows, search, filters, adapter]);

  return {
    rows,
    filteredRows,
    loading,
    error,
    refresh: () => setRefreshTick((t) => t + 1),
  };
}
