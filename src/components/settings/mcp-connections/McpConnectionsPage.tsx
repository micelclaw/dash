import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Loader2, LockKeyhole, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSettingsStore } from '@/stores/settings.store';
import { useAuthStore } from '@/stores/auth.store';
import { listManagedAgents } from '@/services/agents-admin.service';
import { mcpConnectionsApi, type McpCatalog, type McpCatalogItem, type McpConnection, type McpTestReport } from '@/services/mcp-connections.service';
import * as gateway from '@/services/gateway.service';
import { ApiError } from '@/services/api';
import { SectionShell } from '../shared/SectionShell';
import { BrandLogo } from './BrandLogo';
import { ConnectionCard, TestDetails, ToolsList, VisualEvidence } from './ConnectionCard';
import { ConnectionEditor, MCP_OAUTH_PENDING, type McpAgentChoice } from './ConnectionEditor';
import { LegacyConnectionEditor } from './LegacyConnectionEditor';
import { mcpCopy } from './copy';

type Editor = { value: McpConnection | McpCatalogItem | null; editing: boolean; draft?: { client_id: string; issuer: string; scope: string } };
export function McpConnectionsPage() {
  const user = useAuthStore((state) => state.user);
  const generation = useAuthStore((state) => state.sessionGeneration);
  return <McpConnectionsContent key={`${user?.id}:${user?.role}:${generation}`} user={user} generation={generation} />;
}
function McpConnectionsContent({ user, generation }: { user: ReturnType<typeof useAuthStore.getState>['user']; generation: number }) {
  const language = useSettingsStore((state) => state.settings?.general.language ?? 'en');
  const t = useMemo(() => mcpCopy(language), [language]);
  const [params, setParams] = useSearchParams();
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';
  const [connections, setConnections] = useState<McpConnection[]>([]);
  const [catalog, setCatalog] = useState<McpCatalog | null>(null);
  const [system, setSystem] = useState<Awaited<ReturnType<typeof mcpConnectionsApi.system>> | null>(null);
  const [legacy, setLegacy] = useState<gateway.McpServerView[]>([]);
  const [deferred, setDeferred] = useState<Record<string, 'edit' | 'delete'>>({});
  const [legacyEditor, setLegacyEditor] = useState<gateway.McpServerView | null>(null);
  const [agents, setAgents] = useState<McpAgentChoice[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [query, setQuery] = useState(''); const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false); const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true); const [oauthMessage, setOauthMessage] = useState<'authorized' | 'authCancelled' | null>(null);
  const [reload, setReload] = useState(0); const seq = useRef(0);
  const mutations = useRef(0); const reads = useRef(0);
  const returnFocus = useRef<HTMLElement | null>(null); const callbackFlight = useRef(false);
  const readConnections = useCallback(async (signal?: AbortSignal) => {
    const epoch = mutations.current; const read = ++reads.current; const atGeneration = generation;
    let rows: McpConnection[];
    try { rows = await mcpConnectionsApi.list(signal); }
    catch (error) {
      if (signal?.aborted || useAuthStore.getState().sessionGeneration !== atGeneration || epoch !== mutations.current || read !== reads.current) return;
      if (error instanceof ApiError && [401, 403, 404].includes(error.status ?? 0)) { setConnections([]); setEditor(null); setLegacyEditor(null); setSystem(null); setLegacy([]); setAgents([]); }
      throw error;
    }
    if (signal?.aborted || useAuthStore.getState().sessionGeneration !== atGeneration || epoch !== mutations.current || read !== reads.current) return;
    setConnections(rows); return rows;
  }, [generation]);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    void Promise.allSettled([
      readConnections(controller.signal), mcpConnectionsApi.system(controller.signal),
      listManagedAgents(), isAdmin ? gateway.getMcpConfig() : Promise.resolve([]),
    ]).then((results) => {
      if (!active) return;
      const [rows, systemResult, agentResult, legacyResult] = results;
      if (rows.status !== 'fulfilled') setLoadError(true);
      if (systemResult.status === 'fulfilled') setSystem(systemResult.value); else setLoadError(true);
      if (agentResult.status === 'fulfilled') setAgents(agentResult.value.map((agent) => ({ id: agent.id, name: typeof agent.display_name === 'string' ? agent.display_name : agent.id })));
      else setLoadError(true);
      if (legacyResult.status === 'fulfilled') setLegacy(legacyResult.value); else { setLegacy([]); setLoadError(true); }
      setLoading(false);
    });
    return () => { active = false; controller.abort(); };
  }, [user?.id, isAdmin, generation, reload, readConnections]);

  useEffect(() => {
    const controller = new AbortController(); const request = ++seq.current;
    let poll: ReturnType<typeof setTimeout> | undefined;
    const search = async () => {
      try {
        const result = await mcpConnectionsApi.catalog(query, controller.signal);
        if (request !== seq.current || controller.signal.aborted) return;
        setCatalog(result); setSearchError(result.registry_error); setSearching(result.refreshing && !result.updated_at);
        if (result.refreshing) poll = setTimeout(() => { void search(); }, 1500);
      } catch {
        if (request !== seq.current || controller.signal.aborted) return;
        setSearching(false); setSearchError(true);
      }
    };
    const timer = setTimeout(() => { void search(); }, query ? 350 : 0);
    return () => { controller.abort(); clearTimeout(timer); if (poll) clearTimeout(poll); };
  }, [query, generation]);

  useEffect(() => {
    if (params.get('mcp_oauth') !== '1' || callbackFlight.current) return;
    const state = params.get('state'); const code = params.get('code'); const error = params.get('error');
    if (!state && !error) return;
    callbackFlight.current = true;
    // Strip authorization code before doing any asynchronous work.
    const clean = new URLSearchParams(params); for (const key of ['code', 'state', 'error', 'error_description', 'mcp_oauth']) clean.delete(key);
    setParams(clean, { replace: true });
    let pending: { state: string; session_key: string; connection_id: string; user_id: string; draft?: { client_id: string; issuer: string; scope: string } } | null = null;
    try { pending = JSON.parse(sessionStorage.getItem(MCP_OAUTH_PENDING) ?? 'null'); sessionStorage.removeItem(MCP_OAUTH_PENDING); } catch { /* unavailable storage */ }
    if (!pending || pending.user_id !== user?.id || pending.state !== state) { queueMicrotask(() => setOauthMessage('authCancelled')); return; }
    const transaction = pending; const atGeneration = generation;
    void mcpConnectionsApi.complete({ state: transaction.state, session_key: transaction.session_key, ...(code ? { code } : {}), ...(error ? { error } : {}) })
      .then(async () => {
        if (useAuthStore.getState().sessionGeneration !== atGeneration) return;
        mutations.current++; const rows = await readConnections();
        if (useAuthStore.getState().sessionGeneration !== atGeneration || !rows) return;
        setOauthMessage('authorized');
        const connection = rows.find((row) => row.id === transaction.connection_id); if (connection) setEditor({ value: connection, editing: true, draft: transaction.draft });
      }).catch(async () => {
        if (useAuthStore.getState().sessionGeneration !== atGeneration) return;
        setOauthMessage('authCancelled');
        try { const rows = await readConnections(); if (useAuthStore.getState().sessionGeneration !== atGeneration || !rows) return; const connection = rows.find((row) => row.id === transaction.connection_id); if (connection) setEditor({ value: connection, editing: true, draft: transaction.draft }); } catch { /* visible cancellation already retained */ }
      });
  }, [params, setParams, user?.id, generation, readConnections]);

  const showEditor = useCallback((value: Editor) => { returnFocus.current = document.activeElement as HTMLElement; setLegacyEditor(null); setEditor(value); }, []);
  function closeEditor() { setEditor(null); setLegacyEditor(null); requestAnimationFrame(() => { if (returnFocus.current?.isConnected) returnFocus.current.focus(); else document.getElementById('mcp-configured')?.focus(); }); }
  function saved(connection: McpConnection) { mutations.current++; setConnections((rows) => rows.some((row) => row.id === connection.id) ? rows.map((row) => row.id === connection.id ? connection : row) : [...rows, connection]); void readConnections().catch(() => setLoadError(true)); }
  function unavailable(id?: string) { mutations.current++; setConnections((rows) => id ? rows.filter((row) => row.id !== id) : []); setLoadError(true); }
  async function test(connection: McpConnection) {
    const atGeneration = generation; const epoch = ++mutations.current;
    let report: McpTestReport;
    try { report = await mcpConnectionsApi.test(connection.id); }
    catch (error) { if (mutations.current === epoch && useAuthStore.getState().sessionGeneration === atGeneration && error instanceof ApiError && [401, 403, 404].includes(error.status ?? 0)) { unavailable(connection.id); if (editor?.value?.id === connection.id) closeEditor(); } throw error; }
    if (useAuthStore.getState().sessionGeneration !== atGeneration) return;
    // Only attach to the exact local revision that was tested.
    setConnections((rows) => rows.map((row) => row.id === connection.id && row.updated_at === connection.updated_at ? { ...row, tools: report.tools, tool_count: report.tool_count, status: report.status, test_report: report, visual_interface: report.visual_interface, last_probe_at: report.checked_at } : row));
    await readConnections();
  }
  async function remove(connection: McpConnection) { const atGeneration = generation; mutations.current++; await mcpConnectionsApi.remove(connection.id); if (useAuthStore.getState().sessionGeneration !== atGeneration) return; mutations.current++; setConnections((rows) => rows.filter((row) => row.id !== connection.id)); if (editor?.value?.id === connection.id) closeEditor(); toast.success(t('removed')); void readConnections().catch(() => setLoadError(true)); }
  return <SectionShell title={t('title')} description={t('description')} maxWidth={760}>
    <div className="space-y-7 text-[var(--text)]">
      <section aria-labelledby="mcp-popular"><div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1"><h3 id="mcp-popular" className="text-sm font-semibold">{t('popular')}</h3><span className="text-[11px] text-[var(--text-muted)]">{t('curated')}</span></div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{catalog?.popular.map((entry) => <button key={entry.id} className="group flex min-h-24 flex-col items-center justify-center gap-3 rounded-xl border border-transparent px-2 py-3 text-xs transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-[var(--amber)]" onClick={() => showEditor({ value: entry, editing: false })}><BrandLogo slug={entry.provider_slug} name={entry.name} size={32} /><span className="text-center">{entry.name}</span></button>) ?? <p className="col-span-full text-xs text-[var(--text-muted)]">{t('loading')}</p>}</div>
      </section>
      <section aria-label={t('search')}><div className="relative"><Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-[var(--text-muted)]" /><Input type="search" aria-label={t('search')} placeholder={t('search')} value={query} onChange={(event) => { setQuery(event.target.value); setSearching(Boolean(event.target.value.trim())); setSearchError(false); setCatalog((previous) => previous ? { ...previous, results: [] } : previous); }} className="h-10 pl-10 pr-10" />{searching && <Loader2 size={15} aria-label={t('loading')} className="absolute right-3 top-3 animate-spin text-[var(--text-muted)]" />}</div>
        <div aria-live="polite" className="mt-2">{searchError && <p className="mb-3 rounded-lg bg-[var(--amber)]/5 px-3 py-2 text-xs text-[var(--text-dim)]">{t('cached')}</p>}
          {query.trim() && <div className="max-h-80 overflow-y-auto rounded-lg border border-[var(--border)]">{catalog?.results.map((entry) => <button key={entry.id} onClick={() => showEditor({ value: entry, editing: false })} className="flex w-full items-center gap-3 border-b border-[var(--border)] px-3 py-3 text-left last:border-b-0 hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-[var(--amber)]"><BrandLogo slug={entry.provider_slug} name={entry.name} size={25} /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-baseline gap-x-2"><span className="break-words text-xs font-semibold">{entry.name}</span><span className="text-[10px] text-[var(--text-muted)]">{entry.provider}</span></span><span className="mt-1 block truncate text-xs text-[var(--text-muted)]">{entry.description}</span></span></button>)}{!searching && !catalog?.results.length && <p className="p-3 text-xs text-[var(--text-muted)]">{t('emptySearch')}</p>}</div>}
        </div><Button variant="link" className="mt-2 px-0 text-xs" onClick={() => showEditor({ value: null, editing: false })}><Plus size={13} />{t('manual')}</Button>
      </section>
      {oauthMessage && <p role="status" className={`rounded-lg border border-[var(--border)] p-3 text-xs ${oauthMessage === 'authorized' ? 'text-[var(--success)]' : 'text-[var(--amber)]'}`}>{t(oauthMessage)}</p>}
      {editor && <ConnectionEditor key={`${editor.editing}:${editor.value?.id ?? 'manual'}`} initial={editor.value} editing={editor.editing} initialDraft={editor.draft} agents={agents} isAdmin={isAdmin} returnAgent={params.get('agent')} userId={user?.id ?? ''} t={t} onClose={closeEditor} onSaved={saved} onUnavailable={unavailable} />}
      {legacyEditor && <LegacyConnectionEditor server={legacyEditor} t={t} onClose={closeEditor} onSaved={() => { setDeferred((states) => ({ ...states, [legacyEditor.name]: 'edit' })); setLoading(true); setLoadError(false); setReload((value) => value + 1); }} />}
      <section aria-labelledby="mcp-configured"><h3 id="mcp-configured" tabIndex={-1} className="mb-4 text-sm font-semibold">{t('configured')}</h3>
        {loadError && <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 text-xs text-[var(--error)]">{t('requestFailed')}<Button variant="outline" onClick={() => { setLoading(true); setLoadError(false); setReload((value) => value + 1); }}>{t('retry')}</Button></div>}
        {loading && <p role="status" className="text-xs text-[var(--text-muted)]">{t('loading')}</p>}
        <div className="space-y-3">{system && <SystemConnection system={system} t={t} language={language} />}
          {connections.map((connection) => <ConnectionCard key={connection.id} connection={connection} t={t} language={language} onEdit={() => showEditor({ value: connection, editing: true })} onTest={() => test(connection)} onRemove={() => remove(connection)} />)}
          {legacy.filter((server) => !server.system).map((server) => <LegacyConnection key={server.name} server={server} t={t} language={language} deferred={deferred[server.name]} onEdit={() => { returnFocus.current = document.activeElement as HTMLElement; setEditor(null); setLegacyEditor(server); }} onRemove={async () => { await gateway.deleteMcpServer(server.name); setDeferred((states) => ({ ...states, [server.name]: 'delete' })); toast.info(t('deleteDeferred')); }} />)}
          {!loading && !connections.length && !system && !legacy.length && !loadError && <p className="text-xs text-[var(--text-muted)]">{t('none')}</p>}
        </div>
      </section>
    </div>
  </SectionShell>;
}

function legacyReport(result: gateway.McpProbeResult): McpTestReport {
  return { ok: false, status: result.ok ? 'server_responds' : 'error', checked_at: new Date().toISOString(),
    transport: result.ok ? 'passed' : 'failed', authorization: 'unverified', discovery: result.ok ? 'passed' : 'unverified', functional: 'unverified',
    tools: result.tools ?? [], tool_count: result.tool_count ?? 0, visual_interface: (result as gateway.McpProbeResult & { visual_interface?: McpTestReport['visual_interface'] }).visual_interface ?? 'unchecked', ...(result.ok ? {} : { error: 'MCP_CONNECTION_FAILED' }) };
}
function SystemConnection({ system, t, language }: { language: string; system: Awaited<ReturnType<typeof mcpConnectionsApi.system>>; t: ReturnType<typeof mcpCopy> }) {
  const [busy, setBusy] = useState(false); const [report, setReport] = useState<McpTestReport | null>(null);
  return <article data-connection-id="system:claw-os" className="rounded-xl border border-[var(--amber)]/25 bg-[var(--card)] p-4"><div className="flex items-center gap-3"><LockKeyhole size={25} className="text-[var(--amber)]" /><div className="flex-1"><h4 className="text-sm font-semibold">Micelclaw <span className="ml-2 text-[10px] font-normal text-[var(--text-muted)]">{t('system')}</span></h4><p className="mt-1 text-xs text-[var(--text-muted)]">{t('systemHint')}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{t(!system.enabled ? 'disabled' : report ? report.status === 'error' ? 'error' : report.status === 'auth_required' ? 'authRequired' : 'responds' : 'unchecked')}</p>{report && <time dateTime={report.checked_at} className="mt-1 block text-[10px] text-[var(--text-muted)]">{new Date(report.checked_at).toLocaleString(language)}</time>}</div><VisualEvidence state={report?.visual_interface ?? 'unchecked'} t={t} /></div><ToolsList tools={report?.tools ?? system.tools} count={report?.tool_count ?? system.tool_count} t={t} />{report && <TestDetails report={report} t={t} />}<div className="mt-3 flex justify-end"><Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { setReport(await mcpConnectionsApi.systemTest()); } catch { setReport(legacyReport({ ok: false })); } finally { setBusy(false); } }}>{busy && <Loader2 size={13} className="animate-spin" />}{t('test')}</Button></div></article>;
}
function LegacyConnection({ server, t, language, deferred, onEdit, onRemove }: { language: string; server: gateway.McpServerView; deferred?: 'edit' | 'delete'; t: ReturnType<typeof mcpCopy>; onEdit: () => void; onRemove: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(false); const [report, setReport] = useState<McpTestReport | null>(null);
  return <article className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"><div className="flex items-center gap-3"><BrandLogo name={server.name} /><div className="min-w-0 flex-1"><h4 className="break-words text-sm font-semibold">{server.name}</h4><p className="mt-1 text-xs text-[var(--text-muted)]">{t('system')} · {server.transport === 'stdio' ? t('local') : 'HTTP'} · {t(!server.enabled ? 'disabled' : report ? report.status === 'error' ? 'error' : 'responds' : 'unchecked')}</p>{report && <time dateTime={report.checked_at} className="mt-1 block text-[10px] text-[var(--text-muted)]">{new Date(report.checked_at).toLocaleString(language)}</time>}</div><VisualEvidence state={report?.visual_interface ?? 'unchecked'} t={t} /></div>{report && <><ToolsList tools={report.tools} count={report.tool_count} t={t} /><TestDetails report={report} t={t} /></>}{error && <p role="alert" className="mt-2 text-xs text-[var(--error)]">{t('requestFailed')}</p>}{deferred && <p role="status" className="mt-3 text-xs text-[var(--amber)]">{t(deferred === 'delete' ? 'deleteDeferred' : 'deferred')}</p>}{deferred === 'delete' ? null : confirm ? <div className="mt-3 rounded-lg border border-[var(--error)]/40 p-3 text-xs"><p>{t('deleteConfirm')}</p><div className="mt-3 flex justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={() => setConfirm(false)}>{t('cancel')}</Button><Button variant="destructive" autoFocus disabled={busy} onClick={async () => { setBusy(true); try { await onRemove(); } catch { setError(true); } finally { setBusy(false); } }}>{t('remove')}</Button></div></div> : <div className="mt-3 flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); setError(false); try { setReport(legacyReport(await gateway.testMcpServer({ ...server, name: server.name }))); } catch { setError(true); } finally { setBusy(false); } }}>{t('test')}</Button><Button variant="ghost" disabled={busy} onClick={onEdit}>{t('edit')}</Button><Button variant="ghost" disabled={busy} onClick={() => setConfirm(true)}>{t('remove')}</Button></div>}</article>;
}
