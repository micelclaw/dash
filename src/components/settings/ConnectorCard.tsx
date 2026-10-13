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

import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Settings, Pause, Play, Loader2, Trash2, Unlink, TriangleAlert } from 'lucide-react';
import * as syncSvc from '@/services/sync.service';
import { DisconnectDialog } from './DisconnectDialog';
import { toast } from 'sonner';
import { useWebSocket } from '@/hooks/use-websocket';
import { avisosDeConector } from './connector-avisos';
import { DataServiceIcon, type DataServiceDomain } from '@/config/data-provider-icons';
import { taskWritePresentation } from './connector-task-write-state';

// ─── Connector icons ──────────────────────────────────────

/**
 * `sync_connectors.domains` usa el vocabulario interno de dominios de registro
 * (`emails`/`events`/`contacts`, el mismo que `ConnectorDataDomain` en el core),
 * no el de `DataServiceIcon` (`mail`/`calendar`/`contacts`). Mismo mapeo que
 * `ConnectWizard.tsx` (el contador de integraciones por tipo de la ventana 1).
 */
function connectorDomainToServiceDomain(domains: string[]): DataServiceDomain | undefined {
  for (const d of domains) {
    if (d === 'emails') return 'mail';
    if (d === 'events') return 'calendar';
    if (d === 'contacts') return 'contacts';
    if (d === 'tasks') return 'tasks';
  }
  return undefined;
}

function ConnectorIcon({
  type,
  providerSlug,
  domains,
  size = 20,
}: {
  type: string;
  providerSlug?: string | null;
  domains?: string[];
  size?: number;
}) {
  // Connectores de DATOS (todo lo que no es un observer de mensajería): el
  // logo real del proveedor + el glifo del dominio, en vez de las ramas
  // hardcodeadas de google/synology y del RefreshCw genérico de antes — esas
  // adivinaban el proveedor por el nombre del tipo (el bug que INT35 mató del
  // lado del servidor) y una "S" naranja para CUALQUIER CalDAV/CardDAV, fuera
  // de Synology o no.
  if (!type.endsWith('-observer')) {
    return (
      <DataServiceIcon
        providerSlug={providerSlug ?? 'generic'}
        domain={connectorDomainToServiceDomain(domains ?? [])}
        size={size}
      />
    );
  }
  if (type === 'slack-observer') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313z" fill="#E01E5A"/>
        <path d="M8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312z" fill="#36C5F0"/>
        <path d="M18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312z" fill="#2EB67D"/>
        <path d="M15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z" fill="#ECB22E"/>
      </svg>
    );
  }
  if (type === 'discord-observer') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#5865F2">
        <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    );
  }
  if (type === 'telegram-observer') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11" fill="#0088cc"/>
        <path d="M5.4 11.6l10.1-4.3c.5-.2.9.1.7.7L14.5 16c-.2.5-.6.6-1 .4l-2.8-2.1-1.3 1.3c-.1.1-.3.2-.5.2l.2-2.8 5.1-4.6c.2-.2 0-.3-.3-.1L7.6 13.2l-2.7-.8c-.6-.2-.6-.6.1-.8z" fill="white"/>
      </svg>
    );
  }
  if (type === 'teams-observer') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="1" y="4" width="14" height="16" rx="2" fill="#6264a7"/>
        <text x="8" y="15" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="sans-serif">T</text>
        <circle cx="19" cy="7" r="3.5" fill="#6264a7"/>
        <rect x="15.5" y="11" width="7" height="7" rx="1.5" fill="#6264a7" opacity="0.8"/>
      </svg>
    );
  }
  if (type === 'signal-observer') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#3a76f0"/>
        <path d="M12 6.5c-3.04 0-5.5 2.46-5.5 5.5 0 .97.25 1.88.7 2.67L6.5 17.5l2.83-.7c.79.45 1.7.7 2.67.7 3.04 0 5.5-2.46 5.5-5.5S15.04 6.5 12 6.5z" fill="white"/>
      </svg>
    );
  }
  // Observer de mensajería sin rama propia (p.ej. gateway-observer, los de
  // SimpleX/Session): esto ya no debería ocurrir para tipos de DATOS, que
  // arriba siempre resuelven a un logo o una inicial vía DataServiceIcon.
  return <RefreshCw size={size} style={{ color: 'var(--info)' }} />;
}

