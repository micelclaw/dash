import { useState } from 'react';
import { useBlockAllowLists } from '@micelclaw/mail-admin-ui';
import { Plus, Trash2, RefreshCw, Info, ShieldBan, ShieldCheck, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

const targetLabels: Record<string, string> = { email: 'Email', domain: 'Dominio', ip: 'IP' };
const targetColors: Record<string, string> = { email: '#3b82f6', domain: '#8b5cf6', ip: '#22c55e' };

export default function Antispam() {
  const { available, blockList, allowList, loading, error, refetch, addEntry, removeEntry } = useBlockAllowLists();

  const [blockForm, setBlockForm] = useState({ value: '', target: 'email' as 'email' | 'domain' | 'ip', comment: '' });
  const [allowForm, setAllowForm] = useState({ value: '', target: 'email' as 'email' | 'domain' | 'ip', comment: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const handleAdd = async (type: 'block' | 'allow') => {
    const form = type === 'block' ? blockForm : allowForm;
    if (!form.value.trim()) { toast.error('El valor es obligatorio'); return; }
    setSubmitting(true);
    try {
      await addEntry({ type, target: form.target, value: form.value.trim(), comment: form.comment.trim() });
      toast.success(`Entrada añadida a la lista de ${type === 'block' ? 'bloqueo' : 'permitidos'}`);
      if (type === 'block') setBlockForm({ value: '', target: 'email', comment: '' });
      else setAllowForm({ value: '', target: 'email', comment: '' });
      refetch();
    } catch {
      toast.error('Error al añadir la entrada');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeEntry(id);
      toast.success('Entrada eliminada');
      setDeleteConfirm(null);
      refetch();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', padding: '6px 10px',
    color: 'var(--text)', fontSize: '0.8125rem', outline: 'none',
    fontFamily: 'var(--font-sans)',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle, cursor: 'pointer',
  };

  const renderSection = (
    title: string,
    Icon: typeof ShieldBan,
    entries: typeof blockList,
    form: typeof blockForm,
    setForm: typeof setBlockForm,
    type: 'block' | 'allow',
  ) => (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 24,
    }}>
      {/* Section header */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Icon size={16} style={{ color: type === 'block' ? '#ef4444' : '#22c55e' }} />
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        <span style={{
          fontSize: '0.75rem', color: 'var(--text-muted)',
          background: 'var(--surface-hover)', padding: '2px 8px',
          borderRadius: 'var(--radius-md)', marginLeft: 'auto',
        }}>
          {entries.length}
        </span>
      </div>

      {/* Add form */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg)',
      }}>
        <input
          placeholder="Valor (email, dominio o IP)"
          value={form.value}
          onChange={e => setForm({ ...form, value: e.target.value })}
          style={{ ...inputStyle, flex: 1 }}
        />
        <select
          value={form.target}
          onChange={e => setForm({ ...form, target: e.target.value as 'email' | 'domain' | 'ip' })}
          style={selectStyle}
        >
          <option value="email">Email</option>
          <option value="domain">Dominio</option>
          <option value="ip">IP</option>
        </select>
        <input
          placeholder="Comentario (opcional)"
          value={form.comment}
          onChange={e => setForm({ ...form, comment: e.target.value })}
          style={{ ...inputStyle, width: 180 }}
        />
        <button
          onClick={() => handleAdd(type)}
          disabled={submitting}
          style={{
            background: 'var(--amber)', color: '#000', fontWeight: 600,
            border: 'none', borderRadius: 'var(--radius-md)',
            padding: '6px 14px', cursor: 'pointer', fontSize: '0.8125rem',
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: submitting ? 0.6 : 1,
          }}
        >
          <Plus size={14} />
          Añadir
        </button>
      </div>

      {/* Table header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 100px 1fr 60px',
        padding: '8px 20px', background: 'var(--surface)',
        fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500,
        textTransform: 'uppercase', letterSpacing: '0.04em',
        borderBottom: '1px solid var(--border)',
      }}>
        <span>Valor</span>
        <span>Tipo</span>
        <span>Comentario</span>
        <span />
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          No hay entradas
        </div>
      ) : (
        entries.map(entry => (
          <div
            key={entry.id}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 100px 1fr 60px',
              padding: '10px 20px', background: 'var(--card)',
              borderBottom: '1px solid var(--border)', fontSize: '0.8125rem',
              alignItems: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}
          >
            <span style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
              {entry.value}
            </span>
            <span>
              <span style={{
                background: `${targetColors[entry.target]}15`,
                color: targetColors[entry.target],
                fontSize: '0.6875rem', fontWeight: 500,
                padding: '2px 8px', borderRadius: 'var(--radius-md)',
              }}>
                {targetLabels[entry.target]}
              </span>
            </span>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
              {entry.comment || '-'}
            </span>
            <span style={{ textAlign: 'right' }}>
              {deleteConfirm === entry.id ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    style={{
                      background: '#ef4444', color: '#fff', border: 'none',
                      borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
                      fontSize: '0.6875rem',
                    }}
                  >
                    Si
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    style={{
                      background: 'transparent', color: 'var(--text-dim)',
                      border: '1px solid var(--border)', borderRadius: 4,
                      padding: '2px 8px', cursor: 'pointer', fontSize: '0.6875rem',
                    }}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(entry.id)}
                  style={{
                    background: 'transparent', border: 'none',
                    cursor: 'pointer', color: 'var(--text-muted)', padding: 4,
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </span>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 960, fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>
          Antispam
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

      {loading && !blockList.length && !allowList.length && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: 32, textAlign: 'center' }}>
          Cargando listas...
        </div>
      )}

      {error && !blockList.length && !allowList.length && (
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

      {renderSection('Lista de bloqueo', ShieldBan, blockList, blockForm, setBlockForm, 'block')}
      {renderSection('Lista de permitidos', ShieldCheck, allowList, allowForm, setAllowForm, 'allow')}
    </div>
  );
}
