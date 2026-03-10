import { useState } from 'react';
import { Plus, Trash2, RefreshCw, Lock, ArrowRight, Globe, Server, Mail, BookOpen, Zap, HelpCircle } from 'lucide-react';
import type { ProxyRoute, ProxyRouteInput } from '../hooks/use-proxy';

interface ProxyHostsSectionProps {
  routes: ProxyRoute[];
  loading: boolean;
  onAdd: (input: ProxyRouteInput) => Promise<void>;
  onRemove: (routeId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

const EMPTY_FORM: ProxyRouteInput = {
  path: '',
  upstream: '',
  auth_required: false,
  rate_limit: null,
  upstream_tls: false,
};

// ─── Preset templates ───────────────────────────────────────────────

interface Preset {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  defaults: ProxyRouteInput;
}

const PRESETS: Preset[] = [
  {
    id: 'website',
    label: 'Website',
    description: 'Serve a website or frontend app (e.g. React, WordPress, static HTML)',
    icon: Globe,
    color: '#3b82f6',
    defaults: { path: '/*', upstream: 'localhost:3000', auth_required: false, rate_limit: null, upstream_tls: false },
  },
  {
    id: 'api',
    label: 'API / Backend',
    description: 'Expose a backend service or REST API behind a path prefix',
    icon: Server,
    color: '#22c55e',
    defaults: { path: '/api/*', upstream: 'localhost:8080', auth_required: false, rate_limit: '100r/m', upstream_tls: false },
  },
  {
    id: 'app',
    label: 'Web Application',
    description: 'Proxy a web app running in Docker (e.g. Nextcloud, GitLab, wiki)',
    icon: Zap,
    color: '#a855f7',
    defaults: { path: '/*', upstream: 'localhost:8080', auth_required: false, rate_limit: null, upstream_tls: true },
  },
  {
    id: 'mail',
    label: 'Webmail',
    description: 'Proxy a webmail interface (e.g. Roundcube, Rainloop)',
    icon: Mail,
    color: '#f59e0b',
    defaults: { path: '/mail/*', upstream: 'localhost:8880', auth_required: false, rate_limit: null, upstream_tls: false },
  },
];

// ─── Main Component ─────────────────────────────────────────────────

export function ProxyHostsSection({ routes, loading, onAdd, onRemove, onRefresh }: ProxyHostsSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProxyRouteInput>({ ...EMPTY_FORM });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const handleAdd = async () => {
    if (!form.path || !form.upstream) return;
    setAdding(true);
    await onAdd(form);
    setForm({ ...EMPTY_FORM });
    setShowForm(false);
    setSelectedPreset(null);
    setAdding(false);
  };

  const handleDelete = async (routeId: string) => {
    setDeleting(routeId);
    await onRemove(routeId);
    setDeleting(null);
  };

  const applyPreset = (preset: Preset) => {
    setForm({ ...preset.defaults });
    setSelectedPreset(preset.id);
    setShowForm(true);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)', fontSize: '0.875rem',
      }}>
        Loading routes...
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{
            fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)',
            margin: 0, fontFamily: 'var(--font-sans)',
          }}>
            Proxy Hosts ({routes.length})
          </h2>
          <button
            onClick={() => setShowHelp(!showHelp)}
            title="What is a proxy host?"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 22, height: 22,
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '50%',
              cursor: 'pointer',
              color: showHelp ? '#3b82f6' : 'var(--text-muted)',
              transition: 'all var(--transition-fast)',
            }}
          >
            <HelpCircle size={12} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <IconButton icon={RefreshCw} onClick={onRefresh} title="Refresh" />
          <button
            onClick={() => { setShowForm(!showForm); setSelectedPreset(null); setForm({ ...EMPTY_FORM }); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Plus size={14} />
            Add Host
          </button>
        </div>
      </div>

      {/* Help explainer */}
      {showHelp && (
        <div style={{
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          background: 'rgba(59, 130, 246, 0.04)',
          padding: 16,
          marginBottom: 20,
          fontSize: '0.8125rem',
          color: 'var(--text-dim)',
          lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BookOpen size={14} style={{ color: '#3b82f6' }} />
            How does the reverse proxy work?
          </div>
          <p style={{ margin: '0 0 8px' }}>
            A <strong>reverse proxy</strong> is like a receptionist for your server. When someone visits your domain
            (e.g. <code style={codeStyle}>mysite.com</code>), the proxy decides which internal service should handle the request.
          </p>
          <p style={{ margin: '0 0 8px' }}>
            <strong>Source Path</strong> is what the visitor types in their browser.
            For example, <code style={codeStyle}>/*</code> means "everything", while <code style={codeStyle}>/blog/*</code> means
            "only URLs starting with /blog".
          </p>
          <p style={{ margin: '0 0 8px' }}>
            <strong>Upstream</strong> is the internal address of the service that will handle those requests.
            For example, if you have a website running on port 3000, the upstream would be <code style={codeStyle}>localhost:3000</code>.
          </p>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Tip: If you're not sure where to start, choose one of the templates below and adjust the port number to match your service.
          </p>
        </div>
      )}

      {/* Quick Setup Templates */}
      {!showForm && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: '0.6875rem', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            color: 'var(--text-muted)', marginBottom: 8,
          }}>
            Quick Setup
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                style={{
                  padding: '14px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = preset.color + '66';
                  e.currentTarget.style.background = preset.color + '08';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'var(--surface)';
                }}
              >
                <preset.icon size={20} style={{ color: preset.color, marginBottom: 8 }} />
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  {preset.label}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {preset.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add Form */}
      {showForm && (
        <div style={{
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          background: 'var(--surface)',
          padding: 20,
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
              {selectedPreset ? `New ${PRESETS.find(p => p.id === selectedPreset)?.label ?? 'Host'}` : 'New Proxy Host'}
            </div>
            {selectedPreset && (
              <button
                onClick={() => { setSelectedPreset(null); setForm({ ...EMPTY_FORM }); }}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  fontSize: '0.6875rem', color: 'var(--text-muted)', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Clear template
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
            <FieldGroup label="Source Path" hint="URL path visitors will use (e.g. /* for everything)">
              <input
                type="text"
                placeholder="/*"
                value={form.path}
                onChange={(e) => setForm({ ...form, path: e.target.value })}
                style={inputStyle}
              />
            </FieldGroup>
            <FieldGroup label="Upstream" hint="Internal address of your service (host:port)">
              <input
                type="text"
                placeholder="localhost:3000"
                value={form.upstream}
                onChange={(e) => setForm({ ...form, upstream: e.target.value })}
                style={inputStyle}
              />
            </FieldGroup>
          </div>

          {/* Advanced options — collapsible */}
          <AdvancedOptions form={form} setForm={setForm} />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setSelectedPreset(null); }} style={cancelBtnStyle}>
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!form.path || !form.upstream || adding}
              style={{
                ...saveBtnStyle,
                opacity: (!form.path || !form.upstream || adding) ? 0.5 : 1,
                cursor: (!form.path || !form.upstream || adding) ? 'not-allowed' : 'pointer',
              }}
            >
              {adding ? 'Adding...' : 'Add Route'}
            </button>
          </div>
        </div>
      )}

      {/* Routes Table */}
      {routes.length === 0 ? (
        <div style={{
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          padding: '48px 24px',
          textAlign: 'center',
        }}>
          <Globe size={28} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
          <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', margin: '0 0 4px', fontWeight: 500 }}>
            No proxy hosts configured yet
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>
            Use one of the templates above or click "Add Host" to get started.
          </p>
        </div>
      ) : (
        <div style={{
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 30px 1fr 80px 100px 44px',
            gap: 0,
            padding: '10px 16px',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            fontSize: '0.625rem', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            alignItems: 'center',
          }}>
            <span>Source</span>
            <span />
            <span>Upstream</span>
            <span>Auth</span>
            <span>Rate Limit</span>
            <span />
          </div>

          {/* Rows */}
          {routes.map((route) => (
            <div
              key={route.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 30px 1fr 80px 100px 44px',
                gap: 0,
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                alignItems: 'center',
                background: 'var(--card)',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--card)'; }}
            >
              {/* Source path */}
              <span style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.8125rem',
                color: '#d4a017',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {route.path}
              </span>

              {/* Arrow */}
              <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />

              {/* Upstream */}
              <span style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.8125rem',
                color: 'var(--text)',
                display: 'flex', alignItems: 'center', gap: 6,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {route.upstream_tls && (
                  <Lock size={12} style={{ color: '#22c55e', flexShrink: 0 }} />
                )}
                {route.upstream}
              </span>

              {/* Auth badge */}
              <span>
                {route.auth_required && (
                  <span style={{
                    fontSize: '0.625rem', fontWeight: 600,
                    padding: '2px 6px', borderRadius: 4,
                    background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6',
                  }}>
                    AUTH
                  </span>
                )}
              </span>

              {/* Rate limit */}
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>
                {route.rate_limit ?? '-'}
              </span>

              {/* Delete */}
              <button
                onClick={() => handleDelete(route.id)}
                disabled={deleting === route.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28,
                  background: 'transparent',
                  border: '1px solid transparent',
                  borderRadius: 'var(--radius-md)',
                  cursor: deleting === route.id ? 'not-allowed' : 'pointer',
                  color: 'var(--text-muted)',
                  opacity: deleting === route.id ? 0.4 : 1,
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#f43f5e';
                  e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
                title="Remove route"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Advanced Options (collapsible) ─────────────────────────────────

function AdvancedOptions({ form, setForm }: { form: ProxyRouteInput; setForm: (f: ProxyRouteInput) => void }) {
  const [open, setOpen] = useState(form.auth_required || form.upstream_tls || !!form.rate_limit);

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none', border: 'none', padding: 0,
          fontSize: '0.75rem', fontWeight: 500,
          color: 'var(--text-muted)', cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        <span style={{
          display: 'inline-block',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s',
          fontSize: '0.625rem',
        }}>
          &#9654;
        </span>
        Advanced Options
      </button>

      {open && (
        <div style={{
          marginTop: 10, padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text-dim)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.auth_required ?? false}
                onChange={(e) => setForm({ ...form, auth_required: e.target.checked })}
                style={{ accentColor: '#3b82f6' }}
              />
              <span>
                Require Auth
                <span style={{ display: 'block', fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 1 }}>
                  Only authenticated users can access this route
                </span>
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text-dim)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.upstream_tls ?? false}
                onChange={(e) => setForm({ ...form, upstream_tls: e.target.checked })}
                style={{ accentColor: '#3b82f6' }}
              />
              <span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Lock size={11} />
                  HTTPS Upstream
                </span>
                <span style={{ display: 'block', fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 1 }}>
                  Connect to the internal service via HTTPS (for services with their own SSL)
                </span>
              </span>
            </label>

            <div>
              <div style={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4 }}>
                Rate Limit
              </div>
              <input
                type="text"
                placeholder="e.g. 100r/m"
                value={form.rate_limit ?? ''}
                onChange={(e) => setForm({ ...form, rate_limit: e.target.value || null })}
                style={{ ...inputStyle, width: 120 }}
              />
              <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Max requests per minute (leave empty for no limit)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared Components ──────────────────────────────────────────────

function IconButton({ icon: Icon, onClick, title }: {
  icon: React.ComponentType<{ size?: number }>;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        color: 'var(--text-dim)',
        transition: 'all var(--transition-fast)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-hover)';
        e.currentTarget.style.color = 'var(--text)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.color = 'var(--text-dim)';
      }}
    >
      <Icon size={14} />
    </button>
  );
}

function FieldGroup({ label, hint, children, inline }: { label: string; hint?: string; children: React.ReactNode; inline?: boolean }) {
  return (
    <div style={inline ? { display: 'flex', alignItems: 'center', gap: 8 } : undefined}>
      <div style={{
        fontSize: '0.625rem', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.05em',
        color: 'var(--text-muted)',
        marginBottom: inline ? 0 : 4,
      }}>
        {label}
      </div>
      {children}
      {hint && (
        <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.3 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

const codeStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: '0.75rem',
  background: 'rgba(59, 130, 246, 0.1)',
  padding: '1px 5px',
  borderRadius: 3,
  color: '#3b82f6',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-mono, monospace)',
  outline: 'none',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-dim)',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
};

const saveBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: '#3b82f6',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  color: '#fff',
  fontSize: '0.8125rem',
  fontWeight: 600,
  fontFamily: 'var(--font-sans)',
};
