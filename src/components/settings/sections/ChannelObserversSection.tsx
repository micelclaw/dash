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
import { RefreshCw, Settings, Trash2, Loader2, MessageSquare, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useWebSocket } from '@/hooks/use-websocket';
import { SettingSection } from '../SettingSection';
import { AddIntegrationModal } from '../AddIntegrationModal';
import { WhatsAppImportDialog } from './WhatsAppImportDialog';
import { ChannelConfigModal } from './ChannelConfigModal';

interface ConnectorInfo {
  id: string;
  connector_type: string;
  display_name: string | null;
  name: string;
  domains: string[];
  status: string;
  last_sync_at: string | null;
  errors_count: number;
}

interface PlatformStats {
  platform: string;
  channel_count: number;
  message_count: number;
}

interface ObserverPrivacy {
  direction_filter: 'all' | 'my_messages';
  content_filter: 'full' | 'metadata_only';
}

const OBSERVER_TYPES = ['slack-observer', 'discord-observer', 'telegram-observer', 'teams-observer', 'signal-observer'];

function timeAgo(ts: string | null): string {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function ChannelObserversSection() {
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [whatsappStats, setWhatsappStats] = useState<PlatformStats | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalPrefilter, setAddModalPrefilter] = useState<string | undefined>();
  const [privacy, setPrivacy] = useState<ObserverPrivacy>({ direction_filter: 'all', content_filter: 'full' });
  const [privacyDirty, setPrivacyDirty] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [syncProgress, setSyncProgress] = useState<Record<string, { channel?: string; processed: number; total: number }>>({});

  // Listen for sync progress events
  const progressEvent = useWebSocket('sync.progress');
  useEffect(() => {
    if (!progressEvent) return;
    const data = progressEvent.data;
    const connectorId = data.connector_id as string;
    if (!connectorId) return;
    setSyncProgress(prev => ({
      ...prev,
      [connectorId]: {
        channel: data.channel as string | undefined,
        processed: data.processed as number,
        total: data.total as number,
      },
    }));
  }, [progressEvent]);

  const completedEvent = useWebSocket('sync.completed');
  useEffect(() => {
    if (!completedEvent) return;
    const connectorId = completedEvent.data.connector_id as string;
    if (connectorId) {
      setSyncProgress(prev => {
        const next = { ...prev };
        delete next[connectorId];
        return next;
      });
    }
    loadData();
  }, [completedEvent]);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get<{ data: ConnectorInfo[] }>('/sync/connectors');
      const observers = (res.data ?? []).filter(c => OBSERVER_TYPES.includes(c.connector_type));
      setConnectors(observers);
    } catch {
      // Ignore if API not available
    }

    try {
      const res = await api.get<{ data: PlatformStats[] }>('/messages/platforms');
      const wa = (res.data ?? []).find(p => p.platform === 'whatsapp');
      setWhatsappStats(wa ?? null);
    } catch {
      // Ignore
    }

    try {
      const res = await api.get<{ data: ObserverPrivacy }>('/sync/observers/privacy');
      if (res.data) setPrivacy(res.data);
    } catch {
      // Ignore — use defaults
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const slackConnector = connectors.find(c => c.connector_type === 'slack-observer');
  const discordConnector = connectors.find(c => c.connector_type === 'discord-observer');
  const telegramConnector = connectors.find(c => c.connector_type === 'telegram-observer');
  const teamsConnector = connectors.find(c => c.connector_type === 'teams-observer');
  const signalConnector = connectors.find(c => c.connector_type === 'signal-observer');
  const configConnector = connectors.find(c => c.id === configId);

  const handleConnect = (serviceId: string) => {
    setAddModalPrefilter(serviceId);
    setAddModalOpen(true);
  };

  const handleSync = async (connectorId: string) => {
    try {
      await api.post(`/sync/connectors/${connectorId}/run`);
      toast.success('Sync started');
    } catch {
      toast.error('Failed to start sync');
    }
  };

  const handleDisconnect = async (connectorId: string) => {
    try {
      await api.delete(`/sync/connectors/${connectorId}`);
      toast.success('Disconnected');
      loadData();
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  const handleSavePrivacy = async () => {
    setSavingPrivacy(true);
    try {
      await api.patch('/sync/observers/privacy', privacy);
      toast.success('Privacy settings saved');
      setPrivacyDirty(false);
    } catch {
      toast.error('Failed to save privacy settings');
    }
    setSavingPrivacy(false);
  };

  return (
    <>
      <SettingSection
        title="Channel Observers"
        description="Import and observe your messaging platforms."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Slack row */}
          <PlatformRow
            icon={<SlackIcon size={20} />}
            name="Slack"
            connector={slackConnector}
            progress={slackConnector ? syncProgress[slackConnector.id] : undefined}
            onConnect={() => handleConnect('slack-observer')}
            onConfigure={() => slackConnector && setConfigId(slackConnector.id)}
            onSync={() => slackConnector && handleSync(slackConnector.id)}
            onDisconnect={() => slackConnector && handleDisconnect(slackConnector.id)}
          />

          {/* Discord row */}
          <PlatformRow
            icon={<DiscordIcon size={20} />}
            name="Discord"
            connector={discordConnector}
            progress={discordConnector ? syncProgress[discordConnector.id] : undefined}
            onConnect={() => handleConnect('discord-observer')}
            onConfigure={() => discordConnector && setConfigId(discordConnector.id)}
            onSync={() => discordConnector && handleSync(discordConnector.id)}
            onDisconnect={() => discordConnector && handleDisconnect(discordConnector.id)}
          />

          {/* Telegram row */}
          <PlatformRow
            icon={<TelegramIcon size={20} />}
            name="Telegram"
            connector={telegramConnector}
            progress={telegramConnector ? syncProgress[telegramConnector.id] : undefined}
            onConnect={() => handleConnect('telegram-observer')}
            onConfigure={() => telegramConnector && setConfigId(telegramConnector.id)}
            onSync={() => telegramConnector && handleSync(telegramConnector.id)}
            onDisconnect={() => telegramConnector && handleDisconnect(telegramConnector.id)}
          />

          {/* Teams row */}
          <PlatformRow
            icon={<TeamsIcon size={20} />}
            name="Teams"
            connector={teamsConnector}
            progress={teamsConnector ? syncProgress[teamsConnector.id] : undefined}
            onConnect={() => handleConnect('teams-observer')}
            onConfigure={() => teamsConnector && setConfigId(teamsConnector.id)}
            onSync={() => teamsConnector && handleSync(teamsConnector.id)}
            onDisconnect={() => teamsConnector && handleDisconnect(teamsConnector.id)}
          />

          {/* Signal row */}
          <PlatformRow
            icon={<SignalIcon size={20} />}
            name="Signal"
            connector={signalConnector}
            progress={signalConnector ? syncProgress[signalConnector.id] : undefined}
            onConnect={() => handleConnect('signal-observer')}
            onConfigure={() => signalConnector && setConfigId(signalConnector.id)}
            onSync={() => signalConnector && handleSync(signalConnector.id)}
            onDisconnect={() => signalConnector && handleDisconnect(signalConnector.id)}
          />

          {/* WhatsApp row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <WhatsAppIcon size={20} />
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>
                  WhatsApp
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {whatsappStats
                    ? `${whatsappStats.channel_count} chat${whatsappStats.channel_count !== 1 ? 's' : ''} imported (${whatsappStats.message_count.toLocaleString()} messages)`
                    : 'Import chat export files'}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowImport(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px',
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text)',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.75rem',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
              <Upload size={14} />
              {whatsappStats ? 'Import another' : 'Import chat'}
            </button>
          </div>
        </div>
      </SettingSection>

      {/* Privacy section */}
      <SettingSection
        title="Privacy"
        description="Default privacy settings for all channel observers."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{
              fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              marginBottom: 8,
            }}>
              Message scope
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={radioLabelStyle}>
                <input
                  type="radio" name="observer-direction"
                  checked={privacy.direction_filter === 'all'}
                  onChange={() => { setPrivacy(p => ({ ...p, direction_filter: 'all' })); setPrivacyDirty(true); }}
                  style={{ accentColor: 'var(--amber)' }}
                />
                <div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Full conversations</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>All messages in selected channels</div>
                </div>
              </label>
              <label style={radioLabelStyle}>
                <input
                  type="radio" name="observer-direction"
                  checked={privacy.direction_filter === 'my_messages'}
                  onChange={() => { setPrivacy(p => ({ ...p, direction_filter: 'my_messages' })); setPrivacyDirty(true); }}
                  style={{ accentColor: 'var(--amber)' }}
                />
                <div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>My messages only</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Only messages you sent</div>
                </div>
              </label>
            </div>
          </div>

          <div>
            <div style={{
              fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              marginBottom: 8,
            }}>
              Content storage
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={radioLabelStyle}>
                <input
                  type="radio" name="observer-content"
                  checked={privacy.content_filter === 'full'}
                  onChange={() => { setPrivacy(p => ({ ...p, content_filter: 'full' })); setPrivacyDirty(true); }}
                  style={{ accentColor: 'var(--amber)' }}
                />
                <div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Full content</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Store complete message text</div>
                </div>
              </label>
              <label style={radioLabelStyle}>
                <input
                  type="radio" name="observer-content"
                  checked={privacy.content_filter === 'metadata_only'}
                  onChange={() => { setPrivacy(p => ({ ...p, content_filter: 'metadata_only' })); setPrivacyDirty(true); }}
                  style={{ accentColor: 'var(--amber)' }}
                />
                <div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Metadata only</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Store sender, time, channel (not content)</div>
                </div>
              </label>
            </div>
          </div>

          {privacyDirty && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { loadData(); setPrivacyDirty(false); }}
                style={{
                  padding: '6px 14px',
                  background: 'none', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-dim)', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', fontSize: '0.75rem',
                }}
              >
                Discard
              </button>
              <button
                onClick={handleSavePrivacy}
                disabled={savingPrivacy}
                style={{
                  padding: '6px 14px',
                  background: 'var(--amber)', border: 'none',
                  borderRadius: 'var(--radius-md)',
                  color: '#000', cursor: savingPrivacy ? 'default' : 'pointer',
                  fontFamily: 'var(--font-sans)', fontSize: '0.75rem',
                  fontWeight: 600, opacity: savingPrivacy ? 0.7 : 1,
                }}
              >
                {savingPrivacy ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </SettingSection>

      {/* Modals */}
      {showImport && (
        <WhatsAppImportDialog
          onClose={() => setShowImport(false)}
          onImported={() => { loadData(); setShowImport(false); }}
        />
      )}

      {configId && configConnector && (
        <ChannelConfigModal
          connectorId={configId}
          connectorType={configConnector.connector_type}
          onClose={() => setConfigId(null)}
          onSaved={loadData}
        />
      )}

      {addModalOpen && (
        <AddIntegrationModal
          open={addModalOpen}
          onClose={() => { setAddModalOpen(false); setAddModalPrefilter(undefined); }}
          onConnected={() => { loadData(); setAddModalOpen(false); setAddModalPrefilter(undefined); }}
          prefilterService={addModalPrefilter}
        />
      )}
    </>
  );
}

