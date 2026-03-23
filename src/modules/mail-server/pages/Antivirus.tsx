import { useState, useEffect } from 'react';
import { useMailServerApi } from '@micelclaw/mail-admin-ui';
import { Shield, CheckCircle, XCircle, Info } from 'lucide-react';

export default function Antivirus() {
  const api = useMailServerApi();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      setLoading(true);
      try {
        const data = await api.getStatus();
        setStatus(data);
        setError(null);
      } catch (e) {
        setError('No se pudo obtener el estado del antivirus');
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, []);

  const clamavRunning = status?.clamav === 'running' || status?.antivirus === 'running' || status?.clamav?.status === 'running';

  return (
    <div style={{ padding: 24, maxWidth: 960, fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>
          Antivirus
        </h1>
      </div>

      {loading && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: 32, textAlign: 'center' }}>
          Cargando estado...
        </div>
      )}

      {error && !loading && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: 24, display: 'flex',
          alignItems: 'center', gap: 12, color: 'var(--text-dim)', fontSize: '0.875rem',
        }}>
          <Info size={16} style={{ color: '#3b82f6' }} />
          {error}
        </div>
      )}

      {!loading && status && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 'var(--radius-md)',
              background: clamavRunning ? '#22c55e15' : '#ef444415',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shield size={24} style={{ color: clamavRunning ? '#22c55e' : '#ef4444' }} />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                ClamAV
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {clamavRunning ? (
                  <>
                    <CheckCircle size={14} style={{ color: '#22c55e' }} />
                    <span style={{ fontSize: '0.8125rem', color: '#22c55e', fontWeight: 500 }}>
                      Activo
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle size={14} style={{ color: '#ef4444' }} />
                    <span style={{ fontSize: '0.8125rem', color: '#ef4444', fontWeight: 500 }}>
                      Inactivo
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{
            marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)',
            fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.6,
          }}>
            ClamAV proporciona protección antivirus para los correos entrantes y salientes.
            Los correos con contenido malicioso se rechazan automáticamente.
          </div>
        </div>
      )}
    </div>
  );
}
