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
import { Brain, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { SettingSection } from '../SettingSection';

interface LearnedPreference {
  id: string;
  description: string;
  confidence: number;
  source?: string;
  created_at: string;
}

export function PreferencesSection() {
  const [preferences, setPreferences] = useState<LearnedPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: LearnedPreference[] }>('/preferences');
      setPreferences(res.data ?? []);
    } catch {
      // pro tier — may not be available
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleForget = async (id: string) => {
    setDeleting(id);
    try {
      await api.delete(`/preferences/${id}`);
      setPreferences(prev => prev.filter(p => p.id !== id));
      toast.success('Preference forgotten');
    } catch {
      toast.error('Failed to forget preference');
    }
    setDeleting(null);
  };

  return (
    <SettingSection
      title="Learned Preferences"
      description="Preferences the system has learned from your behavior. You can forget any of them."
      action={
        <button onClick={load} className="p-1.5 rounded hover:bg-[var(--surface-hover)]" title="Refresh">
          <RefreshCw size={14} className={`text-[var(--text-muted)] ${loading ? 'animate-spin' : ''}`} />
        </button>
      }
    >
      {loading ? null : preferences.length === 0 ? (
        <div className="text-center py-8 text-sm text-[var(--text-muted)]">
          <Brain size={24} className="mx-auto mb-2 opacity-40" />
          No learned preferences yet
        </div>
      ) : (
        <div className="space-y-2">
          {preferences.map(pref => (
            <div key={pref.id} className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-[var(--text)] mb-1">{pref.description}</div>
                <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
                  <span>Confidence: {Math.round(pref.confidence * 100)}%</span>
                  <div className="w-16 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--amber)]"
                      style={{ width: `${pref.confidence * 100}%` }}
                    />
                  </div>
                  {pref.source && <span>from {pref.source}</span>}
                  <span>{new Date(pref.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => handleForget(pref.id)}
                disabled={deleting === pref.id}
                className="p-1.5 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 flex-shrink-0"
                title="Forget"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </SettingSection>
  );
}
