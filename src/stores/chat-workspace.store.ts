import { create } from 'zustand';
import type { CanvasState } from './canvas.store';
import type { McpAppView } from '@/services/mcp-apps.service';
import { parseProductivityTabReference, type ProductivityTabReference } from '@/modules/chat/mcp-apps/productivity/reference';
import type { ProductivityContext } from '@/modules/chat/mcp-apps/productivity/types';

export const MAX_WORKSPACE_TABS = 8;
export type WorkspaceFile = NonNullable<CanvasState['workspaceFile']>;
type ResourceBase = { id: string; title: string; sourceConversationId: string };
export type WorkspaceResource = ResourceBase & (
  | { kind: 'file'; file: WorkspaceFile; content: string | null; status: 'loading' | 'ready' | 'error'; error?: string; version: number }
  | { kind: 'document'; documentId: string; viewId: string; widgetName?: string; artifactName?: string }
  | { kind: 'board' }
  | { kind: 'browser' }
  | { kind: 'app'; view: McpAppView | null }
  | { kind: 'productivity'; reference: ProductivityTabReference; context?: ProductivityContext; view: McpAppView | null; viewEpoch?: number }
);
export interface ChatWorkspace {
  resources: Record<string, WorkspaceResource>;
  openIds: string[];
  activeId: string | null;
  panelOpen: boolean;
  seen: boolean;
  closedIds: string[];
  epoch: number;
  revoked: boolean;
}
const empty = (): ChatWorkspace => ({ resources: {}, openIds: [], activeId: null, panelOpen: false, seen: false, closedIds: [], epoch: 0, revoked: false });
const retireApp = (resource: WorkspaceResource): WorkspaceResource => resource.kind === 'productivity'
  ? { ...resource, view: null, viewEpoch: (resource.viewEpoch ?? 0) + 1 }
  : resource.kind === 'app' ? { ...resource, view: null } : resource;

