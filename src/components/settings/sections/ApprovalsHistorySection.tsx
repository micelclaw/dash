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
import { History, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/services/api';
import { SettingSection } from '../SettingSection';

interface ApprovalHistoryEntry {
  id: string;
  operation: string;
  requested_by: string;
  decision: 'approved' | 'rejected' | 'expired';
  resolved_by?: string;
  created_at: string;
  resolved_at?: string;
}

export function ApprovalsHistorySection() {
  const [entries, setEntries] = useState<ApprovalHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: ApprovalHistoryEntry[] }>('/approvals/history');
      setEntries(res.data ?? []);
    } catch {
      // optional
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SettingSection
      title="Approval History"
      description="Past approval decisions."
      action={
        <button onClick={load} className="p-1.5 rounded hover:bg-[var(--surface-hover)]" title="Refresh">
          <RefreshCw size={14} className={`text-[var(--text-muted)] ${loading ? 'animate-spin' : ''}`} />
        </button>
      }
    >
      {loading ? null : entries.length === 0 ? (
        <div className="text-center py-8 text-sm text-[var(--text-muted)]">
          <History size={24} className="mx-auto mb-2 opacity-40" />
          No approval history
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map(entry => (
            <div key={entry.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--surface)] text-xs">
              {entry.decision === 'approved' ? (
                <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
              ) : (
                <XCircle size={14} className="text-red-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="font-medium text-[var(--text)]">{entry.operation}</span>
                <span className="text-[var(--text-muted)] ml-2">by {entry.requested_by}</span>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                entry.decision === 'approved' ? 'bg-green-500/10 text-green-400' :
                entry.decision === 'rejected' ? 'bg-red-500/10 text-red-400' :
                'bg-[var(--surface-hover)] text-[var(--text-muted)]'
              }`}>
                {entry.decision}
              </span>
              <span className="text-[var(--text-muted)] text-[10px]">
                {new Date(entry.resolved_at ?? entry.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </SettingSection>
  );
}
