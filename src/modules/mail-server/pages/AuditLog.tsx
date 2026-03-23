import { useState, useMemo } from 'react';
import { useRspamdStats } from '@micelclaw/mail-admin-ui';
import { RefreshCw, Info, Search, WifiOff } from 'lucide-react';

const scoreColor = (score: number) =>
  score < 5 ? '#22c55e' : score <= 10 ? '#f97316' : '#ef4444';

const formatDate = (ts: number) => new Date(ts * 1000).toLocaleString();
const toDateStr = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10);

export default function AuditLog() {
  const { available, history, loading, error, refetch } = useRspamdStats();
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const filtered = useMemo(() => {
    if (!history) return [];
    let items = history;

    if (filterFrom.trim()) {
      const q = filterFrom.trim().toLowerCase();
      items = items.filter(e => e.from?.toLowerCase().includes(q));
    }
    if (filterTo.trim()) {
      const q = filterTo.trim().toLowerCase();
      items = items.filter(e => e.to?.toLowerCase().includes(q));
    }
    if (dateStart) {
      const start = new Date(dateStart).getTime() / 1000;
      items = items.filter(e => e.timestamp >= start);
    }
    if (dateEnd) {
      const end = new Date(dateEnd + 'T23:59:59').getTime() / 1000;
      items = items.filter(e => e.timestamp <= end);
    }

    return items.slice(0, 100);
  }, [history, filterFrom, filterTo, dateStart, dateEnd]);

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

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', padding: '6px 10px',
    color: 'var(--text)', fontSize: '0.8125rem', outline: 'none',
    fontFamily: 'var(--font-sans)',
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>
          Auditoría
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

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16,
        padding: '12px 16px', background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
        flexWrap: 'wrap',
      }}>
        <Search size={14} style={{ color: 'var(--text-muted)' }} />
        <input
          placeholder="De (remitente)"
          value={filterFrom}
          onChange={e => setFilterFrom(e.target.value)}
          style={{ ...inputStyle, width: 180 }}
        />
        <input
          placeholder="Para (destinatario)"
          value={filterTo}
          onChange={e => setFilterTo(e.target.value)}
          style={{ ...inputStyle, width: 180 }}
        />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Desde:</span>
        <input
          type="date"
          value={dateStart}
          onChange={e => setDateStart(e.target.value)}
          style={{ ...inputStyle, width: 140 }}
        />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hasta:</span>
        <input
          type="date"
          value={dateEnd}
          onChange={e => setDateEnd(e.target.value)}
          style={{ ...inputStyle, width: 140 }}
        />
        {(filterFrom || filterTo || dateStart || dateEnd) && (
          <button
            onClick={() => { setFilterFrom(''); setFilterTo(''); setDateStart(''); setDateEnd(''); }}
            style={{
              background: 'transparent', color: 'var(--text-dim)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              padding: '6px 14px', cursor: 'pointer', fontSize: '0.8125rem',
            }}
          >
            Limpiar
          </button>
        )}
      </div>

      {loading && (!history || history.length === 0) && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: 32, textAlign: 'center' }}>
          Cargando historial...
        </div>
      )}

      {error && (!history || history.length === 0) && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: 48, gap: 16,
        }}>
          <WifiOff size={36} style={{ color: 'var(--border)' }} />
          <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text)' }}>
            No se pudo cargar el historial
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            La consulta tardó demasiado. Prueba con un rango de fechas más corto
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

      {/* Table */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', overflow: 'hidden',
      }}>
        {/* Header */}
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

        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            No hay entradas que coincidan con los filtros
          </div>
        ) : (
          filtered.map(entry => (
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
                {entry.subject}
              </span>
              <span style={{
                textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem', color: scoreColor(entry.score),
              }}>
                {entry.score.toFixed(1)}
              </span>
              <span style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                {entry.action}
              </span>
            </div>
          ))
        )}

        {/* Count footer */}
        <div style={{
          padding: '8px 20px', fontSize: '0.75rem', color: 'var(--text-muted)',
          borderTop: '1px solid var(--border)', textAlign: 'right',
        }}>
          {filtered.length} de {history?.length || 0} entradas
        </div>
      </div>
    </div>
  );
}
