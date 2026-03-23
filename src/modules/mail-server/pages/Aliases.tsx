import { useState, useEffect } from 'react';
import { useMailServerApi } from '@micelclaw/mail-admin-ui';
import type { MailuAlias } from '@micelclaw/mail-admin-ui';
import { ArrowRightLeft, Plus, RefreshCw, Trash2, X, Pencil } from 'lucide-react';
import { toast } from 'sonner';

export default function Aliases() {
  const api = useMailServerApi();

  const [aliases, setAliases] = useState<MailuAlias[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<MailuAlias | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Form state (shared create/edit)
  const [formEmail, setFormEmail] = useState('');
  const [formDest, setFormDest] = useState('');
  const [formWildcard, setFormWildcard] = useState(false);
  const [formComment, setFormComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAliases = async () => {
    setLoading(true);
    try {
      setAliases(await api.getAliases());
    } catch {
      toast.error('Error cargando aliases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAliases(); }, []);

  const resetForm = () => {
    setFormEmail('');
    setFormDest('');
    setFormWildcard(false);
    setFormComment('');
  };

  const openCreate = () => {
    resetForm();
    setEditTarget(null);
    setShowCreate(true);
  };

  const openEdit = (a: MailuAlias) => {
    setFormEmail(a.email);
    setFormDest(a.destination.join(', '));
    setFormWildcard(a.wildcard);
    setFormComment(a.comment);
    setEditTarget(a);
    setShowCreate(true);
  };

  const handleSubmit = async () => {
    if (!formEmail.trim() || !formDest.trim()) return;
    setSubmitting(true);
    const destination = formDest.split(',').map(s => s.trim()).filter(Boolean);
    try {
      if (editTarget) {
        await api.updateAlias(editTarget.email, {
          destination,
          wildcard: formWildcard,
          comment: formComment,
        });
        toast.success('Alias actualizado');
      } else {
        await api.createAlias({
          email: formEmail.trim(),
          destination,
          wildcard: formWildcard,
          comment: formComment,
        });
        toast.success(`Alias ${formEmail} creado`);
      }
      setShowCreate(false);
      resetForm();
      setEditTarget(null);
      fetchAliases();
    } catch {
      toast.error(editTarget ? 'Error actualizando alias' : 'Error creando alias');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteAlias(deleteTarget);
      toast.success(`Alias ${deleteTarget} eliminado`);
      setDeleteTarget(null);
      fetchAliases();
    } catch {
      toast.error('Error eliminando alias');
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
          <ArrowRightLeft size={18} style={{ color: 'var(--amber)' }} />
          <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>
            Aliases
          </h1>
          <span style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            background: 'var(--surface-hover)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-md)',
          }}>
            {aliases.length}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={fetchAliases}
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
            onClick={openCreate}
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
            Nuevo alias
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
          gridTemplateColumns: '1fr 1.5fr 80px 1fr 70px',
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
          <span>Destino</span>
          <span style={{ textAlign: 'center' }}>Wildcard</span>
          <span>Comentario</span>
          <span />
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            Cargando...
          </div>
        ) : aliases.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            No hay aliases configurados
          </div>
        ) : (
          aliases.map((a) => (
            <div
              key={a.email}
              onMouseEnter={() => setHoveredRow(a.email)}
              onMouseLeave={() => setHoveredRow(null)}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.5fr 80px 1fr 70px',
                padding: '10px 16px',
                background: hoveredRow === a.email ? 'var(--surface-hover)' : 'var(--card)',
                borderBottom: '1px solid var(--border)',
                fontSize: '0.8125rem',
                alignItems: 'center',
                transition: 'background 0.1s',
              }}
            >
              <span style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                {a.email}
              </span>
              <span style={{ color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.destination.join(', ')}
              </span>
              <span style={{ textAlign: 'center' }}>
                {a.wildcard && (
                  <span style={{
                    background: 'var(--amber)',
                    color: '#000',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-md)',
                  }}>
                    Wildcard
                  </span>
                )}
              </span>
              <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.comment || '—'}
              </span>
              <span style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(a); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(a.email); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit dialog */}
      {showCreate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { setShowCreate(false); setEditTarget(null); }}
        >
          <div
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, width: 440, maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
                {editTarget ? 'Editar alias' : 'Nuevo alias'}
              </h2>
              <button
                onClick={() => { setShowCreate(false); setEditTarget(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Email del alias</label>
                <input
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="alias@dominio.com"
                  disabled={!!editTarget}
                  style={{ ...inputStyle, opacity: editTarget ? 0.6 : 1 }}
                />
              </div>
              <div>
                <label style={labelStyle}>Destino (separar con coma)</label>
                <input
                  value={formDest}
                  onChange={(e) => setFormDest(e.target.value)}
                  placeholder="user1@dominio.com, user2@dominio.com"
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={formWildcard}
                  onChange={(e) => setFormWildcard(e.target.checked)}
                  style={{ accentColor: 'var(--amber)' }}
                />
                <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Wildcard</span>
              </div>
              <div>
                <label style={labelStyle}>Comentario</label>
                <input
                  value={formComment}
                  onChange={(e) => setFormComment(e.target.value)}
                  placeholder="Descripción opcional"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button
                onClick={() => { setShowCreate(false); setEditTarget(null); }}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '6px 14px', cursor: 'pointer', color: 'var(--text-dim)', fontSize: '0.8125rem' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !formEmail.trim() || !formDest.trim()}
                style={{
                  background: 'var(--amber)',
                  color: '#000',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 14px',
                  cursor: submitting ? 'wait' : 'pointer',
                  fontSize: '0.8125rem',
                  opacity: submitting || !formEmail.trim() || !formDest.trim() ? 0.6 : 1,
                }}
              >
                {submitting ? 'Guardando...' : editTarget ? 'Actualizar' : 'Crear alias'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, width: 380, maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
              Eliminar alias
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
              ¿Eliminar el alias <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{deleteTarget}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '6px 14px', cursor: 'pointer', color: 'var(--text-dim)', fontSize: '0.8125rem' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                style={{ background: '#ef4444', color: '#fff', fontWeight: 600, border: 'none', borderRadius: 'var(--radius-md)', padding: '6px 14px', cursor: 'pointer', fontSize: '0.8125rem' }}
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
