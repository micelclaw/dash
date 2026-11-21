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
import { X, Plus, Globe, Server, Mail, Zap } from 'lucide-react';
import { useEscapeToClose } from '@/hooks/use-escape-to-close';
import type { ProxyHostInput, ProxyHost } from '../hooks/use-proxy-hosts';
import { hasMessage, useI18n } from '@/i18n';

interface HostEditorDialogProps {
  host?: ProxyHost | null;
  onSave: (input: ProxyHostInput) => Promise<unknown>;
  onClose: () => void;
}

// ─── Presets ─────────────────────────────────────────────────────────

interface Preset {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  defaults: Partial<ProxyHostInput>;
}

const PRESETS: Preset[] = [
  {
    id: 'website', label: 'Website', icon: Globe, color: '#3b82f6',
    defaults: { scheme: 'http', forward_host: 'localhost', forward_port: 3000, block_exploits: true, compression: true },
  },
  {
    id: 'api', label: 'API / Backend', icon: Server, color: '#22c55e',
    defaults: { scheme: 'http', forward_host: 'localhost', forward_port: 8080, block_exploits: true, rate_limit: '100r/m' },
  },
  {
    id: 'app', label: 'Web App', icon: Zap, color: '#a855f7',
    defaults: { scheme: 'https', forward_host: 'localhost', forward_port: 8443, block_exploits: true, websocket_support: true, compression: true },
  },
  {
    id: 'mail', label: 'Webmail', icon: Mail, color: '#f59e0b',
    defaults: { scheme: 'http', forward_host: 'localhost', forward_port: 8880, block_exploits: true, websocket_support: true },
  },
];

// ─── Component ───────────────────────────────────────────────────────

