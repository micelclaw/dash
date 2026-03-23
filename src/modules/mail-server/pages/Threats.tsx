import { useRspamdStats } from '@micelclaw/mail-admin-ui';
import { RefreshCw, ScanSearch, Bug, ShieldCheck, GraduationCap, Info, WifiOff } from 'lucide-react';

const scoreColor = (score: number) =>
  score < 5 ? '#22c55e' : score <= 10 ? '#f97316' : '#ef4444';

const formatDate = (ts: number) => {
  const d = new Date(ts * 1000);
  return d.toLocaleString();
};

export default function Threats() {
  const { available, stats, history, loading, error, refetch } = useRspamdStats();

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

  const statCards = stats ? [
    { label: 'Escaneados', value: stats.scanned, icon: ScanSearch, color: '#3b82f6' },
    { label: 'Spam', value: stats.spam_count, icon: Bug, color: '#ef4444' },
    { label: 'Ham', value: stats.ham_count, icon: ShieldCheck, color: '#22c55e' },
    { label: 'Aprendidos', value: stats.learned, icon: GraduationCap, color: '#8b5cf6' },
  ] : [];

  const limitedHistory = (history || []).slice(0, 50);

  return (
    <div style={{ padding: 24, maxWidth: 1100, fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>
          Amenazas
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

      {loading && !stats && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: 32, textAlign: 'center' }}>
          Cargando estadísticas...
        </div>
      )}

      {error && !stats && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: 48, gap: 16,
        }}>
          <WifiOff size={36} style={{ color: 'var(--border)' }} />
          <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text)' }}>
            No se pudo conectar con el servicio de antispam
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Verifica que Rspamd está corriendo y accesible
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

      {stats && (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {statCards.map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: 16,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 'var(--radius-md)',
                    background: `${s.color}15`, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
                  }}>
                    <Icon size={16} style={{ color: s.color }} />
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
                    {s.value.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', marginTop: 4 }}>
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions breakdown */}
          {stats.actions && Object.keys(stats.actions).length > 0 && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 24,
            }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
                Acciones
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {Object.entries(stats.actions).map(([action, count]) => (
                  <div key={action} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--bg)', padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                  }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>{action}</span>
                    <span style={{
                      fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)',
                      background: 'var(--surface-hover)', padding: '1px 6px',
                      borderRadius: 'var(--radius-md)',
                    }}>
                      {(count as number).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History table */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
                Historial
              </span>
              <span style={{
                fontSize: '0.75rem', color: 'var(--text-muted)',
                background: 'var(--surface-hover)', padding: '2px 8px',
                borderRadius: 'var(--radius-md)',
              }}>
                {limitedHistory.length} entradas
              </span>
            </div>

            {/* Table header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '140px 1fr 1fr 1.5fr 70px 100px',
              padding: '8px 20px', background: 'var(--surface)',
              fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500,
              textTransform: 'uppercase', letterSpacing: '0.04em',
              borderBottom: '1px solid var(--border)',
            }}>
              <span>Fecha</span>
              <span>De</span>
              <span>Para</span>
              <span>Asunto</span>
              <span style={{ textAlign: 'right' }}>Score</span>
              <span style={{ textAlign: 'right' }}>Acción</span>
            </div>

            {limitedHistory.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                No hay historial
              </div>
            ) : (
              limitedHistory.map(entry => (
                <div
                  key={entry.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '140px 1fr 1fr 1.5fr 70px 100px',
                    padding: '10px 20px', background: 'var(--card)',
                    borderBottom: '1px solid var(--border)', fontSize: '0.8125rem',
                    alignItems: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}
                >
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {formatDate(entry.timestamp)}
                  </span>
                  <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.from}
                  </span>
                  <span style={{ color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.to}
                  </span>
                  <span style={{ color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.subject?.slice(0, 50)}{(entry.subject?.length || 0) > 50 ? '...' : ''}
                  </span>
                  <span style={{
                    textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem', color: scoreColor(entry.score),
                  }}>
                    {entry.score.toFixed(1)}
                  </span>
                  <span style={{
                    textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-dim)',
                  }}>
                    {entry.action}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
