import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useMailServerApi } from '@micelclaw/mail-admin-ui';
import type { MailuDomain } from '@micelclaw/mail-admin-ui';
import { Globe, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

export default function Domains() {
  const api = useMailServerApi();
  const navigate = useNavigate();

  const [domains, setDomains] = useState<MailuDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Create form
  const [formName, setFormName] = useState('');
  const [formMaxUsers, setFormMaxUsers] = useState(-1);
  const [formMaxAliases, setFormMaxAliases] = useState(-1);
  const [formSignup, setFormSignup] = useState(false);
  const [formComment, setFormComment] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchDomains = async () => {
    setLoading(true);
    try {
      setDomains(await api.getDomains());
    } catch {
      toast.error('Error cargando dominios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDomains(); }, []);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setCreating(true);
    try {
      await api.createDomain({
        name: formName.trim(),
        max_users: formMaxUsers,
        max_aliases: formMaxAliases,
        signup_enabled: formSignup,
        comment: formComment,
      });
      toast.success(`Dominio ${formName} creado`);
      setShowCreate(false);
      setFormName('');
      setFormMaxUsers(-1);
      setFormMaxAliases(-1);
      setFormSignup(false);
      setFormComment('');
      fetchDomains();
    } catch {
      toast.error('Error creando dominio');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteDomain(deleteTarget);
      toast.success(`Dominio ${deleteTarget} eliminado`);
      setDeleteTarget(null);
      fetchDomains();
    } catch {
      toast.error('Error eliminando dominio');
    }
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
          <Globe size={18} style={{ color: 'var(--amber)' }} />
          <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>
            Dominios
          </h1>
          <span style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            background: 'var(--surface-hover)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-md)',
          }}>
            {domains.length}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={fetchDomains}
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
            Nuevo dominio
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
        {/* Header row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 100px 100px 80px 1fr 50px',
          padding: '8px 16px',
          background: 'var(--surface)',
          fontSize: '0.75rem',
          fontWeight: 500,
          color: 'var(--text-muted)',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.04em',
          borderBottom: '1px solid var(--border)',
        }}>
          <span>Nombre</span>
          <span style={{ textAlign: 'right' }}>Max Users</span>
          <span style={{ textAlign: 'right' }}>Max Aliases</span>
          <span style={{ textAlign: 'center' }}>Signup</span>
          <span>Comentario</span>
          <span />
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            Cargando...
          </div>
        ) : domains.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            No hay dominios configurados
          </div>
        ) : (
          domains.map((d) => (
            <div
              key={d.name}
              onMouseEnter={() => setHoveredRow(d.name)}
              onMouseLeave={() => setHoveredRow(null)}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px 100px 80px 1fr 50px',
                padding: '10px 16px',
                background: hoveredRow === d.name ? 'var(--surface-hover)' : 'var(--card)',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                alignItems: 'center',
                transition: 'background 0.1s',
              }}
              onClick={() => navigate(`/mail-server/domains/${d.name}`)}
            >
              <span style={{ color: 'var(--text)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
                {d.name}
              </span>
              <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>
                {d.max_users === -1 ? '∞' : d.max_users}
              </span>
              <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>
                {d.max_aliases === -1 ? '∞' : d.max_aliases}
              </span>
              <span style={{ textAlign: 'center' }}>
                <span style={{
                  fontSize: '0.6875rem', fontWeight: 500,
                  padding: '2px 8px', borderRadius: 'var(--radius-md)',
                  background: d.signup_enabled ? '#22c55e15' : '#ef444415',
                  color: d.signup_enabled ? '#22c55e' : '#ef4444',
                }}>
                  {d.signup_enabled ? 'Sí' : 'No'}
                </span>
              </span>
              <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.comment || '—'}
              </span>
              <span
                style={{ display: 'flex', justifyContent: 'flex-end' }}
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(d.name); }}
              >
                <Trash2 size={14} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} />
              </span>
            </div>
          ))
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
              width: 420,
              maxWidth: '90vw',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>Nuevo dominio</h2>
              <button
                onClick={() => setShowCreate(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nombre del dominio</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="ejemplo.com"
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Max usuarios (-1 = ilimitado)</label>
                  <input
                    type="number"
                    value={formMaxUsers}
                    onChange={(e) => setFormMaxUsers(Number(e.target.value))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Max aliases (-1 = ilimitado)</label>
                  <input
                    type="number"
                    value={formMaxAliases}
                    onChange={(e) => setFormMaxAliases(Number(e.target.value))}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={formSignup}
                  onChange={(e) => setFormSignup(e.target.checked)}
                  style={{ accentColor: 'var(--amber)' }}
                />
                <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Habilitar signup</span>
              </div>
              <div>
                <label style={labelStyle}>Comentario</label>
                <textarea
                  value={formComment}
                  onChange={(e) => setFormComment(e.target.value)}
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
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
                disabled={creating || !formName.trim()}
                style={{
                  background: 'var(--amber)',
                  color: '#000',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 14px',
                  cursor: creating ? 'wait' : 'pointer',
                  fontSize: '0.8125rem',
                  opacity: creating || !formName.trim() ? 0.6 : 1,
                }}
              >
                {creating ? 'Creando...' : 'Crear dominio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
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
          onClick={() => setDeleteTarget(null)}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              width: 380,
              maxWidth: '90vw',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
              Eliminar dominio
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
              ¿Estás seguro de que quieres eliminar <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{deleteTarget}</strong>?
              Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setDeleteTarget(null)}
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
                onClick={handleDelete}
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 14px',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
