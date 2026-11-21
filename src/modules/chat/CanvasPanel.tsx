import '@/lib/chat-workspace-session';
import { useAuthStore } from '@/stores/auth.store';
import { useNavigate } from 'react-router';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, FileText, Globe, LayoutDashboard, Maximize2, Minimize2, PanelsTopLeft, Plus, Shapes, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/stores/chat.store';
import { MAX_WORKSPACE_TABS, useChatWorkspaceStore, workspaceContentPath, type WorkspaceResource } from '@/stores/chat-workspace.store';
import { mcpAppsService, type McpAppView } from '@/services/mcp-apps.service';
import { WorkspaceResourceView, openWorkspaceAppFile } from './WorkspaceResourceView';
import { MCPAppPanel } from './mcp-apps/MCPAppPanel';

interface CanvasPanelProps { onClose: () => void; expanded?: boolean; onExpand?: () => void }
const Icon = ({ resource }: { resource: WorkspaceResource }) => {
  const Component = resource.kind === 'browser' ? Globe : resource.kind === 'board' ? LayoutDashboard : resource.kind === 'app' || resource.kind === 'productivity' ? Shapes : FileText;
  return <Component size={14} className="shrink-0" />;
};
export function CanvasPanel({ onClose, expanded = false, onExpand }: CanvasPanelProps) {
  const chat = useChatStore(s => s.activeConversationId);
  const generation = useAuthStore(s => s.sessionGeneration);
  // One keyed host per chat: leases are retired on leaving it, and never remounted with stale authority.
  return chat ? <ConversationWorkspace key={`${chat}:${generation}`} chat={chat} onClose={onClose} expanded={expanded} onExpand={onExpand} /> : <div data-testid="canvas-panel" className="flex h-full flex-1 flex-col bg-[var(--card)] p-4 text-sm text-[var(--text-muted)]"><Button variant="ghost" onClick={onClose}><ArrowLeft size={16} /> Conversación</Button><p>Abre una conversación para ver sus resultados.</p></div>;
}
function ConversationWorkspace({ chat, onClose, expanded, onExpand }: CanvasPanelProps & { chat: string }) {
  const navigate = useNavigate();
  const workspace = useChatWorkspaceStore(s => s.byConversation[chat]);
  const [picker, setPicker] = useState(false); const [appsVisited, setAppsVisited] = useState(false);
  const [visited, setVisited] = useState<string[]>([]);
  const tabs = useRef<HTMLDivElement>(null); const prefix = useId();
  useEffect(() => { useChatWorkspaceStore.getState().ensure(chat); return () => useChatWorkspaceStore.getState().suspendApps(chat); }, [chat]);
  const activeId = workspace?.activeId && workspace.resources[workspace.activeId] ? workspace.activeId : null;
  useEffect(() => { if (activeId) setVisited(ids => ids.includes(activeId) ? ids : [...ids, activeId]); }, [activeId]);
  if (!workspace) return null;
  const open = workspace.openIds.map(id => workspace.resources[id]).filter((r): r is WorkspaceResource => Boolean(r));
  const resource = activeId ? workspace.resources[activeId] : null;
  const selecting = picker || !resource;
  const focusTab = (id: string) => {
    useChatWorkspaceStore.getState().select(chat, id); setPicker(false);
    requestAnimationFrame(() => tabs.current?.querySelector<HTMLButtonElement>(`[data-resource-id="${CSS.escape(id)}"]`)?.focus());
  };
  const openResult = (id: string) => {
    if (!useChatWorkspaceStore.getState().open(chat, id)) { toast.info(`Puedes mantener ${MAX_WORKSPACE_TABS} pestañas abiertas. Cierra una para abrir otra.`); return; }
    setPicker(false);
  };
  const close = (id: string) => {
    useChatWorkspaceStore.getState().close(chat, id); setVisited(ids => ids.filter(value => value !== id));
    const next = useChatWorkspaceStore.getState().byConversation[chat]?.activeId;
    if (next) focusTab(next);
  };
  const openApp = (view: McpAppView) => {
    const accepted = useChatWorkspaceStore.getState().upsert(chat, { id: `app:${view.view_id}`, kind: 'app', title: view.title, view, sourceConversationId: chat }, true);
    if (!accepted) { void mcpAppsService.close(chat, view).catch(() => {}); toast.info('Cierra una pestaña antes de abrir otra App.'); return; }
    setPicker(false);
  };
  let fileTarget: { sourceId: string; filename: string } | undefined;
  if (resource?.kind === 'file') {
    const path = workspaceContentPath(resource.file.contentUrl, chat);
    if (path) {
      const url = new URL(path, location.origin);
      const agent = url.searchParams.get('agent_id'); const relative = url.searchParams.get('path');
      const preview = `/conversations/${encodeURIComponent(chat)}/mcp-app-file-preview/`;
      const fileId = /^\/files\/([a-f0-9-]{36})\/content$/i.exec(url.pathname)?.[1];
      const sourceId = agent && relative ? `workspace:${agent}:${relative}` : url.pathname.startsWith(preview) ? `micelclaw-file://${url.pathname.slice(preview.length)}` : fileId ? `file:${fileId}` : null;
      if (sourceId) fileTarget = { sourceId, filename: resource.file.title };
    }
  }
  return <section data-testid="canvas-panel" aria-label="Resultados de la conversación" className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--card)]" onKeyDown={event => { if (event.key === 'Escape' && event.target === event.currentTarget) onClose(); }}>
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--border)] px-3">
      <Button size="icon" variant="ghost" aria-label="Volver a la conversación" className="md:hidden" onClick={onClose}><ArrowLeft size={16} /></Button>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text)]">{selecting ? 'Resultados' : resource?.title}</span>
      <Button size="icon" variant="ghost" aria-label="Abrir resultados y Apps" aria-expanded={selecting} onClick={() => { setPicker(v => !v); setAppsVisited(true); }}><PanelsTopLeft size={16} /></Button>
      {onExpand && <Button size="icon" variant="ghost" aria-label={expanded ? 'Restaurar tamaño' : 'Ampliar resultado'} onClick={onExpand}>{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</Button>}
      <Button size="icon" variant="ghost" aria-label="Ocultar resultados" className="hidden md:inline-flex" onClick={onClose}><X size={16} /></Button>
    </header>
    {workspace.revoked ? <div role="alert" className="grid flex-1 place-content-center gap-3 p-6 text-center text-sm text-[var(--text-muted)]">Ya no tienes acceso a los resultados de esta conversación.</div> : <>
      <div ref={tabs} role="tablist" aria-label="Resultados abiertos" className="flex shrink-0 overflow-x-auto border-b border-[var(--border)] bg-[var(--surface)]" onKeyDown={event => {
        const index = open.findIndex(r => r.id === activeId); let next: number;
        if (event.key === 'ArrowRight') next = (index + 1) % open.length;
        else if (event.key === 'ArrowLeft') next = (index + open.length - 1) % open.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = open.length - 1;
        else if (event.key === 'Delete' && activeId) { event.preventDefault(); close(activeId); return; }
        else return;
        if (open[next]) { event.preventDefault(); focusTab(open[next]!.id); }
      }}>
        {open.map((r, index) => <div key={r.id} role="presentation" className={`group flex shrink-0 items-center border-r border-[var(--border)] ${r.id === activeId && !selecting ? 'border-t-2 border-t-[var(--amber)] bg-[var(--card)] text-[var(--text)]' : 'border-t-2 border-t-transparent text-[var(--text-muted)]'}`}>
          <button role="tab" id={`${prefix}-tab-${index}`} aria-controls={`${prefix}-panel-${index}`} aria-selected={r.id === activeId && !selecting} tabIndex={r.id === activeId ? 0 : -1} data-resource-id={r.id} className="flex h-10 max-w-44 items-center gap-2 px-3 text-xs outline-offset-[-3px]" onClick={() => { useChatWorkspaceStore.getState().select(chat, r.id); setPicker(false); }}><Icon resource={r} /><span className="truncate">{r.title}</span>{r.kind === 'file' && r.status === 'loading' && <span className="size-1.5 rounded-full bg-[var(--amber)]" aria-label="Creando" />}</button>
          <button type="button" aria-label={`Cerrar ${r.title}`} className="mr-1 rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-hover)]" onClick={() => close(r.id)}><X size={12} /></button>
        </div>)}
        <button aria-label="Abrir otro resultado" className="px-3 text-[var(--text-muted)] hover:bg-[var(--surface-hover)]" onClick={() => { setPicker(true); setAppsVisited(true); }}><Plus size={15} /></button>
      </div>
      <div hidden={!selecting} className="min-h-0 flex-1 overflow-auto" aria-label="Todos los resultados">
        <div className="space-y-4 p-5"><div><h3 className="m-0 text-sm font-semibold text-[var(--text)]">Tu espacio de trabajo</h3><p className="mb-0 mt-2 text-xs leading-5 text-[var(--text-muted)]">Abre un resultado para verlo junto a la conversación. Cerrar una pestaña conserva el archivo.</p></div>
          {Object.values(workspace.resources).length > 0 && <div className="grid gap-1">{Object.values(workspace.resources).map(r => <button key={r.id} onClick={() => openResult(r.id)} className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-3 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]"><Icon resource={r} /><span className="min-w-0 flex-1 truncate">{r.title}</span><span className="text-xs text-[var(--text-muted)]">{workspace.openIds.includes(r.id) ? 'Abierto' : 'Reabrir'}</span></button>)}</div>}
          <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => { const id = `board:${chat}`; useChatWorkspaceStore.getState().upsert(chat, { id, kind: 'board', title: 'Tablero', sourceConversationId: chat }, true); setPicker(false); }}><LayoutDashboard size={14} /> Abrir tablero</Button><Button variant="outline" size="sm" onClick={() => setAppsVisited(true)}><Shapes size={14} /> Abrir Apps</Button><Button variant="outline" size="sm" onClick={() => { const id = `browser:${chat}`; useChatWorkspaceStore.getState().upsert(chat, { id, kind: 'browser', title: 'Navegación', sourceConversationId: chat }, true); setPicker(false); }}>Abrir navegador</Button></div>
        </div>
        {appsVisited && <MCPAppPanel key={`${chat}:${workspace.epoch}`} conversationId={chat} onOpenFile={result => openWorkspaceAppFile(chat, result, navigate)} fileTarget={fileTarget} onOpenView={openApp} />}
      </div>
      {open.map((r, index) => visited.includes(r.id) && <div key={`${r.id}:${workspace.epoch}`} id={`${prefix}-panel-${index}`} role="tabpanel" aria-labelledby={`${prefix}-tab-${index}`} hidden={selecting || r.id !== activeId} className="min-h-0 flex-1 overflow-hidden" tabIndex={0}><WorkspaceResourceView chat={chat} resource={r} onApps={() => { setAppsVisited(true); setPicker(true); }} /></div>)}
    </>}
  </section>;
}
