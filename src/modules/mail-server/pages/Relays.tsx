import { useCallback, useEffect, useState } from 'react';
import { useMailServerApi, type MailuRelay } from '@micelclaw/mail-admin-ui';
import { toast } from 'sonner';
import { Network, Plus, Pencil, Trash2, X, Server } from 'lucide-react';

const primaryBtn: React.CSSProperties = {
  background: 'var(--amber)',
  color: '#000',
  fontWeight: 600,
  border: 'none',
  borderRadius: 'var(--radius-md)',
  padding: '6px 14px',
  cursor: 'pointer',
  fontSize: '0.8125rem',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '8px 12px',
  fontSize: '0.875rem',
  width: '100%',
  outline: 'none',
};

interface RelayDialogProps {
  relay?: MailuRelay | null;
  onClose: () => void;
  onSave: (data: { name: string; smtp: string; comment: string }) => void;
  saving: boolean;
}

function RelayDialog({ relay, onClose, onSave, saving }: RelayDialogProps) {
  const [name, setName] = useState(relay?.name ?? '');
  const [smtp, setSmtp] = useState(relay?.smtp ?? '');
  const [comment, setComment] = useState(relay?.comment ?? '');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: 24,
          width: 420,
          maxWidth: '90vw',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '1rem' }}>
            {relay ? 'Editar relay' : 'Nuevo relay'}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ color: 'var(--text-dim)', fontSize: '0.8125rem', marginBottom: 4, display: 'block' }}>
              Nombre del dominio
            </label>
            <input
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="example.com"
              disabled={!!relay}
            />
          </div>
          <div>
            <label style={{ color: 'var(--text-dim)', fontSize: '0.8125rem', marginBottom: 4, display: 'block' }}>
              Servidor SMTP (host:port)
            </label>
            <input
              style={inputStyle}
              value={smtp}
              onChange={(e) => setSmtp(e.target.value)}
              placeholder="smtp.example.com:25"
            />
          </div>
          <div>
            <label style={{ color: 'var(--text-dim)', fontSize: '0.8125rem', marginBottom: 4, display: 'block' }}>
              Comentario
            </label>
            <input
              style={inputStyle}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                color: 'var(--text-dim)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 14px',
                cursor: 'pointer',
                fontSize: '0.8125rem',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={() => onSave({ name, smtp, comment })}
              disabled={saving || !name || !smtp}
              style={{
                ...primaryBtn,
                opacity: saving || !name || !smtp ? 0.5 : 1,
              }}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Relays() {
  const api = useMailServerApi();
  const [relays, setRelays] = useState<MailuRelay[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRelay, setEditRelay] = useState<MailuRelay | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchRelays = useCallback(async () => {
    try {
      const data = await api.getRelays();
      setRelays(data);
    } catch {
      toast.error('Error al cargar los relays');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchRelays();
  }, [fetchRelays]);

  const handleSave = async (data: { name: string; smtp: string; comment: string }) => {
    setSaving(true);
    try {
      if (editRelay) {
        await api.updateRelay(editRelay.name, { smtp: data.smtp, comment: data.comment });
        toast.success('Relay actualizado');
      } else {
        await api.createRelay(data);
        toast.success('Relay creado');
      }
      setDialogOpen(false);
      setEditRelay(null);
      fetchRelays();
    } catch {
      toast.error('Error al guardar el relay');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await api.deleteRelay(name);
      toast.success('Relay eliminado');
      setConfirmDeleteId(null);
      fetchRelays();
    } catch {
      toast.error('Error al eliminar el relay');
    }
  };

  const gridColumns = '1fr 1fr 1fr 140px';

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '1.125rem' }}>Dominios Relay</span>
          {!loading && (
            <span
              style={{
                background: 'var(--surface)',
                color: 'var(--text-dim)',
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
              }}
            >
              {relays.length}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            setEditRelay(null);
            setDialogOpen(true);
          }}
          style={primaryBtn}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Nuevo relay
          </span>
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-dim)', padding: 40, textAlign: 'center' }}>Cargando...</div>
      ) : relays.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 60,
            color: 'var(--text-muted)',
            gap: 12,
          }}
        >
          <Network size={40} />
          <span style={{ fontSize: '0.9375rem' }}>No hay dominios relay configurados</span>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          {/* Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: gridColumns,
              background: 'var(--surface)',
              padding: '10px 16px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            <span>Nombre</span>
            <span>Servidor SMTP</span>
            <span>Comentario</span>
            <span>Acciones</span>
          </div>
          {/* Rows */}
          {relays.map((relay) => (
            <div
              key={relay.name}
              style={{
                display: 'grid',
                gridTemplateColumns: gridColumns,
                padding: '12px 16px',
                background: 'var(--card)',
                borderTop: '1px solid var(--border)',
                alignItems: 'center',
                fontSize: '0.875rem',
                color: 'var(--text)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--card)')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Server size={14} style={{ color: 'var(--text-dim)' }} />
                {relay.name}
              </span>
              <span style={{ color: 'var(--text-dim)' }}>{relay.smtp}</span>
              <span style={{ color: 'var(--text-muted)' }}>{relay.comment || '—'}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {confirmDeleteId === relay.name ? (
                  <>
                    <button
                      onClick={() => handleDelete(relay.name)}
                      style={{
                        background: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        padding: '4px 10px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      style={{
                        background: 'transparent',
                        color: 'var(--text-dim)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '4px 10px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                      }}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditRelay(relay);
                        setDialogOpen(true);
                      }}
                      style={{
                        background: 'transparent',
                        color: 'var(--text-dim)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '4px 8px',
                        cursor: 'pointer',
                      }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(relay.name)}
                      style={{
                        background: 'transparent',
                        color: '#ef4444',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '4px 8px',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {dialogOpen && (
        <RelayDialog
          relay={editRelay}
          onClose={() => {
            setDialogOpen(false);
            setEditRelay(null);
          }}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}
