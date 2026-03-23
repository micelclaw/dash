import { useMonitoring } from '@micelclaw/mail-admin-ui';
import { RefreshCw, Send, Inbox, XCircle, Clock, Wifi, Timer, Info, WifiOff } from 'lucide-react';

const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
};

export default function MonitoringOverview() {
  const { available, overview, loading, error, refetch } = useMonitoring();

  if (!available) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: 24, display: 'flex',
          alignItems: 'center', gap: 12, color: 'var(--text-dim)', fontSize: '0.875rem',
        }}>
          <Info size={16} style={{ color: '#3b82f6' }} />
          Esta funcionalidad requiere Claw Core
        </div>
      </div>
    );
  }

  const cards = overview ? [
    {
      label: 'Enviados hoy', value: overview.emails_sent_today,
      icon: Send, color: '#3b82f6', valueColor: undefined,
    },
    {
      label: 'Recibidos hoy', value: overview.emails_received_today,
      icon: Inbox, color: '#8b5cf6', valueColor: undefined,
    },
    {
      label: 'Rechazados hoy', value: overview.emails_rejected_today,
      icon: XCircle, color: '#ef4444',
      valueColor: overview.emails_rejected_today > 0 ? '#ef4444' : undefined,
    },
    {
      label: 'Cola', value: overview.queue_size,
      icon: Clock, color: 'var(--amber)',
      valueColor: overview.queue_size > 0 ? '#f97316' : undefined,
    },
    {
      label: 'Conexiones activas', value: overview.active_connections,
      icon: Wifi, color: '#22c55e', valueColor: undefined,
    },
    {
      label: 'Uptime', value: formatUptime(overview.uptime_seconds),
      icon: Timer, color: 'var(--text-dim)', valueColor: undefined, isString: true,
    },
  ] : [];

  return (
    <div style={{ padding: 24, maxWidth: 960, fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>
          Monitorización
        </h1>
        <button
          onClick={() => refetch()}
          style={{
            background: 'transparent', color: 'var(--text-dim)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            padding: '6px 14px', cursor: 'pointer', fontSize: '0.8125rem',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      {loading && !overview && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: 32, textAlign: 'center' }}>
          Cargando datos...
        </div>
      )}

      {error && !overview && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: 48, gap: 16,
        }}>
          <WifiOff size={36} style={{ color: 'var(--border)' }} />
          <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text)' }}>
            No se pudieron obtener las métricas del servidor
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Verifica que el servicio de monitorización está activo
          </div>
          <button
            onClick={() => refetch()}
            style={{
              background: 'var(--amber)', color: '#000', fontWeight: 600,
              border: 'none', borderRadius: 'var(--radius-md)',
              padding: '6px 14px', cursor: 'pointer', fontSize: '0.8125rem',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      )}

      {overview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {cards.map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: 20,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-md)',
                  background: `${typeof card.color === 'string' && card.color.startsWith('#') ? card.color : 'var(--amber)'}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 12,
                }}>
                  <Icon size={18} style={{ color: card.color }} />
                </div>
                <div style={{
                  fontSize: '1.75rem', fontWeight: 700, lineHeight: 1,
                  color: card.valueColor || 'var(--text)',
                }}>
                  {card.value}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', marginTop: 4 }}>
                  {card.label}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
