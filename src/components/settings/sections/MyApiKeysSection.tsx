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
import { KeyRound, RefreshCw } from 'lucide-react';
import { api } from '@/services/api';
import { SettingSection } from '../SettingSection';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
}

export function MyApiKeysSection() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: ApiKey[] }>('/api-keys/mine');
      setKeys(res.data ?? []);
    } catch {
      // endpoint may not be available
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SettingSection
      title="My API Keys"
      description="API keys assigned to your account (read-only)."
      action={
        <button onClick={load} className="p-1.5 rounded hover:bg-[var(--surface-hover)]" title="Refresh">
          <RefreshCw size={14} className={`text-[var(--text-muted)] ${loading ? 'animate-spin' : ''}`} />
        </button>
      }
    >
      {loading ? null : keys.length === 0 ? (
        <div className="text-center py-8 text-sm text-[var(--text-muted)]">
          <KeyRound size={24} className="mx-auto mb-2 opacity-40" />
          No API keys assigned to your account
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map(key => (
            <div key={key.id} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <KeyRound size={14} className="text-[var(--text-muted)] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-[var(--text)]">{key.name}</div>
                <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                  <span className="font-mono">{key.prefix}...</span>
                  {key.scopes.length > 0 && (
                    <span className="flex gap-1">
                      {key.scopes.slice(0, 3).map(s => (
                        <span key={s} className="px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)]">{s}</span>
                      ))}
                      {key.scopes.length > 3 && <span>+{key.scopes.length - 3}</span>}
                    </span>
                  )}
                  {key.last_used_at && <span>Last used: {new Date(key.last_used_at).toLocaleDateString()}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SettingSection>
  );
}