export function HostEditorDialog({ host, onSave, onClose }: HostEditorDialogProps) {
  const { t } = useI18n();
  const isEdit = !!host;
  const [tab, setTab] = useState<'details' | 'ssl' | 'advanced'>('details');
  const [saving, setSaving] = useState(false);

  // Cerrar con Escape (formulario: se ignora si el foco está en un campo).
  useEscapeToClose(onClose);

  // Form state
  const [domainInput, setDomainInput] = useState('');
  const [domains, setDomains] = useState<string[]>(host?.domain_names ?? []);
  const [scheme, setScheme] = useState(host?.scheme ?? 'http');
  const [forwardHost, setForwardHost] = useState(host?.forward_host ?? '');
  const [forwardPort, setForwardPort] = useState(host?.forward_port ?? 80);
  const [label, setLabel] = useState(host?.label ?? '');
  const [notes, setNotes] = useState(host?.notes ?? '');

  // SSL
  const [sslMode, setSslMode] = useState(host?.ssl_mode ?? 'none');
  const [forceSsl, setForceSsl] = useState(host?.force_ssl ?? false);
  const [hstsEnabled, setHstsEnabled] = useState(host?.hsts_enabled ?? false);

  // Advanced
  const [blockExploits, setBlockExploits] = useState(host?.block_exploits ?? true);
  const [websocketSupport, setWebsocketSupport] = useState(host?.websocket_support ?? false);
  const [compression, setCompression] = useState(host?.compression ?? false);
  const [cacheAssets, setCacheAssets] = useState(host?.cache_assets ?? false);
  const [http2Support, setHttp2Support] = useState(host?.http2_support ?? true);
  const [rateLimit, setRateLimit] = useState(host?.rate_limit ?? '');

  const addDomain = () => {
    const d = domainInput.trim().toLowerCase();
    if (d && !domains.includes(d)) {
      setDomains([...domains, d]);
    }
    setDomainInput('');
  };

  const removeDomain = (d: string) => setDomains(domains.filter(x => x !== d));

  const applyPreset = (preset: Preset) => {
    const d = preset.defaults;
    if (d.scheme) setScheme(d.scheme);
    if (d.forward_host) setForwardHost(d.forward_host);
    if (d.forward_port) setForwardPort(d.forward_port);
    if (d.block_exploits !== undefined) setBlockExploits(d.block_exploits);
    if (d.websocket_support !== undefined) setWebsocketSupport(d.websocket_support);
    if (d.compression !== undefined) setCompression(d.compression);
    if (d.rate_limit !== undefined) setRateLimit(d.rate_limit ?? '');
  };

  const handleSave = async () => {
    if (domains.length === 0 || !forwardHost) return;
    setSaving(true);
    const input: ProxyHostInput = {
      host_type: 'proxy',
      domain_names: domains,
      scheme,
      forward_host: forwardHost,
      forward_port: forwardPort,
      ssl_mode: sslMode,
      force_ssl: forceSsl,
      hsts_enabled: hstsEnabled,
      block_exploits: blockExploits,
      websocket_support: websocketSupport,
      compression,
      cache_assets: cacheAssets,
      http2_support: http2Support,
      rate_limit: rateLimit || null,
      label: label || undefined,
      notes: notes || undefined,
    };
    await onSave(input);
    setSaving(false);
  };

  const canSave = domains.length > 0 && forwardHost.trim().length > 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="proxy-host-dialog-title" style={{
        width: 640, maxHeight: '85vh',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg, 12px)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span id="proxy-host-dialog-title" style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
            {isEdit ? t('proxy.editHost') : t('proxy.newHost')}
          </span>
          <button onClick={onClose} aria-label={t('proxy.close')} title={t('proxy.close')} style={{
            background: 'none', border: 'none', padding: 4,
            cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 0,
          borderBottom: '1px solid var(--border)',
          padding: '0 20px',
        }} role="tablist" aria-label={t('proxy.tabs')}>
          {(['details', 'ssl', 'advanced'] as const).map(tabKey => (
            <button
              key={tabKey}
              id={`proxy-tab-${tabKey}`}
              role="tab"
              aria-selected={tab === tabKey}
              aria-controls="proxy-host-panel"
              onClick={() => setTab(tabKey)}
              style={{
                padding: '10px 16px',
                background: 'none', border: 'none',
                borderBottom: tab === tabKey ? '2px solid var(--amber)' : '2px solid transparent',
                color: tab === tabKey ? 'var(--text)' : 'var(--text-muted)',
                fontSize: '0.8125rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                textTransform: 'capitalize',
              }}
            >
              {t(`proxy.${tabKey}`)}
            </button>
          ))}
        </div>

        {/* Body */}
        <div id="proxy-host-panel" role="tabpanel" aria-labelledby={`proxy-tab-${tab}`} style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {tab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Presets (only for new) */}
              {!isEdit && (
                <div>
                  <FieldLabel>{t('proxy.quickPreset')}</FieldLabel>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {PRESETS.map(p => (
                      <button
                        key={p.id}
                        onClick={() => applyPreset(p)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          background: 'var(--surface)',
                          cursor: 'pointer',
                          fontSize: '0.75rem', fontWeight: 600,
                          color: 'var(--text-dim)',
                          fontFamily: 'var(--font-sans)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = p.color + '66'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                      >
                        <p.icon size={12} style={{ color: p.color }} />
                        {hasMessage(`proxy.preset.${p.id}`) ? t(`proxy.preset.${p.id}`) : p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Domain Names */}
              <div>
                <FieldLabel>{t('proxy.domainNames')}</FieldLabel>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder={t('proxy.domainExample')}
                    aria-label={t('proxy.domainNames')}
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDomain(); } }}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={addDomain} style={smallBtnStyle} title={t('proxy.addDomain')} aria-label={t('proxy.addDomain')}>
                    <Plus size={14} />
                  </button>
                </div>
                {domains.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {domains.map(d => (
                      <span key={d} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        fontSize: '0.8125rem',
                        fontFamily: 'var(--font-mono, monospace)',
                        color: 'var(--text)',
                      }}>
                        {d}
                        <button onClick={() => removeDomain(d)} title={t('proxy.removeDomain', { domain: d })} aria-label={t('proxy.removeDomain', { domain: d })} style={{
                          background: 'none', border: 'none', padding: 0,
                          cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
                        }}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Forward destination */}
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 100px', gap: 10 }}>
                <div>
                  <FieldLabel>{t('proxy.scheme')}</FieldLabel>
                  <select
                    aria-label={t('proxy.scheme')}
                    value={scheme}
                    onChange={(e) => setScheme(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="http">http</option>
                    <option value="https">https</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>{t('proxy.forwardHost')}</FieldLabel>
                  <input
                    type="text"
                    placeholder="localhost"
                    aria-label={t('proxy.forwardHost')}
                    value={forwardHost}
                    onChange={(e) => setForwardHost(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <FieldLabel>{t('proxy.port')}</FieldLabel>
                  <input
                    type="number"
                    aria-label={t('proxy.port')}
                    value={forwardPort}
                    onChange={(e) => setForwardPort(parseInt(e.target.value) || 80)}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Label & Notes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <FieldLabel>{t('proxy.labelOptional')}</FieldLabel>
                  <input
                    type="text"
                    placeholder={t('proxy.labelExample')}
                    aria-label={t('proxy.labelOptional')}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <FieldLabel>{t('proxy.notesOptional')}</FieldLabel>
                  <input
                    type="text"
                    placeholder={t('proxy.internalNotes')}
                    aria-label={t('proxy.notesOptional')}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          )}

          {tab === 'ssl' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <FieldLabel>{t('proxy.sslMode')}</FieldLabel>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['none', 'auto', 'custom', 'dns_challenge'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setSslMode(m)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-sm)',
                        border: sslMode === m ? '1px solid var(--amber)' : '1px solid var(--border)',
                        background: sslMode === m ? 'rgba(212, 160, 23, 0.08)' : 'var(--surface)',
                        color: sslMode === m ? 'var(--amber)' : 'var(--text-dim)',
                        fontSize: '0.8125rem', fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {m === 'none' ? t('proxy.ssl.none') : m === 'auto' ? t('proxy.ssl.auto') : m === 'custom' ? t('proxy.ssl.custom') : t('proxy.ssl.dnsChallenge')}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  {sslMode === 'auto' && t('proxy.ssl.autoHelp')}
                  {sslMode === 'none' && t('proxy.ssl.noneHelp')}
                  {sslMode === 'custom' && t('proxy.ssl.customHelp')}
                  {sslMode === 'dns_challenge' && t('proxy.ssl.dnsHelp')}
                </div>
              </div>

              <ToggleField label={t('proxy.forceHttps')} description={t('proxy.forceHttpsHelp')} checked={forceSsl} onChange={setForceSsl} />
              <ToggleField label={t('proxy.hsts')} description={t('proxy.hstsHelp')} checked={hstsEnabled} onChange={setHstsEnabled} />
            </div>
          )}

          {tab === 'advanced' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <ToggleField label={t('proxy.blockExploits')} description={t('proxy.blockExploitsHelp')} checked={blockExploits} onChange={setBlockExploits} />
              <ToggleField label={t('proxy.websocket')} description={t('proxy.websocketHelp')} checked={websocketSupport} onChange={setWebsocketSupport} />
              <ToggleField label={t('proxy.compression')} description={t('proxy.compressionHelp')} checked={compression} onChange={setCompression} />
              <ToggleField label={t('proxy.cacheAssets')} description={t('proxy.cacheAssetsHelp')} checked={cacheAssets} onChange={setCacheAssets} />
              <ToggleField label={t('proxy.http2')} description={t('proxy.http2Help')} checked={http2Support} onChange={setHttp2Support} />

              <div>
                <FieldLabel>{t('proxy.rateLimit')}</FieldLabel>
                <input
                  type="text"
                  placeholder={t('proxy.rateLimitPlaceholder')}
                  aria-label={t('proxy.rateLimit')}
                  value={rateLimit}
                  onChange={(e) => setRateLimit(e.target.value)}
                  style={{ ...inputStyle, maxWidth: 250 }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
        }}>
          <button onClick={onClose} style={cancelBtnStyle}>{t('proxy.cancel')}</button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            style={{
              ...saveBtnStyle,
              opacity: (!canSave || saving) ? 0.5 : 1,
              cursor: (!canSave || saving) ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? t('proxy.saving') : isEdit ? t('proxy.updateHost') : t('proxy.createHost')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared UI ───────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.6875rem', fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.05em',
      color: 'var(--text-muted)', marginBottom: 4,
    }}>
      {children}
    </div>
  );
}

function ToggleField({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      cursor: 'pointer', padding: '8px 10px',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)',
      background: checked ? 'rgba(34, 197, 94, 0.04)' : 'var(--surface)',
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: '#22c55e', marginTop: 2 }}
      />
      <div>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
          {label}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>
          {description}
        </div>
      </div>
    </label>
  );
}

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

const smallBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 36, height: 36, flexShrink: 0,
  background: '#3b82f6', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-dim)',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
};

const saveBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: '#3b82f6',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  color: '#fff',
  fontSize: '0.8125rem',
  fontWeight: 600,
  fontFamily: 'var(--font-sans)',
};