// ─── Platform row component ──────────────────────────────

interface PlatformRowProps {
  icon: React.ReactNode;
  name: string;
  connector: ConnectorInfo | undefined;
  progress?: { channel?: string; processed: number; total: number };
  onConnect: () => void;
  onConfigure: () => void;
  onSync: () => void;
  onDisconnect: () => void;
}

function PlatformRow({ icon, name, connector, progress, onConnect, onConfigure, onSync, onDisconnect }: PlatformRowProps) {
  const connected = connector && connector.status !== 'disconnected';
  const syncing = !!progress;

  return (
    <div style={{
      padding: '12px 14px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon}
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>{name}</span>
        </div>

        {connected ? (
          <span style={{
            fontSize: '0.6875rem', fontWeight: 500,
            color: '#22c55e',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
            Connected
          </span>
        ) : (
          <button
            onClick={onConnect}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px',
              background: 'none',
              border: '1px solid var(--amber)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--amber)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.6875rem', fontWeight: 500,
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212, 160, 23, 0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            Connect &rarr;
          </button>
        )}
      </div>

      {/* Details when connected */}
      {connected && connector && (
        <div style={{ marginTop: 8, paddingLeft: 30 }}>
          {/* Status info */}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>
            {connector.display_name && <span>{connector.display_name}</span>}
            {connector.last_sync_at && (
              <span>{connector.display_name ? ' · ' : ''}Last sync: {timeAgo(connector.last_sync_at)}</span>
            )}
          </div>

          {/* Sync progress */}
          {syncing && progress && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: '0.75rem', color: 'var(--amber)',
              marginBottom: 8,
            }}>
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              <span>
                Syncing{progress.channel ? ` ${progress.channel}` : ''}...
                {progress.total > 0 && ` ${progress.processed}/${progress.total} messages`}
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            <ActionButton icon={<Settings size={12} />} label="Configure channels" onClick={onConfigure} />
            <ActionButton icon={<RefreshCw size={12} />} label="Sync now" onClick={onSync} />
            <ActionButton icon={<Trash2 size={12} />} label="Disconnect" onClick={onDisconnect} danger />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small action button ─────────────────────────────────

function ActionButton({ icon, label, onClick, danger }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 8px',
        background: 'none',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        color: danger ? 'var(--error)' : 'var(--text-dim)',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        fontSize: '0.6875rem',
        transition: 'all var(--transition-fast)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? 'rgba(244, 63, 94, 0.1)' : 'var(--surface-hover)';
        e.currentTarget.style.borderColor = danger ? 'var(--error)' : 'var(--border-hover)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'none';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Inline radio label style ────────────────────────────

const radioLabelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 8,
  cursor: 'pointer',
  padding: '4px 0',
};

// ─── Platform SVG icons ──────────────────────────────────

function SlackIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313z" fill="#E01E5A"/>
      <path d="M8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312z" fill="#36C5F0"/>
      <path d="M18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312z" fill="#2EB67D"/>
      <path d="M15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z" fill="#ECB22E"/>
    </svg>
  );
}

function DiscordIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#5865F2">
      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

function TelegramIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="#0088cc"/>
      <path d="M5.4 11.6l10.1-4.3c.5-.2.9.1.7.7L14.5 16c-.2.5-.6.6-1 .4l-2.8-2.1-1.3 1.3c-.1.1-.3.2-.5.2l.2-2.8 5.1-4.6c.2-.2 0-.3-.3-.1L7.6 13.2l-2.7-.8c-.6-.2-.6-.6.1-.8z" fill="white"/>
    </svg>
  );
}

function TeamsIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="1" y="4" width="14" height="16" rx="2" fill="#6264a7"/>
      <text x="8" y="15" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="sans-serif">T</text>
      <circle cx="19" cy="7" r="3.5" fill="#6264a7"/>
      <rect x="15.5" y="11" width="7" height="7" rx="1.5" fill="#6264a7" opacity="0.8"/>
    </svg>
  );
}

function SignalIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#3a76f0"/>
      <path d="M12 6.5c-3.04 0-5.5 2.46-5.5 5.5 0 .97.25 1.88.7 2.67L6.5 17.5l2.83-.7c.79.45 1.7.7 2.67.7 3.04 0 5.5-2.46 5.5-5.5S15.04 6.5 12 6.5z" fill="white"/>
    </svg>
  );
}

function WhatsAppIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="#25D366"/>
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" stroke="#25D366" strokeWidth="1.5" fill="none"/>
    </svg>
  );
}
