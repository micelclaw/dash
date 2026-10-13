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
import * as syncSvc from '@/services/sync.service';
import type { ConnectorInfo as SyncConnectorInfo } from '@/services/sync.service';
import { SettingSection } from '../SettingSection';
import { SettingSelect } from '../SettingSelect';
import { SaveBar } from '../SaveBar';
import { ConnectedList } from '../connect/ConnectedList';
import { ConnectWizard } from '../connect/ConnectWizard';
import { EditConnectorModal } from '../EditConnectorModal';
import { Link } from 'react-router';
import { MessageCircle, ChevronRight } from 'lucide-react';
import { DavAccessPanel } from './DavAccessPanel';

const INTERVAL_OPTIONS = [
  { value: '5', label: '5 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '60 minutes' },
  { value: '120', label: '120 minutes' },
];

type ConnectorInfo = SyncConnectorInfo;

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
      // Filter out channel observers — they are shown in ChannelObserversSection
      const list = await syncSvc.listConnectors();
      setConnectors(list.filter((c) => !c.connector_type.endsWith('-observer')));
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
      toast.success('Sync saved');
    } catch {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  return (
    <>
      <DavAccessPanel />
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
            Conectar
          </button>
        }
      >
        {connectors.length === 0 ? (
          <div style={{
            padding: '32px 0', textAlign: 'center',
            fontSize: '0.8125rem', color: 'var(--text-muted)',
            fontFamily: 'var(--font-sans)',
          }}>
            <div style={{ marginBottom: 8 }}>Todavía no hay nada conectado.</div>
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
              Conectar lo primero
            </button>
          </div>
        ) : (
          // Agrupadas por proveedor, una tarjeta por tipo de dato.
          <ConnectedList
            connectors={connectors}
            onRefresh={loadConnectors}
            onConfigure={(id) => setEditingId(id)}
          />
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

      <ChannelObserversBlock />

      <SaveBar visible={!!dirty.sync} saving={saving} onSave={handleSave} onDiscard={() => resetSection('sync')} />

      <ConnectWizard
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

// ── Link card to Channel Observers (now its own sidebar section, so this
// avoids the double-mount that the embedded block used to cause).
function ChannelObserversBlock() {
  return (
    <SettingSection title="Channel Observers" description="Two-way bridges — observe incoming messages and reply from Messages on the platforms you authorize.">
      <Link
        to="/settings/observers"
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', textDecoration: 'none', color: 'var(--text)',
        }}
      >
        <MessageCircle size={20} style={{ color: 'var(--amber)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Open Channel Observers</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 1 }}>
            Connect Signal, WhatsApp, Telegram, Discord, Matrix and more.
          </div>
        </div>
        <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </Link>
    </SettingSection>
  );
}
