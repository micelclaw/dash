import { useState } from 'react';
import { AppWindow, CircleHelp, LayoutGrid, Loader2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { McpConnection, McpTestReport, McpTool } from '@/services/mcp-connections.service';
import { BrandLogo } from './BrandLogo';
import type { mcpCopy } from './copy';
type Copy = ReturnType<typeof mcpCopy>;
export function VisualEvidence({ state, t }: { state: McpTestReport['visual_interface']; t: Copy }) {
  const Icon = state === 'advertised' ? AppWindow : state === 'none' ? LayoutGrid : CircleHelp;
  const label = t(state === 'advertised' ? 'uiAdvertised' : state === 'none' ? 'uiNone' : 'uiUnknown');
  return <span tabIndex={0} role="img" aria-label={label} title={label} className="inline-flex rounded text-[var(--text-muted)] focus-visible:outline focus-visible:outline-[var(--amber)]"><Icon size={14} /></span>;
}

export function ToolsList({ tools, count, t }: { tools: McpTool[]; count: number; t: Copy }) {
  return <details className="mt-3 text-xs"><summary className="w-fit cursor-pointer rounded py-1 text-[var(--text-dim)] focus-visible:outline focus-visible:outline-[var(--amber)]">{count} {t('tools')}</summary>
    <ul className="mt-2 max-h-64 space-y-3 overflow-auto pr-2">{tools.map((tool) => <li key={tool.name} className="break-words"><div className="font-medium text-[var(--text)]">{tool.name}</div>{tool.description && <p className="mt-0.5 whitespace-pre-wrap text-[var(--text-muted)]">{tool.description}</p>}</li>)}</ul>
  </details>;
}
export function TestDetails({ report, t }: { report: McpTestReport; t: Copy }) {
  return <details className="mt-3 text-xs"><summary className="w-fit cursor-pointer py-1 text-[var(--text-dim)]">{t('details')}</summary>
    <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5">{(['transport', 'authorization', 'discovery', 'functional'] as const).map((phase) => <div key={phase} className="contents"><dt>{t(phase === 'authorization' ? 'authentication' : phase)}</dt><dd className={report[phase] === 'passed' ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}>{t(report[phase])}</dd></div>)}</dl>
    {report.functional === 'unverified' && <p className="mt-2 text-[var(--text-muted)]">{t(report.functional_tool ? 'readUnverified' : 'noSafeRead')}</p>}
    {report.functional_tool && <p className="mt-2 break-words text-[var(--text-muted)]">{report.functional_tool}</p>}
    {report.error && <p className="mt-2 text-[var(--error)]">{report.error === 'MCP_AUTH_REQUIRED' ? t('authRequired') : t('requestFailed')}</p>}
  </details>;
}
export function ConnectionCard({ connection, t, language, onEdit, onTest, onRemove }: {
  connection: McpConnection; t: Copy; language: string; onEdit: () => void;
  onTest: () => Promise<void>; onRemove: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<'test' | 'delete' | null>(null);
  const [error, setError] = useState(false);
  const state = !connection.enabled ? 'disabled' : connection.auth_mode !== 'none' && !connection.has_credentials ? 'auth_required' : connection.test_report?.status ?? 'unchecked';
  const statusLabel = t(state === 'disabled' ? 'disabled' : state === 'verified' ? 'verified' : state === 'server_responds' ? 'responds' : state === 'auth_required' ? 'authRequired' : state === 'error' ? 'error' : 'unchecked');
  async function act(kind: 'test' | 'delete') {
    if (busy) return; setBusy(kind); setError(false);
    try { await (kind === 'test' ? onTest() : onRemove()); }
    catch { setError(true); }
    finally { setBusy(null); }
  }
  return <article className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4" data-connection-id={connection.id}>
    <div className="flex items-start gap-3"><span className="shrink-0 pt-0.5"><BrandLogo slug={connection.provider_slug} name={connection.display_name} /></span>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h4 className="break-words text-sm font-semibold">{connection.display_name}</h4><span className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">{t(connection.owner_type)}</span>
        <VisualEvidence state={connection.visual_interface} t={t} /></div>
        <p aria-live="polite" className={`mt-1 text-xs ${state === 'verified' ? 'text-[var(--success)]' : state === 'auth_required' ? 'text-[var(--amber)]' : state === 'error' ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'}`}>{busy === 'test' ? t('loading') : statusLabel}</p>
        {connection.has_credentials && <p className="mt-1 break-words text-[11px] text-[var(--text-muted)]">{connection.account_label ?? t(connection.auth_mode === 'oauth' && connection.has_oauth_client ? 'accountAuthorized' : 'credentialsStored')}</p>}
        {connection.last_probe_at && <time className="mt-1 block text-[10px] text-[var(--text-muted)]" dateTime={connection.last_probe_at}>{new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(connection.last_probe_at))}</time>}
      </div>
    </div>
    <ToolsList tools={connection.tools} count={connection.tool_count} t={t} />
    {connection.test_report && <TestDetails report={connection.test_report} t={t} />}
    {error && <p role="alert" className="mt-3 text-xs text-[var(--error)]">{t('requestFailed')}</p>}
    {confirming ? <div className="mt-4 rounded-lg border border-[var(--error)]/40 bg-[var(--error)]/5 p-3"><p className="text-xs">{t('deleteConfirm')}</p><div className="mt-3 flex flex-wrap justify-end gap-2"><Button variant="ghost" disabled={!!busy} onClick={() => setConfirming(false)}>{t('cancel')}</Button><Button autoFocus variant="destructive" disabled={!!busy} onClick={() => void act('delete')}>{busy === 'delete' && <Loader2 size={13} className="animate-spin" />}{t('remove')}</Button></div></div>
      : <div className="mt-4 flex flex-wrap justify-end gap-2">{connection.can_test && <Button variant="outline" disabled={!!busy} onClick={() => void act('test')}>{busy === 'test' && <Loader2 size={13} className="animate-spin" />}{t('test')}</Button>}{(connection.can_manage || connection.can_grant) && <Button variant="ghost" disabled={!!busy} onClick={onEdit}><Pencil size={13} />{t('edit')}</Button>}{connection.can_manage && <Button variant="ghost" disabled={!!busy} onClick={() => { setError(false); setConfirming(true); }}><Trash2 size={13} />{t('remove')}</Button>}</div>}
  </article>;
}
