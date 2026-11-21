import { create } from 'zustand';
import { useChatWorkspaceStore } from './chat-workspace.store';
import type { NativeCanvasBoard } from '@/services/native-canvas.service';

export type NativeCanvasBoardState = { board: NativeCanvasBoard | null; loading: boolean; error: string | null; revision: number | null; epoch: number };
export type NativeCanvasPreview = { documentId: string; viewId: string; title: string | null; widgetName?: string; artifactName?: string };
export function shouldFetchNativeCanvasBoard(state: NativeCanvasBoardState | undefined): boolean {
  return state === undefined || (!state.loading && state.error === null && state.board === null);
}
/** Decision buttons exist only while OpenClaw still has a decision to make.
 * A declaration may already be granted or rejected by the active policy. */
export function canvasWidgetNeedsGrantDecision(widget: Record<string, unknown>): boolean {
  return widget.grant_state === 'pending';
}
type Store = {
  byConversation: Map<string, NativeCanvasBoardState>;
  setLoading: (conversationId: string) => number;
  setBoard: (conversationId: string, board: NativeCanvasBoard, expectedEpoch?: number) => void;
  setError: (conversationId: string, error: string, expectedEpoch?: number) => void;
  invalidate: (conversationId: string, revision?: number) => void;
  clear: (conversationId: string) => void;
  revoke: (conversationId: string) => void;
  previews: Map<string, NativeCanvasPreview[]>;
  addPreview: (conversationId: string, preview: NativeCanvasPreview) => void;
};
const initial = (): NativeCanvasBoardState => ({ board: null, loading: false, error: null, revision: null, epoch: 0 });

export const useNativeCanvasBoardStore = create<Store>()((set, get) => ({
  byConversation: new Map(),
  setLoading: (conversationId) => {
    const state = get().byConversation.get(conversationId) ?? initial();
    const epoch = state.epoch;
    set((s) => { const next = new Map(s.byConversation); next.set(conversationId, { ...state, loading: true, error: null }); return { byConversation: next }; });
    return epoch;
  },
  setBoard: (conversationId, board, expectedEpoch) => set((s) => {
    const current = s.byConversation.get(conversationId) ?? initial();
    if (expectedEpoch !== undefined && current.epoch !== expectedEpoch || current.error === 'Ya no tienes acceso a este Canvas.') return s;
    if (typeof board.revision === 'number' && current.revision !== null && board.revision < current.revision) return s;
    const next = new Map(s.byConversation);
    const previous = next.get(conversationId)?.board;
    // OpenClaw's PATCH response currently contains the board but not the
    // authorization bit returned by GET. Preserve a previously verified
    // capability rather than accidentally changing the visible permissions.
    const snapshot = {
      ...board,
      ...(board.can_manage === undefined && previous?.can_manage !== undefined ? { can_manage: previous.can_manage } : {}),
      ...(board.can_edit === undefined && previous?.can_edit !== undefined ? { can_edit: previous.can_edit } : {}),
    };
    const revision = typeof snapshot.revision === 'number' ? snapshot.revision : null;
    next.set(conversationId, { board: snapshot, revision, loading: false, error: null, epoch: current.epoch });
    return { byConversation: next };
  }),
  setError: (conversationId, error, expectedEpoch) => set((s) => { if (expectedEpoch !== undefined && (s.byConversation.get(conversationId)?.epoch ?? 0) !== expectedEpoch) return s; const next = new Map(s.byConversation); next.set(conversationId, { ...(next.get(conversationId) ?? initial()), loading: false, error }); return { byConversation: next }; }),
  invalidate: (conversationId, revision) => set((s) => { const previous = s.byConversation.get(conversationId) ?? initial(); if (revision !== undefined && previous.revision !== null && revision <= previous.revision) return s; const next = new Map(s.byConversation); next.set(conversationId, { ...previous, loading: false, error: null, board: null, epoch: previous.epoch + 1, revision: revision ?? previous.revision }); return { byConversation: next }; }),
  clear: (conversationId) => set((s) => {
    const byConversation = new Map(s.byConversation);
    const previews = new Map(s.previews);
    byConversation.set(conversationId, { ...initial(), epoch: (s.byConversation.get(conversationId)?.epoch ?? 0) + 1 });
    previews.delete(conversationId);
    return { byConversation, previews };
  }),
  // Keep a terminal local state after a 403. Removing the entry entirely
  // would make the panel immediately retry board.get and create a request
  // loop after a member has been revoked.
  revoke: (conversationId) => set((s) => {
    const byConversation = new Map(s.byConversation);
    const previews = new Map(s.previews);
    byConversation.set(conversationId, {
      board: null,
      revision: null,
      loading: false,
      error: 'Ya no tienes acceso a este Canvas.',
      epoch: (s.byConversation.get(conversationId)?.epoch ?? 0) + 1,
    });
    previews.delete(conversationId);
    return { byConversation, previews };
  }),
  previews: new Map(),
  addPreview: (conversationId, preview) => {
    if (!/^cv_[a-z0-9_-]{8,128}$/i.test(preview.documentId) || !/^[a-z0-9_-]{1,128}$/i.test(preview.viewId)) return;
    const name = preview.widgetName && /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(preview.widgetName) ? preview.widgetName : undefined;
    const artifactName = preview.artifactName && /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(preview.artifactName) ? preview.artifactName : undefined;
    const key = artifactName ?? name ?? preview.documentId;
    const id = `document:${key}`;
    const workspace = useChatWorkspaceStore.getState();
    const previous = workspace.byConversation[conversationId]?.resources[id];
    if (previous?.kind !== 'document' || previous.documentId !== preview.documentId || previous.viewId !== preview.viewId || previous.title !== (preview.title ?? 'Documento')) {
      workspace.upsert(conversationId, { id, kind: 'document', sourceConversationId: conversationId, documentId: preview.documentId, viewId: preview.viewId, widgetName: name, artifactName, title: preview.title ?? 'Documento' });
    }
    set((s) => {
      const next = new Map(s.previews); const old = next.get(conversationId) ?? [];
      const index = old.findIndex(item => (item.artifactName ?? item.widgetName ?? item.documentId) === key);
      if (index >= 0 && old[index]!.documentId === preview.documentId && old[index]!.viewId === preview.viewId && old[index]!.title === preview.title) return s;
      const items = [...old]; if (index >= 0) items[index] = { ...preview, widgetName: name, artifactName }; else items.push({ ...preview, widgetName: name, artifactName });
      next.set(conversationId, items.slice(-100)); return { previews: next };
    });
  },
}));
