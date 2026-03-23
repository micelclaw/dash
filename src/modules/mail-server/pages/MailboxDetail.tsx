import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useMailServerApi } from '@micelclaw/mail-admin-ui';
import type { MailuUser, MailuFetchedAccount, MailuToken } from '@micelclaw/mail-admin-ui';
import { ArrowLeft, RefreshCw, Trash2, Save, X, Plus, Shield, Mail, Clock, Forward, Download, Key } from 'lucide-react';
import { toast } from 'sonner';

const TABS = ['General', 'Spam', 'Auto-respuesta', 'Reenvío', 'Cuentas externas', 'Tokens'] as const;
type Tab = typeof TABS[number];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function MailboxDetail() {
  const { email: emailParam } = useParams<{ email: string }>();
  const email = emailParam ? decodeURIComponent(emailParam) : '';
  const navigate = useNavigate();
  const api = useMailServerApi();

  const [user, setUser] = useState<MailuUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('General');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  // General edits
  const [editName, setEditName] = useState('');
  const [editQuota, setEditQuota] = useState(0);
  const [editEnabled, setEditEnabled] = useState(true);
  const [editChangePw, setEditChangePw] = useState(false);
  const [editImap, setEditImap] = useState(true);
  const [editPop, setEditPop] = useState(true);

  // Spam edits
  const [editSpamEnabled, setEditSpamEnabled] = useState(true);
  const [editSpamThreshold, setEditSpamThreshold] = useState(5);
  const [editSpamMarkRead, setEditSpamMarkRead] = useState(false);

  // Auto-reply edits
  const [editReplyEnabled, setEditReplyEnabled] = useState(false);
  const [editReplySubject, setEditReplySubject] = useState('');
  const [editReplyBody, setEditReplyBody] = useState('');
  const [editReplyStart, setEditReplyStart] = useState('');
  const [editReplyEnd, setEditReplyEnd] = useState('');

  // Forward edits
  const [editFwdEnabled, setEditFwdEnabled] = useState(false);
  const [editFwdDest, setEditFwdDest] = useState('');
  const [editFwdKeep, setEditFwdKeep] = useState(true);

  // Token create
  const [showTokenCreate, setShowTokenCreate] = useState(false);
  const [tokenComment, setTokenComment] = useState('');
  const [tokenIp, setTokenIp] = useState('');
  const [creatingToken, setCreatingToken] = useState(false);

  const loadFields = (u: MailuUser) => {
    setEditName(u.displayed_name);
    setEditQuota(u.quota_bytes);
    setEditEnabled(u.enabled);
    setEditChangePw(u.change_pw_next_login);
    setEditImap(u.enable_imap);
    setEditPop(u.enable_pop);
    setEditSpamEnabled(u.spam_enabled);
    setEditSpamThreshold(u.spam_threshold);
    setEditSpamMarkRead(u.spam_mark_as_read);
    setEditReplyEnabled(u.reply_enabled);
    setEditReplySubject(u.reply_subject);
    setEditReplyBody(u.reply_body);
    setEditReplyStart(u.reply_startdate);
    setEditReplyEnd(u.reply_enddate);
    setEditFwdEnabled(u.forward_enabled);
    setEditFwdDest(u.forward_destination?.join(', ') || '');
    setEditFwdKeep(u.forward_keep);
  };

  const fetchUser = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const u = await api.getUser(email);
      setUser(u);
      loadFields(u);
    } catch {
      toast.error('Error cargando buzón');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUser(); }, [email]);

  const saveTab = async (data: Partial<MailuUser>) => {
    if (!email) return;
    setSaving(true);
    try {
      const updated = await api.updateUser(email, data);
      setUser(updated);
      loadFields(updated);
      toast.success('Buzón actualizado');
    } catch {
      toast.error('Error actualizando buzón');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGeneral = () => saveTab({
    displayed_name: editName,
    quota_bytes: editQuota,
    enabled: editEnabled,
    change_pw_next_login: editChangePw,
    enable_imap: editImap,
    enable_pop: editPop,
  });

  const handleSaveSpam = () => saveTab({
    spam_enabled: editSpamEnabled,
    spam_threshold: editSpamThreshold,
    spam_mark_as_read: editSpamMarkRead,
  });

  const handleSaveReply = () => saveTab({
    reply_enabled: editReplyEnabled,
    reply_subject: editReplySubject,
    reply_body: editReplyBody,
    reply_startdate: editReplyStart,
    reply_enddate: editReplyEnd,
  });

  const handleSaveForward = () => saveTab({
    forward_enabled: editFwdEnabled,
    forward_destination: editFwdDest.split(',').map(s => s.trim()).filter(Boolean),
    forward_keep: editFwdKeep,
  });

  const handleDelete = async () => {
    if (!email) return;
    try {
      await api.deleteUser(email);
      toast.success(`Buzón ${email} eliminado`);
      navigate('/mail-server/mailboxes');
    } catch {
      toast.error('Error eliminando buzón');
    }
  };

  const handleCreateToken = async () => {
    if (!tokenComment.trim()) return;
    setCreatingToken(true);
    try {
      await api.createToken({ comment: tokenComment, ip: tokenIp || '0.0.0.0/0' });
      toast.success('Token creado');
      setShowTokenCreate(false);
      setTokenComment('');
      setTokenIp('');
      fetchUser();
    } catch {
      toast.error('Error creando token');
    } finally {
      setCreatingToken(false);
    }
  };

  const handleDeleteToken = async (id: number) => {
    try {
      await api.deleteToken(id);
      toast.success('Token eliminado');
      fetchUser();
    } catch {
      toast.error('Error eliminando token');
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

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: 20,
  };

  const saveButton = (onClick: () => void) => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
      <button
        onClick={onClick}
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
  );

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Cargando buzón...</div>;
  }

  if (!user) {
    return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Buzón no encontrado</div>;
  }

  const quotaPct = user.quota_bytes > 0 ? Math.min(100, Math.round((user.quota_bytes_used / user.quota_bytes) * 100)) : 0;
  const quotaColor = quotaPct >= 90 ? '#ef4444' : quotaPct >= 70 ? 'var(--amber)' : '#22c55e';

  return (
    <div style={{ padding: 24, maxWidth: 960, fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate('/mail-server/mailboxes')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4, display: 'flex' }}
          >
            <ArrowLeft size={18} />
          </button>
          <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
            {user.email}
          </h1>
          <span style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: user.enabled ? '#22c55e' : '#ef4444',
          }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={fetchUser}
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
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
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

      {/* General */}
      {activeTab === 'General' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Nombre visible</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Quota (bytes, 0 = ilimitado)</label>
              <input type="number" value={editQuota} onChange={(e) => setEditQuota(Number(e.target.value))} style={inputStyle} />
              {user.quota_bytes > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {formatBytes(user.quota_bytes_used)} / {formatBytes(user.quota_bytes)}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: quotaColor, fontWeight: 600 }}>{quotaPct}%</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${quotaPct}%`, height: '100%', background: quotaColor, borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text)', cursor: 'pointer' }}>
                <input type="checkbox" checked={editEnabled} onChange={(e) => setEditEnabled(e.target.checked)} style={{ accentColor: 'var(--amber)' }} />
                Habilitado
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text)', cursor: 'pointer' }}>
                <input type="checkbox" checked={editChangePw} onChange={(e) => setEditChangePw(e.target.checked)} style={{ accentColor: 'var(--amber)' }} />
                Cambiar contraseña en próximo login
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text)', cursor: 'pointer' }}>
                <input type="checkbox" checked={editImap} onChange={(e) => setEditImap(e.target.checked)} style={{ accentColor: 'var(--amber)' }} />
                IMAP
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text)', cursor: 'pointer' }}>
                <input type="checkbox" checked={editPop} onChange={(e) => setEditPop(e.target.checked)} style={{ accentColor: 'var(--amber)' }} />
                POP3
              </label>
            </div>
          </div>
          {saveButton(handleSaveGeneral)}
        </div>
      )}

      {/* Spam */}
      {activeTab === 'Spam' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <Shield size={16} style={{ color: 'var(--amber)' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>Configuración Antispam</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text)', cursor: 'pointer' }}>
              <input type="checkbox" checked={editSpamEnabled} onChange={(e) => setEditSpamEnabled(e.target.checked)} style={{ accentColor: 'var(--amber)' }} />
              Antispam habilitado
            </label>
            <div>
              <label style={labelStyle}>Umbral de spam (1-15, menor = más agresivo)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range"
                  min={1}
                  max={15}
                  value={editSpamThreshold}
                  onChange={(e) => setEditSpamThreshold(Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--amber)' }}
                />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', minWidth: 24, textAlign: 'center' }}>
                  {editSpamThreshold}
                </span>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text)', cursor: 'pointer' }}>
              <input type="checkbox" checked={editSpamMarkRead} onChange={(e) => setEditSpamMarkRead(e.target.checked)} style={{ accentColor: 'var(--amber)' }} />
              Marcar spam como leído
            </label>
          </div>
          {saveButton(handleSaveSpam)}
        </div>
      )}

      {/* Auto-reply */}
      {activeTab === 'Auto-respuesta' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <Clock size={16} style={{ color: 'var(--amber)' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>Auto-respuesta</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text)', cursor: 'pointer' }}>
              <input type="checkbox" checked={editReplyEnabled} onChange={(e) => setEditReplyEnabled(e.target.checked)} style={{ accentColor: 'var(--amber)' }} />
              Auto-respuesta habilitada
            </label>
            <div>
              <label style={labelStyle}>Asunto</label>
              <input value={editReplySubject} onChange={(e) => setEditReplySubject(e.target.value)} placeholder="Fuera de oficina" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Cuerpo del mensaje</label>
              <textarea value={editReplyBody} onChange={(e) => setEditReplyBody(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Fecha inicio</label>
                <input type="date" value={editReplyStart} onChange={(e) => setEditReplyStart(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Fecha fin</label>
                <input type="date" value={editReplyEnd} onChange={(e) => setEditReplyEnd(e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>
          {saveButton(handleSaveReply)}
        </div>
      )}

      {/* Forward */}
      {activeTab === 'Reenvío' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <Forward size={16} style={{ color: 'var(--amber)' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>Reenvío de correo</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text)', cursor: 'pointer' }}>
              <input type="checkbox" checked={editFwdEnabled} onChange={(e) => setEditFwdEnabled(e.target.checked)} style={{ accentColor: 'var(--amber)' }} />
              Reenvío habilitado
            </label>
            <div>
              <label style={labelStyle}>Destinos (separados por coma)</label>
              <input
                value={editFwdDest}
                onChange={(e) => setEditFwdDest(e.target.value)}
                placeholder="otro@ejemplo.com, backup@ejemplo.com"
                style={inputStyle}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text)', cursor: 'pointer' }}>
              <input type="checkbox" checked={editFwdKeep} onChange={(e) => setEditFwdKeep(e.target.checked)} style={{ accentColor: 'var(--amber)' }} />
              Conservar copia en buzón
            </label>
          </div>
          {saveButton(handleSaveForward)}
        </div>
      )}

      {/* Fetched accounts */}
      {activeTab === 'Cuentas externas' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <Download size={16} style={{ color: 'var(--amber)' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>Cuentas externas</span>
          </div>
          {(!user.fetches || user.fetches.length === 0) ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              No hay cuentas externas configuradas
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {user.fetches.map((f: MailuFetchedAccount) => (
                <div
                  key={f.id}
                  style={{
                    background: 'var(--bg)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    border: f.error ? '1px solid #ef4444' : '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 500, fontSize: '0.8125rem', color: 'var(--text)' }}>
                      {f.username}@{f.host}:{f.port}
                    </span>
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--surface-hover)',
                      color: 'var(--text-dim)',
                      textTransform: 'uppercase' as const,
                    }}>
                      {f.protocol}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>TLS: {f.tls ? 'Sí' : 'No'}</span>
                    <span>Keep: {f.keep ? 'Sí' : 'No'}</span>
                    <span>Último check: {f.last_check || 'Nunca'}</span>
                  </div>
                  {f.error && (
                    <div style={{ marginTop: 6, fontSize: '0.75rem', color: '#ef4444' }}>
                      Error: {f.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tokens */}
      {activeTab === 'Tokens' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Key size={16} style={{ color: 'var(--amber)' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>Tokens de aplicación</span>
            </div>
            <button
              onClick={() => setShowTokenCreate(true)}
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
              Nuevo token
            </button>
          </div>

          {(!user.tokens || user.tokens.length === 0) ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              No hay tokens configurados
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {user.tokens.map((t: MailuToken) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>{t.comment}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>IP: {t.ip}</div>
                  </div>
                  <button
                    onClick={() => handleDeleteToken(t.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#ef4444',
                      padding: 4,
                      display: 'flex',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Token create dialog */}
      {showTokenCreate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowTokenCreate(false)}
        >
          <div
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, width: 380, maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>Nuevo token</h2>
              <button onClick={() => setShowTokenCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Comentario</label>
                <input value={tokenComment} onChange={(e) => setTokenComment(e.target.value)} placeholder="Thunderbird desktop" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>IP permitida (0.0.0.0/0 = cualquiera)</label>
                <input value={tokenIp} onChange={(e) => setTokenIp(e.target.value)} placeholder="0.0.0.0/0" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => setShowTokenCreate(false)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '6px 14px', cursor: 'pointer', color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
                Cancelar
              </button>
              <button
                onClick={handleCreateToken}
                disabled={creatingToken || !tokenComment.trim()}
                style={{
                  background: 'var(--amber)',
                  color: '#000',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 14px',
                  cursor: creatingToken ? 'wait' : 'pointer',
                  fontSize: '0.8125rem',
                  opacity: creatingToken || !tokenComment.trim() ? 0.6 : 1,
                }}
              >
                {creatingToken ? 'Creando...' : 'Crear token'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setDeleteConfirm(false)}
        >
          <div
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, width: 380, maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>Eliminar buzón</h2>
            <p style={{ margin: '0 0 20px', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
              ¿Eliminar <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{user.email}</strong>?
              Se perderán todos los correos y configuración.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setDeleteConfirm(false)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '6px 14px', cursor: 'pointer', color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
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
