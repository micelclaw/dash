import { useState } from 'react';
import { useMailQueue } from '@micelclaw/mail-admin-ui';
import { RefreshCw, Trash2, Play, Pause, Info, Inbox } from 'lucide-react';
import { toast } from 'sonner';

const statusColor: Record<string, string> = {
  active: '#22c55e', deferred: '#f97316', hold: '#ef4444',
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

export default function MailQueue() {
  const {
    available, stats, messages, loading, error,
    refetch, flush, deleteMessage, deleteAll, hold, release,
  } = useMailQueue();
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);

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

  const handleFlush = async () => {
    try {
      await flush();
      toast.success('Cola flushed correctamente');
      refetch();
    } catch {
      toast.error('Error al hacer flush');
    }
  };

  const handleDeleteAll = async () => {
    try {
      await deleteAll();
      toast.success('Todos los mensajes eliminados');
      setDeleteAllConfirm(false);
      refetch();
    } catch {
      toast.error('Error al eliminar mensajes');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMessage(id);
      toast.success('Mensaje eliminado');
      refetch();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const handleHold = async (id: string) => {
    try {
      await hold(id);
      toast.success('Mensaje retenido');
      refetch();
    } catch {
      toast.error('Error');
    }
  };

  const handleRelease = async (id: string) => {
    try {
      await release(id);
      toast.success('Mensaje liberado');
      refetch();
    } catch {
      toast.error('Error');
    }
  };

  const statBadges = stats ? [
    { label: 'Total', value: stats.total, color: 'var(--text)' },
    { label: 'Diferidos', value: stats.deferred, color: '#f97316' },
    { label: 'Activos', value: stats.active, color: '#22c55e' },
    { label: 'Retenidos', value: stats.hold, color: '#ef4444' },
  ] : [];

  return (
    <div style={{ padding: 24, maxWidth: 1100, fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>
            Cola de correo
          </h1>
          {statBadges.map(b => (
            <span key={b.label} style={{
              fontSize: '0.75rem', color: b.color,
              background: 'var(--surface-hover)', padding: '2px 8px',
              borderRadius: 'var(--radius-md)', fontWeight: 500,
            }}>
              {b.label}: {b.value}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
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
          </button>
          <button
            onClick={handleFlush}
            style={{
              background: 'var(--amber)', color: '#000', fontWeight: 600,
              border: 'none', borderRadius: 'var(--radius-md)',
              padding: '6px 14px', cursor: 'pointer', fontSize: '0.8125rem',
            }}
          >
            Flush
          </button>
          {deleteAllConfirm ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={handleDeleteAll}
                style={{
                  background: '#ef4444', color: '#fff', fontWeight: 600,
                  border: 'none', borderRadius: 'var(--radius-md)',
                  padding: '6px 14px', cursor: 'pointer', fontSize: '0.8125rem',
                }}
              >
                Confirmar
              </button>
              <button
                onClick={() => setDeleteAllConfirm(false)}
                style={{
                  background: 'transparent', color: 'var(--text-dim)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  padding: '6px 14px', cursor: 'pointer', fontSize: '0.8125rem',
                }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDeleteAllConfirm(true)}
              style={{
                background: '#ef444420', color: '#ef4444', fontWeight: 600,
                border: '1px solid #ef444440', borderRadius: 'var(--radius-md)',
                padding: '6px 14px', cursor: 'pointer', fontSize: '0.8125rem',
              }}
            >
              Borrar todo
            </button>
          )}
        </div>
      </div>

      {loading && messages.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: 32, textAlign: 'center' }}>
          Cargando cola...
        </div>
      )}

      {error && (
        <div style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: 16 }}>
          Error: {String(error)}
        </div>
      )}

      {/* Table */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '100px 1fr 1fr 70px 130px 80px 1.2fr 90px',
          padding: '8px 16px', background: 'var(--surface)',
          fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          borderBottom: '1px solid var(--border)',
        }}>
          <span>ID</span>
          <span>Remitente</span>
          <span>Destinatarios</span>
          <span>Tamaño</span>
          <span>Fecha</span>
          <span>Estado</span>
          <span>Razón</span>
          <span style={{ textAlign: 'right' }}>Acciones</span>
        </div>

        {messages.length === 0 ? (
          <div style={{
            padding: 48, textAlign: 'center', color: 'var(--text-muted)',
            fontSize: '0.875rem', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 12,
          }}>
            <Inbox size={32} style={{ color: 'var(--border)' }} />
            La cola está vacía
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              style={{
                display: 'grid', gridTemplateColumns: '100px 1fr 1fr 70px 130px 80px 1.2fr 90px',
                padding: '10px 16px', background: 'var(--card)',
                borderBottom: '1px solid var(--border)', fontSize: '0.8125rem',
                alignItems: 'center',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                {msg.id.slice(0, 10)}
              </span>
              <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {msg.sender}
              </span>
              <span style={{ color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {msg.recipients.join(', ')}
              </span>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                {formatBytes(msg.size)}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                {new Date(msg.arrival_time).toLocaleString()}
              </span>
              <span>
                <span style={{
                  background: `${statusColor[msg.status] || 'var(--text-dim)'}15`,
                  color: statusColor[msg.status] || 'var(--text-dim)',
                  fontSize: '0.6875rem', fontWeight: 500,
                  padding: '2px 8px', borderRadius: 'var(--radius-md)',
                }}>
                  {msg.status}
                </span>
              </span>
              <span
                title={msg.reason || ''}
                style={{
                  color: 'var(--text-dim)', fontSize: '0.75rem',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  cursor: msg.reason ? 'help' : 'default',
                }}
              >
                {msg.reason || '-'}
              </span>
              <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                {msg.status === 'hold' ? (
                  <button
                    onClick={() => handleRelease(msg.id)}
                    title="Liberar"
                    style={{
                      background: 'transparent', border: '1px solid var(--border)',
                      borderRadius: 4, padding: 4, cursor: 'pointer', color: '#22c55e',
                    }}
                  >
                    <Play size={12} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleHold(msg.id)}
                    title="Retener"
                    style={{
                      background: 'transparent', border: '1px solid var(--border)',
                      borderRadius: 4, padding: 4, cursor: 'pointer', color: '#f97316',
                    }}
                  >
                    <Pause size={12} />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(msg.id)}
                  title="Eliminar"
                  style={{
                    background: 'transparent', border: '1px solid var(--border)',
                    borderRadius: 4, padding: 4, cursor: 'pointer', color: '#ef4444',
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
