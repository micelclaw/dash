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

import { useState, useEffect, useCallback } from 'react';
import { Copy, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { SettingSection } from '../SettingSection';

interface DuplicatePair {
  recordA: { id: string; domain: string; title: string; subtitle?: string };
  recordB: { id: string; domain: string; title: string; subtitle?: string };
  similarity: number;
  domain: string;
}

export function DuplicatesSection() {
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const loadDuplicates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: DuplicatePair[] }>('/sync/duplicates');
      setPairs(res.data ?? []);
    } catch {
      // endpoint may not return data yet
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadDuplicates(); }, [loadDuplicates]);

  const handleDismiss = async (pair: DuplicatePair) => {
    const key = `${pair.recordA.id}-${pair.recordB.id}`;
    setDismissing(key);
    try {
      await api.post('/sync/duplicates/dismiss', {
        record_a_id: pair.recordA.id,
        record_b_id: pair.recordB.id,
        domain: pair.domain,
      });
      setPairs(prev => prev.filter(p => !(p.recordA.id === pair.recordA.id && p.recordB.id === pair.recordB.id)));
      toast.success('Duplicate dismissed');
    } catch {
      toast.error('Failed to dismiss duplicate');
    }
    setDismissing(null);
  };

  return (
    <SettingSection
      title="Duplicates"
      description="Fuzzy duplicate records detected during sync."
      action={
        <button onClick={loadDuplicates} className="p-1.5 rounded hover:bg-[var(--surface-hover)]" title="Refresh">
          <RefreshCw size={14} className={`text-[var(--text-muted)] ${loading ? 'animate-spin' : ''}`} />
        </button>
      }
    >
      {loading ? null : pairs.length === 0 ? (
        <div className="text-center py-8 text-sm text-[var(--text-muted)]">
          <Copy size={24} className="mx-auto mb-2 opacity-40" />
          No duplicates detected
        </div>
      ) : (
        <div className="space-y-2">
          {pairs.map((pair) => {
            const key = `${pair.recordA.id}-${pair.recordB.id}`;
            return (
              <div key={key} className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                <div className="flex items-start justify-between mb-2">
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-500/10 text-amber-400 font-medium">
                    {Math.round(pair.similarity * 100)}% match · {pair.domain}
                  </span>
                  <button
                    onClick={() => handleDismiss(pair)}
                    disabled={dismissing === key}
                    className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text)]"
                    title="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-xs">
                    <div className="font-medium text-[var(--text)] truncate">{pair.recordA.title}</div>
                    {pair.recordA.subtitle && <div className="text-[var(--text-muted)] truncate">{pair.recordA.subtitle}</div>}
                  </div>
                  <div className="text-xs">
                    <div className="font-medium text-[var(--text)] truncate">{pair.recordB.title}</div>
                    {pair.recordB.subtitle && <div className="text-[var(--text-muted)] truncate">{pair.recordB.subtitle}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SettingSection>
  );
}