const storageKey = (owner: string, chat: string) => `micelclaw.chat-workspace.v1.${owner}.${chat}`;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/** Allow only existing Core content contracts. Strip credentials before storing a reference. */
export function workspaceContentPath(value: string, chat: string): string | null {
  try {
    const base = typeof location === 'undefined' ? 'http://localhost' : location.origin;
    const apiOrigin = new URL(import.meta.env?.VITE_API_URL || base, base).origin;
    const url = new URL(value, value.startsWith('/') && !value.startsWith('//') ? apiOrigin : base);
    if (url.origin !== apiOrigin || url.username || url.password) return null;
    const path = url.pathname.replace(/^\/api\/v1(?=\/)/, '');
    if (path === '/managed-agents/workspace-link/content') {
      const agent = url.searchParams.get('agent_id'); const relative = url.searchParams.get('path');
      if (!agent || !uuid.test(agent) || !relative || relative.length > 4096) return null;
      return `${path}?${new URLSearchParams({ agent_id: agent, path: relative })}`;
    }
    const prefix = `/conversations/${encodeURIComponent(chat)}/mcp-app-file-preview/`;
    if (path.startsWith(prefix) && uuid.test(path.slice(prefix.length))) return path;
    if (/^\/files\/[a-f0-9-]{36}\/(?:content|download)$/i.test(path)) return path.replace(/\/download$/, '/content');
    return null;
  } catch { return null; }
}
export function workspaceFileId(chat: string, file: WorkspaceFile): string {
  const path = workspaceContentPath(file.contentUrl, chat);
  // Technical tool results have no server URL: callers provide a message-scoped relativePath.
  return `file:${path ?? `inline:${file.relativePath}`}`;
}
function restore(owner: string | null, chat: string): ChatWorkspace {
  const result = empty();
  if (!owner) return result;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey(owner, chat)) ?? 'null');
    if (!stored || stored.version !== 1) return result;
    result.seen = stored.seen === true;
    result.closedIds = Array.isArray(stored.closedIds) ? stored.closedIds.filter((v: unknown): v is string => typeof v === 'string' && v.length < 5000).slice(-256) : [];
    for (const r of Array.isArray(stored.resources) ? stored.resources.slice(-100) : []) {
      if (!r || typeof r.id !== 'string' || typeof r.title !== 'string' || r.title.length > 200) continue;
      if (r.kind === 'file' && r.file && workspaceContentPath(r.file.contentUrl, chat) && r.sourceConversationId === chat) {
        const file = r.file as WorkspaceFile;
        if (!['markdown', 'code', 'text', 'image', 'pdf', 'html'].includes(file.previewKind)) continue;
        const clean = { ...file, contentUrl: workspaceContentPath(file.contentUrl, chat)! };
        const id = workspaceFileId(chat, clean);
        if (r.id === id) result.resources[id] = { id, title: r.title, sourceConversationId: chat, kind: 'file', file: clean, content: null, status: 'loading', version: 0 };
      } else if (r.kind === 'app' && r.sourceConversationId === chat && /^app:[a-z0-9_-]{1,128}$/i.test(r.id)) {
        result.resources[r.id] = { id: r.id, title: r.title, kind: 'app', view: null, sourceConversationId: chat };
      } else if (r.kind === 'productivity' && r.sourceConversationId === chat) {
        const reference = parseProductivityTabReference(r.reference, chat);
        if (reference && r.id === reference.resource_id) result.resources[r.id] = { id: r.id, title: reference.title, kind: 'productivity', reference, view: null, sourceConversationId: chat };
      }
    }
    // Id-only preferences can precede authorized history. They are never a data grant.
    result.openIds = Array.isArray(stored.openIds) ? stored.openIds.filter((v: unknown): v is string => typeof v === 'string' && v.length < 5000).slice(0, MAX_WORKSPACE_TABS) : [];
    result.activeId = typeof stored.activeId === 'string' && result.openIds.includes(stored.activeId) ? stored.activeId : result.openIds[0] ?? null;
    result.panelOpen = stored.panelOpen === true && result.openIds.length > 0;
  } catch { /* Optional local preferences; server resources remain authoritative. */ }
  return result;
}
function persist(owner: string | null, chat: string, workspace: ChatWorkspace) {
  if (!owner) return;
  try {
    const resources = Object.values(workspace.resources).flatMap<Record<string, unknown>>((r) => {
      if (r.kind === 'file' && r.file.contentUrl) return [{ id: r.id, title: r.title, sourceConversationId: r.sourceConversationId, kind: r.kind, file: r.file }];
      if (r.kind === 'app') return [{ id: r.id, title: r.title, sourceConversationId: r.sourceConversationId, kind: r.kind }];
      if (r.kind === 'productivity') return [{ id: r.id, title: r.title, sourceConversationId: r.sourceConversationId, kind: r.kind, reference: parseProductivityTabReference(r.reference, chat) }];
      return [];
    }).slice(-100);
    localStorage.setItem(storageKey(owner, chat), JSON.stringify({ version: 1, resources, openIds: workspace.openIds, activeId: workspace.activeId, panelOpen: workspace.panelOpen, closedIds: workspace.closedIds, seen: workspace.seen }));
  } catch { /* Storage denial/quota never prevents viewing an authorized result. */ }
}
interface WorkspaceStore {
  owner: string | null;
  generation: number;
  byConversation: Record<string, ChatWorkspace>;
  ensure(chat: string): void;
  upsert(chat: string, resource: WorkspaceResource, explicit?: boolean | 'remember'): boolean;
  open(chat: string, id: string): boolean;
  select(chat: string, id: string): void;
  close(chat: string, id: string): void;
  setPanel(chat: string, open: boolean): void;
  completeFile(chat: string, id: string, version: number, content: string): void;
  failFile(chat: string, id: string, version: number, message: string): void;
  revalidate(chat: string): void;
  suspendApps(chat: string): void;
  invalidateProductivityProfiles(): void;
  revokeSource(chat: string): void;
  reset(chat: string): void;
  authorize(chat: string): void;
  remove(chat: string): void;
}
export const useChatWorkspaceStore = create<WorkspaceStore>()((set, get) => {
  const update = (chat: string, change: (value: ChatWorkspace) => ChatWorkspace) => {
    const s = get();
    const next = change(s.byConversation[chat] ?? restore(s.owner, chat));
    if (next === s.byConversation[chat]) return;
    persist(s.owner, chat, next);
    set({ byConversation: { ...s.byConversation, [chat]: next } });
  };
  const activate = (w: ChatWorkspace, id: string): ChatWorkspace => {
    const openIds = w.openIds.filter(key => Boolean(w.resources[key]));
    if (!w.resources[id] || w.revoked || (!openIds.includes(id) && openIds.length >= MAX_WORKSPACE_TABS)) return w;
    return { ...w, openIds: openIds.includes(id) ? openIds : [...openIds, id], activeId: id, panelOpen: true, seen: true, closedIds: w.closedIds.filter((v) => v !== id) };
  };
  return {
    owner: null, generation: 0, byConversation: {},
    ensure: (chat) => { if (!get().byConversation[chat]) update(chat, (w) => w); },
    upsert: (chat, resource, explicit = false) => {
      let accepted = false;
      update(chat, (w) => {
        if (w.revoked) return w;
        const exists = Boolean(w.resources[resource.id]);
        const previous = w.resources[resource.id];
        const nextResource = resource.kind === 'productivity' ? { ...resource, viewEpoch: Math.max(resource.viewEpoch ?? 0, previous?.kind === 'productivity' ? previous.viewEpoch ?? 0 : 0) } : resource;
        const resources = { ...w.resources, [resource.id]: nextResource };
        for (const key of Object.keys(resources)) {
          if (Object.keys(resources).length <= 100) break;
          if (key !== resource.id && !w.openIds.includes(key)) delete resources[key];
        }
        let next = { ...w, resources };
        if (explicit === true) next = activate(next, resource.id);
        else if (explicit !== 'remember' && !exists && !w.closedIds.includes(resource.id) && !w.openIds.includes(resource.id) && w.openIds.filter(id => Boolean(w.resources[id])).length < MAX_WORKSPACE_TABS) {
          const first = !w.seen;
          next = { ...next, openIds: [...w.openIds, resource.id], activeId: w.activeId && next.resources[w.activeId] ? w.activeId : resource.id, panelOpen: first ? true : w.panelOpen, seen: true };
        }
        accepted = next.openIds.includes(resource.id);
        return next;
      });
      return accepted;
    },
    open: (chat, id) => { let ok = false; update(chat, (w) => { const next = activate(w, id); ok = next.openIds.includes(id); return next; }); return ok; },
    select: (chat, id) => update(chat, (w) => w.openIds.includes(id) ? { ...w, activeId: id } : w),
    close: (chat, id) => update(chat, (w) => {
      const index = w.openIds.indexOf(id); const openIds = w.openIds.filter((v) => v !== id);
      const resources = { ...w.resources }; const r = resources[id];
      if (r?.kind === 'app' || r?.kind === 'productivity') resources[id] = retireApp(r);
      if (r?.kind === 'file' && r.file.contentUrl) resources[id] = { ...r, content: null, status: 'loading', version: r.version + 1 };
      return { ...w, resources, openIds, activeId: w.activeId === id ? openIds[Math.min(index, openIds.length - 1)] ?? null : w.activeId, panelOpen: openIds.length ? w.panelOpen : false, closedIds: [...w.closedIds.filter((v) => v !== id), id].slice(-256) };
    }),
    setPanel: (chat, panelOpen) => update(chat, (w) => ({ ...w, panelOpen, seen: true })),
    completeFile: (chat, id, version, content) => update(chat, (w) => {
      const r = w.resources[id]; if (w.revoked || r?.kind !== 'file' || r.version !== version) return w;
      return { ...w, resources: { ...w.resources, [id]: { ...r, content, status: 'ready', error: undefined } } };
    }),
    failFile: (chat, id, version, error) => update(chat, (w) => {
      const r = w.resources[id]; if (w.revoked || r?.kind !== 'file' || r.version !== version) return w;
      return { ...w, resources: { ...w.resources, [id]: { ...r, content: null, status: 'error', error } } };
    }),
    revalidate: (chat) => update(chat, (w) => ({ ...w, epoch: w.epoch + 1, resources: Object.fromEntries(Object.entries(w.resources).map(([id, r]) => [id, r.kind === 'file' ? { ...r, content: null, status: 'loading', version: r.version + 1 } : retireApp(r)])) })),
    suspendApps: (chat) => update(chat, (w) => ({ ...w, resources: Object.fromEntries(Object.entries(w.resources).map(([id, r]) => [id, r.kind === 'file' && r.file.contentUrl ? { ...r, content: null, status: 'loading', version: r.version + 1 } : retireApp(r)])) })),
    invalidateProductivityProfiles: () => {
      for (const chat of Object.keys(get().byConversation)) update(chat, w => ({ ...w, resources: Object.fromEntries(Object.entries(w.resources).map(([id, r]) => [id, r.kind === 'productivity' && r.reference.erp_profile_id ? retireApp(r) : r])) }));
    },
    revokeSource: (source) => {
      for (const [chat, w] of Object.entries(get().byConversation)) {
        if (chat === source) update(chat, (v) => ({ ...empty(), epoch: v.epoch + 1, revoked: true, seen: true }));
        else for (const r of Object.values(w.resources)) if (r.sourceConversationId === source) update(chat, (v) => ({ ...v, resources: Object.fromEntries(Object.entries(v.resources).filter(([, item]) => item.sourceConversationId !== source)), openIds: v.openIds.filter((id) => v.resources[id]?.sourceConversationId !== source), activeId: null, epoch: v.epoch + 1 }));
      }
      if (!get().byConversation[source]) update(source, (w) => ({ ...empty(), epoch: w.epoch + 1, revoked: true, seen: true }));
    },
    reset: (chat) => update(chat, (w) => w.revoked ? w : ({ ...empty(), epoch: w.epoch + 1 })),
    authorize: (chat) => update(chat, (w) => w.revoked ? { ...empty(), epoch: w.epoch + 1 } : w),
    remove: (chat) => {
      const s = get(); const next = { ...s.byConversation, [chat]: { ...empty(), epoch: (s.byConversation[chat]?.epoch ?? 0) + 1, revoked: true, seen: true } };
      try { if (s.owner) localStorage.removeItem(storageKey(s.owner, chat)); } catch { /* optional */ }
      set({ byConversation: next });
    },
  };
});
