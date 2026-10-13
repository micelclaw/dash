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

import { useEffect, useState } from 'react';
import { Search, Globe, Shield, Plus, X, CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import * as browserSecuritySvc from '@/services/browser-security.service';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { api } from '@/services/api';


// ─── Types ───────────────────────────────────────────────

interface BrowserSecurityConfig {
  internet_access: boolean;
  local_network_access: boolean;
  local_network_allowlist: string[];
  domain_denylist: string[];
  allow_web_auth: boolean;
  isolated_sessions: boolean;
  persist_sessions: boolean;
}

// ─── Shared components ───────────────────────────────────

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{label}</div>
        {description && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginTop: 2 }}>{description}</div>
        )}
      </div>
      <div style={{ flexShrink: 0, marginLeft: 16 }}>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11,
        background: checked ? 'var(--amber)' : 'var(--surface)',
        border: `1px solid ${checked ? 'var(--amber)' : 'var(--border)'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        transition: 'all 0.15s ease',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: '50%',
        background: checked ? '#06060a' : 'var(--text-dim)',
        position: 'absolute', top: 2,
        left: checked ? 20 : 2,
        transition: 'left 0.15s ease',
      }} />
    </button>
  );
}

function ListEditor({
  items, onAdd, onRemove, placeholder, validate,
}: {
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
  validate?: (item: string) => boolean;
}) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (validate && !validate(trimmed)) {
      toast.error('Invalid format');
      return;
    }
    if (items.includes(trimmed)) {
      toast.error('Already in the list');
      return;
    }
    onAdd(trimmed);
    setInput('');
  };

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: 8,
      marginTop: 6,
    }}>
      {items.length === 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '4px 8px', fontFamily: 'var(--font-sans)' }}>
          (none)
        </div>
      )}
      {items.map((item, i) => (
        <div key={item} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 8px',
          fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', color: 'var(--text)',
        }}>
          <span>{item}</span>
          <button
            onClick={() => onRemove(i)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: '4px 8px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
          }}
        />
        <button
          onClick={handleAdd}
          style={{
            display: 'flex', alignItems: 'center',
            padding: '4px 8px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-dim)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Default Search Mode ─────────────────────────────────
//
// Lives in the `general.default_search_mode` settings field for
// historical reasons (it was originally in GeneralSection). We save
// inline on change instead of marking the general section dirty so
// it doesn't surface a SaveBar in the unrelated General section.

const SEARCH_MODES = [
  { value: 'auto', label: 'Auto (recommended)' },
  { value: 'fulltext', label: 'Always Keywords' },
  { value: 'semantic', label: 'Always Semantic (Pro)' },
];

function DefaultSearchModeRow() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const tier = useAuthStore((s) => s.user?.tier ?? 'free');
  const isPro = tier !== 'free'; // pro OR plus

  if (!settings) return null;
  const current = settings.general?.default_search_mode ?? 'auto';

  const handleChange = async (v: string) => {
    // Free users picking 'semantic' get a toast and the value is rejected
    // before hitting the backend. Without this they'd see "saved" but the
    // actual search behavior would silently fall back to keywords.
    if (v === 'semantic' && !isPro) {
      toast.error('Semantic-only mode requires Pro. Upgrade to enable it.');
      return;
    }
    try {
      const next = { ...settings.general, default_search_mode: v };
      await updateSection('general', next as unknown as Record<string, unknown>);
      toast.success('Search mode saved');
    } catch {
      toast.error('Failed to save');
    }
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <SettingRow
        label="Default Search Mode"
        description="Auto: keywords for Free tier, semantic for Pro. Override here if you prefer one over the other."
      >
        <select
          value={current}
          onChange={(e) => handleChange(e.target.value)}
          style={{
            padding: '6px 10px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text)',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
            minWidth: 200,
          }}
        >
          {SEARCH_MODES.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </SettingRow>
    </div>
  );
}

// ─── Web Search Config ───────────────────────────────────

function WebSearchConfig() {
  type Provider = { id: string; label?: string; configured?: boolean; available?: boolean; reason?: string; credentialSource?: 'none' | 'secretRef' | 'config' | 'env' | 'auth-profile' | 'missing'; credential?: { configured?: boolean } };
  type Status = { provider?: string | null; providers?: Provider[]; route?: { provider?: string; kind?: string; testable?: boolean; reason?: string }; model?: { provider?: string; id?: string; runtimeLabel?: string }; testProvider?: { id?: string } | null };
  type AgentOption = { id: string; name: string; display_name: string; model: string };
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === 'owner' || role === 'admin';
  const [status, setStatus] = useState<Status | null>(null);
  const [provider, setProvider] = useState('');
  const [query, setQuery] = useState('Novedades de OpenClaw 2026.9.6');
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'effective' | 'persisted' | 'uncertain' | null>(null);
  const [testResult, setTestResult] = useState<{ provider: string; results: Array<{ title?: string; url?: string }>; citations?: unknown[]; answer?: string | null } | null>(null);
  const [testError, setTestError] = useState('');
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentId, setAgentId] = useState('');

  const loadStatus = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ data: Status }>('/web-search/status', agentId ? { agent_id: agentId } : undefined);
      setStatus(response.data);
      setProvider(response.data.provider ?? response.data.route?.provider ?? '');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo consultar OpenClaw Web Search');
    } finally { setLoading(false); }
  };
  useEffect(() => {
    void api.get<{ data: AgentOption[] }>('/managed-agents').then((response) => {
      setAgents(response.data ?? []);
      const francis = response.data?.find((item) => item.name === 'francis');
      if (francis) setAgentId(francis.id);
    }).catch(() => undefined);
  }, []);
  useEffect(() => { void loadStatus(); }, [agentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveProvider = async () => {
    setSaving(true);
    try {
      const response = await api.patch<{ data: { confirmation: 'effective' | 'persisted' | 'uncertain' } }>('/web-search/config', { provider }, { timeout: 240_000 });
      const confirmation = response.data.confirmation;
      setSaveState(confirmation);
      if (confirmation === 'effective') toast.success('Proveedor guardado y activo');
      else if (confirmation === 'persisted') toast.success('Proveedor guardado; OpenClaw aún no confirmó su activación');
      else toast.error('El Gateway no confirmó el guardado. Comprueba el estado antes de repetir.');
      if (confirmation !== 'uncertain') await loadStatus();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const testProvider = async () => {
    setTesting(true);
    setTestResult(null);
    setTestError('');
    try {
      const response = await api.post<{ data: { provider: string; results: Array<{ title?: string; url?: string }>; citations?: unknown[]; answer?: string | null } }>('/web-search', { query, max_results: 5 }, { timeout: 40_000 });
      setTestResult(response.data);
      const total = response.data.results?.length ?? response.data.citations?.length ?? 0;
      toast.success(`Búsqueda completada con ${response.data.provider}: ${total} resultados/citas`);
    } catch (error) { const message = error instanceof Error ? error.message : 'La prueba ha fallado'; setTestError(message); toast.error(message); }
    finally { setTesting(false); }
  };

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)',
        fontFamily: 'var(--font-sans)', marginBottom: 12,
      }}>
        <Globe size={16} style={{ color: 'var(--amber)' }} />
        Búsqueda web · OpenClaw
      </div>
      {loading ? <div style={{ color: 'var(--text-muted)', padding: 12 }}><Loader2 size={14} style={{ display: 'inline', animation: 'spin 1s linear infinite' }} /> Consultando OpenClaw…</div> : (
        <>
          <SettingRow label="Proveedor compartido" description="Configuración global administrada por owner/admin; las credenciales se guardan en Secrets.">
            <div style={{ display: 'flex', gap: 6 }}>
              <select disabled={!canManage} value={provider} onChange={(event) => { setProvider(event.target.value); setSaveState(null); }} style={{ padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}>
                {(status?.providers ?? []).map((item) => <option key={item.id} value={item.id}>{item.label ?? item.id}</option>)}
              </select>
              {canManage && <button data-testid="web-search-save-provider" onClick={saveProvider} disabled={!provider || saving} style={{ padding: '6px 10px', background: 'var(--amber)', border: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>{saving ? 'Guardando…' : 'Guardar'}</button>}
            </div>
            {saveState === 'uncertain' && <span style={{ color: 'var(--amber)', fontSize: '0.72rem' }}>Estado incierto: usa Recargar estado antes de reintentar.</span>}
            {saveState === 'persisted' && <span style={{ color: 'var(--amber)', fontSize: '0.72rem' }}>Guardado; activación todavía no confirmada.</span>}
            <button onClick={() => void loadStatus()} disabled={loading} style={{ border: 0, background: 'transparent', color: 'var(--amber)', cursor: 'pointer', fontSize: '0.72rem', padding: 0 }}>Recargar estado</button>
          </SettingRow>
          {canManage && <SettingRow label="Credenciales compartidas" description="Las claves personales antiguas no se copian ni se eliminan automáticamente.">
            <Link to="/settings/secrets" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--amber)', textDecoration: 'none', fontSize: '0.75rem' }}><Shield size={13} /> Configurar Secrets</Link>
          </SettingRow>}
          {(status?.providers ?? []).map((item) => (
            <SettingRow key={item.id} label={item.label ?? item.id} description={item.reason ?? (item.credentialSource === 'secretRef' ? 'Credencial resuelta desde Secrets' : item.credentialSource === 'auth-profile' ? 'Autenticación del perfil de OpenClaw' : item.credentialSource === 'none' ? 'No requiere credencial' : item.configured || item.credential?.configured ? `Configurado por OpenClaw${item.credentialSource ? ` · ${item.credentialSource}` : ''}` : 'Sin credencial compartida')}>
              {item.available ? <span style={{ color: '#22c55e', fontSize: '0.75rem' }}><CheckCircle size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Configurado · cuota sin verificar</span> : <span style={{ color: '#ef4444', fontSize: '0.75rem' }}><XCircle size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> No configurado</span>}
            </SettingRow>
          ))}
          <SettingRow label="Ruta del agente" description={status?.route?.reason ?? 'La búsqueda incorporada al modelo se prueba mediante un turno normal de chat.'}>
            <div style={{ display: 'grid', gap: 5, minWidth: 240 }}>
              <select value={agentId} onChange={(event) => setAgentId(event.target.value)} style={{ padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}>
                {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.display_name}</option>)}
              </select>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>Modelo: {status?.model ? `${status.model.provider ?? ''}/${status.model.id ?? ''}` : agents.find((agent) => agent.id === agentId)?.model ?? '—'} · Ruta: {status?.route?.kind === 'external' ? 'Nativa del modelo' : status?.route?.provider ?? 'Proveedor gestionado'}</span>
            </div>
          </SettingRow>
          <div style={{ marginTop: 14, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'grid', gap: 8 }}>
            <strong style={{ fontSize: '0.8rem' }}>Probar proveedor gestionado</strong>
            <div style={{ display: 'flex', gap: 8 }}><input value={query} onChange={(event) => setQuery(event.target.value)} style={{ flex: 1, padding: '7px 9px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }} /><button onClick={testProvider} disabled={testing || saving || !query.trim() || provider !== (status?.provider ?? status?.route?.provider)} style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>{testing ? 'Probando…' : 'Probar'}</button></div>
            {provider !== (status?.provider ?? status?.route?.provider) && <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Guarda el proveedor elegido antes de probarlo.</span>}
            {testResult && <div style={{ display: 'grid', gap: 5, fontSize: '0.75rem' }}><strong>Respuesta de {testResult.provider}</strong>{testResult.answer && <span>{testResult.answer}</span>}{testResult.results.map((item, index) => <a key={`${item.url ?? index}`} href={item.url} target="_blank" rel="noreferrer" style={{ color: 'var(--amber)' }}>{item.title || item.url}</a>)}</div>}
            {testError && <div role="alert" style={{ color: 'var(--amber)', fontSize: '0.75rem' }}>{testError}</div>}
            <button onClick={() => { window.location.href = '/chat'; }} style={{ justifySelf: 'start', border: 0, background: 'transparent', color: 'var(--amber)', cursor: 'pointer', padding: 0 }}><ExternalLink size={13} style={{ display: 'inline', marginRight: 5 }} />Probar búsqueda nativa del modelo en el chat</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Browser Security Config ─────────────────────────────

function BrowserSecurityConfig() {
  const [config, setConfig] = useState<BrowserSecurityConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      setConfig(await browserSecuritySvc.getBrowserSecurity());
    } catch { /* use defaults */ }
    setLoading(false);
  };

  const patchConfig = async (update: Partial<BrowserSecurityConfig>) => {
    try {
      setConfig(await browserSecuritySvc.updateBrowserSecurity(update));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  if (loading || !config) {
    return (
      <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.875rem', fontFamily: 'var(--font-sans)' }}>
        Loading security settings...
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)',
        fontFamily: 'var(--font-sans)', marginBottom: 12, marginTop: 24,
      }}>
        <Shield size={16} style={{ color: 'var(--amber)' }} />
        Browser Security
      </div>

      <SettingRow
        label="Internet Access"
        description="The agent can browse public websites"
      >
        <Toggle checked={config.internet_access} onChange={(v) => patchConfig({ internet_access: v })} />
      </SettingRow>

      <SettingRow
        label="Local Network Access"
        description="Allow access to local devices (router, NAS, HA)"
      >
        <Toggle checked={config.local_network_access} onChange={(v) => patchConfig({ local_network_access: v })} />
      </SettingRow>

      {config.local_network_access && (
        <div style={{ padding: '0 0 8px 0' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginBottom: 4 }}>
            Allowed local addresses
          </div>
          <ListEditor
            items={config.local_network_allowlist}
            onAdd={(item) => patchConfig({ local_network_allowlist: [...config.local_network_allowlist, item] })}
            onRemove={(i) => patchConfig({ local_network_allowlist: config.local_network_allowlist.filter((_, idx) => idx !== i) })}
            placeholder="192.168.1.1 or homeassistant.local"
          />
        </div>
      )}

      <div style={{ padding: '0 0 8px 0' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginBottom: 4, marginTop: 8 }}>
          Blocked Domains
        </div>
        <ListEditor
          items={config.domain_denylist}
          onAdd={(item) => patchConfig({ domain_denylist: [...config.domain_denylist, item] })}
          onRemove={(i) => patchConfig({ domain_denylist: config.domain_denylist.filter((_, idx) => idx !== i) })}
          placeholder="example.com"
          validate={(item) => /^[\w.-]+\.[a-z]{2,}$/.test(item.replace(/^https?:\/\//, '').split('/')[0] ?? '')}
        />
      </div>

      <SettingRow
        label="Web Authentication"
        description="Allow the agent to log into websites"
      >
        <Toggle checked={config.allow_web_auth} onChange={(v) => patchConfig({ allow_web_auth: v })} />
      </SettingRow>

      {config.allow_web_auth && (
        <div style={{
          padding: '4px 0 4px 16px',
          fontSize: '0.75rem', color: '#f59e0b',
          fontFamily: 'var(--font-sans)',
          borderLeft: '2px solid #f59e0b',
          marginBottom: 4,
        }}>
          The agent will have access to your accounts on allowed websites.
        </div>
      )}

      <SettingRow
        label="Isolated Sessions"
        description="Each browsing session starts clean (no cookies)"
      >
        <Toggle checked={config.isolated_sessions} onChange={(v) => patchConfig({ isolated_sessions: v })} />
      </SettingRow>

      <SettingRow
        label="Persistent Sessions"
        description={config.allow_web_auth ? 'Keep cookies and sessions between uses' : 'Requires Web Authentication to be enabled'}
      >
        <Toggle
          checked={config.persist_sessions}
          onChange={(v) => patchConfig({ persist_sessions: v })}
          disabled={!config.allow_web_auth}
        />
      </SettingRow>
    </div>
  );
}

// ─── Main Section ────────────────────────────────────────

export function SearchSection() {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)',
        fontFamily: 'var(--font-sans)', marginBottom: 20,
      }}>
        <Search size={20} style={{ color: 'var(--amber)' }} />
        Search & Web
      </div>

      <DefaultSearchModeRow />
      <WebSearchConfig />
      <BrowserSecurityConfig />
    </div>
  );
}