// ─── Connector display labels ────────────────────────────

/**
 * Etiquetas de los observers de MENSAJERÍA. Las de DATOS ya no viven aquí: se
 * piden al catálogo (ver `useConnectorLabels`).
 *
 * Este mapa era el QUINTO sitio paralelo del arco — los otros cuatro
 * (`CONNECTOR_META`, `CONNECTOR_LABELS`, la inferencia del proveedor y las ramas
 * de colecciones) se colapsaron en el catálogo del servidor, y éste seguía
 * declarando `imap-generic: 'IMAP Email'` por su cuenta. Se vio porque la tarjeta
 * mostraba una etiqueta distinta de la que dice el catálogo.
 */
const MESSAGING_LABELS: Record<string, string> = {
  'slack-observer': 'Slack',
  'discord-observer': 'Discord',
  'telegram-observer': 'Telegram',
  'teams-observer': 'Teams',
  'signal-observer': 'Signal',
};

/** Las etiquetas de los tipos de DATOS, del catálogo del servidor. */
function useConnectorLabels(): Record<string, string> {
  const [labels, setLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    let vivo = true;
    syncSvc
      .listDataCatalog()
      .then((c) => {
        if (!vivo) return;
        const m: Record<string, string> = {};
        for (const t of c.connectorTypes) m[t.type] = t.label;
        setLabels(m);
      })
      .catch(() => { /* sin catálogo se cae al nombre de la fila */ });
    return () => { vivo = false; };
  }, []);
  return labels;
}

const STATUS_COLORS: Record<string, string> = {
  connected: '#22c55e',
  syncing: 'var(--amber)',
  error: 'var(--error)',
  paused: 'var(--text-muted)',
  disconnected: 'var(--text-muted)',
};

function timeAgo(ts: string | null): string {
  if (!ts) return 'Never';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}


// ─── Component ───────────────────────────────────────────

interface ConnectorCardProps {
  connector: {
    id: string;
    connector_type: string;
    display_name: string | null;
    name: string;
    domains: string[];
    status: string;
    last_sync_at: string | null;
    last_error?: string | null;
    errors_count: number;
    task_write_supported?: boolean;
    task_write_certified?: boolean;
    task_write_enabled?: boolean;
    task_pending_change_count?: number | null;
    /** Cambios que agotaron los reintentos de subida (0 = todo al día). */
    push_failed_count?: number;
    push_last_error?: string | null;
    /**
     * Quién autoriza la integración, DICHO por el catálogo del servidor
     * (`GET /sync/connectors`). Nulo en las que no van por OAuth y en filas
     * antiguas guardadas antes de que el campo existiera.
     */
    oauth_provider?: string | null;
    /**
     * El proveedor de MARCA (Synology/Nextcloud/Google/…), DICHO por el
     * servidor. `null`/`undefined` si no hay proveedor determinable — el
     * icono cae entonces a `'generic'` (motor puro, sin marca).
     */
    provider_slug?: string | null;
  };
  onRefresh: () => void;
  onConfigure?: (id: string) => void;
}

