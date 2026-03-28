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
import { Users, User, X, RefreshCw } from 'lucide-react';
import { api } from '@/services/api';

interface PlatformContact {
  id: string;
  display_name: string;
  identifier?: string;
  last_message?: string;
}

interface PlatformGroup {
  id: string;
  name: string;
  members_count?: number;
  last_message?: string;
}

interface PlatformProfile {
  display_name?: string;
  identifier?: string;
  avatar?: string;
}

interface PlatformContactsPanelProps {
  platform: 'simplex-chat' | 'signal-cli';
  onClose: () => void;
}

export function PlatformContactsPanel({ platform, onClose }: PlatformContactsPanelProps) {
  const [tab, setTab] = useState<'contacts' | 'groups' | 'profile'>('contacts');
  const [contacts, setContacts] = useState<PlatformContact[]>([]);
  const [groups, setGroups] = useState<PlatformGroup[]>([]);
  const [profile, setProfile] = useState<PlatformProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'contacts') {
        const res = await api.get<{ data: PlatformContact[] }>(`/${platform}/contacts`);
        setContacts(res.data ?? []);
      } else if (tab === 'groups') {
        const res = await api.get<{ data: PlatformGroup[] }>(`/${platform}/groups`);
        setGroups(res.data ?? []);
      } else {
        const res = await api.get<{ data: PlatformProfile }>(`/${platform}/profile`);
        setProfile(res.data ?? null);
      }
    } catch {
      // endpoint may not be available
    }
    setLoading(false);
  }, [platform, tab]);

  useEffect(() => { load(); }, [load]);

  const label = platform === 'simplex-chat' ? 'SimpleX' : 'Signal';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface)', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', flex: 1 }}>
          {label}
        </span>
        <button onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
          <RefreshCw size={14} />
        </button>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
          <X size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {(['contacts', 'groups', 'profile'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '8px 0', background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid var(--amber)' : '2px solid transparent',
              color: tab === t ? 'var(--text)' : 'var(--text-muted)',
              fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
              fontFamily: 'var(--font-sans)', textTransform: 'capitalize',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {loading ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading...</div>
        ) : tab === 'contacts' ? (
          contacts.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              <User size={20} style={{ opacity: 0.4, margin: '0 auto 4px', display: 'block' }} />
              No contacts
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {contacts.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem' }}>
                  <User size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.display_name}
                    </div>
                    {c.identifier && <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{c.identifier}</div>}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : tab === 'groups' ? (
          groups.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              <Users size={20} style={{ opacity: 0.4, margin: '0 auto 4px', display: 'block' }} />
              No groups
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {groups.map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem' }}>
                  <Users size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.name}
                    </div>
                    {g.members_count != null && (
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{g.members_count} members</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : profile ? (
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              {profile.display_name ?? 'Unknown'}
            </div>
            {profile.identifier && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{profile.identifier}</div>
            )}
          </div>
        ) : (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            No profile data
          </div>
        )}
      </div>
    </div>
  );
}
