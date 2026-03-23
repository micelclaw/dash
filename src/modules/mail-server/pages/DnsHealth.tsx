import { useState } from 'react';
import { useDnsHealth } from '@micelclaw/mail-admin-ui';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Copy, Info } from 'lucide-react';
import { toast } from 'sonner';

const RECORD_TYPES = ['mx', 'spf', 'dkim', 'dmarc', 'ptr', 'autoconfig'] as const;
const RECORD_LABELS: Record<string, string> = {
  mx: 'MX', spf: 'SPF', dkim: 'DKIM', dmarc: 'DMARC', ptr: 'PTR', autoconfig: 'Autoconfig',
};

const statusColor = (s: string) =>
  s === 'ok' ? '#22c55e' : s === 'warning' ? '#f97316' : '#ef4444';

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'ok') return <CheckCircle size={14} style={{ color: '#22c55e' }} />;
  if (status === 'warning') return <AlertTriangle size={14} style={{ color: '#f97316' }} />;
  return <XCircle size={14} style={{ color: '#ef4444' }} />;
};

const scoreBadgeColor = (score: number) =>
  score === 6 ? '#22c55e' : score >= 3 ? 'var(--amber)' : '#ef4444';

export default function DnsHealth() {
  const { available, result, loading, error, forceCheck } = useDnsHealth();
  const [checking, setChecking] = useState(false);

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

  const handleCheck = async () => {
    setChecking(true);
    try {
      await forceCheck();
      toast.success('Comprobación DNS completada');
    } catch {
      toast.error('Error al comprobar DNS');
    } finally {
      setChecking(false);
    }
  };

  const copyExpected = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success('Copiado al portapapeles');
  };

  return (
    <div style={{ padding: 24, maxWidth: 960, fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>
            DNS Health
          </h1>
          {result && (
            <span style={{
              background: `${scoreBadgeColor(result.overall_score)}20`,
              color: scoreBadgeColor(result.overall_score),
              fontWeight: 600, fontSize: '0.75rem',
              padding: '2px 10px', borderRadius: 'var(--radius-md)',
            }}>
              {result.overall_score}/6
            </span>
          )}
        </div>
        <button
          onClick={handleCheck}
          disabled={checking}
          style={{
            background: 'var(--amber)', color: '#000', fontWeight: 600,
            border: 'none', borderRadius: 'var(--radius-md)',
            padding: '6px 14px', cursor: 'pointer', fontSize: '0.8125rem',
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: checking ? 0.6 : 1,
          }}
        >
          <RefreshCw size={14} style={checking ? { animation: 'spin 1s linear infinite' } : undefined} />
          Comprobar ahora
        </button>
      </div>

      {loading && !result && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: 32, textAlign: 'center' }}>
          Cargando resultados DNS...
        </div>
      )}

      {error && (
        <div style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: 16 }}>
          Error: {String(error)}
        </div>
      )}

      {result && (
        <>
          {/* Domain */}
          <div style={{ fontSize: '0.875rem', color: 'var(--text-dim)', marginBottom: 16 }}>
            Dominio: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{result.domain}</span>
          </div>

          {/* Record cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {RECORD_TYPES.map((key) => {
              // Resilient access: try multiple key patterns since Core may return different structures
              const r = result as any;
              const record = r[key] ?? r[`dns_${key}`] ?? r.checks?.[key] ?? r.records?.[key] ?? null;
              if (!record || typeof record !== 'object' || !record.status) return null;
              return (
                <div key={key} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: 16,
                }}>
                  {/* Card header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
                      {RECORD_LABELS[key]}
                    </span>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: `${statusColor(record.status)}15`,
                      color: statusColor(record.status),
                      fontSize: '0.75rem', fontWeight: 500,
                      padding: '2px 8px', borderRadius: 'var(--radius-md)',
                    }}>
                      <StatusIcon status={record.status} />
                      {record.status === 'ok' ? 'OK' : record.status === 'warning' ? 'Advertencia' : 'Error'}
                    </div>
                  </div>

                  {/* Expected */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Esperado
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <code style={{
                        fontSize: '0.75rem', fontFamily: 'var(--font-mono)',
                        color: 'var(--text)', background: 'var(--bg)',
                        padding: '4px 8px', borderRadius: 4, flex: 1,
                        wordBreak: 'break-all',
                      }}>
                        {record.expected}
                      </code>
                      <button
                        onClick={() => copyExpected(record.expected)}
                        style={{
                          background: 'transparent', border: 'none',
                          cursor: 'pointer', color: 'var(--text-muted)', padding: 4,
                          borderRadius: 4, flexShrink: 0,
                        }}
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Actual */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Actual
                    </div>
                    <code style={{
                      fontSize: '0.75rem', fontFamily: 'var(--font-mono)',
                      color: record.actual ? 'var(--text)' : 'var(--text-muted)',
                      background: 'var(--bg)', padding: '4px 8px',
                      borderRadius: 4, display: 'block', wordBreak: 'break-all',
                    }}>
                      {record.actual || 'No encontrado'}
                    </code>
                  </div>

                  {/* Hint */}
                  {record.hint && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.5 }}>
                      {record.hint}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Checked at */}
          {result.checked_at && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
              Última comprobación: {new Date(result.checked_at).toLocaleString()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
