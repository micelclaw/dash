import { useCallback, useEffect, useRef, useState } from 'react';
import { mcpAppsService, type McpAppEntry, type McpAppList, type McpAppView, type McpWorkspacePreview } from '@/services/mcp-apps.service';
import { MCPAppFrame } from './MCPAppFrame';
import { MCPAppSettings } from './MCPAppSettings';
import { MCPFileAppChooser } from './MCPFileAppChooser';
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const button: React.CSSProperties = { padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontSize: 12 };
export function MCPAppPanel({ conversationId, onOpenFile, fileTarget, onOpenView }: { conversationId: string; onOpenFile(preview: McpWorkspacePreview): Promise<void>; fileTarget?: { sourceId: string; filename: string }; onOpenView?: (view: McpAppView) => void }) {
 const [catalog, setCatalog] = useState<McpAppList | null>(null); const [view, setView] = useState<McpAppView | null>(null);
 const [loading, setLoading] = useState(false); const [launching, setLaunching] = useState<string | null>(null); const [error, setError] = useState('');
 const [settings, setSettings] = useState<string | null>(null); const [context, setContext] = useState<unknown>(null); const [messageNotice, setMessageNotice] = useState('');
 const [query, setQuery] = useState(''); const [searching, setSearching] = useState(false); const [resources, setResources] = useState<unknown[]>([]);
 const lifecycle = useRef<AbortController | null>(null);
 const refresh = useCallback(async () => {
  const controller = lifecycle.current; if (!controller) return; setLoading(true); setError('');
  try { const data = await mcpAppsService.list(conversationId, controller.signal); if (!controller.signal.aborted) setCatalog(data); }
  catch (e) { if (!controller.signal.aborted) { setCatalog(null); setError(e instanceof Error ? e.message : 'Apps are unavailable'); } }
  finally { if (!controller.signal.aborted) setLoading(false); }
 }, [conversationId]);
 useEffect(() => {
  const controller = new AbortController(); lifecycle.current = controller; setView(null); setCatalog(null); setSettings(null); setContext(null); setError(''); setResources([]); void refresh();
  return () => { controller.abort(); lifecycle.current = null; };
 }, [conversationId, refresh]);
 async function launch(entry: McpAppEntry) {
  const controller = lifecycle.current; if (!controller || launching) return; setLaunching(entry.id); setError(''); setSettings(null); setContext(null);
  try { const data = await mcpAppsService.launch(conversationId, entry.id, undefined, controller.signal); if (!controller.signal.aborted) { if (onOpenView) onOpenView(data); else setView(data); } else void mcpAppsService.close(conversationId, data).catch(() => {}); }
  catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not open App'); }
  finally { if (!controller.signal.aborted) setLaunching(null); }
 }
 function appendDraft(text: string) { window.dispatchEvent(new CustomEvent('micelclaw:mcp-app-draft', { detail: { conversation_id: conversationId, text } })); setMessageNotice('App content added to your draft. Review it and press Send yourself.'); }
 function viewChat() { window.dispatchEvent(new CustomEvent('micelclaw:mcp-app-focus-chat', { detail: { conversation_id: conversationId } })); document.querySelector('[data-mcp-app-approvals]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
 async function clearContext() { if (!view) return; const state = object(object(context).state); if (typeof state.updateId !== 'string') return; try { await mcpAppsService.request(conversationId, view, { kind: 'remove-context', update_id: state.updateId }); setContext(null); } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove App context'); } }
 async function search(serverId: string) { const controller = lifecycle.current; if (!controller || searching) return; setSearching(true); setError(''); try { const result = object(await mcpAppsService.search(conversationId, serverId, query, controller.signal)); if (!controller.signal.aborted) setResources(Array.isArray(result.resources) ? result.resources : []); } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Search failed'); } finally { if (!controller.signal.aborted) setSearching(false); } }
 if (catalog?.owner_only) return <section aria-label="Shared Apps" style={{ padding: 16, display: 'grid', gap: 12 }}><h3 style={{ margin: 0 }}>Apps</h3><p>Only the conversation owner can interact with Apps. Shared previews contain no active document or external requests.</p>{catalog.views.map(saved => <article key={saved.view_id} style={{ ...button, cursor: 'default' }}><strong>{saved.title}</strong><div>{saved.server_label} · inactive preview</div></article>)}</section>;
 return <section aria-label="Conversation Apps" style={{ display: 'grid', gap: 12, padding: 12, overflowY: 'auto', minHeight: 0 }}>
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><h3 style={{ margin: 0, fontSize: 15 }}>Apps in this conversation</h3><button style={button} onClick={() => void refresh()} disabled={loading || !!launching}>Refresh</button></div>
  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Apps use their own secure surface. Requests for permission appear in the chat.</p>
  {loading && <p role="status">Discovering the server's available Apps…</p>}
  {launching && <div role="status" style={{ padding: 10, border: '1px solid var(--amber)', borderRadius: 8 }}>Opening App; permission may be waiting in the chat. <button style={button} onClick={viewChat}>View in chat</button></div>}
  {error && <p role="alert" style={{ color: 'var(--error)', fontSize: 12, overflowWrap: 'anywhere' }}>{error}</p>}
  {!view && fileTarget && <MCPFileAppChooser conversationId={conversationId} fileId={fileTarget.sourceId} filename={fileTarget.filename} onOpened={onOpenView ?? setView} />}
  {catalog && !catalog.entries.length && !view && !loading && <p>No compatible Apps are advertised for this conversation.</p>}
  {!view && catalog?.entries.filter(e => e.type !== 'file').map(entry => <button key={entry.id} style={{ ...button, textAlign: 'left', padding: 11 }} disabled={!!launching} onClick={() => void launch(entry)}><strong>{entry.title}</strong><span style={{ display: 'block', marginTop: 4, color: 'var(--text-muted)' }}>{entry.server_label} · {entry.type === 'settings' ? 'Server interface' : entry.type === 'thread' ? 'This chat' : 'App'}</span></button>)}
  {!view && catalog?.views.map(saved => {
   const advertised = catalog.entries.find(e => e.id === saved.entry_id); const entry = advertised?.type !== 'file' ? advertised : undefined;
   return <article key={saved.view_id} style={{ padding: 11, border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}><strong>{saved.title}</strong><p style={{ margin: '5px 0' }}>Inactive after reload. Reopening can run its advertised entry action again.</p>{entry ? <button style={button} disabled={!!launching} onClick={() => void launch(entry)}>Reopen explicitly</button> : <span>{advertised?.type === 'file' ? 'Select the original file to reopen this editor.' : 'The server no longer advertises this entrypoint.'}</span>}</article>;
  })}
  {view && <>
   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><strong>{view.title}</strong><button style={button} onClick={() => { void mcpAppsService.close(conversationId, view).catch(() => {}); setView(null); setContext(null); void refresh(); }}>Close App</button></div>
   <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}><span>Temporary access · up to ten minutes</span><button style={button} onClick={viewChat}>View requests in chat</button></div>
   {typeof object(object(context).state).updateId === 'string' && <div style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}>App context attached to future turns <button style={button} onClick={() => void clearContext()}>Remove context</button></div>}
   <MCPAppFrame key={view.lease_id} conversationId={conversationId} view={view} onMessage={appendDraft} onOpenFile={onOpenFile} onContext={setContext} onRevoked={message => { setView(null); setContext(null); setError(message); }} />
  </>}
  {messageNotice && <p role="status" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{messageNotice}</p>}
  {!view && catalog?.servers.filter(s => s.settings_supported).map(server => <div key={server.id}><button style={button} onClick={() => setSettings(settings === server.id ? null : server.id)}>Settings · {server.label}</button>{settings === server.id && <MCPAppSettings conversationId={conversationId} serverId={server.id} serverLabel={server.label} />}</div>)}
  {!view && catalog?.servers.some(s => s.mention_supported) && <div style={{ display: 'grid', gap: 8 }}><label style={{ fontSize: 12 }}>Find a resource in an App<input value={query} onChange={e => setQuery(e.target.value)} maxLength={2048} style={{ ...button, width: '100%', marginTop: 5, cursor: 'text' }} /></label>{catalog.servers.filter(s => s.mention_supported).map(server => <button key={server.id} style={button} disabled={searching || !query.trim()} onClick={() => void search(server.id)}>Search {server.label}</button>)}{resources.map((raw, index) => { const item = object(raw); if (typeof item.uri !== 'string') return null; return <button key={index} style={button} onClick={() => appendDraft(`App reference: ${String(item.title ?? item.name ?? 'Resource')} (${item.uri})`)}>Add reference · {String(item.title ?? item.name ?? 'Resource')}</button>; })}</div>}
 </section>;
}
