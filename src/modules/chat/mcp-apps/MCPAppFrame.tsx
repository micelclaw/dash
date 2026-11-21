import { useEffect, useRef, useState } from 'react';
import { mcpAppsService, type McpAppView, type McpWorkspacePreview } from '@/services/mcp-apps.service';

type Json = Record<string, unknown>;
const record = (value: unknown): Json => value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
const sandboxOrigin = (value: string): string | null => {
 try { const url = new URL(value); return url.protocol === 'https:' && url.origin !== location.origin && url.pathname === '/mcp-app-sandbox' && !url.username && !url.password && !url.hash ? url.origin : null; }
 catch { return null; }
};
const requestId = (id: unknown): id is string | number => typeof id === 'string' || typeof id === 'number' && Number.isSafeInteger(id);
export interface MCPAppFrameProps {
 conversationId: string; view: McpAppView;
 onMessage(text: string): void; onOpenFile(preview: McpWorkspacePreview): Promise<void>;
 onContext(value: unknown): void; onRevoked(message: string): void;
}

/** Native MCP Apps protocol host. The HTML runs only inside the native double sandbox. */
export function MCPAppFrame({ conversationId, view, ...callbacks }: MCPAppFrameProps) {
 const frame = useRef<HTMLIFrameElement>(null); const handlers = useRef(callbacks); handlers.current = callbacks;
 const latest = useRef(view); latest.current = view; const hostReady = useRef(false);
 const origin = sandboxOrigin(view.sandbox_url);
 const [failure, setFailure] = useState(''); const [height, setHeight] = useState(600); const [conflict, setConflict] = useState(false);
 useEffect(() => {
  if (origin && hostReady.current) frame.current?.contentWindow?.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: view.host_context }, origin);
 }, [view.host_context, origin]);
 useEffect(() => {
  if (!origin) { handlers.current.onRevoked('The App sandbox origin is unsafe.'); return; }
  let closed = false; let initialized = false; let accepted = false; let resourceSent = false; let polling = false; let sequence = 0;
  const pending = new Map<string | number, AbortController>(); const lifetime = new AbortController();
  const post = (message: Json) => { if (!closed) frame.current?.contentWindow?.postMessage(message, origin); };
  const notify = (method: string, params: unknown = {}) => post({ jsonrpc: '2.0', method, params });
  const respond = (id: string | number, result: unknown) => post({ jsonrpc: '2.0', id, result });
  const reject = (id: string | number, message: string, code = -32000) => post({ jsonrpc: '2.0', id, error: { code, message } });
  const close = () => {
   if (closed) return; closed = true; lifetime.abort(); for (const controller of pending.values()) controller.abort(); pending.clear();
   void mcpAppsService.close(conversationId, view).catch(() => {});
  };
  const fail = (message: string) => { close(); setFailure(message); handlers.current.onRevoked(message); };
  const rpc = async (operation: Json, signal?: AbortSignal) => mcpAppsService.request(conversationId, view, operation, signal ?? lifetime.signal);
  const handshake = setTimeout(() => { if (!initialized) fail('The App did not finish its handshake. Reopen it to try again.'); }, 15_000);
  const expire = setTimeout(() => fail('App permission expired. Reopen the App explicitly.'), Math.max(0, Math.min(10 * 60_000, view.expires_at - Date.now())));
  const onMessage = (event: MessageEvent) => {
   if (closed || event.origin !== origin || event.source !== frame.current?.contentWindow) return;
   const message = record(event.data); if (message.jsonrpc !== '2.0' || message.id !== undefined && !requestId(message.id)) return;
   const id = message.id; const params = record(message.params); const method = message.method;
   if (method === 'notifications/cancelled') { if (requestId(params.requestId)) { pending.get(params.requestId)?.abort(); pending.delete(params.requestId); } return; }
   if (method === 'ui/notifications/sandbox-proxy-ready' && id === undefined) {
    if (!resourceSent) { resourceSent = true; notify('ui/notifications/sandbox-resource-ready', { html: view.html, csp: view.csp }); } return;
   }
   if (method === 'ping' && requestId(id)) { respond(id, {}); return; }
   if (method === 'ui/initialize' && requestId(id)) {
    const info = record(params.appInfo);
    if (typeof params.protocolVersion !== 'string' || typeof info.name !== 'string' || typeof info.version !== 'string' || !params.appCapabilities || typeof params.appCapabilities !== 'object') { reject(id, 'Invalid App initialization', -32602); return; }
    accepted = true;
    respond(id, { protocolVersion: '2026-01-26', hostInfo: { name: 'Micelclaw Dash', version: '0.8.0' }, hostCapabilities: {
     sandbox: { csp: view.csp }, ...(view.capabilities.server_tools ? { serverTools: {} } : {}), ...(view.capabilities.server_resources ? { serverResources: {} } : {}),
     ...(view.capabilities.message ? { message: { text: {} } } : {}), ...(view.capabilities.model_context ? { updateModelContext: { text: {}, structuredContent: {} } } : {}),
    }, hostContext: { theme: 'dark', displayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen'], locale: navigator.language, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, platform: 'web', ...latest.current.host_context } }); return;
   }
   if (method === 'ui/notifications/initialized' && id === undefined) {
    if (!accepted || initialized) return; initialized = true; hostReady.current = true; clearTimeout(handshake);
    notify('ui/notifications/tool-input', { arguments: view.tool_input }); notify('ui/notifications/tool-result', view.tool_result);
    if (view.capabilities.model_context) void rpc({ kind: 'model-context' }).then(value => { if (closed) return; handlers.current.onContext(value); notify('ui/notifications/host-context-changed', { 'openai/modelContext': record(value).state ?? null }); }).catch(e => { if (!closed) fail(e instanceof Error ? e.message : 'App context is no longer available'); });
    return;
   }
   if (method === 'ui/notifications/size-changed' && id === undefined) { if (typeof params.height === 'number' && Number.isFinite(params.height)) setHeight(Math.max(160, Math.min(1200, Math.round(params.height)))); return; }
   if (method === 'ui/notifications/request-teardown' && id === undefined) { fail('App closed. Reopen it explicitly to continue.'); return; }
   if (!requestId(id) || typeof method !== 'string') return;
   if (!initialized) { reject(id, 'App initialization is incomplete', -32002); return; }
   if (pending.has(id)) { reject(id, 'Duplicate request ID', -32600); return; }
   if (pending.size >= 4) { reject(id, 'Too many concurrent App requests'); return; }
   if (method === 'ui/request-display-mode') { const mode = params.mode === 'fullscreen' ? 'fullscreen' : 'inline'; setHeight(mode === 'fullscreen' ? Math.max(300, innerHeight - 200) : 600); respond(id, { mode }); notify('ui/notifications/host-context-changed', { displayMode: mode }); return; }
   if (method === 'ui/message') {
    if (!view.capabilities.message || params.role !== 'user' || !Array.isArray(params.content) || params.content.some(c => record(c).type !== 'text' || typeof record(c).text !== 'string')) { reject(id, 'Only supported text messages may enter the composer', -32602); return; }
    const text = params.content.map(c => String(record(c).text)).join('\n');
    if (!text.trim() || text.length > 8000) { reject(id, 'App message is empty or too large', -32602); return; }
    handlers.current.onMessage(text); respond(id, {}); return;
   }
   let operation: Json;
   if (method === 'tools/list' && view.capabilities.server_tools) operation = { kind: 'list-tools', ...(typeof params.cursor === 'string' ? { cursor: params.cursor } : {}) };
   else if (method === 'tools/call' && view.capabilities.server_tools && typeof params.name === 'string') operation = { kind: 'call-tool', tool: params.name, arguments: record(params.arguments) };
   else if (method === 'resources/list' && view.capabilities.server_resources) operation = { kind: 'list-resources', ...(typeof params.cursor === 'string' ? { cursor: params.cursor } : {}) };
   else if (method === 'resources/templates/list' && view.capabilities.server_resources) operation = { kind: 'list-templates', ...(typeof params.cursor === 'string' ? { cursor: params.cursor } : {}) };
   else if (method === 'resources/read' && (view.capabilities.server_resources || view.capabilities.file_resources) && typeof params.uri === 'string') { const representation = record(record(params._meta)['openai/resource']).representation; operation = { kind: 'read-resource', uri: params.uri, ...(typeof representation === 'string' ? { representation } : {}) }; }
   else if (method === 'resources/subscribe' && view.capabilities.file_resources && typeof params.uri === 'string') operation = { kind: 'subscribe-resource', uri: params.uri };
   else if (method === 'resources/unsubscribe' && view.capabilities.file_resources && typeof params.uri === 'string') operation = { kind: 'unsubscribe-resource', uri: params.uri };
   else if (method === 'openai/resources/write' && view.capabilities.file_resources && typeof params.uri === 'string' && typeof params.ifMatch === 'string') operation = { kind: 'write-resource', uri: params.uri, if_match: params.ifMatch, ...(typeof params.text === 'string' ? { text: params.text } : {}), ...(typeof params.blob === 'string' ? { blob: params.blob } : {}) };
   else if (method === 'ui/update-model-context' && view.capabilities.model_context) operation = { kind: 'update-context', ...(Array.isArray(params.content) ? { content: params.content } : {}), ...(params.structuredContent && typeof params.structuredContent === 'object' ? { structured_content: params.structuredContent } : {}) };
   else if (method === 'openai/files/open' && view.capabilities.open_files && typeof params.path === 'string') operation = { kind: 'open-file', path: params.path };
   else { reject(id, 'This method is not announced or implemented by this host', -32601); return; }
   const controller = new AbortController(); pending.set(id, controller);
   rpc(operation, controller.signal).then(async result => {
    if (closed || pending.get(id) !== controller) return;
    if (record(result).outcome === 'conflict') setConflict(true);
    if (method === 'openai/files/open') { await handlers.current.onOpenFile(result as McpWorkspacePreview); respond(id, {}); }
    else respond(id, result);
   }).catch(e => { if (!closed && pending.get(id) === controller) reject(id, e instanceof Error ? e.message : 'App request failed'); }).finally(() => { pending.delete(id); });
  };
  window.addEventListener('message', onMessage);
  const poll = setInterval(() => {
   if (closed || polling) return; polling = true;
   void mcpAppsService.events(conversationId, view, sequence, lifetime.signal).then(async updates => {
    if (closed) return; sequence = updates.sequence;
    for (const event of updates.events) {
     if (event.type === 'resource-updated' && event.uri) notify('notifications/resources/updated', { uri: event.uri });
     if (event.type === 'context-changed' && view.capabilities.model_context) {
      const value = await rpc({ kind: 'model-context' }); if (closed) return;
      handlers.current.onContext(value); notify('ui/notifications/host-context-changed', { 'openai/modelContext': record(value).state ?? null });
     }
    }
   }).catch(e => { if (!closed && !lifetime.signal.aborted) fail(e instanceof Error ? e.message : 'App authority was revoked'); }).finally(() => { polling = false; });
  }, 1200);
  const pagehide = () => fail('App suspended. Reopen it explicitly after returning.'); window.addEventListener('pagehide', pagehide);
  return () => { hostReady.current = false; clearTimeout(handshake); clearTimeout(expire); clearInterval(poll); window.removeEventListener('message', onMessage); window.removeEventListener('pagehide', pagehide); close(); };
 }, [conversationId, view.lease_id, view.sandbox_url, origin]);
 if (!origin) return <p role="alert" style={{ padding: 16, color: 'var(--error)' }}>The App sandbox origin is unsafe.</p>;
 if (failure) return <p role="alert" style={{ padding: 16, color: 'var(--error)' }}>{failure}</p>;
 return <div style={{ minHeight: 200 }}>
  {view.file_access && !view.file_access.writable && <p style={{ padding: 10, color: 'var(--text-muted)' }}>Read-only · {view.file_access.reason ?? 'This file’s current permissions allow viewing only.'}</p>}
  {conflict && <p role="alert" style={{ padding: 10, color: 'var(--amber)' }}>The file changed elsewhere. Your App draft is preserved; compare or reload it before saving again.</p>}
  <iframe ref={frame} title={view.title} src={view.sandbox_url} sandbox="allow-scripts allow-same-origin allow-forms" allow="camera 'none'; microphone 'none'; geolocation 'none'; display-capture 'none'; payment 'none'" referrerPolicy="no-referrer" style={{ width: '100%', height, border: 0, background: 'transparent' }} />
 </div>;
}
