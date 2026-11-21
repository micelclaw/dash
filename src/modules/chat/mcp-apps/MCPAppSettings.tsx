import { useEffect, useState, useRef } from 'react';
import { mcpAppsService } from '@/services/mcp-apps.service';
type Setting = { title: string; description?: string; type: 'boolean' | 'string' | 'number' | 'integer'; enum?: string[]; minimum?: number; maximum?: number; minLength?: number; maxLength?: number };
type Settings = { schema: { properties: Record<string, Setting> }; values: Record<string, string | number | boolean> };
export function MCPAppSettings({ conversationId, serverId, serverLabel }: { conversationId: string; serverId: string; serverLabel: string }) {
 const [settings, setSettings] = useState<Settings | null>(null); const [draft, setDraft] = useState<Record<string, string | number | boolean>>({}); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false);
 const lifetime = useRef<AbortController | null>(null);
 useEffect(() => {
  const controller = new AbortController(); lifetime.current = controller; setSettings(null); setError(''); setSaved(false); setBusy(false);
  void mcpAppsService.settings(conversationId, serverId, controller.signal).then(result => { if (controller.signal.aborted) return; const data = result as Settings; if (!data?.schema?.properties || !data.values) throw new Error('Server returned unsupported settings'); setSettings(data); setDraft(data.values); }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not read App settings'); });
  return () => { controller.abort(); lifetime.current = null; };
 }, [conversationId, serverId]);
 async function save() { const controller = lifetime.current; if (!settings || busy || !controller) return; setBusy(true); setError(''); setSaved(false); try { await mcpAppsService.saveSettings(conversationId, serverId, draft, controller.signal); if (!controller.signal.aborted) setSaved(true); } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not save settings'); } finally { if (!controller.signal.aborted) setBusy(false); } }
 return <section style={{ display: 'grid', gap: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 8 }} aria-label={`${serverLabel} App settings`}>
  <strong>{serverLabel} settings</strong>{!settings && !error && <p role="status">Reading the server's advertised settings…</p>}
  {settings && Object.entries(settings.schema.properties).map(([key, field]) => <fieldset key={key} style={{ display: 'grid', gap: 5, fontSize: 12, border: 0, padding: 0, margin: 0 }}>
   <legend>{field.title || key}</legend>{field.description && <span style={{ color: 'var(--text-muted)' }}>{field.description}</span>}
   {field.type === 'boolean' ? <input aria-label={field.title || key} type="checkbox" disabled={busy} checked={draft[key] === true} onChange={e => { setDraft(old => ({ ...old, [key]: e.target.checked })); setSaved(false); }} /> : field.enum ? <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{field.enum.map(value => <label key={value}><input type="radio" name={`mcp-setting-${serverId}-${key}`} disabled={busy} checked={draft[key] === value} onChange={() => { setDraft(old => ({ ...old, [key]: value })); setSaved(false); }} />{value}</label>)}</span> : <input aria-label={field.title || key} disabled={busy} type={field.type === 'string' ? 'text' : 'number'} value={String(draft[key] ?? '')} min={field.minimum} max={field.maximum} minLength={field.minLength} maxLength={field.maxLength} step={field.type === 'integer' ? 1 : 'any'} onChange={e => { const value = field.type === 'string' ? e.target.value : e.target.valueAsNumber; if (typeof value === 'number' && !Number.isFinite(value)) return; setDraft(old => ({ ...old, [key]: value })); setSaved(false); }} style={{ padding: 7, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }} />}
  </fieldset>)}
  {settings && <button disabled={busy} onClick={() => void save()} style={{ padding: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', borderRadius: 6 }}>{busy ? 'Waiting for permission in chat…' : 'Save server settings'}</button>}
  {saved && <span role="status" style={{ color: 'var(--success)' }}>Server settings saved.</span>}{error && <p role="alert" style={{ color: 'var(--error)', fontSize: 12 }}>{error}</p>}
 </section>;
}
