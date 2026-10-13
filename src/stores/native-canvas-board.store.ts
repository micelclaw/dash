import { create } from 'zustand';
import type { NativeCanvasBoard } from '@/services/native-canvas.service';

export type NativeCanvasBoardState = { board: NativeCanvasBoard | null; loading: boolean; error: string | null; revision: number | null };
export type NativeCanvasPreview = { documentId: string; viewId: string; title: string | null };
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
  setLoading: (conversationId: string) => void;
  setBoard: (conversationId: string, board: NativeCanvasBoard) => void;
  setError: (conversationId: string, error: string) => void;
  invalidate: (conversationId: string, revision?: number) => void;
  clear: (conversationId: string) => void;
  revoke: (conversationId: string) => void;
  previews: Map<string, NativeCanvasPreview[]>;
  addPreview: (conversationId: string, preview: NativeCanvasPreview) => void;
};
const initial = (): NativeCanvasBoardState => ({ board: null, loading: false, error: null, revision: null });

export const useNativeCanvasBoardStore = create<Store>()((set) => ({
  byConversation: new Map(),
  setLoading: (conversationId) => set((s) => { const next = new Map(s.byConversation); next.set(conversationId, { ...(next.get(conversationId) ?? initial()), loading: true, error: null }); return { byConversation: next }; }),
  setBoard: (conversationId, board) => set((s) => {
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
    next.set(conversationId, { board: snapshot, revision, loading: false, error: null });
    return { byConversation: next };
  }),
  setError: (conversationId, error) => set((s) => { const next = new Map(s.byConversation); next.set(conversationId, { ...(next.get(conversationId) ?? initial()), loading: false, error }); return { byConversation: next }; }),
  invalidate: (conversationId, revision) => set((s) => { const previous = s.byConversation.get(conversationId) ?? initial(); if (revision !== undefined && previous.revision !== null && revision <= previous.revision) return s; const next = new Map(s.byConversation); next.set(conversationId, { ...previous, loading: false, error: null, board: null, revision: revision ?? previous.revision }); return { byConversation: next }; }),
  clear: (conversationId) => set((s) => {
    const byConversation = new Map(s.byConversation);
    const previews = new Map(s.previews);
    byConversation.delete(conversationId);
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
    });
    previews.delete(conversationId);
    return { byConversation, previews };
  }),
  previews: new Map(),
  addPreview: (conversationId, preview) => set((s) => {
    const next = new Map(s.previews);
    const old = next.get(conversationId) ?? [];
    // Re-emitted deltas are common; a view id is stable for one preview.
    if (old.some((item) => item.viewId === preview.viewId)) return s;
    next.set(conversationId, [...old.slice(-11), preview]);
    return { previews: next };
  }),
}));
