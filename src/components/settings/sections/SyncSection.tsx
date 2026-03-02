import { useState, useEffect } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings.store';
import { api } from '@/services/api';
import { SettingSection } from '../SettingSection';
import { SettingSelect } from '../SettingSelect';
import { SaveBar } from '../SaveBar';
import type { SyncConnector } from '@/types/settings';

const INTERVAL_OPTIONS = [
  { value: '5', label: '5 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '60 minutes' },
  { value: '120', label: '120 minutes' },
];

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { active: '#22c55e', error: '#f59e0b', disabled: '#6b7280' };
  const color = colors[status] || '#6b7280';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function SyncSection() {
  const settings = useSettingsStore((s) => s.settings);
  const dirty = useSettingsStore((s) => s.dirty);
  const setLocalValue = useSettingsStore((s) => s.setLocalValue);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const resetSection = useSettingsStore((s) => s.resetSection);
  const [saving, setSaving] = useState(false);
  const [connectors, setConnectors] = useState<SyncConnector[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const useMock = import.meta.env.VITE_MOCK_API === 'true';
      if (useMock) {
        setConnectors([
          { id: '1', provider: 'Google Calendar', account_name: 'user@gmail.com', status: 'active', last_sync_at: new Date(Date.now() - 300000).toISOString(), error_message: null },
          { id: '2', provider: 'Gmail', account_name: 'user@gmail.com', status: 'active', last_sync_at: new Date(Date.now() - 120000).toISOString(), error_message: null },
        ]);
        return;
      }
      try {
        const res = await api.get<{ data: SyncConnector[] }>('/sync/connectors');
        setConnectors(res.data);
      } catch {
        setConnectors([]);
      }
    }
    load();
  }, []);

  if (!settings) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSection('sync', settings.sync as unknown as Record<string, unknown>);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  const handleSyncNow = async (id: string) => {
    setSyncing(id);
    try {
      const useMock = import.meta.env.VITE_MOCK_API === 'true';
      if (!useMock) {
        await api.post(`/sync/connectors/${id}/run`);
      }
      toast.success('Sync triggered');
    } catch {
      toast.error('Sync failed');
    }
    setSyncing(null);
  };

  return (
    <>
      <SettingSection title="Sync Connectors" description="Connected services and their sync status.">
        {connectors.length === 0 ? (
          <div style={{ padding: '16px 0', fontSize: '0.8125rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
            No sync connectors configured.
          </div>
        ) : (
          connectors.map((c) => (
            <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                    {c.provider}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.account_name}</div>
                </div>
                <StatusBadge status={c.status} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  Last: {timeAgo(c.last_sync_at)}
                </span>
                <button
                  onClick={() => handleSyncNow(c.id)}
                  disabled={syncing === c.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    height: 26, padding: '0 8px',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
                    fontSize: '0.75rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
                  }}
                >
                  {syncing === c.id ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
                  Sync
                </button>
              </div>
              {c.status === 'error' && c.error_message && (
                <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: 4, paddingLeft: 4 }}>
                  {c.error_message} — <button style={{ background: 'none', border: 'none', color: 'var(--amber)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', padding: 0, textDecoration: 'underline' }}>Reconnect</button>
                </div>
              )}
            </div>
          ))
        )}
      </SettingSection>

      <SettingSection title="Sync Interval">
        <SettingSelect
          label="Default Sync Interval"
          description="Each connector can override this in its own settings."
          value={String(settings.sync.default_interval_minutes)}
          options={INTERVAL_OPTIONS}
          onChange={(v) => setLocalValue('sync.default_interval_minutes', parseInt(v))}
        />
      </SettingSection>

      <SaveBar visible={!!dirty.sync} saving={saving} onSave={handleSave} onDiscard={() => resetSection('sync')} />
    </>
  );
}
