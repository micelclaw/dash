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
 *
 * ─── Channel Observers (capability-driven) ─────────────────────────
 * Rows are generated from `GET /messages/capabilities` (the backend SSOT),
 * not a hardcoded list. Each platform's send/observe/pairing state, connector
 * status and stream health come from the backend; branding/icons come from the
 * shared messaging-platforms registry. May be mounted at `/settings/observers`.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { RefreshCw, Settings, Trash2, Loader2, Upload, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';
import * as syncSvc from '@/services/sync.service';
import * as messagesSvc from '@/services/messages.service';
import { ApiError } from '@/services/api';
import { useWebSocket } from '@/hooks/use-websocket';
import { usePlatformCapabilitiesStore } from '@/stores/platform-capabilities.store';
import { MESSAGING_PLATFORMS, platformMeta, accountModelOf, type AccountModel } from '@/config/messaging-platforms';
import type { PlatformCapability } from '@/services/messages.service';
import { PlatformIcon } from '@/components/shared/platform-icons';
import { SettingSection } from '../SettingSection';
import { AddIntegrationModal } from '../AddIntegrationModal';
import { WhatsAppImportDialog } from './WhatsAppImportDialog';
import { ChannelConfigModal } from './ChannelConfigModal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PLATFORM_PRIVACY } from './observers/privacy-data';
import { PrivacyTags, PrivacyScore } from './observers/PrivacyTagList';
import { ObserverStatusBadge } from './observers/ObserverStatusBadge';
import { observerDisconnectTarget } from './observers/observer-disconnect';

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

interface ObserverPrivacy {
  direction_filter: 'all' | 'my_messages';
  content_filter: 'full' | 'metadata_only';
}

/**
 * Which platforms currently have a working Connect wizard, and the SERVICES id
 * to prefilter the AddIntegrationModal with. Extended per implementation batch
 * (WhatsApp/WeChat/… land here as their forms ship).
 */
const WIZARD_SERVICE_ID: Record<string, string> = {
  signal: 'signal-observer',
  simplex: 'simplex-observer',
  // "SimpleX · tu móvil (XRCP)": wizard propio (el sidecar + emparejar con el móvil).
  simplex_xrcp: 'simplex-xrcp',
  session: 'session-observer',
  session_link: 'session-link-observer',
  // Telegram = tu CUENTA REAL vía el hub Matrix (mautrix-telegram). Ya no hay
  // wizard de bot: una sola fila "Telegram".
  telegram: 'telegram-matrix',
  // WhatsApp = tu CUENTA REAL vía el hub Matrix (mautrix-whatsapp, 2026-07-17).
  whatsapp: 'whatsapp-matrix',
  // Messenger = tu CUENTA REAL vía el hub Matrix (mautrix-meta, 2026-08-05).
  fb_messenger: 'messenger-matrix',
  google_messages: 'gmessages-matrix',
  irc: 'irc-matrix',
  viber: 'viber-observer',
  googlechat: 'googlechat-matrix',
  qq: 'qq-matrix',
  discord: 'discord-observer',
  slack: 'slack-observer',
  teams: 'teams-observer',
};

/**
 * Display order: highest privacy first, then the rest by score desc.
 * Se excluyen los TRANSPORTES internos (Matrix): son la tubería del hub, no un
 * canal que el usuario conecte — Telegram ya ES esa fila.
 */
const DISPLAY_ORDER = MESSAGING_PLATFORMS
  .filter((m) => !m.internalTransport)
  .map((m) => m.platform)
  .sort((a, b) => {
    const sa = PLATFORM_PRIVACY[a]?.score ?? -1;
    const sb = PLATFORM_PRIVACY[b]?.score ?? -1;
    return sb - sa;
  });

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [stats, setStats] = useState<Record<string, { channel_count: number; message_count: number }>>({});
  const [showImport, setShowImport] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  // Qué plataforma se está configurando: el hub Matrix mete Telegram/Messenger/
  // Google Messages en UN connector → el selector debe filtrar por ella.
  const [configPlatform, setConfigPlatform] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalPrefilter, setAddModalPrefilter] = useState<string | undefined>();
  const [privacy, setPrivacy] = useState<ObserverPrivacy>({ direction_filter: 'all', content_filter: 'full' });
  const [privacyDirty, setPrivacyDirty] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [syncProgress, setSyncProgress] = useState<Record<string, { channel?: string; processed: number; total: number }>>({});
  const [disconnectTarget, setDisconnectTarget] = useState<ReturnType<typeof observerDisconnectTarget> | null>(null);
  // Selection-first: after a channel connects, auto-open its chat picker so the
  // user chooses which contacts/groups to sync (no confusing empty inbox).
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);
  const [pendingSelectPlatform, setPendingSelectPlatform] = useState<string | null>(null);
  /** Plataforma cuyo wizard está abierto (para saber qué picker abrir al acabar). */
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  const capabilities = usePlatformCapabilitiesStore((s) => s.byPlatform);
  const loadCaps = usePlatformCapabilitiesStore((s) => s.load);
  const refreshCaps = usePlatformCapabilitiesStore((s) => s.refresh);

  const progressEvent = useWebSocket('sync.progress');
  useEffect(() => {
    if (!progressEvent) return;
    const data = progressEvent.data;
    const connectorId = data.connector_id as string;
    if (!connectorId) return;
    setSyncProgress((prev) => ({
      ...prev,
      [connectorId]: { channel: data.channel as string | undefined, processed: data.processed as number, total: data.total as number },
    }));
  }, [progressEvent]);

  const completedEvent = useWebSocket('sync.completed');
  useEffect(() => {
    if (!completedEvent) return;
    const connectorId = completedEvent.data.connector_id as string;
    if (connectorId) {
      setSyncProgress((prev) => {
        const next = { ...prev };
        delete next[connectorId];
        return next;
      });
    }
    loadData();
    refreshCaps();
  }, [completedEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = useCallback(async () => {
    try {
      const list = await syncSvc.listConnectors();
      setConnectors(list as ConnectorInfo[]);
    } catch {
      /* ignore */
    }
    try {
      const list = await messagesSvc.getPlatformStats();
      const map: Record<string, { channel_count: number; message_count: number }> = {};
      for (const p of list) map[p.platform] = { channel_count: p.channel_count, message_count: p.message_count };
      setStats(map);
    } catch {
      /* ignore */
    }
    try {
      const data = await syncSvc.getObserverPrivacy();
      if (data) setPrivacy(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadCaps();
    loadData();
  }, [loadCaps, loadData]);

  // Re-preguntar al backend al volver a la pestaña. Sin esto, una pestaña abierta
  // desde hace horas seguía pintando el estado del primer fetch: pasó de verdad —
  // una fila "Connected" con un connector ya borrado, imposible de desconectar.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState !== 'visible') return;
      refreshCaps();
      loadData();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refreshCaps, loadData]);

  // Deep-links:
  //  ?connect=<platform>   → open the connect wizard (new channel)
  //  ?configure=<platform> → open the chat picker for an already-connected channel
  useEffect(() => {
    const connect = searchParams.get('connect');
    const configure = searchParams.get('configure');
    if (!connect && !configure) return;
    if (connect) {
      const serviceId = WIZARD_SERVICE_ID[connect];
      if (serviceId) {
        setAddModalPrefilter(serviceId);
        setAddModalOpen(true);
      }
    }
    if (configure) {
      const ct = platformMeta(configure).connectorType;
      if (ct) {
        setPendingSelectPlatform(configure);
        setPendingSelect(ct); // the pendingSelect effect opens the picker once the connector is loaded
      }
    }
    const next = new URLSearchParams(searchParams);
    next.delete('connect');
    next.delete('configure');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const connectorById = useMemo(() => new Map(connectors.map((c) => [c.id, c])), [connectors]);

  // Selection-first: once the just-connected connector appears in the list, open
  // its chat picker so the user chooses which contacts/groups to sync.
  useEffect(() => {
    if (!pendingSelect) return;
    const conn = connectors.find((c) => c.connector_type === pendingSelect);
    if (conn) {
      setConfigPlatform(pendingSelectPlatform);
      setConfigId(conn.id);
      setPendingSelect(null);
      setPendingSelectPlatform(null);
    }
  }, [connectors, pendingSelect]);

  const handleConnect = (platform: string) => {
    const serviceId = WIZARD_SERVICE_ID[platform];
    if (!serviceId) {
      toast.info('This channel isn’t available to connect yet.');
      return;
    }
    setConnectingPlatform(platform);
    setAddModalPrefilter(serviceId);
    setAddModalOpen(true);
  };

  /**
   * El modal solo renderiza si el connector está en `connectorById`. Antes, con
   * una fila stale, el botón NO HACÍA NADA (silencio total, sin toast ni pista).
   * Ahora se dice qué pasa y se re-sincroniza para que la fila se corrija sola.
   */
  const handleConfigure = (connectorId: string | null, platform?: string) => {
    if (connectorId && connectorById.has(connectorId)) {
      setConfigPlatform(platform ?? null);
      setConfigId(connectorId);
      return;
    }
    toast.error('That channel is no longer connected — refreshing');
    refreshCaps();
    loadData();
  };

  const handleSync = async (connectorId: string) => {
    try {
      // El toast se deriva de lo que el backend HIZO de verdad (contrato {action})
      // — nunca "Sync started" sobre un no-op (bug real: la fila de un bridge del
      // Gateway toasteaba éxito sin hacer nada).
      const action = await syncSvc.runConnector(connectorId);
      const TOAST: Record<string, string> = {
        sync_started: 'Sync started',
        stream_reconnected: 'Reconnecting stream…',
        stream_already_live: 'Stream is already live',
        refreshed: 'Refreshing chats — new history will appear shortly',
        noop: 'Nothing to sync — this channel ingests in real time',
      };
      toast.success(TOAST[action] ?? 'Done');
      // El estado del stream puede cambiar en segundos: refetch corto.
      setTimeout(() => refreshCaps(), 2_500);
    } catch {
      // Si el connector ya no existe, la fila estaba stale → re-sincronizar con
      // el backend repara la fila sola en vez de dejar un botón que solo falla.
      toast.error('Failed to start sync');
      refreshCaps();
      loadData();
    }
  };

  /**
   * XRCP: tomar/soltar el control del móvil. Reutiliza el par pause/resume del
   * connector (pause = soltar control → el móvil libre; resume = tomar control →
   * reconecta+sincroniza). El estado se deriva del backend (status del connector).
   */
  const handleToggleControl = async (connectorId: string, currentStatus: string) => {
    const release = currentStatus !== 'paused'; // 'connected' → soltar
    try {
      if (release) {
        await syncSvc.pauseConnector(connectorId);
        toast.success('Control soltado — tu móvil queda libre');
      } else {
        await syncSvc.resumeConnector(connectorId);
        toast.success('Tomando el control — abre «Usar desde escritorio» en el móvil');
      }
      setTimeout(() => { refreshCaps(); loadData(); }, 2_500);
    } catch {
      toast.error(release ? 'No se pudo soltar el control' : 'No se pudo tomar el control');
      refreshCaps();
      loadData();
    }
  };

  const handleDisconnect = async (target: ReturnType<typeof observerDisconnectTarget>) => {
    try {
      await syncSvc.deleteConnector(target.id, target.options);
      toast.success('Disconnected');
      loadData();
      refreshCaps();
    } catch (err) {
      // Un 404 = el connector YA no está (doble pulsación, o el servidor lo borró y el cliente
      // reintentó): eso ES estar desconectado, no un fallo. Solo es error de verdad otra cosa.
      if (err instanceof ApiError && err.status === 404) {
        toast.success('Disconnected');
      } else {
        toast.error('Failed to disconnect');
      }
      loadData();
      refreshCaps();
    }
    setDisconnectTarget(null);
  };

  const handleSavePrivacy = async () => {
    setSavingPrivacy(true);
    try {
      await syncSvc.updateObserverPrivacy(privacy);
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
        description="Connect your messaging platforms — observe incoming messages and reply from Messages on the platforms you authorize."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {DISPLAY_ORDER.map((platform) => {
            const cap = capabilities[platform];
            const connectorId = cap?.connector?.id ?? null;
            const connector = connectorId ? connectorById.get(connectorId) : undefined;
            const progress = connectorId ? syncProgress[connectorId] : undefined;
            return (
              <PlatformRow
                key={platform}
                platform={platform}
                capability={cap}
                connector={connector}
                stats={stats[platform]}
                progress={progress}
                hasWizard={Boolean(WIZARD_SERVICE_ID[platform])}
                onConnect={() => handleConnect(platform)}
                onConfigure={() => handleConfigure(connectorId, platform)}
                onSync={() => connectorId && handleSync(connectorId)}
                onDisconnect={() => connectorId && setDisconnectTarget(observerDisconnectTarget(connectorId, platformMeta(platform).channelType === 'matrix'))}
                onToggleControl={connectorId ? () => handleToggleControl(connectorId, connector?.status ?? 'connected') : undefined}
                onImport={platform === 'whatsapp' ? () => setShowImport(true) : undefined}
              />
            );
          })}
        </div>
      </SettingSection>

      {/* Privacy defaults */}
      <SettingSection title="Privacy" description="Default privacy settings for all channel observers.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PrivacyRadioGroup
            title="Message scope"
            options={[
              { value: 'all', label: 'Full conversations', hint: 'All messages in selected channels' },
              { value: 'my_messages', label: 'My messages only', hint: 'Only messages you sent' },
            ]}
            name="observer-direction"
            selected={privacy.direction_filter}
            onChange={(v) => { setPrivacy((p) => ({ ...p, direction_filter: v as 'all' | 'my_messages' })); setPrivacyDirty(true); }}
          />
          <PrivacyRadioGroup
            title="Content storage"
            options={[
              { value: 'full', label: 'Full content', hint: 'Store complete message text' },
              { value: 'metadata_only', label: 'Metadata only', hint: 'Store sender, time, channel (not content)' },
            ]}
            name="observer-content"
            selected={privacy.content_filter}
            onChange={(v) => { setPrivacy((p) => ({ ...p, content_filter: v as 'full' | 'metadata_only' })); setPrivacyDirty(true); }}
          />
          {privacyDirty && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { loadData(); setPrivacyDirty(false); }}
                style={{ padding: '6px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.75rem' }}
              >
                Discard
              </button>
              <button
                onClick={handleSavePrivacy}
                disabled={savingPrivacy}
                style={{ padding: '6px 14px', background: 'var(--amber)', border: 'none', borderRadius: 'var(--radius-md)', color: '#000', cursor: savingPrivacy ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600, opacity: savingPrivacy ? 0.7 : 1 }}
              >
                {savingPrivacy ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </SettingSection>

      {/* Modals */}
      {showImport && (
        <WhatsAppImportDialog onClose={() => setShowImport(false)} onImported={() => { loadData(); setShowImport(false); }} />
      )}
      {configId && connectorById.get(configId) && (
        <ChannelConfigModal
          connectorId={configId}
          connectorType={connectorById.get(configId)!.connector_type}
          platform={configPlatform ?? undefined}
          onClose={() => { setConfigId(null); setConfigPlatform(null); }}
          onSaved={() => { loadData(); refreshCaps(); }}
        />
      )}
      {addModalOpen && (
        <AddIntegrationModal
          open={addModalOpen}
          onClose={() => { setAddModalOpen(false); setAddModalPrefilter(undefined); }}
          onConnected={() => {
            // OJO: `addModalPrefilter` es el id del SERVICIO ('telegram-matrix'),
            // no el connector_type ('gateway-observer') → compararlo con
            // `c.connector_type` no casaba nunca y el picker no se abría solo.
            // El connector_type se deriva de la plataforma que se estaba conectando.
            const platform = connectingPlatform;
            const ct = platform ? platformMeta(platform).connectorType : null;
            loadData();
            refreshCaps();
            setAddModalOpen(false);
            setAddModalPrefilter(undefined);
            setConnectingPlatform(null);
            if (ct) {
              setPendingSelectPlatform(platform);
              setPendingSelect(ct); // dispara el selector de chats
            }
          }}
          prefilterService={addModalPrefilter}
        />
      )}
      <ConfirmDialog
        open={disconnectTarget != null}
        title={disconnectTarget?.title ?? 'Disconnect channel?'}
        description={disconnectTarget?.description ?? ''}
        confirmLabel={disconnectTarget?.label ?? 'Disconnect'}
        variant="danger"
        onConfirm={() => { if (disconnectTarget) handleDisconnect(disconnectTarget); }}
        onClose={() => setDisconnectTarget(null)}
      />
    </>
  );
}

// ─── Platform row ────────────────────────────────────────────────────

interface PlatformRowProps {
  platform: string;
  capability?: PlatformCapability;
  connector?: ConnectorInfo;
  stats?: { channel_count: number; message_count: number };
  progress?: { channel?: string; processed: number; total: number };
  hasWizard: boolean;
  onConnect: () => void;
  onConfigure: () => void;
  onSync: () => void;
  onDisconnect: () => void;
  /** XRCP: tomar/soltar el control del móvil (pause/resume del connector). */
  onToggleControl?: () => void;
  onImport?: () => void;
}

function PlatformRow({ platform, capability, connector, stats, progress, hasWizard, onConnect, onConfigure, onSync, onDisconnect, onToggleControl, onImport }: PlatformRowProps) {
  const meta = platformMeta(platform);
  const privacy = PLATFORM_PRIVACY[platform];
  // "Connected" is derived from the backend capability alone — the listConnectors
  // row is only for extra display (name / last sync), so its async arrival never
  // flips the row back to "Connect" (feedback_button_state_persistence).
  const connected = capability?.connector != null;
  const syncing = Boolean(progress);
  const unsupported = capability?.transport === 'none';

  const countLabel = stats
    ? ` · ${stats.channel_count} chat${stats.channel_count !== 1 ? 's' : ''} (${stats.message_count.toLocaleString()} msgs)`
    : '';

  return (
    <div data-platform={platform} style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', opacity: unsupported ? 0.72 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Left: icon + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, minWidth: 150 }}>
          <PlatformIcon platform={platform} size={32} muted={unsupported} />
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{meta.label}</span>
              <AccountModelBadge model={accountModelOf(platform)} />
            </div>
            {privacy && (
              <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 1 }}>
                {privacy.subtitle}
                {countLabel}
              </div>
            )}
          </div>
        </div>

        {/* Center: privacy tags */}
        {privacy ? <PrivacyTags privacy={privacy} /> : <div style={{ flex: 1 }} />}

        {/* Right: score + status/action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {privacy && <PrivacyScore privacy={privacy} />}

          {unsupported ? (
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', padding: '4px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }} title={capability?.note ?? undefined}>
              Unavailable
            </span>
          ) : connected ? (
            <ObserverStatusBadge capability={capability} syncing={syncing} />
          ) : hasWizard ? (
            <ConnectButton onClick={onConnect} />
          ) : onImport ? (
            <ConnectButton onClick={onConnect} label="Connect" />
          ) : (
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', padding: '4px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              Coming soon
            </span>
          )}

          {onImport && (
            <button
              onClick={onImport}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem' }}
            >
              <Upload size={12} /> {stats ? 'Import more' : 'Import history'}
            </button>
          )}
        </div>
      </div>

      {/* Connected details */}
      {connected && (
        <div style={{ marginTop: 6, paddingLeft: 46 }}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: 5 }}>
            {connector?.display_name && <span>{connector.display_name}</span>}
            {(connector?.last_sync_at ?? capability?.connector?.last_sync_at) && (
              <span>{connector?.display_name ? ' · ' : ''}Last sync: {timeAgo(connector?.last_sync_at ?? capability?.connector?.last_sync_at ?? null)}</span>
            )}
          </div>
          {syncing && progress && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', color: 'var(--amber)', marginBottom: 5 }}>
              <Loader2 size={11} className="animate-spin" />
              <span>Syncing{progress.channel ? ` ${progress.channel}` : ''}...{progress.total > 0 && ` ${progress.processed}/${progress.total}`}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 5 }}>
            <ActionButton icon={<Settings size={11} />} label="Configure" onClick={onConfigure} />
            {/* Label según transporte = lo que el botón HACE de verdad: pull
                sincroniza; push nativo reconecta el stream; los bridges Matrix
                refrescan portales+historial (la ingesta ya es en tiempo real). */}
            <ActionButton
              icon={<RefreshCw size={11} />}
              label={
                platform === 'simplex_xrcp' ? 'Sincronizar'
                : capability?.transport === 'matrix-bridge' ? 'Refresh'
                : capability?.stream !== 'not_applicable' ? 'Reconnect'
                : 'Sync now'
              }
              onClick={onSync}
            />
            {/* XRCP: tomar/soltar el control del móvil (exclusión mutua móvil↔PC).
                'paused' = control soltado → "Tomar control" = RE-EMPAREJAR con QR (en esta
                red WSL2 el multicast de reconexión no llega al móvil → la única vía fiable de
                tener sesión activa es escanear un QR nuevo; el móvil se conecta por unicast).
                Controlando → "Soltar control" (release, conserva el emparejamiento). */}
            {platform === 'simplex_xrcp' && onToggleControl && (
              connector?.status === 'paused'
                ? <ActionButton icon={<Play size={11} />} label="Tomar control" onClick={onConnect} />
                : <ActionButton icon={<Pause size={11} />} label="Soltar control" onClick={onToggleControl} />
            )}
            <ActionButton icon={<Trash2 size={11} />} label={meta.channelType === 'matrix' ? 'Disconnect hub' : 'Disconnect'} onClick={onDisconnect} danger />
          </div>
        </div>
      )}
    </div>
  );
}

