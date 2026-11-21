import { useEffect, useId, useRef, useState } from 'react';
import { ExternalLink, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/services/api';
import { mcpConnectionsApi, type McpCatalogItem, type McpConnection, type McpConnectionInput } from '@/services/mcp-connections.service';
import { BrandLogo } from './BrandLogo';
import type { mcpCopy } from './copy';

export interface McpAgentChoice { id: string; name: string }
type Props = {
  initial: McpConnection | McpCatalogItem | null; editing: boolean;
  agents: McpAgentChoice[]; isAdmin: boolean; returnAgent?: string | null; userId: string;
  t: ReturnType<typeof mcpCopy>; onClose: () => void; onSaved: (connection: McpConnection) => void;
  onUnavailable: (id?: string) => void;
  initialDraft?: { client_id: string; issuer: string; scope: string };
};
export const MCP_RETURN_PATH = '/settings?group=connectivity&section=mcp-connections&mcp_oauth=1';
export const MCP_OAUTH_PENDING = 'micelclaw-mcp-oauth';

export function ConnectionEditor({ initial, editing, agents, isAdmin, returnAgent, userId, t, onClose, onSaved, onUnavailable, initialDraft }: Props) {
  const persisted = editing ? initial as McpConnection : null;
  const [current, setCurrent] = useState(persisted);
  const [name, setName] = useState(persisted?.display_name ?? (initial as McpCatalogItem)?.name ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [transport, setTransport] = useState<'streamable-http' | 'sse'>(initial?.transport ?? 'streamable-http');
  const [mode, setMode] = useState<McpConnectionInput['auth_mode']>(initial?.auth_mode === 'unknown' ? initial.required_headers?.length ? 'headers' : 'none' : initial?.auth_mode ?? 'none');
  const [ownerType, setOwnerType] = useState<'personal' | 'shared'>(persisted?.owner_type ?? 'personal');
  const [token, setToken] = useState(''); const [headerValues, setHeaderValues] = useState<Record<string, string>>({});
  const [headerName, setHeaderName] = useState('X-API-Key'); const [headerValue, setHeaderValue] = useState('');
  const [clientId, setClientId] = useState(initialDraft?.client_id ?? persisted?.oauth_client_id ?? ''); const [clientSecret, setClientSecret] = useState('');
  const [issuer, setIssuer] = useState(initialDraft?.issuer ?? persisted?.oauth_issuer ?? ''); const [scope, setScope] = useState(initialDraft?.scope ?? persisted?.oauth_scope ?? (initial as McpCatalogItem)?.default_scope ?? '');
  const [selected, setSelected] = useState<string[]>(returnAgent && !persisted ? [returnAgent] : []);
  const baseline = useRef<string[]>([]);
  const [grantLoading, setGrantLoading] = useState(Boolean(persisted?.can_grant));
  const [grantError, setGrantError] = useState(false);
  const [busy, setBusy] = useState<'save' | 'oauth' | null>(null);
  const [error, setError] = useState(''); const mounted = useRef(true); const flight = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null); const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const canManage = !current || current.can_manage;
  const credentialsPreserved = Boolean(current?.has_credentials && current.url === url && current.auth_mode === mode);
  const preparation = initial?.url === url ? initial.preparation : undefined;
  const requiredHeaders = initial?.required_headers ?? [];
  useEffect(() => {
    mounted.current = true; heading.current?.focus();
    if (persisted?.can_grant) {
      void mcpConnectionsApi.grants(persisted.id).then((grants) => {
        if (!mounted.current) return;
        baseline.current = grants.map((grant) => grant.agent_id); setSelected(baseline.current);
      }).catch(() => { if (mounted.current) setGrantError(true); })
        .finally(() => { if (mounted.current) setGrantLoading(false); });
    }
    return () => { mounted.current = false; };
  }, [persisted?.id, persisted?.can_grant]);

  async function saveConnection(): Promise<McpConnection> {
    if (!canManage && current) return current;
    const headers = { ...Object.fromEntries(Object.entries(headerValues).filter(([, value]) => value)), ...(mode === 'headers' && headerValue ? { [headerName]: headerValue } : {}) };
    const input: McpConnectionInput = { display_name: name.trim(), url: url.trim(), transport, auth_mode: mode,
      owner_type: ownerType, ...(token && mode === 'bearer' ? { bearer_token: token } : {}),
      ...(headers && Object.keys(headers).length ? { headers } : {}),
      ...(current ? { expected_updated_at: current.updated_at } : { catalog_id: initial?.id }),
    };
    const saved = await (current ? mcpConnectionsApi.update(current.id, input) : mcpConnectionsApi.create(input));
    if (mounted.current) { setCurrent(saved); setToken(''); setHeaderValue(''); setHeaderValues({}); onSaved(saved); }
    return saved;
  }
  async function submit(authorize: boolean) {
    if (flight.current) return; flight.current = true; setBusy(authorize ? 'oauth' : 'save'); setError('');
    try {
      if (authorize && !form.current?.reportValidity()) return;
      if (authorize && preparation && ((!current?.has_oauth_client && !clientId) || (!current?.has_oauth_client_secret && !clientSecret))) { setError(t(preparation === 'slack-app' ? 'slackSetup' : 'googleSetup')); return; }
      const saved = await saveConnection();
      if (!mounted.current) return;
      if (saved.can_grant) {
        try {
          if (saved.owner_type === 'shared' && isAdmin && selected.length) await mcpConnectionsApi.userGrant(saved.id);
          for (const agentId of selected.filter((value) => !baseline.current.includes(value))) { await mcpConnectionsApi.grant(saved.id, agentId); baseline.current.push(agentId); }
          for (const agentId of [...baseline.current].filter((value) => !selected.includes(value))) { await mcpConnectionsApi.revoke(saved.id, agentId); baseline.current = baseline.current.filter((value) => value !== agentId); }
        } catch { setError(t('grantIncomplete')); return; }
      }
      if (authorize) {
        const sessionKey = crypto.randomUUID() + crypto.randomUUID();
        const redirectUrl = new URL(MCP_RETURN_PATH, window.location.origin).href;
        const result = await mcpConnectionsApi.authorize(saved.id, {
          expected_updated_at: saved.updated_at, session_key: sessionKey, redirect_url: redirectUrl,
          ...(clientId ? { client_id: clientId } : {}), ...(clientSecret ? { client_secret: clientSecret } : {}),
          ...(issuer ? { issuer } : {}), scope,
        });
        if (!mounted.current) return;
        // Only transaction identity and non-secret selection survive a redirect.
        // No bearer, client secret, code, or token is written to browser storage.
        sessionStorage.setItem(MCP_OAUTH_PENDING, JSON.stringify({ state: result.state, session_key: sessionKey, connection_id: saved.id, user_id: userId, draft: { client_id: clientId, issuer, scope } }));
        setClientSecret(''); setToken(''); setHeaderValue('');
        window.location.assign(result.authorization_url);
      } else { toast.success(t('saved')); onClose(); }
    } catch (failure) {
      if (failure instanceof ApiError && [401, 403, 404].includes(failure.status ?? 0)) {
        setToken(''); setClientSecret(''); setHeaderValues({}); setHeaderValue(''); toast.error(t('requestFailed')); onUnavailable(current?.id); onClose(); return;
      }
      if (mounted.current) setError(failure instanceof ApiError && failure.code === 'MCP_CONNECTION_CHANGED' ? t('conflict') : failure instanceof ApiError && failure.code === 'MCP_OAUTH_PREPARATION_REQUIRED' ? t(preparation === 'slack-app' ? 'slackSetup' : 'googleSetup') : t('requestFailed'));
    } finally { flight.current = false; if (mounted.current) setBusy(null); }
  }
  const label = (key: string) => `${id}-${key}`;
  return <section aria-labelledby={label('title')} className="scroll-mt-6 rounded-xl border border-[var(--amber)]/40 bg-[var(--card)] p-4 sm:p-5">
    <div className="mb-5 flex items-start gap-3"><BrandLogo slug={initial?.provider_slug} name={name} /><div className="min-w-0 flex-1"><h3 tabIndex={-1} ref={heading} id={label('title')} className="text-sm font-semibold outline-none">{t('setup')}</h3>{initial && <p className="mt-1 text-xs text-[var(--text-muted)]">{(initial as McpCatalogItem).name ?? persisted?.display_name}</p>}</div><Button variant="ghost" size="icon" aria-label={t('close')} disabled={!!busy} onClick={onClose}><X size={15} /></Button></div>
    <form ref={form} onSubmit={(event) => { event.preventDefault(); void submit(false); }} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-xs">{t('name')}<Input autoComplete="off" required maxLength={120} value={name} disabled={!canManage || !!busy} onChange={(event) => setName(event.target.value)} /></label>
        <label className="space-y-1.5 text-xs">{t('url')}<Input type="url" required placeholder="https://…/mcp" value={url} disabled={!canManage || !!busy} onChange={(event) => setUrl(event.target.value)} /></label></div>
      {preparation && <div className="rounded-lg border border-[var(--amber)]/25 bg-[var(--amber)]/5 p-3 text-xs leading-relaxed text-[var(--text-dim)]">{t(preparation === 'google-client' ? 'googleSetup' : 'slackSetup')}{initial?.documentation_url && <a className="mt-2 inline-flex items-center gap-1 text-[var(--amber)]" href={initial.documentation_url} target="_blank" rel="noopener noreferrer">{t('docs')}<ExternalLink size={11} /></a>}</div>}
      {initial?.maturity === 'developer_preview' && <p className="text-xs text-[var(--text-muted)]">{t('preview')}</p>}
      <details open={Boolean(preparation)} className="rounded-lg border border-[var(--border)] p-3"><summary className="cursor-pointer text-xs font-medium">{t('advanced')}</summary>
        <fieldset disabled={!canManage || !!busy} className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-4 text-xs">{(['streamable-http', 'sse'] as const).map((value) => <label key={value} className="flex items-center gap-2"><input type="radio" name={label('transport')} checked={transport === value} onChange={() => setTransport(value)} />{value === 'sse' ? 'SSE' : 'HTTP streaming'}</label>)}</div>
          <fieldset><legend className="mb-2 text-xs text-[var(--text-muted)]">{t('authentication')}</legend><div className="flex flex-wrap gap-3 text-xs">{(['oauth', 'bearer', 'headers', 'none'] as const).map((value) => <label key={value} className="flex items-center gap-1.5"><input type="radio" name={label('auth')} disabled={value === 'none' && Boolean(initial?.provider_slug && initial.url === url)} checked={mode === value} onChange={() => setMode(value)} />{value === 'oauth' ? 'OAuth' : t(value === 'none' ? 'noAuth' : value)}</label>)}</div></fieldset>
          {mode === 'bearer' && <label className="block space-y-1.5 text-xs">{t('bearer')} · {credentialsPreserved ? t('preserved') : t('required')}<Input type="password" autoComplete="new-password" required={!credentialsPreserved} value={token} onChange={(event) => setToken(event.target.value)} /></label>}
          {(mode === 'headers' || requiredHeaders.length > 0) && <div className="space-y-3">{requiredHeaders.map((header) => <label key={header.name} className="block space-y-1.5 text-xs">{header.name} · {credentialsPreserved ? t('preserved') : t('required')}<Input type={header.secret ? 'password' : 'text'} autoComplete="off" required={!credentialsPreserved} value={headerValues[header.name] ?? ''} onChange={(event) => setHeaderValues((values) => ({ ...values, [header.name]: event.target.value }))} />{header.description && <span className="block text-[var(--text-muted)]">{header.description}</span>}</label>)}{!requiredHeaders.length && <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-xs">{t('headers')}<Input required value={headerName} onChange={(event) => setHeaderName(event.target.value)} /></label><label className="space-y-1.5 text-xs">{credentialsPreserved ? t('preserved') : t('required')}<Input type="password" autoComplete="new-password" required={!credentialsPreserved} value={headerValue} onChange={(event) => setHeaderValue(event.target.value)} /></label></div>}</div>}
          {mode === 'oauth' && <div className="space-y-3"><p className="break-all text-xs text-[var(--text-muted)]">{t('redirect')} <code>{new URL(MCP_RETURN_PATH, window.location.origin).href}</code></p><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-xs">{t('clientId')}{preparation && !current?.has_oauth_client ? ` · ${t('required')}` : ''}<Input autoComplete="off" value={clientId} onChange={(event) => setClientId(event.target.value)} /></label><label className="space-y-1.5 text-xs">{t('clientSecret')}{preparation && !current?.has_oauth_client_secret ? ` · ${t('required')}` : ''}<Input type="password" autoComplete="new-password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} placeholder={current?.has_oauth_client_secret ? t('preserved') : ''} /></label></div>{!preparation && <label className="block space-y-1.5 text-xs">{t('issuer')}<Input type="url" required={Boolean(clientId)} placeholder="https://…" value={issuer} onChange={(event) => setIssuer(event.target.value)} /></label>}<label className="block space-y-1.5 text-xs">{t('scope')}<Input autoComplete="off" value={scope} onChange={(event) => setScope(event.target.value)} /></label></div>}
        </fieldset>
      </details>
      {isAdmin && !current && <fieldset className="flex flex-wrap gap-4 text-xs" disabled={!!busy}>{(['personal', 'shared'] as const).map((value) => <label key={value} className="flex items-center gap-2"><input type="radio" name={label('owner')} checked={ownerType === value} onChange={() => setOwnerType(value)} />{t(value)}</label>)}</fieldset>}
      {(!current || current.can_grant) && <fieldset disabled={!!busy || grantLoading || grantError} className="space-y-2"><legend className="mb-2 text-xs font-medium">{t('agents')}</legend><p className="mb-3 text-xs text-[var(--text-muted)]">{t('explicit')}</p>{grantLoading ? <p className="text-xs">{t('loading')}</p> : <div className="grid gap-2 sm:grid-cols-2">{agents.map((agent) => <label key={agent.id} className="flex min-h-9 items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs"><input type="checkbox" checked={selected.includes(agent.id)} onChange={(event) => setSelected((values) => event.target.checked ? [...values, agent.id] : values.filter((value) => value !== agent.id))} /><span className="truncate">{agent.name}</span></label>)}</div>}</fieldset>}
      {(error || grantError) && <p role="alert" className="text-xs text-[var(--error)]">{error || t('requestFailed')}</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] pt-4"><Button type="button" variant="ghost" disabled={!!busy} onClick={onClose}>{t('cancel')}</Button>{mode === 'oauth' && canManage && <Button type="button" variant="outline" disabled={!!busy || grantLoading || grantError || !name.trim() || !url.trim()} onClick={() => void submit(true)}>{busy === 'oauth' && <Loader2 size={13} className="animate-spin" />}{t('connect')}</Button>}<Button type="submit" disabled={!!busy || grantLoading || grantError}>{busy === 'save' && <Loader2 size={13} className="animate-spin" />}{busy === 'save' ? t('saving') : t('save')}</Button></div>
    </form>
  </section>;
}
