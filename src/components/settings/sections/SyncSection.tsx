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
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings.store';
import { api } from '@/services/api';
import { SettingSection } from '../SettingSection';
import { SettingSelect } from '../SettingSelect';
import { SaveBar } from '../SaveBar';
import { ConnectorCard } from '../ConnectorCard';
import { AddIntegrationModal } from '../AddIntegrationModal';
import { EditConnectorModal } from '../EditConnectorModal';

const INTERVAL_OPTIONS = [
  { value: '5', label: '5 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '60 minutes' },
  { value: '120', label: '120 minutes' },
];

interface ConnectorInfo {
  id: string;
  connector_type: string;
  name: string;
  display_name: string | null;
  domains: string[];
  status: string;
  last_sync_at: string | null;
  errors_count: number;
}

export function SyncSection() {
  const settings = useSettingsStore((s) => s.settings);
  const dirty = useSettingsStore((s) => s.dirty);
  const setLocalValue = useSettingsStore((s) => s.setLocalValue);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const resetSection = useSettingsStore((s) => s.resetSection);
  const [saving, setSaving] = useState(false);
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadConnectors = useCallback(async () => {
    const useMock = import.meta.env.VITE_MOCK_API === 'true';
    if (useMock) {
      setConnectors([
        { id: '1', connector_type: 'google-calendar', name: 'google — google-calendar', display_name: 'Google Calendar', domains: ['events'], status: 'connected', last_sync_at: new Date(Date.now() - 300000).toISOString(), errors_count: 0 },
        { id: '2', connector_type: 'gmail', name: 'google — gmail', display_name: 'Gmail', domains: ['emails'], status: 'connected', last_sync_at: new Date(Date.now() - 120000).toISOString(), errors_count: 0 },
      ]);
      return;
    }
    try {
      const res = await api.get<{ data: ConnectorInfo[] }>('/sync/connectors');
      setConnectors(res.data);
    } catch {
      setConnectors([]);
    }
  }, []);

  useEffect(() => { loadConnectors(); }, [loadConnectors]);

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

  return (
    <>
      <SettingSection
        title="Integrations"
        description="Connected services and data sources."
        action={
          <button
            onClick={() => setModalOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              height: 28, padding: '0 10px',
              background: 'none',
              border: '1px solid var(--amber)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--amber)',
              fontSize: '0.75rem', fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(212, 160, 23, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            <Plus size={14} />
            Add
          </button>
        }
      >
        {connectors.length === 0 ? (
          <div style={{
            padding: '32px 0', textAlign: 'center',
            fontSize: '0.8125rem', color: 'var(--text-muted)',
            fontFamily: 'var(--font-sans)',
          }}>
            <div style={{ marginBottom: 8 }}>No integrations configured yet.</div>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                background: 'var(--amber)', color: '#000',
                border: 'none', borderRadius: 'var(--radius-md)',
                padding: '6px 16px', cursor: 'pointer',
                fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
                fontWeight: 500,
              }}
            >
              Add your first integration
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 8,
          }}>
            {connectors.map((c) => (
              <ConnectorCard
                key={c.id}
                connector={c}
                onRefresh={loadConnectors}
                onConfigure={(id) => setEditingId(id)}
              />
            ))}
          </div>
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

      <AddIntegrationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConnected={loadConnectors}
      />

      <EditConnectorModal
        connectorId={editingId}
        onClose={() => setEditingId(null)}
        onSaved={loadConnectors}
      />
    </>
  );
}
