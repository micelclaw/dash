import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMailServerApi, type MailuUser } from '@micelclaw/mail-admin-ui';
import { toast } from 'sonner';
import { ShieldCheck, User } from 'lucide-react';

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

const outlineBtn: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--text-dim)',
  fontWeight: 600,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '6px 14px',
  cursor: 'pointer',
  fontSize: '0.8125rem',
};

function StatusDot({ enabled }: { enabled: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: enabled ? '#22c55e' : '#ef4444',
        flexShrink: 0,
      }}
    />
  );
}

function UserRow({
  user,
  isAdmin,
  toggling,
  onToggle,
}: {
  user: MailuUser;
  isAdmin: boolean;
  toggling: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr auto auto',
        padding: '12px 16px',
        background: 'var(--card)',
        borderTop: '1px solid var(--border)',
        alignItems: 'center',
        fontSize: '0.875rem',
        color: 'var(--text)',
        gap: 12,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--card)')}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isAdmin ? (
          <ShieldCheck size={14} style={{ color: 'var(--amber)' }} />
        ) : (
          <User size={14} style={{ color: 'var(--text-dim)' }} />
        )}
        {user.email}
      </span>
      <span style={{ color: 'var(--text-dim)' }}>{user.displayed_name || '—'}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <StatusDot enabled={user.enabled} />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          {user.enabled ? 'Activo' : 'Inactivo'}
        </span>
      </span>
      <button
        onClick={onToggle}
        disabled={toggling}
        style={{
          ...(isAdmin ? outlineBtn : primaryBtn),
          opacity: toggling ? 0.5 : 1,
          minWidth: 120,
          textAlign: 'center',
        }}
      >
        {toggling ? 'Actualizando...' : isAdmin ? 'Revocar admin' : 'Hacer admin'}
      </button>
    </div>
  );
}

export default function Administrators() {
  const api = useMailServerApi();
  const [users, setUsers] = useState<MailuUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingEmail, setTogglingEmail] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch {
      toast.error('Error al cargar los usuarios');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const admins = useMemo(() => users.filter((u) => u.global_admin), [users]);
  const regularUsers = useMemo(() => users.filter((u) => !u.global_admin), [users]);

  const handleToggleAdmin = async (user: MailuUser) => {
    setTogglingEmail(user.email);
    try {
      await api.updateUser(user.email, { global_admin: !user.global_admin });
      toast.success(
        user.global_admin
          ? `${user.email} ya no es administrador`
          : `${user.email} ahora es administrador`
      );
      fetchUsers();
    } catch {
      toast.error('Error al actualizar el usuario');
    } finally {
      setTogglingEmail(null);
    }
  };

  const gridHeaderColumns = '1fr 1fr auto auto';

  const renderSection = (title: string, list: MailuUser[], isAdminSection: boolean) => (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '1rem' }}>{title}</span>
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
          {list.length}
        </span>
      </div>
      {list.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.875rem',
            background: 'var(--surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
          }}
        >
          {isAdminSection ? 'No hay administradores' : 'No hay usuarios regulares'}
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: gridHeaderColumns,
              background: 'var(--surface)',
              padding: '10px 16px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              gap: 12,
            }}
          >
            <span>Email</span>
            <span>Nombre</span>
            <span>Estado</span>
            <span>Acción</span>
          </div>
          {list.map((user) => (
            <UserRow
              key={user.email}
              user={user}
              isAdmin={isAdminSection}
              toggling={togglingEmail === user.email}
              onToggle={() => handleToggleAdmin(user)}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '1.125rem' }}>
          Gestión de administradores
        </span>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-dim)', padding: 40, textAlign: 'center' }}>Cargando...</div>
      ) : (
        <>
          {renderSection('Administradores', admins, true)}
          {renderSection('Usuarios', regularUsers, false)}
        </>
      )}
    </div>
  );
}
