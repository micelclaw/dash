import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useMailServerApi } from '@micelclaw/mail-admin-ui';
import type { MailuDomain, MailuUser, MailuAlias } from '@micelclaw/mail-admin-ui';
import { ArrowLeft, Copy, RefreshCw, Trash2, Save, Shield, Globe, Key, Users, ArrowRightLeft, Settings, Layers } from 'lucide-react';
import { toast } from 'sonner';

const TABS = ['General', 'DNS Records', 'DKIM', 'Usuarios', 'Aliases', 'Managers', 'Alternatives'] as const;
type Tab = typeof TABS[number];

export default function DomainDetail() {
  const { domain: domainParam } = useParams<{ domain: string }>();
  const navigate = useNavigate();
  const api = useMailServerApi();

  const [domain, setDomain] = useState<MailuDomain | null>(null);
  const [users, setUsers] = useState<MailuUser[]>([]);
  const [aliases, setAliases] = useState<MailuAlias[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('General');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Edit state
  const [editMaxUsers, setEditMaxUsers] = useState(-1);
  const [editMaxAliases, setEditMaxAliases] = useState(-1);
  const [editMaxQuota, setEditMaxQuota] = useState(0);
  const [editSignup, setEditSignup] = useState(false);
  const [editComment, setEditComment] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!domainParam) return;
    setLoading(true);
    try {
      const [d, u, a] = await Promise.all([
        api.getDomain(domainParam),
        api.getUsers(),
        api.getAliases(),
      ]);
      setDomain(d);
      setUsers(u.filter(usr => usr.email.endsWith(`@${domainParam}`)));
      setAliases(a.filter(al => al.email.endsWith(`@${domainParam}`)));
      setEditMaxUsers(d.max_users);
      setEditMaxAliases(d.max_aliases);
      setEditMaxQuota(d.max_quota_bytes);
      setEditSignup(d.signup_enabled);
      setEditComment(d.comment);
    } catch {
      toast.error('Error cargando dominio');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [domainParam]);

  const handleSave = async () => {
    if (!domainParam) return;
    setSaving(true);
    try {
      const updated = await api.updateDomain(domainParam, {
        max_users: editMaxUsers,
        max_aliases: editMaxAliases,
        max_quota_bytes: editMaxQuota,
        signup_enabled: editSignup,
        comment: editComment,
      });
      setDomain(updated);
      toast.success('Dominio actualizado');
    } catch {
      toast.error('Error actualizando dominio');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!domainParam) return;
    try {
      await api.deleteDomain(domainParam);
      toast.success(`Dominio ${domainParam} eliminado`);
      navigate('/mail-server/domains');
    } catch {
      toast.error('Error eliminando dominio');
    }
  };

  const handleGenerateDkim = async () => {
    if (!domainParam) return;
    try {
      await api.generateDkim(domainParam);
      toast.success('DKIM regenerado');
      fetchData();
    } catch {
      toast.error('Error regenerando DKIM');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado');
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

  if (loading) {
    return (
      <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Cargando dominio...</div>
    );
  }

  if (!domain) {
    return (
      <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Dominio no encontrado</div>
    );
  }

  const dnsRecords = [
    { label: 'MX', value: domain.dns_mx, icon: Globe },
    { label: 'SPF', value: domain.dns_spf, icon: Shield },
    { label: 'DKIM', value: domain.dns_dkim, icon: Key },
    { label: 'DMARC', value: domain.dns_dmarc, icon: Shield },
    { label: 'Autoconfig', value: domain.dns_autoconfig?.join('\n') || '', icon: Settings },
    { label: 'TLSA', value: domain.dns_tlsa?.join('\n') || '', icon: Shield },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 960, fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate('/mail-server/domains')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              padding: 4,
              display: 'flex',
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
            {domain.name}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
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
              gap: 6,
              fontSize: '0.8125rem',
            }}
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setDeleteConfirm(true)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              cursor: 'pointer',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.8125rem',
            }}
          >
            <Trash2 size={14} />
            Eliminar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid var(--border)',
        marginBottom: 20,
      }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--amber)' : '2px solid transparent',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? 'var(--text)' : 'var(--text-muted)',
              fontFamily: 'var(--font-sans)',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'General' && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 20,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Max usuarios (-1 = ilimitado)</label>
                <input type="number" value={editMaxUsers} onChange={(e) => setEditMaxUsers(Number(e.target.value))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Max aliases (-1 = ilimitado)</label>
                <input type="number" value={editMaxAliases} onChange={(e) => setEditMaxAliases(Number(e.target.value))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Max quota (bytes, 0 = ilimitado)</label>
                <input type="number" value={editMaxQuota} onChange={(e) => setEditMaxQuota(Number(e.target.value))} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={editSignup} onChange={(e) => setEditSignup(e.target.checked)} style={{ accentColor: 'var(--amber)' }} />
              <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Habilitar signup</span>
            </div>
            <div>
              <label style={labelStyle}>Comentario</label>
              <textarea value={editComment} onChange={(e) => setEditComment(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: 'var(--amber)',
                  color: '#000',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 14px',
                  cursor: saving ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.8125rem',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <Save size={14} />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'DNS Records' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {dnsRecords.map((rec) => {
            const Icon = rec.icon;
            return (
              <div
                key={rec.label}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon size={14} style={{ color: 'var(--amber)' }} />
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>{rec.label}</span>
                  </div>
                  {rec.value && (
                    <button
                      onClick={() => copyToClipboard(rec.value)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        padding: 4,
                        display: 'flex',
                      }}
                    >
                      <Copy size={14} />
                    </button>
                  )}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: rec.value ? 'var(--text-dim)' : 'var(--text-muted)',
                  background: 'var(--bg)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 10px',
                  wordBreak: 'break-all',
                  whiteSpace: 'pre-wrap',
                  minHeight: 36,
                }}>
                  {rec.value || 'No disponible'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'DKIM' && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Key size={16} style={{ color: 'var(--amber)' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>DKIM Record</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {domain.dns_dkim && (
                <button
                  onClick={() => copyToClipboard(domain.dns_dkim)}
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
                  <Copy size={14} />
                  Copiar
                </button>
              )}
              <button
                onClick={handleGenerateDkim}
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
                <RefreshCw size={14} />
                Regenerar DKIM
              </button>
            </div>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: domain.dns_dkim ? 'var(--text-dim)' : 'var(--text-muted)',
            background: 'var(--bg)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            wordBreak: 'break-all',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
          }}>
            {domain.dns_dkim || 'No hay registro DKIM configurado. Haz clic en "Regenerar DKIM" para generar uno.'}
          </div>
        </div>
      )}

      {activeTab === 'Usuarios' && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 80px',
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
            <span style={{ textAlign: 'center' }}>Estado</span>
          </div>
          {users.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              No hay usuarios en este dominio
            </div>
          ) : (
            users.map((u) => (
              <div
                key={u.email}
                onClick={() => navigate(`/mail-server/mailboxes/${encodeURIComponent(u.email)}`)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 80px',
                  padding: '10px 16px',
                  background: 'var(--card)',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  alignItems: 'center',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}
              >
                <span style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{u.email}</span>
                <span style={{ color: 'var(--text-dim)' }}>{u.displayed_name || '—'}</span>
                <span style={{ textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: u.enabled ? '#22c55e' : '#ef4444',
                  }} />
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'Aliases' && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 80px',
            padding: '8px 16px',
            background: 'var(--surface)',
            fontSize: '0.75rem',
            fontWeight: 500,
            color: 'var(--text-muted)',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.04em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>Alias</span>
            <span>Destino</span>
            <span style={{ textAlign: 'center' }}>Wildcard</span>
          </div>
          {aliases.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              No hay aliases en este dominio
            </div>
          ) : (
            aliases.map((a) => (
              <div
                key={a.email}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 80px',
                  padding: '10px 16px',
                  background: 'var(--card)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '0.8125rem',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{a.email}</span>
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
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'Managers' && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <Users size={16} style={{ color: 'var(--amber)' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>Domain Managers</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Los managers del dominio se configuran a nivel de usuario. Un usuario con el campo <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg)', padding: '1px 4px', borderRadius: 'var(--radius-md)' }}>manager_of</code> que incluya este dominio podrá administrarlo.
          </p>
          <div style={{ marginTop: 14 }}>
            {users.filter(u => u.manager_of?.includes(domain.name)).length === 0 ? (
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No hay managers asignados a este dominio</span>
            ) : (
              users.filter(u => u.manager_of?.includes(domain.name)).map(u => (
                <div key={u.email} style={{
                  padding: '8px 12px',
                  background: 'var(--bg)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 6,
                  fontSize: '0.8125rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text)',
                }}>
                  {u.email}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'Alternatives' && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <Layers size={16} style={{ color: 'var(--amber)' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>Dominios alternativos</span>
          </div>
          {(!domain.alternatives || domain.alternatives.length === 0) ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              No hay dominios alternativos configurados
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {domain.alternatives.map((alt) => (
                <div key={alt} style={{
                  padding: '8px 12px',
                  background: 'var(--bg)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text)',
                }}>
                  {alt}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
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
          onClick={() => setDeleteConfirm(false)}
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
              ¿Eliminar <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{domain.name}</strong>?
              Se eliminarán todos los usuarios y aliases asociados.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setDeleteConfirm(false)}
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
