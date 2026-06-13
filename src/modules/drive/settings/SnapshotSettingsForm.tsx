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

import { useState, useEffect } from 'react';
import { Database } from 'lucide-react';
import { toast } from 'sonner';
import { TagInput } from '@/components/shared/TagInput';
import { formatFileSize } from '@/lib/file-utils';
import { api } from '@/services/api';
import type { ApiResponse } from '@/types/api';

interface SnapshotSettings {
  enabled: boolean;
  max_versions_per_file: number;
  rotation_policy: 'smart' | 'simple';
  excluded_patterns: string[];
  excluded_folders: string[];
}

interface SettingsResponse {
  storage?: { snapshots?: Partial<SnapshotSettings> };
}

interface SnapshotStats {
  total_snapshots: number;
  total_files_with_snapshots: number;
  total_snapshot_size_bytes: number;
}

const DEFAULTS: SnapshotSettings = {
  enabled: false,
  max_versions_per_file: 32,
  rotation_policy: 'smart',
  excluded_patterns: [],
  excluded_folders: [],
};

interface SnapshotSettingsFormProps {
  /** Called after a successful save (lets the modal wrapper close itself). */
  onSaved?: () => void;
  /** Optional secondary action rendered to the left of Save (e.g. Cancel in the modal). */
  footerExtra?: React.ReactNode;
}

/**
 * Drive snapshot (Versioning) settings form — chrome-free.
 *
 * Reads `storage.snapshots` from GET /settings, shows global stats from
 * GET /files/snapshots/stats, saves via PATCH /settings (deep-merged
 * server-side). The logic was extracted from the old DriveSettingsModal so
 * both the modal (inspector → Versions gear) and the inline Drive Settings
 * → Versioning section render the exact same form with zero duplication.
 */
export function SnapshotSettingsForm({ onSaved, footerExtra }: SnapshotSettingsFormProps) {
  const [settings, setSettings] = useState<SnapshotSettings>(DEFAULTS);
  const [stats, setStats] = useState<SnapshotStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.allSettled([
      api.get<ApiResponse<SettingsResponse>>('/settings'),
      api.get<ApiResponse<SnapshotStats>>('/files/snapshots/stats'),
    ]).then(([settingsRes, statsRes]) => {
      if (cancelled) return;
      if (settingsRes.status === 'fulfilled') {
        const snaps = settingsRes.value.data.storage?.snapshots ?? {};
        setSettings({ ...DEFAULTS, ...snaps });
      }
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/settings', {
        storage: {
          snapshots: {
            enabled: settings.enabled,
            max_versions_per_file: settings.max_versions_per_file,
            rotation_policy: settings.rotation_policy,
            excluded_patterns: settings.excluded_patterns,
          },
        },
      });
      toast.success('Snapshot settings saved');
      onSaved?.();
    } catch {
      toast.error('Could not save settings');
    }
    setSaving(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Loading…</div>
        ) : (
          <>
            {/* Stats */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              background: 'var(--surface)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-dim)',
            }}>
              <Database size={14} style={{ color: 'var(--mod-drive)', flexShrink: 0 }} />
              {stats ? (
                <span>
                  <strong style={{ color: 'var(--text)' }}>{stats.total_snapshots}</strong> snapshot{stats.total_snapshots === 1 ? '' : 's'} across{' '}
                  <strong style={{ color: 'var(--text)' }}>{stats.total_files_with_snapshots}</strong> file{stats.total_files_with_snapshots === 1 ? '' : 's'} ·{' '}
                  <strong style={{ color: 'var(--text)' }}>{formatFileSize(stats.total_snapshot_size_bytes)}</strong> used
                </span>
              ) : (
                <span>Snapshot stats unavailable</span>
              )}
            </div>

            {/* Enabled toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={e => setSettings(s => ({ ...s, enabled: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: 'var(--mod-drive)', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text)', fontWeight: 500 }}>
                  Automatic snapshots
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  Keep a version every time a file changes
                </div>
              </div>
            </label>

            {/* Max versions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text)', fontWeight: 500 }}>
                  Max versions per file
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  Older snapshots are rotated out
                </div>
              </div>
              <input
                type="number"
                min={1}
                max={128}
                value={settings.max_versions_per_file}
                onChange={e => setSettings(s => ({
                  ...s,
                  max_versions_per_file: Math.max(1, Math.min(128, parseInt(e.target.value, 10) || 1)),
                }))}
                style={{
                  width: 72, background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: '5px 8px',
                  fontSize: '0.8125rem', color: 'var(--text)',
                  fontFamily: 'var(--font-sans)', outline: 'none',
                }}
              />
            </div>

            {/* Rotation policy */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text)', fontWeight: 500 }}>
                  Rotation policy
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  Smart keeps daily/weekly milestones; simple drops the oldest
                </div>
              </div>
              <select
                value={settings.rotation_policy}
                onChange={e => setSettings(s => ({ ...s, rotation_policy: e.target.value as 'smart' | 'simple' }))}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: '5px 8px',
                  fontSize: '0.8125rem', color: 'var(--text)',
                  fontFamily: 'var(--font-sans)', cursor: 'pointer',
                }}
              >
                <option value="smart">Smart</option>
                <option value="simple">Simple</option>
              </select>
            </div>

            {/* Excluded patterns */}
            <div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text)', fontWeight: 500, marginBottom: 2 }}>
                Excluded patterns
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                Files matching these globs are never snapshotted
              </div>
              <TagInput
                tags={settings.excluded_patterns}
                onChange={next => setSettings(s => ({ ...s, excluded_patterns: next }))}
                placeholder="*.tmp"
                addLabel="pattern"
                size="xs"
              />
            </div>
          </>
        )}
      </div>

      {/* Save row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end',
        marginTop: 20,
      }}>
        {footerExtra}
        <button
          onClick={() => { void handleSave(); }}
          disabled={loading || saving}
          style={{
            padding: '6px 14px',
            background: (loading || saving) ? 'var(--surface)' : 'var(--amber)',
            border: 'none', borderRadius: 'var(--radius-sm)',
            color: (loading || saving) ? 'var(--text-muted)' : '#000',
            fontSize: '0.8125rem', fontWeight: 600,
            cursor: (loading || saving) ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
