import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useMailServerApi } from '@micelclaw/mail-admin-ui';
import type { MailuDomain, MailuUser, MailuAlias, MailuRelay } from '@micelclaw/mail-admin-ui';
import { Globe, Inbox, ArrowRightLeft, Route, Plus, RefreshCw } from 'lucide-react';

export default function Dashboard() {
  const api = useMailServerApi();
  const navigate = useNavigate();

  const [domains, setDomains] = useState<MailuDomain[]>([]);
  const [users, setUsers] = useState<MailuUser[]>([]);
  const [aliases, setAliases] = useState<MailuAlias[]>([]);
  const [relays, setRelays] = useState<MailuRelay[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverStatus, setServerStatus] = useState<boolean | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [d, u, a, r] = await Promise.all([
        api.getDomains(),
        api.getUsers(),
        api.getAliases(),
        api.getRelays(),
      ]);
      setDomains(d);
      setUsers(u);
      setAliases(a);
      setRelays(r);
      setServerStatus(true);
    } catch {
      setServerStatus(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const stats = [
    { label: 'Dominios', count: domains.length, icon: Globe, color: 'var(--amber)' },
    { label: 'Buzones', count: users.length, icon: Inbox, color: '#3b82f6' },
    { label: 'Aliases', count: aliases.length, icon: ArrowRightLeft, color: '#8b5cf6' },
    { label: 'Relay', count: relays.length, icon: Route, color: '#22c55e' },
  ];

  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const recentDomains = domains.slice(0, 5);

  return (
    <div style={{ padding: 24, maxWidth: 960, fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>
          Mail Server
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={fetchAll}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.8125rem',
            }}
          >
            <RefreshCw size={14} />
            Actualizar
          </button>
          <button
            onClick={() => navigate('/mail-server/domains')}
            style={{
              background: 'var(--amber)',
              color: '#000',
              fontWeight: 600,
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '6px 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.8125rem',
            }}
          >
            <Plus size={14} />
            Nuevo dominio
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: 32, textAlign: 'center' }}>
          Cargando estadísticas...
        </div>
      ) : (
        <>
          {/* Server status */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 16px', marginBottom: 20,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: serverStatus === null ? 'var(--text-muted)' : serverStatus ? '#22c55e' : '#ef4444',
              boxShadow: serverStatus ? '0 0 6px rgba(34,197,94,0.4)' : serverStatus === false ? '0 0 6px rgba(239,68,68,0.4)' : 'none',
            }} />
            <span style={{
              fontSize: '0.8125rem', fontWeight: 500,
              color: serverStatus === null ? 'var(--text-muted)' : serverStatus ? '#22c55e' : '#ef4444',
            }}>
              {serverStatus === null ? 'Verificando...' : serverStatus ? 'Servidor operativo' : 'Servidor detenido'}
            </span>
          </div>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
            {stats.map((s, i) => {
              const Icon = s.icon;
              const isHovered = hoveredCard === i;
              return (
                <div
                  key={s.label}
                  onMouseEnter={() => setHoveredCard(i)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    background: 'var(--surface)',
                    border: `1px solid ${isHovered ? 'var(--amber)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-lg)',
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    transition: 'border-color 0.15s',
                    cursor: 'default',
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 'var(--radius-md)',
                    background: `${s.color}20`, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={18} style={{ color: s.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
                      {s.count}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', marginTop: 4 }}>
                      {s.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent domains */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
                Dominios recientes
              </span>
              <span style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                background: 'var(--surface-hover)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-md)',
              }}>
                Top 5
              </span>
            </div>

            {recentDomains.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                No hay dominios configurados
              </div>
            ) : (
              <div>
                {/* Header row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 120px',
                  padding: '8px 20px',
                  background: 'var(--surface)',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  fontWeight: 500,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.04em',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <span>Dominio</span>
                  <span style={{ textAlign: 'right' }}>Usuarios</span>
                  <span style={{ textAlign: 'right' }}>Max Aliases</span>
                </div>

                {recentDomains.map((d) => {
                  const domainUsers = users.filter(u => u.email.endsWith(`@${d.name}`));
                  return (
                    <div
                      key={d.name}
                      onClick={() => navigate(`/mail-server/domains/${d.name}`)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 120px 120px',
                        padding: '10px 20px',
                        background: 'var(--card)',
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}
                    >
                      <span style={{ color: 'var(--text)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
                        {d.name}
                      </span>
                      <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>
                        {domainUsers.length}
                      </span>
                      <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>
                        {d.max_aliases === -1 ? '∞' : d.max_aliases}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
