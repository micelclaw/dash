/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { useState } from 'react';
import {
  Server, Plus, Trash2, CheckCircle, AlertTriangle,
  RefreshCw, X, ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import type { DnsProviderAccount, DnsProviderType, DnsProviderAccountInput } from '../hooks/use-dns-providers';

interface ProvidersSectionProps {
  providers: DnsProviderAccount[];
  loading: boolean;
  onAdd: (input: DnsProviderAccountInput) => Promise<DnsProviderAccount | null>;
  onTest: (id: string) => Promise<boolean>;
  onRemove: (id: string) => Promise<void>;
}

interface ProviderField {
  key: string;
  label: string;
  type: string;
  placeholder: string;
  help?: string;
  link?: { label: string; url: string };
}

const PROVIDER_OPTIONS: { value: DnsProviderType; label: string; fields: ProviderField[] }[] = [
  {
    value: 'cloudflare',
    label: 'Cloudflare',
    fields: [
      {
        key: 'api_token', label: 'API Token', type: 'password',
        placeholder: 'Token con permisos Zone:DNS:Edit',
        help: 'Crea un token personalizado con los permisos: Zone → DNS → Edit y Zone → Zone → Read. No uses la Global API Key. Puedes usar tanto User API Tokens como Account API Tokens.',
        link: { label: 'Crear API Token', url: 'https://dash.cloudflare.com/profile/api-tokens' },
      },
    ],
  },
  {
    value: 'porkbun',
    label: 'Porkbun',
    fields: [
      {
        key: 'api_key', label: 'API Key', type: 'password',
        placeholder: 'pk1_...',
        help: 'Ve a porkbun.com → Account → API Access. Activa el acceso API y copia tu API Key.',
        link: { label: 'Abrir panel Porkbun', url: 'https://porkbun.com/account/api' },
      },
      {
        key: 'secret_key', label: 'Secret Key', type: 'password',
        placeholder: 'sk1_...',
        help: 'Se genera junto con la API Key. Si la perdiste, crea un par nuevo.',
      },
    ],
  },
  {
    value: 'namecheap',
    label: 'Namecheap',
    fields: [
      {
        key: 'api_user', label: 'API User', type: 'text',
        placeholder: 'Tu nombre de usuario de Namecheap',
        help: 'El mismo usuario con el que inicias sesión en Namecheap.',
      },
      {
        key: 'api_key', label: 'API Key', type: 'password',
        placeholder: 'Namecheap API Key',
        help: 'Ve a Profile → Tools → API Access. Necesitas tener 20+ dominios o 50$+ de gasto para activar la API. Añade la IP de tu servidor a la whitelist.',
        link: { label: 'Abrir panel API', url: 'https://ap.www.namecheap.com/settings/tools/apiaccess/' },
      },
    ],
  },
  {
    value: 'hetzner',
    label: 'Hetzner DNS',
    fields: [
      {
        key: 'api_token', label: 'API Token', type: 'password',
        placeholder: 'Hetzner DNS API Token',
        help: 'Ve a dns.hetzner.com → API Tokens → Create API Token. El token tiene acceso completo a todas tus zonas DNS.',
        link: { label: 'Crear token', url: 'https://dns.hetzner.com/settings/api-token' },
      },
    ],
  },
];

export function ProvidersSection({ providers, loading, onAdd, onTest, onRemove }: ProvidersSectionProps) {
  const [showForm, setShowForm] = useState(false);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)', fontSize: '0.875rem',
      }}>
        Loading providers...
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{
          fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)',
          margin: 0, fontFamily: 'var(--font-sans)',
        }}>
          DNS Providers
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', background: '#3b82f6', color: '#fff',
            border: 'none', borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Plus size={14} />
          Connect Provider
        </button>
      </div>

      {showForm && (
        <ConnectProviderForm
          onAdd={async (input) => {
            const p = await onAdd(input);
            if (p) setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {providers.length === 0 && !showForm ? (
        <div style={{
          borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
          background: 'var(--surface)', padding: '48px 24px', textAlign: 'center',
        }}>
          <Server size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <h3 style={{
            fontSize: '1rem', fontWeight: 600, color: 'var(--text)',
            margin: '0 0 6px', fontFamily: 'var(--font-sans)',
          }}>
            No Providers Connected
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0 0 20px', lineHeight: 1.5 }}>
            Connect a DNS provider to manage zones and records through their API.
          </p>
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', background: '#3b82f6', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Plus size={14} />
            Connect Your First Provider
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {providers.map(p => (
            <ProviderCard key={p.id} provider={p} onTest={() => onTest(p.id)} onRemove={() => onRemove(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Provider Card ───────────────────────────────────────────────────

function ProviderCard({ provider, onTest, onRemove }: {
  provider: DnsProviderAccount;
  onTest: () => Promise<boolean>;
  onRemove: () => Promise<void>;
}) {
  const [testing, setTesting] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [infoOpen, setInfoOpen] = useState(!provider.verified_at);

  const handleTest = async () => {
    setTesting(true);
    await onTest();
    setTesting(false);
  };

  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)',
      background: 'var(--card)',
      padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--radius-md)',
            background: 'rgba(59, 130, 246, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Server size={18} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
              {provider.label}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 1 }}>
              {provider.provider}
              {provider.verified_at && ` · Verified ${new Date(provider.verified_at).toLocaleDateString()}`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {provider.verified
            ? <CheckCircle size={16} style={{ color: '#22c55e' }} />
            : <AlertTriangle size={16} style={{ color: '#f59e0b' }} />}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={handleTest}
          disabled={testing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            color: 'var(--text-dim)', fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)', cursor: testing ? 'not-allowed' : 'pointer',
            opacity: testing ? 0.5 : 1,
          }}
        >
          <RefreshCw size={12} />
          {testing ? 'Testing...' : 'Test Connection'}
        </button>

        {confirmRemove ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: '#f43f5e' }}>Remove?</span>
            <button onClick={() => onRemove()} style={{
              padding: '6px 14px', background: '#f43f5e', border: 'none',
              borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.8125rem',
              fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}>
              Confirm
            </button>
            <button onClick={() => setConfirmRemove(false)} style={{
              padding: '6px 14px', background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              color: 'var(--text-dim)', fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmRemove(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', background: 'transparent',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-md)', color: '#f43f5e',
              fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            <Trash2 size={12} />
            Remove
          </button>
        )}
      </div>

      {/* Info block — what can you do now */}
      {provider.verified && (
        <div style={{
          marginTop: 12,
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(34, 197, 94, 0.25)',
          background: 'rgba(34, 197, 94, 0.06)',
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setInfoOpen(!infoOpen)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 12px', background: 'none', border: 'none',
              cursor: 'pointer', color: '#22c55e', fontSize: '0.8125rem',
              fontWeight: 600, fontFamily: 'var(--font-sans)',
            }}
          >
            <Info size={14} />
            <span style={{ flex: 1, textAlign: 'left' }}>
              Cuenta conectada — siguiente paso
            </span>
            {infoOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {infoOpen && (
            <div style={{
              padding: '0 12px 12px', fontSize: '0.75rem',
              color: 'var(--text-dim)', lineHeight: 1.6,
            }}>
              <p style={{ margin: '0 0 8px' }}>
                Tu cuenta de <strong style={{ color: 'var(--text)' }}>{provider.provider}</strong> est&aacute;
                {' '}conectada. Micelclaw puede leer y gestionar los registros DNS de tus dominios a trav&eacute;s de su API.
              </p>
              <p style={{ margin: '0 0 6px', fontWeight: 600, color: 'var(--text)' }}>
                Ahora puedes:
              </p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>
                  <strong>A&ntilde;adir una zona</strong> — ve a la secci&oacute;n <em>Zones</em> y a&ntilde;ade tu dominio.
                  Micelclaw importar&aacute; autom&aacute;ticamente los registros DNS existentes desde {provider.provider}.
                </li>
                <li style={{ marginTop: 4 }}>
                  <strong>Gestionar registros DNS</strong> — crea, edita o elimina registros (A, AAAA, CNAME, MX, TXT...)
                  directamente desde Micelclaw.
                </li>
                <li style={{ marginTop: 4 }}>
                  <strong>Activar DDNS</strong> — si tu IP p&uacute;blica cambia, Micelclaw puede actualizar
                  autom&aacute;ticamente los registros A/AAAA de tus dominios.
                </li>
                <li style={{ marginTop: 4 }}>
                  <strong>Aplicar plantillas</strong> — configura r&aacute;pidamente email (MX + SPF + DKIM + DMARC),
                  web o servicios con plantillas predefinidas.
                </li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Connect Provider Form ───────────────────────────────────────────

function ConnectProviderForm({ onAdd, onCancel }: {
  onAdd: (input: DnsProviderAccountInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [providerType, setProviderType] = useState<DnsProviderType>('cloudflare');
  const [label, setLabel] = useState('');
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);

  const providerDef = PROVIDER_OPTIONS.find(p => p.value === providerType)!;
  const allFilled = label.trim() && providerDef.fields.every(f => credentials[f.key]?.trim());

  const handleSubmit = async () => {
    if (!allFilled) return;
    setAdding(true);
    await onAdd({ provider: providerType, label: label.trim(), credentials });
    setAdding(false);
  };

  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      background: 'var(--surface)',
      padding: 20, marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
          Connect Provider
        </div>
        <button onClick={onCancel} style={{
          background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-muted)',
        }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <FieldGroup label="Provider">
          <select
            value={providerType}
            onChange={(e) => { setProviderType(e.target.value as DnsProviderType); setCredentials({}); }}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {PROVIDER_OPTIONS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </FieldGroup>
        <FieldGroup label="Nombre para identificarla">
          <input
            type="text"
            placeholder={providerType === 'cloudflare' ? 'ej. johndoe@gmail.com' : providerType === 'porkbun' ? 'ej. Porkbun de johndoe' : 'ej. Mi cuenta de ' + (PROVIDER_OPTIONS.find(p => p.value === providerType)?.label ?? '')}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={inputStyle}
          />
        </FieldGroup>
      </div>

      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
        Conecta la cuenta donde tienes registrado tu dominio. Micelclaw solo necesita permisos de lectura y edición de DNS — nunca accederá a tu facturación ni a otros ajustes.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {providerDef.fields.map(f => (
          <FieldGroup key={f.key} label={f.label}>
            <input
              type={f.type}
              placeholder={f.placeholder}
              value={credentials[f.key] ?? ''}
              onChange={(e) => setCredentials({ ...credentials, [f.key]: e.target.value })}
              style={inputStyle}
            />
            {(f.help || f.link) && (
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                {f.help}
                {f.link && (
                  <>
                    {f.help ? ' ' : ''}
                    <a
                      href={f.link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#3b82f6', textDecoration: 'none' }}
                    >
                      {f.link.label} ↗
                    </a>
                  </>
                )}
              </div>
            )}
          </FieldGroup>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={cancelBtn}>Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={!allFilled || adding}
          style={{
            padding: '6px 14px', background: '#3b82f6', color: '#fff',
            border: 'none', borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-sans)',
            cursor: (!allFilled || adding) ? 'not-allowed' : 'pointer',
            opacity: (!allFilled || adding) ? 0.5 : 1,
          }}
        >
          {adding ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    </div>
  );
}

// ─── Shared ──────────────────────────────────────────────────────────

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: '0.625rem', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.05em',
        color: 'var(--text-muted)', marginBottom: 4,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', background: 'var(--bg)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  color: 'var(--text)', fontSize: '0.8125rem',
  fontFamily: 'var(--font-mono, monospace)', outline: 'none',
};

const cancelBtn: React.CSSProperties = {
  padding: '6px 14px', background: 'transparent',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  color: 'var(--text-dim)', fontSize: '0.8125rem',
  fontFamily: 'var(--font-sans)', cursor: 'pointer',
};
