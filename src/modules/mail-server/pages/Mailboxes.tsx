import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useMailServerApi } from '@micelclaw/mail-admin-ui';
import type { MailuUser, MailuDomain } from '@micelclaw/mail-admin-ui';
import { Inbox, Plus, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function Mailboxes() {
  const api = useMailServerApi();
  const navigate = useNavigate();

  const [users, setUsers] = useState<MailuUser[]>([]);
  const [domains, setDomains] = useState<MailuDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDomain, setFilterDomain] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Create form
  const [formPrefix, setFormPrefix] = useState('');
  const [formDomain, setFormDomain] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formQuota, setFormQuota] = useState(0);
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [u, d] = await Promise.all([api.getUsers(), api.getDomains()]);
      setUsers(u);
      setDomains(d);
      if (d.length > 0 && !formDomain) setFormDomain(d[0].name);
    } catch {
      toast.error('Error cargando buzones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredUsers = filterDomain
    ? users.filter(u => u.email.endsWith(`@${filterDomain}`))
    : users;

  const handleCreate = async () => {
    const email = `${formPrefix.trim()}@${formDomain}`;
    if (!formPrefix.trim() || !formDomain || !formPassword) return;
    setCreating(true);
    try {
      await api.createUser({
        email,
        raw_password: formPassword,
        displayed_name: formName,
        quota_bytes: formQuota,
      });
      toast.success(`Buzón ${email} creado`);
      setShowCreate(false);
      setFormPrefix('');
      setFormPassword('');
      setFormName('');
      setFormQuota(0);
      fetchData();
    } catch {
      toast.error('Error creando buzón');
    } finally {
      setCreating(false);
    }
  };

  const getQuotaPercent = (used: number, total: number): number => {
    if (total <= 0) return 0;
    return Math.min(100, Math.round((used / total) * 100));
  };

  const getQuotaColor = (percent: number): string => {
    if (percent >= 90) return '#ef4444';
    if (percent >= 70) return 'var(--amber)';
    return '#22c55e';
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 12px',
    color: 'var(--text)',
    fontSize: '0.8125rem',
    fontFamily: 'var(--font-sans)',
    width: '100%',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'var(--text-dim)',
    marginBottom: 4,
    display: 'block',
  };

  return (
    <div style={{ padding: 24, maxWidth: 960, fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Inbox size={18} style={{ color: 'var(--amber)' }} />
          <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>
            Buzones
          </h1>
          <span style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            background: 'var(--surface-hover)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-md)',
          }}>
            {filteredUsers.length}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={filterDomain}
            onChange={(e) => setFilterDomain(e.target.value)}
            style={{
              ...inputStyle,
              width: 'auto',
              minWidth: 140,
              cursor: 'pointer',
            }}
          >
            <option value="">Todos los dominios</option>
            {domains.map(d => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </select>
          <button
            onClick={fetchData}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              display: 'flex',
              alignItems: 'center',
              fontSize: '0.8125rem',
            }}
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
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
            Nuevo buzón
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 160px 60px 100px',
          padding: '8px 16px',
          background: 'var(--surface)',
          fontSize: '0.75rem',
          fontWeight: 500,
          color: 'var(--text-muted)',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.04em',
          borderBottom: '1px solid var(--border)',
        }}>
          <span>Email</span>
          <span>Nombre</span>
          <span>Quota</span>
          <span style={{ textAlign: 'center' }}>Estado</span>
          <span style={{ textAlign: 'center' }}>Protocolos</span>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            Cargando...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            No hay buzones
          </div>
        ) : (
          filteredUsers.map((u) => {
            const pct = getQuotaPercent(u.quota_bytes_used, u.quota_bytes);
            const barColor = getQuotaColor(pct);
            return (
              <div
                key={u.email}
                onMouseEnter={() => setHoveredRow(u.email)}
                onMouseLeave={() => setHoveredRow(null)}
                onClick={() => navigate(`/mail-server/mailboxes/${encodeURIComponent(u.email)}`)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 160px 60px 100px',
                  padding: '10px 16px',
                  background: hoveredRow === u.email ? 'var(--surface-hover)' : 'var(--card)',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  alignItems: 'center',
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                  {u.email}
                </span>
                <span style={{ color: 'var(--text-dim)' }}>
                  {u.displayed_name || '—'}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{
                    height: 6,
                    background: 'var(--bg)',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: barColor,
                      borderRadius: 3,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    {formatBytes(u.quota_bytes_used)} / {u.quota_bytes > 0 ? formatBytes(u.quota_bytes) : '∞'}
                  </span>
                </span>
                <span style={{ textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: u.enabled ? '#22c55e' : '#ef4444',
                  }} />
                </span>
                <span style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                  {u.enable_imap && (
                    <span style={{
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      padding: '1px 5px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--surface-hover)',
                      color: 'var(--text-dim)',
                    }}>
                      IMAP
                    </span>
                  )}
                  {u.enable_pop && (
                    <span style={{
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      padding: '1px 5px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--surface-hover)',
                      color: 'var(--text-dim)',
                    }}>
                      POP
                    </span>
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Create dialog */}
      {showCreate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setShowCreate(false)}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              width: 440,
              maxWidth: '90vw',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>Nuevo buzón</h2>
              <button
                onClick={() => setShowCreate(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Email</label>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    value={formPrefix}
                    onChange={(e) => setFormPrefix(e.target.value)}
                    placeholder="usuario"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.875rem', fontWeight: 600 }}>@</span>
                  <select
                    value={formDomain}
                    onChange={(e) => setFormDomain(e.target.value)}
                    style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}
                  >
                    {domains.map(d => (
                      <option key={d.name} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Contraseña</label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Nombre visible</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Juan Pérez"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Quota (bytes, 0 = ilimitado)</label>
                <input
                  type="number"
                  value={formQuota}
                  onChange={(e) => setFormQuota(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button
                onClick={() => setShowCreate(false)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 14px',
                  cursor: 'pointer',
                  color: 'var(--text-dim)',
                  fontSize: '0.8125rem',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !formPrefix.trim() || !formPassword}
                style={{
                  background: 'var(--amber)',
                  color: '#000',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 14px',
                  cursor: creating ? 'wait' : 'pointer',
                  fontSize: '0.8125rem',
                  opacity: creating || !formPrefix.trim() || !formPassword ? 0.6 : 1,
                }}
              >
                {creating ? 'Creando...' : 'Crear buzón'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
