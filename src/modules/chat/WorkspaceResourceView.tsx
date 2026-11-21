import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, Download, ExternalLink, Loader2, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import MarkdownRenderer from '@/components/markdown/MarkdownRenderer';
import { useChatWorkspaceStore, workspaceContentPath, type WorkspaceResource } from '@/stores/chat-workspace.store';
import { useAuthStore } from '@/stores/auth.store';
import { useCanvasStore } from '@/stores/canvas.store';
import { nativeCanvasService, type NativeCanvasDocument } from '@/services/native-canvas.service';
import { mcpAppsService, type McpWorkspacePreview } from '@/services/mcp-apps.service';
import { chatWorkspaceService, downloadWorkspaceBlob } from '@/services/chat-workspace.service';
import { usePersistedScreenshots } from '@/hooks/use-persisted-screenshots';
import { NativeCanvasBoardPanel, NativeCanvasDocumentFrame } from './NativeCanvasBoardPanel';
import { MCPAppFrame } from './mcp-apps/MCPAppFrame';
import { BrowserSessionView } from './components/BrowserSessionView';

const WorkspaceBrowserLive = lazy(() => import('./WorkspaceBrowserLive'));
const WorkspacePdfPreview = lazy(() => import('./WorkspacePdfPreview'));
const ProductivityResult = lazy(() => import('./mcp-apps/productivity/ProductivityResult'));
type Resource = WorkspaceResource;
export function WorkspaceResourceView({ chat, resource, onApps }: { chat: string; resource: Resource; onApps: () => void }) {
  if (resource.kind === 'file') return <FileResult chat={chat} resource={resource} />;
  if (resource.kind === 'document') return <DocumentResult resource={resource} />;
  if (resource.kind === 'browser') return <BrowserResult chat={chat} resourceId={resource.id} />;
  if (resource.kind === 'app') return <AppResult chat={chat} resource={resource} onApps={onApps} />;
  if (resource.kind === 'productivity') return <Suspense fallback={<p role="status" className="p-4">Cargando visor…</p>}><ProductivityResult chat={chat} resource={resource} /></Suspense>;
  return <NativeCanvasBoardPanel conversationId={resource.sourceConversationId} onSelectConversation={source => {
    useChatWorkspaceStore.getState().upsert(chat, { id: `board:${source}`, sourceConversationId: source, kind: 'board', title: source === chat ? 'Tablero' : 'Tablero compartido' }, true);
  }} />;
}
function FileResult({ chat, resource }: { chat: string; resource: Extract<Resource, { kind: 'file' }> }) {
  const [mode, setMode] = useState<'preview' | 'source'>('preview');
  const [blobUrl, setBlobUrl] = useState(''); const [binaryError, setBinaryError] = useState('');
  const [retry, setRetry] = useState(0); const [downloading, setDownloading] = useState(false);
  const navigate = useNavigate();
  const binary = resource.file.previewKind === 'image' || resource.file.previewKind === 'pdf';
  useEffect(() => {
    let active = true; let objectUrl = '';
    const generation = useAuthStore.getState().sessionGeneration;
    const version = resource.version;
    if (binary) {
      setBinaryError(''); setBlobUrl('');
      void chatWorkspaceService.blob(chat, resource.file).then(result => {
        if (!active || useAuthStore.getState().sessionGeneration !== generation) return;
        if (result.blob.size > 25 * 1024 * 1024) throw new Error('Abre este archivo desde su origen para ver su tamaño completo.');
        objectUrl = URL.createObjectURL(new Blob([result.blob], { type: resource.file.mimeType })); setBlobUrl(objectUrl);
      }).catch(error => { if (active) setBinaryError(error instanceof Error ? error.message : 'No se pudo cargar el archivo'); });
    } else if (resource.content === null || resource.status === 'loading') {
      if (!resource.file.contentUrl && resource.content !== null) return;
      void chatWorkspaceService.text(chat, resource.file).then(content => {
        if (active && useAuthStore.getState().sessionGeneration === generation) useChatWorkspaceStore.getState().completeFile(chat, resource.id, version, content);
      }).catch(error => { if (active && useAuthStore.getState().sessionGeneration === generation) useChatWorkspaceStore.getState().failFile(chat, resource.id, version, error instanceof Error ? error.message : 'No se pudo cargar el archivo'); });
    }
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  // Content is the result of this request, not a reason to start the request again.
  }, [chat, resource.id, resource.version, retry, binary]);
  const download = async () => {
    const epoch = useChatWorkspaceStore.getState().byConversation[chat]?.epoch;
    const generation = useAuthStore.getState().sessionGeneration; setDownloading(true);
    try {
      const blob = !binary && resource.content !== null ? new Blob([resource.content], { type: resource.file.mimeType }) : (await chatWorkspaceService.blob(chat, resource.file)).blob;
      if (useAuthStore.getState().sessionGeneration === generation && useChatWorkspaceStore.getState().byConversation[chat]?.epoch === epoch && !useChatWorkspaceStore.getState().byConversation[chat]?.revoked) downloadWorkspaceBlob(blob, resource.file.title);
    } catch { toast.error('No se pudo descargar el archivo.'); }
    finally { setDownloading(false); }
  };
  const error = binary ? binaryError : resource.status === 'error' ? resource.error : '';
  const loading = binary ? !blobUrl && !error : resource.content === null && !error;
  const sourceAvailable = !binary;
  return <div className="flex h-full min-h-0 flex-col">
    <div className="flex shrink-0 items-center gap-1 border-b border-[var(--border)] px-3 py-2">
      {sourceAvailable && <div role="group" aria-label="Presentación del archivo" className="flex gap-1">
        <Button size="sm" variant={mode === 'preview' ? 'secondary' : 'ghost'} aria-pressed={mode === 'preview'} onClick={() => setMode('preview')}>Vista previa</Button>
        <Button size="sm" variant={mode === 'source' ? 'secondary' : 'ghost'} aria-pressed={mode === 'source'} onClick={() => setMode('source')}>Código</Button>
      </div>}
      <span className="ml-auto text-xs text-[var(--text-muted)]">{({ html: 'HTML', markdown: 'Markdown', image: 'Imagen', pdf: 'PDF', code: 'Código', text: 'Texto' })[resource.file.previewKind]}</span>
    </div>
    {error ? <ResultError message={error} retry={() => { useChatWorkspaceStore.getState().upsert(chat, { ...resource, status: 'loading', error: undefined, version: resource.version + 1 }); setRetry(v => v + 1); }} /> : loading ? <ResultLoading title={resource.title} /> : <div className="relative min-h-0 flex-1">
      <div hidden={mode !== 'preview'} className="h-full overflow-auto" data-workspace-preview>
        {resource.file.previewKind === 'html' ? <NativeCanvasDocumentFrame document={{ html: resource.content ?? '', sandbox_url: '', sandbox_port: 1024 }} /> : resource.file.previewKind === 'markdown' ? <div className="app-detail-md mx-auto max-w-3xl p-6 text-sm leading-7 text-[var(--text)]"><MarkdownRenderer content={resource.content ?? ''} /></div> : resource.file.previewKind === 'image' ? <div className="flex h-full items-center justify-center bg-[var(--bg)] p-4"><img src={blobUrl} alt={resource.title} onError={() => setBinaryError('No se pudo cargar la imagen.')} className="max-h-full max-w-full object-contain" /></div> : resource.file.previewKind === 'pdf' ? <Suspense fallback={<ResultLoading title={resource.title} />}><WorkspacePdfPreview url={blobUrl} /></Suspense> : <pre className="m-0 whitespace-pre-wrap break-words p-5 font-mono text-xs leading-6 text-[var(--text)]">{resource.content}</pre>}
      </div>
      {sourceAvailable && <pre hidden={mode !== 'source'} className="m-0 h-full overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-xs leading-6 text-[var(--text)]" aria-label={`Código de ${resource.title}`}>{resource.content}</pre>}
    </div>}
    <footer className="flex shrink-0 flex-wrap items-center gap-1 border-t border-[var(--border)] p-2">
      <Button size="sm" variant="ghost" onClick={() => void download()} disabled={downloading || loading || !!error}><Download size={14} /> Descargar</Button>
      {resource.file.deepLink.startsWith('/') && !resource.file.deepLink.startsWith('//') && <Button size="sm" variant="ghost" onClick={() => navigate(resource.file.deepLink)}><ExternalLink size={14} /> Abrir origen</Button>}
      {!loading && <Button size="sm" variant="ghost" aria-label={`Actualizar ${resource.title}`} onClick={() => { useChatWorkspaceStore.getState().upsert(chat, { ...resource, version: resource.version + 1, status: 'loading' }); setRetry(v => v + 1); }}><RefreshCw size={14} /></Button>}
    </footer>
  </div>;
}
function DocumentResult({ resource }: { resource: Extract<Resource, { kind: 'document' }> }) {
  const [document, setDocument] = useState<NativeCanvasDocument | null>(null); const [error, setError] = useState('');
  const [mode, setMode] = useState<'preview' | 'source'>('preview'); const [retry, setRetry] = useState(0); const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true; const generation = useAuthStore.getState().sessionGeneration;
    setDocument(null); setError('');
    void nativeCanvasService.document(resource.sourceConversationId, resource.documentId).then(value => { if (active && useAuthStore.getState().sessionGeneration === generation) setDocument(value); })
      .catch(cause => { if (active && useAuthStore.getState().sessionGeneration === generation) setError(cause instanceof Error ? cause.message : 'No se pudo abrir el documento'); });
    return () => { active = false; };
  }, [resource.sourceConversationId, resource.documentId, resource.viewId, retry]);
  const save = async () => {
    setSaving(true);
    try { const value = await nativeCanvasService.exportDocument(resource.sourceConversationId, resource.documentId, { format: 'html', title: resource.title }); toast.success(`Guardado en Mi Drive / Canvas: ${value.file.filename}`); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : 'No se pudo guardar'); }
    finally { setSaving(false); }
  };
  return <div className="flex h-full min-h-0 flex-col">
    <div role="group" aria-label="Presentación del documento" className="flex gap-1 border-b border-[var(--border)] px-3 py-2"><Button size="sm" variant={mode === 'preview' ? 'secondary' : 'ghost'} onClick={() => setMode('preview')} aria-pressed={mode === 'preview'}>Vista previa</Button><Button size="sm" variant={mode === 'source' ? 'secondary' : 'ghost'} onClick={() => setMode('source')} aria-pressed={mode === 'source'}>Código</Button></div>
    {error ? <ResultError message={error} retry={() => setRetry(v => v + 1)} /> : !document ? <ResultLoading title={resource.title} /> : <div className="min-h-0 flex-1 overflow-auto"><div hidden={mode !== 'preview'}><NativeCanvasDocumentFrame document={document} /></div><pre hidden={mode !== 'source'} className="m-0 whitespace-pre-wrap break-words p-5 font-mono text-xs leading-6 text-[var(--text)]">{document.html}</pre></div>}
    <footer className="flex flex-wrap gap-1 border-t border-[var(--border)] p-2"><Button size="sm" variant="ghost" disabled={!document || saving} onClick={() => void save()}><Save size={14} /> Guardar en Drive</Button><Button size="sm" variant="ghost" disabled={!document} onClick={() => document && downloadWorkspaceBlob(new Blob([document.html], { type: 'text/html' }), `${resource.title.replace(/\.html?$/i, '')}.html`)}><Download size={14} /> Descargar</Button></footer>
  </div>;
}
function BrowserResult({ chat, resourceId }: { chat: string; resourceId: string }) {
  const [mode, setMode] = useState<'live' | 'history'>('history');
  const sessions = useCanvasStore(s => s.browserSessions);
  const matching = [...sessions.values()].filter(s => s.conversationId === chat);
  const session = matching.find(s => s.status === 'active') ?? matching.at(-1);
  const saved = usePersistedScreenshots(chat);
  const refresh = useRef(saved.refresh); refresh.current = saved.refresh;
  const previous = useRef(session?.snapshot);
  useEffect(() => { if (session?.snapshot && previous.current !== session.snapshot) { previous.current = session.snapshot; refresh.current(); } }, [session?.snapshot]);
  return <div className="flex h-full min-h-0 flex-col">
    <div role="group" aria-label="Vista del navegador" className="flex gap-2 border-b border-[var(--border)] p-2"><Button size="sm" aria-pressed={mode === 'live'} variant={mode === 'live' ? 'secondary' : 'ghost'} onClick={() => setMode('live')}>En directo</Button><Button size="sm" aria-pressed={mode === 'history'} variant={mode === 'history' ? 'secondary' : 'ghost'} onClick={() => setMode('history')}>Capturas guardadas</Button></div>
    {mode === 'live' ? <Suspense fallback={<ResultLoading title="navegador" />}><WorkspaceBrowserLive chat={chat} resourceId={resourceId} /></Suspense> : <>
    <p className="m-0 px-4 py-3 text-xs text-[var(--text-muted)]">Imágenes guardadas por el agente; no son seguimiento en directo.</p>
    {saved.error && <div role="alert" className="flex items-center justify-between gap-2 p-3 text-xs">{saved.error}<Button size="sm" variant="ghost" onClick={saved.refresh}>Reintentar</Button></div>}
    <BrowserSessionView session={session ?? { sessionId: 'history', conversationId: chat, currentUrl: null, humanizedAction: null, snapshot: null, actions: [], status: 'complete', pagesVisited: 0 }} persistedScreenshots={saved.screenshots} currentIndex={saved.currentIndex} onNavigate={saved.navigate} onDelete={saved.deleteScreenshot} onDownload={saved.downloadScreenshot} />
    </>}
  </div>;
}
function AppResult({ chat, resource, onApps }: { chat: string; resource: Extract<Resource, { kind: 'app' }>; onApps: () => void }) {
  const navigate = useNavigate();
  const [context, setContext] = useState<unknown>(null); const [notice, setNotice] = useState('');
  const current = useRef(resource); current.current = resource;
  const contextState = context && typeof context === 'object' ? (context as { state?: { updateId?: unknown } }).state : undefined;
  const hasContext = typeof contextState?.updateId === 'string';
  const fail = useCallback((message: string) => { setNotice(message); useChatWorkspaceStore.getState().upsert(chat, { ...current.current, view: null }); }, [chat]);
  const removeContext = async () => {
    if (!resource.view || !context || typeof context !== 'object') return;
    const state = (context as { state?: { updateId?: string } }).state;
    if (!state?.updateId) return;
    try { await mcpAppsService.request(chat, resource.view, { kind: 'remove-context', update_id: state.updateId }); setContext(null); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo retirar el contexto'); }
  };
  return <div className="h-full overflow-auto p-3">
    {resource.view ? <>
      <div className="mb-3 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]"><span>Acceso temporal</span><Button size="sm" variant="ghost" onClick={() => window.dispatchEvent(new CustomEvent('micelclaw:mcp-app-focus-chat', { detail: { conversation_id: chat } }))}>Ver permisos en el chat</Button>{hasContext && <Button size="sm" variant="ghost" onClick={() => void removeContext()}>Retirar contexto</Button>}</div>
      <MCPAppFrame conversationId={chat} view={resource.view} onMessage={text => window.dispatchEvent(new CustomEvent('micelclaw:mcp-app-draft', { detail: { conversation_id: chat, text } }))} onOpenFile={result => openWorkspaceAppFile(chat, result, navigate, useChatWorkspaceStore.getState().byConversation[chat]?.activeId === resource.id)} onContext={setContext} onRevoked={fail} />
    </> : <div className="grid min-h-48 place-content-center gap-3 text-center text-sm text-[var(--text-muted)]"><p>{notice || 'La App está inactiva. Vuelve a abrirla para revisar su acceso.'}</p><Button variant="outline" onClick={onApps}>Abrir Apps</Button></div>}
  </div>;
}
export async function openWorkspaceAppFile(chat: string, result: McpWorkspacePreview, navigate?: (path: string) => void, focus = true): Promise<void> {
  if (useChatWorkspaceStore.getState().byConversation[chat]?.revoked) throw new Error('Acceso revocado');
  if (!result.preview) { if (!focus) throw new Error('Abre esta App antes de navegar a su archivo.'); if (navigate && result.deep_link.startsWith('/') && !result.deep_link.startsWith('//')) { navigate(result.deep_link); return; } throw new Error('Este archivo se abre desde su origen.'); }
  const preview = result.preview;
  if (!workspaceContentPath(preview.content_url, chat)) throw new Error('Referencia de archivo no válida');
  useCanvasStore.getState().setWorkspaceFile(chat, { title: preview.filename, relativePath: result.relative_path, previewKind: preview.kind, mimeType: preview.mime_type, contentUrl: preview.content_url, deepLink: result.deep_link, sizeBytes: preview.size_bytes }, { status: 'loading', focus });
}
function ResultLoading({ title }: { title: string }) { return <div role="status" className="flex min-h-48 flex-1 items-center justify-center gap-2 p-6 text-sm text-[var(--text-muted)]"><Loader2 size={18} className="animate-spin" /> Preparando {title}…</div>; }
function ResultError({ message, retry }: { message?: string; retry: () => void }) { return <div role="alert" className="grid min-h-48 flex-1 place-content-center justify-items-center gap-3 p-6 text-center text-sm text-[var(--text-muted)]"><AlertTriangle size={20} /><p className="m-0 max-w-sm">{message ?? 'No se pudo abrir el resultado.'}</p><Button variant="outline" onClick={retry}><RefreshCw size={14} /> Reintentar</Button></div>; }
