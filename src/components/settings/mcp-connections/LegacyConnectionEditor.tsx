import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { upsertMcpServer, type McpServerView } from '@/services/gateway.service';
import type { mcpCopy } from './copy';

/** Existing adapters retain their admin-only config API. No new stdio installs,
 * secret round trips, or translation into managed connection UUIDs. */
export function LegacyConnectionEditor({ server, t, onClose, onSaved }: { server: McpServerView; t: ReturnType<typeof mcpCopy>; onClose: () => void; onSaved: () => void }) {
  const [url, setUrl] = useState(server.url ?? ''); const [enabled, setEnabled] = useState(server.enabled);
  const [command, setCommand] = useState(server.command ?? ''); const [args, setArgs] = useState((server.args ?? []).join('\n'));
  const [headers, setHeaders] = useState<Record<string, string>>({}); const [env, setEnv] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [error, setError] = useState(false); const flight = useRef(false); const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section className="rounded-xl border border-[var(--amber)]/40 bg-[var(--card)] p-4"><h3 ref={heading} tabIndex={-1} className="mb-4 text-sm font-semibold outline-none">{t('setup')} · {server.name}</h3><form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); if (flight.current) return; flight.current = true; setBusy(true); setError(false); try { await upsertMcpServer(server.name, { transport: server.transport === 'stdio' ? 'stdio' : server.transport === 'sse' ? 'sse' : 'http', enabled, url: server.transport === 'stdio' ? undefined : url, command: server.transport === 'stdio' ? command : undefined, args: server.transport === 'stdio' ? args.split('\n').filter(Boolean) : undefined, headers: { ...server.headers, ...Object.fromEntries(Object.entries(headers).filter(([, value]) => value)) }, env: { ...server.env, ...Object.fromEntries(Object.entries(env).filter(([, value]) => value)) }, timeout: server.timeout, tool_filter: server.tool_filter }); toast.info(t('deferred')); onSaved(); onClose(); } catch { setError(true); } finally { flight.current = false; setBusy(false); } }}>
    <fieldset disabled={busy} className="space-y-4">{server.transport === 'stdio' ? <><label className="block space-y-1 text-xs">command<Input required value={command} onChange={(event) => setCommand(event.target.value)} /></label><label className="block space-y-1 text-xs">args<textarea className="w-full rounded border border-[var(--border)] bg-[var(--surface)] p-2" rows={3} value={args} onChange={(event) => setArgs(event.target.value)} /></label></> : <label className="block space-y-1 text-xs">{t('url')}<Input type="url" required value={url} onChange={(event) => setUrl(event.target.value)} /></label>}
      {Object.keys(server.headers ?? {}).map((key) => <label key={key} className="block space-y-1 text-xs">{key}<Input type="password" autoComplete="new-password" placeholder={t('preserved')} value={headers[key] ?? ''} onChange={(event) => setHeaders((values) => ({ ...values, [key]: event.target.value }))} /></label>)}
      {Object.keys(server.env ?? {}).map((key) => <label key={key} className="block space-y-1 text-xs">{key}<Input type="password" autoComplete="new-password" placeholder={t('preserved')} value={env[key] ?? ''} onChange={(event) => setEnv((values) => ({ ...values, [key]: event.target.value }))} /></label>)}
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />{t('enabled')}</label>
    </fieldset>{error && <p role="alert" className="text-xs text-[var(--error)]">{t('requestFailed')}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>{t('cancel')}</Button><Button type="submit" disabled={busy}>{busy ? t('saving') : t('save')}</Button></div>
  </form></section>;
}
