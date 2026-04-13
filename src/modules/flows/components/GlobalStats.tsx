/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from '@/services/api';

interface GlobalFlowStats {
  total_runs: number;
  successful_runs: number;
  items_processed: Record<string, number>;
  tokens_used: number;
  cost_usd_estimate: number;
  estimated_hours_saved: number;
}

export function GlobalStats() {
  const [stats, setStats] = useState<GlobalFlowStats | null>(null);

  useEffect(() => {
    api.get<{ data: GlobalFlowStats }>('/flows/stats/global')
      .then((res) => setStats(res.data))
      .catch(() => {}); // Silent fail — stats are optional
  }, []);

  if (!stats || stats.total_runs === 0) return null;

  const highlights: string[] = [];
  for (const [domain, count] of Object.entries(stats.items_processed ?? {})) {
    if (count > 0) {
      const label = domain === 'emails' ? 'emails classified' : domain === 'notes' ? 'notes created' : domain === 'photos' ? 'photos processed' : domain === 'diary' ? 'diary entries' : `${domain} items`;
      highlights.push(`${count.toLocaleString()} ${label}`);
    }
  }

  if (highlights.length === 0 && (stats.estimated_hours_saved ?? 0) <= 0) return null;

  return (
    <div style={{
      background: 'var(--mod-flows-dim)', border: '1px solid rgba(244,63,94,0.2)',
      borderRadius: 8, padding: '10px 14px', marginBottom: 16,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <Sparkles size={16} style={{ color: 'var(--mod-flows)', flexShrink: 0 }} />
      <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
        <span style={{ color: 'var(--text)', fontWeight: 500 }}>This month your flows have: </span>
        {highlights.join(', ')}
        {(stats.estimated_hours_saved ?? 0) > 0 && (
          <span> · Estimated time saved: <strong style={{ color: 'var(--mod-flows)' }}>~{stats.estimated_hours_saved.toFixed(1)}h</strong></span>
        )}
      </div>
    </div>
  );
}
