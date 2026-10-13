/** Per-user browser network/auth/session policy. */

import { useCallback, useEffect, useState } from 'react';
import { Globe2, Loader2, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RetryBanner } from '@/components/settings/shared/RetryBanner';
import {
  getBrowserSecurity,
  updateBrowserSecurity,
  type BrowserSecurityConfig,
} from '@/services/browser-security.service';

function ToggleRow({ label, description, checked, disabled, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] py-3 last:border-0">
      <div className="min-w-0 flex-1"><div className="text-sm font-medium text-[var(--text)]">{label}</div><p className="mt-1 text-xs text-[var(--text-muted)]">{description}</p></div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'border-[var(--amber)] bg-[var(--amber)]' : 'border-[var(--border)] bg-[var(--card)]'}`}
      >
        <span className={`absolute top-[3px] h-4 w-4 rounded-full transition-[left] ${checked ? 'left-[23px] bg-[#06060a]' : 'left-[3px] bg-[var(--text-muted)]'}`} />
      </button>
    </div>
  );
}

function StringList({ label, description, values, placeholder, onChange }: {
  label: string;
  description: string;
  values: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
}) {
  const [value, setValue] = useState('');
  const add = () => {
    const next = value.trim();
    if (!next || values.includes(next)) return;
    onChange([...values, next]);
    setValue('');
  };
  return (
    <div className="py-3">
      <div className="text-sm font-medium text-[var(--text)]">{label}</div>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{description}</p>
      <div className="mt-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] p-2">
        {values.length === 0 ? <div className="px-2 py-1 text-xs text-[var(--text-muted)]">No entries</div> : values.map((item) => (
          <div key={item} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface-hover)]">
            <code className="min-w-0 flex-1 break-all">{item}</code>
            <button type="button" aria-label={`Remove ${item}`} onClick={() => onChange(values.filter((valueItem) => valueItem !== item))} className="inline-flex h-6 w-6 items-center justify-center rounded border-0 bg-transparent text-[var(--text-muted)] hover:text-[var(--error)]"><Trash2 size={12} /></button>
          </div>
        ))}
        <div className="mt-2 flex gap-2">
          <input aria-label={label} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') add(); }} placeholder={placeholder} className="h-8 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text)]" />
          <Button type="button" size="sm" variant="secondary" onClick={add} disabled={!value.trim()}><Plus size={12} />Add</Button>
        </div>
      </div>
    </div>
  );
}

export function BrowserSafetyPanel() {
  const [config, setConfig] = useState<BrowserSecurityConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setConfig(await getBrowserSecurity());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load browser safety');
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const patch = async (update: Partial<BrowserSecurityConfig>) => {
    if (!config) return;
    const previous = config;
    setConfig({ ...config, ...update });
    setSaving(true);
    try {
      setConfig(await updateBrowserSecurity(update));
    } catch (saveError) {
      setConfig(previous);
      toast.error(saveError instanceof Error ? saveError.message : 'Could not update browser safety');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="m-0 flex items-center gap-2 text-lg font-semibold text-[var(--text)]"><Globe2 size={19} className="text-[var(--amber)]" />Browser safety</h2><p className="mt-1 max-w-3xl text-sm text-[var(--text-dim)]">Network boundaries, authentication and session isolation for agent-controlled browsing.</p></div>
        <div className="flex items-center gap-2">{saving && <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]"><Loader2 size={12} className="animate-spin" />Saving</span>}<Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh</Button></div>
      </div>
      {error && <RetryBanner severity="error" title="Browser safety unavailable" message={error} onRetry={() => void load()} loading={loading} />}
      {loading && !config ? (
        <div className="flex items-center gap-2 py-10 text-sm text-[var(--text-muted)]"><Loader2 size={15} className="animate-spin" />Loading browser policy…</div>
      ) : config && (
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby="browser-boundaries-title">
            <h3 id="browser-boundaries-title" className="m-0 flex items-center gap-2 text-sm font-semibold text-[var(--text)]"><ShieldCheck size={16} className="text-[var(--amber)]" />Network boundaries</h3>
            <div className="mt-2">
              <ToggleRow label="Internet access" description="Allow public websites." checked={config.internet_access} onChange={(checked) => void patch({ internet_access: checked })} />
              <ToggleRow label="Local network access" description="Allow only the local addresses listed below." checked={config.local_network_access} onChange={(checked) => void patch({ local_network_access: checked })} />
              {config.local_network_access && <StringList label="Allowed local addresses" description="Explicit IP addresses or local hostnames." values={config.local_network_allowlist} placeholder="192.168.1.10 or nas.local" onChange={(values) => void patch({ local_network_allowlist: values })} />}
              <StringList label="Blocked domains" description="Denied even when internet access is enabled." values={config.domain_denylist} placeholder="example.com" onChange={(values) => void patch({ domain_denylist: values })} />
            </div>
          </section>
          <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby="browser-session-title">
            <h3 id="browser-session-title" className="m-0 text-sm font-semibold text-[var(--text)]">Authentication and sessions</h3>
            <div className="mt-2">
              <ToggleRow label="Web authentication" description="Allow agents to sign in to websites." checked={config.allow_web_auth} onChange={(checked) => void patch({ allow_web_auth: checked, ...(!checked ? { persist_sessions: false } : {}) })} />
              <ToggleRow label="Isolated sessions" description="Start each browsing session with a clean context." checked={config.isolated_sessions} onChange={(checked) => void patch({ isolated_sessions: checked })} />
              <ToggleRow label="Persistent sessions" description={config.allow_web_auth ? 'Keep cookies between approved uses.' : 'Enable web authentication first.'} checked={config.persist_sessions} disabled={!config.allow_web_auth} onChange={(checked) => void patch({ persist_sessions: checked })} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