function AccountModelBadge({ model }: { model: AccountModel }) {
  if (model === 'none') return null;
  const account = model === 'account';
  return (
    <span
      title={account ? 'Your account — you see your real conversations with other people.' : 'Bot — you only see DMs sent to the bot and groups the bot is in, not your personal 1:1 chats.'}
      style={{
        fontSize: '0.5625rem', fontWeight: 600, lineHeight: 1,
        padding: '2px 6px', borderRadius: 5,
        textTransform: 'uppercase', letterSpacing: '0.04em',
        background: account ? 'rgba(16,185,129,0.14)' : 'rgba(148,163,184,0.14)',
        color: account ? '#34d399' : 'var(--text-muted)',
        border: `1px solid ${account ? 'rgba(16,185,129,0.30)' : 'var(--border)'}`,
      }}
    >
      {account ? 'Your account' : 'Bot'}
    </span>
  );
}

function ConnectButton({ onClick, label = 'Connect' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', background: 'none', border: '1px solid var(--amber)', borderRadius: 'var(--radius-md)', color: 'var(--amber)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 500, transition: 'all var(--transition-fast)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(212, 160, 23, 0.1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
    >
      {label} &rarr;
    </button>
  );
}

function ActionButton({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: danger ? 'var(--error)' : 'var(--text-dim)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', transition: 'all var(--transition-fast)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = danger ? 'rgba(244, 63, 94, 0.1)' : 'var(--surface-hover)'; e.currentTarget.style.borderColor = danger ? 'var(--error)' : 'var(--border-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      {icon}
      {label}
    </button>
  );
}

function PrivacyRadioGroup({ title, options, name, selected, onChange }: {
  title: string;
  options: { value: string; label: string; hint: string }[];
  name: string;
  selected: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {options.map((opt) => (
          <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', padding: '4px 0' }}>
            <input type="radio" name={name} checked={selected === opt.value} onChange={() => onChange(opt.value)} style={{ accentColor: 'var(--amber)' }} />
            <div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{opt.label}</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{opt.hint}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
