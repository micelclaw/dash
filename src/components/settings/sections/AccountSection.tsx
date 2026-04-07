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
import { User, Unlink, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { SettingSection } from '../SettingSection';

interface Binding {
  id: string;
  platform: string;
  platform_user_id: string;
  display_name: string | null;
  created_at: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  signal: 'Signal',
  telegram: 'Telegram',
  discord: 'Discord',
  simplex: 'SimpleX',
  session: 'Session',
  slack: 'Slack',
  whatsapp: 'WhatsApp',
};

export function AccountSection() {
  const user = useAuthStore(s => s.user);
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [loadingBindings, setLoadingBindings] = useState(true);

  const loadBindings = useCallback(async () => {
    try {
      const res = await api.get<{ data: Binding[] }>('/auth/bindings');
      setBindings(res.data ?? []);
    } catch {
      // Silently ignore if endpoint not available
    }
    setLoadingBindings(false);
  }, []);

  useEffect(() => { loadBindings(); }, [loadBindings]);
  useEffect(() => { setDisplayName(user?.display_name ?? ''); }, [user?.display_name]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.patch('/auth/me', { display_name: displayName.trim() || undefined });
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    }
    setSaving(false);
  };

  const handleUnbind = async (id: string) => {
    try {
      await api.delete(`/auth/bindings/${id}`);
      setBindings(prev => prev.filter(b => b.id !== id));
      toast.success('Channel unlinked');
    } catch {
      toast.error('Failed to unlink channel');
    }
  };

  return (
    <>
      <SettingSection title="Profile" description="Your display name and account details.">
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Display Name</label>
            <div className="flex gap-2">
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your display name"
                className="flex-1 px-3 py-1.5 text-sm rounded-md bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={handleSaveProfile}
                disabled={saving || displayName === (user?.display_name ?? '')}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
          {user?.email && (
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Email</label>
              <p className="text-sm text-[var(--text)]">{user.email}</p>
            </div>
          )}
        </div>
      </SettingSection>

      <SettingSection
        title="Channel Bindings"
        description="Messaging platforms linked to your account. Link new channels by chatting with the assistant."
      >
        {loadingBindings ? null : bindings.length === 0 ? (
          <div className="text-center py-8 text-sm text-[var(--text-muted)]">
            <MessageSquare size={24} className="mx-auto mb-2 opacity-40" />
            No channels linked yet. Ask the assistant to bind a Signal, Telegram, or Discord account.
          </div>
        ) : (
          <div className="space-y-2">
            {bindings.map(binding => (
              <div
                key={binding.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
              >
                <User size={14} className="text-[var(--text-muted)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--text)]">
                    {PLATFORM_LABELS[binding.platform] ?? binding.platform}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    {binding.display_name ?? binding.platform_user_id}
                    {' · '}Linked {new Date(binding.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => handleUnbind(binding.id)}
                  className="p-1.5 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 shrink-0"
                  title="Unlink"
                >
                  <Unlink size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </SettingSection>
    </>
  );
}