export function ConnectorCard({ connector, onRefresh, onConfigure }: ConnectorCardProps) {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total?: number; folder?: string; phase?: string } | null>(null);
  const catalogLabels = useConnectorLabels();

  const fallbackRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Listen for sync progress WS events
  const progressEvent = useWebSocket('sync.progress');
  const completedEvent = useWebSocket('sync.completed');
  const errorEvent = useWebSocket('sync.error');

  useEffect(() => {
    if (progressEvent?.data?.connector_id === connector.id) {
      setProgress(progressEvent.data as any);
      if (!syncing) setSyncing(true);
    }
  }, [progressEvent, connector.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!completedEvent) return;
    // Clear syncing state when this connector's sync completes
    if (completedEvent.data?.connector_id === connector.id) {
      clearTimeout(fallbackRef.current);
      setProgress(null);
      setSyncing(false);
      onRefresh();
    }
  }, [completedEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!errorEvent) return;
    if (errorEvent.data?.connector_id === connector.id) {
      clearTimeout(fallbackRef.current);
      setProgress(null);
      setSyncing(false);
      onRefresh();
    }
  }, [errorEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => clearTimeout(fallbackRef.current);
  }, []);

  const label =
    connector.display_name
    || catalogLabels[connector.connector_type]
    || MESSAGING_LABELS[connector.connector_type]
    || connector.name;
  const statusColor = STATUS_COLORS[connector.status] ?? 'var(--text-muted)';

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncSvc.runConnector(connector.id);
      toast.success(`Sync started: ${label}`);
    } catch {
      toast.error('Failed to start sync');
      setSyncing(false);
      return;
    }
    // Fallback: if WS never fires, reset after 120s
    clearTimeout(fallbackRef.current);
    fallbackRef.current = setTimeout(() => { setSyncing(false); onRefresh(); }, 120_000);
  };

  const handleTogglePause = async () => {
    try {
      const isSyncing = syncing || connector.status === 'syncing';
      if (connector.status === 'paused') {
        // Resume — trigger immediate sync
        await syncSvc.resumeConnector(connector.id);
        toast.success(`Resumed: ${label}`);
      } else {
        // Pause — will also abort running sync if active
        await syncSvc.pauseConnector(connector.id);
        if (isSyncing) {
          setSyncing(false);
          setProgress(null);
          toast.success(`Sync cancelled: ${label}`);
        } else {
          toast.success(`Paused: ${label}`);
        }
      }
      onRefresh();
    } catch {
      toast.error('Operation failed');
    }
  };

  // Desconectar abre un diálogo que dice cuántos datos se lleva y ofrece la copia
  // (criterio I8-3). El `confirm()` de antes decía «esto dejará de sincronizar»,
  // que era verdad a medias: ni contaba los datos ni los retiraba.
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  // Quién autoriza esta integración lo DICE el catálogo (`oauth_provider` viaja
  // en el payload), no se adivina del nombre del tipo. La adivinanza era
  // exactamente el patrón frágil que INT61 mató del lado del servidor, reabierto
  // por esta punta: fallaba justo en `gmail` (no contiene «google») y obligaba a
  // tocar este fichero cada vez que se añadía un proveedor. La rama por prefijo
  // se conserva SOLO como respaldo de filas antiguas guardadas sin ese campo.
  const oauthProvider = connector.oauth_provider
    ?? (connector.connector_type.startsWith('google-') || connector.connector_type === 'gmail'
      ? 'google'
      : connector.connector_type.startsWith('microsoft-') || connector.connector_type === 'teams-observer'
        ? 'microsoft'
        : null);

  const handleRevokeOAuth = async () => {
    if (!oauthProvider) return;
    if (!confirm(`Revoke OAuth access for ${oauthProvider}? This will disconnect ALL ${oauthProvider} connectors.`)) return;
    try {
      await syncSvc.deleteOAuthCredentials(oauthProvider);
      toast.success(`OAuth access revoked for ${oauthProvider}`);
      onRefresh();
    } catch {
      toast.error('Failed to revoke OAuth access');
    }
  };

  const iconBtnStyle: React.CSSProperties = {
    background: 'none', border: 'none',
    color: 'var(--text-dim)', cursor: 'pointer',
    padding: 4, display: 'flex', borderRadius: 'var(--radius-sm)',
  };

  const avisos = avisosDeConector(connector);
  const estadoEscrituraTareas = taskWritePresentation(connector);

  return (
    <div
      data-connector-id={connector.id}
      data-provider={connector.provider_slug ?? undefined}
      style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 8,
      transition: 'border-color var(--transition-fast)',
      }}
    >
      {/* Top: icon + name + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ConnectorIcon
          type={connector.connector_type}
          providerSlug={connector.provider_slug}
          domains={connector.domains}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {label}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            {connector.domains.join(', ')}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: statusColor,
          }} />
          <span style={{ fontSize: '0.6875rem', color: statusColor, textTransform: 'capitalize' }}>
            {connector.status}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {syncing && progress && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{
            height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2, background: 'var(--amber)',
              width: progress.total ? `${Math.min(100, (progress.processed / progress.total) * 100)}%` : '50%',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
            {progress.phase ?? 'Syncing'}: {progress.processed}{progress.total ? `/${progress.total}` : ''}{progress.folder ? ` (${progress.folder})` : ''}
          </span>
        </div>
      )}

      {/* La causa del fallo, en el sitio donde el usuario ve el rojo. Antes la
          tarjeta se ponía en error y no decía nada: había que ir a la base de
          datos para saber si era la contraseña, el certificado o la red.

          Se enseñan DOS cosas distintas, y por eso la banda no cuelga solo del
          estado: (a) el `runSync` falló, y (b) el runSync fue bien pero un cambio
          TUYO no llegó al proveedor (INT78) — un correo que destacaste aquí y
          allí sigue sin marcar. El segundo caso deja la tarjeta en verde, así que
          condicionar la banda a `status==='error'` lo escondía por completo. */}
      {avisos.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 6,
          padding: '8px 10px', marginBottom: 8,
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.6875rem', color: 'var(--text-dim)', lineHeight: 1.5,
        }}>
          {avisos.map((aviso, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <TriangleAlert size={13} style={{ color: 'var(--error)', flexShrink: 0, marginTop: 1 }} />
              <span>{aviso}</span>
            </div>
          ))}
        </div>
      )}

      {estadoEscrituraTareas && (
        <div
          role="status"
          data-testid="task-write-status"
          style={{
            display: 'flex', flexDirection: 'column', gap: 3,
            padding: '7px 9px',
            background: 'var(--surface-raised, rgba(148, 163, 184, 0.08))',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.6875rem', color: 'var(--text-dim)', lineHeight: 1.45,
          }}
        >
          <span style={{ fontWeight: 600, color: estadoEscrituraTareas.color }}>
            {estadoEscrituraTareas.title}
          </span>
          <span>{estadoEscrituraTareas.pendingText}</span>
          {estadoEscrituraTareas.blocked && estadoEscrituraTareas.pendingCount > 0 && (
            <span>These changes will not be uploaded while writing is blocked.</span>
          )}
        </div>
      )}

      {/* Bottom: last sync + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          {syncing && !progress ? 'Syncing...' : `Last sync: ${timeAgo(connector.last_sync_at)}`}
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            onClick={handleSync}
            disabled={syncing || connector.status === 'syncing'}
            style={{ ...iconBtnStyle, opacity: syncing ? 0.5 : 1 }}
            title="Sync now"
          >
            {syncing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
          </button>
          <button
            onClick={handleTogglePause}
            style={{
              ...iconBtnStyle,
              color: (syncing || connector.status === 'syncing')
                ? 'var(--amber)'
                : connector.status === 'paused'
                  ? '#22c55e'
                  : 'var(--text-dim)',
            }}
            title={
              (syncing || connector.status === 'syncing')
                ? 'Stop sync'
                : connector.status === 'paused'
                  ? 'Resume'
                  : 'Pause'
            }
          >
            {connector.status === 'paused' ? <Play size={14} /> : <Pause size={14} />}
          </button>
          {onConfigure && (
            <button onClick={() => onConfigure(connector.id)} style={iconBtnStyle} title="Configure">
              <Settings size={14} />
            </button>
          )}
          {oauthProvider && (
            <button onClick={handleRevokeOAuth} style={{ ...iconBtnStyle, color: 'var(--warning, #f59e0b)' }} title={`Revoke ${oauthProvider} OAuth`}>
              <Unlink size={14} />
            </button>
          )}
          <button onClick={() => setDisconnectOpen(true)} style={{ ...iconBtnStyle, color: 'var(--error)' }} title="Disconnect">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <DisconnectDialog
        preserveNotes={connector.domains.includes('notes')}
        connectorId={connector.id}
        label={label}
        open={disconnectOpen}
        onClose={() => setDisconnectOpen(false)}
        onDisconnected={onRefresh}
      />
    </div>
  );
}

// Se re-exporta desde aquí porque había quien la importaba del componente.
export { avisosDeConector };
