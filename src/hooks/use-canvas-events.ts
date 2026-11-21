import { useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chat.store';
import { useCanvasStore } from '@/stores/canvas.store';
import { useNativeCanvasBoardStore, type NativeCanvasPreview } from '@/stores/native-canvas-board.store';
import { useChatWorkspaceStore } from '@/stores/chat-workspace.store';
import { useWebSocketStore } from '@/stores/websocket.store';
import { useAuthStore } from '@/stores/auth.store';
import { nativeCanvasService } from '@/services/native-canvas.service';
import { chatWorkspaceService } from '@/services/chat-workspace.service';
import { useProductivityEvents } from './use-productivity-events';

export function useCanvasEvents() {
  useProductivityEvents();
  const activeConvId = useChatStore(s => s.activeConversationId);
  const messages = useChatStore(s => activeConvId ? s.messages.get(activeConvId) : undefined);
  const client = useWebSocketStore(s => s.client);
  const board = useNativeCanvasBoardStore(s => activeConvId ? s.byConversation.get(activeConvId) : undefined);
  const workspace = useChatWorkspaceStore(s => activeConvId ? s.byConversation[activeConvId] : undefined);
  const generation = useAuthStore(s => s.sessionGeneration);
  const workspaceEpoch = workspace?.epoch ?? 0;
  const nativeEpoch = board?.epoch ?? 0;
  const revoked = workspace?.revoked === true;
  const liveVersions = useRef(new Map<string, Map<string, string>>());

  useEffect(() => {
    if (activeConvId) useChatWorkspaceStore.getState().ensure(activeConvId);
  }, [activeConvId, generation]);
  useEffect(() => {
    if (!activeConvId || !messages || revoked) return;
    if (messages.length === 0) liveVersions.current.delete(activeConvId);
    const latest = new Map<string, NativeCanvasPreview>();
    for (const message of messages) {
      if (message.role !== 'assistant') continue;
      const refs = message.message_metadata?.canvas_previews;
      if (!Array.isArray(refs)) continue;
      for (const raw of refs) {
        if (!raw || typeof raw !== 'object') continue;
        const p = raw as Record<string, unknown>;
        if (typeof p.document_id !== 'string' || !/^cv_[a-z0-9_-]{8,128}$/i.test(p.document_id) || typeof p.view_id !== 'string' || !/^[a-z0-9_-]{1,128}$/i.test(p.view_id)) continue;
        const name = typeof p.board_widget_name === 'string' && /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(p.board_widget_name) ? p.board_widget_name : undefined;
        const artifactName = typeof p.artifact_name === 'string' && /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(p.artifact_name) ? p.artifact_name : undefined;
        latest.set(artifactName ?? name ?? p.document_id, { artifactName, documentId: p.document_id, viewId: p.view_id, widgetName: name, title: typeof p.title === 'string' ? p.title : null });
      }
    }
    for (const [key, preview] of latest) {
      const live = liveVersions.current.get(activeConvId)?.get(key);
      const liveInHistory = live && messages.some(message => Array.isArray(message.message_metadata?.canvas_previews) && message.message_metadata.canvas_previews.some((raw: unknown) => raw && typeof raw === 'object' && (raw as Record<string, unknown>).document_id === live));
      if (live && live !== preview.documentId && !liveInHistory) continue;
      useNativeCanvasBoardStore.getState().addPreview(activeConvId, preview);
    }
  }, [activeConvId, messages, revoked]);

  useEffect(() => {
    if (!client) return;
    const unsub = client.on('canvas.*', event => {
      if (useAuthStore.getState().sessionGeneration !== generation) return;
      const chat = event.data.conversation_id;
      if (typeof chat !== 'string' || !chat) return;
      const store = useChatWorkspaceStore.getState();
      if (store.byConversation[chat]?.revoked) return;
      switch (event.event) {
        case 'canvas.board_changed': {
          useNativeCanvasBoardStore.getState().invalidate(chat, typeof event.data.revision === 'number' ? event.data.revision : undefined);
          if (useChatStore.getState().activeConversationId === chat) void discoverNativeBoard(chat, generation);
          // A board mutation can change the bytes behind a document too.
          const current = store.byConversation[chat];
          const resource = current?.resources[`board:${chat}`]; if (resource) store.upsert(chat, resource);
          break;
        }
        case 'canvas.preview': {
          if (typeof event.data.document_id !== 'string' || typeof event.data.view_id !== 'string') return;
          const versions = liveVersions.current.get(chat) ?? new Map<string, string>();
          const name = typeof event.data.artifact_name === 'string' && /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(event.data.artifact_name) ? event.data.artifact_name : typeof event.data.board_widget_name === 'string' && /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(event.data.board_widget_name) ? event.data.board_widget_name : event.data.document_id;
          versions.set(name, event.data.document_id); liveVersions.current.set(chat, versions);
          useNativeCanvasBoardStore.getState().addPreview(chat, { documentId: event.data.document_id, viewId: event.data.view_id, artifactName: typeof event.data.artifact_name === 'string' ? event.data.artifact_name : undefined, widgetName: typeof event.data.board_widget_name === 'string' ? event.data.board_widget_name : undefined, title: typeof event.data.title === 'string' ? event.data.title : null });
          break;
        }
      }
    });
    const unsubChat = client.on('chat.*', event => {
      if (useAuthStore.getState().sessionGeneration !== generation) return;
      const chat = event.data.conversation_id; if (typeof chat !== 'string') return;
      if (event.event === 'chat.stream.done') {
        const workspaceStore = useChatWorkspaceStore.getState(); const current = workspaceStore.byConversation[chat];
        if (current && !current.revoked) for (const r of Object.values(current.resources)) {
          if (r.kind === 'file' && r.file.contentUrl && current.openIds.includes(r.id)) workspaceStore.upsert(chat, { ...r, version: r.version + 1, status: 'loading' });
        }
      }

    });
    return () => { unsub(); unsubChat(); };
  }, [client, generation]);

  useEffect(() => {
    if (!activeConvId || revoked) return;
    let active = true; const chat = activeConvId; const epoch = workspaceEpoch;
    const current = () => active && useAuthStore.getState().sessionGeneration === generation && !useChatWorkspaceStore.getState().byConversation[chat]?.revoked && (useChatWorkspaceStore.getState().byConversation[chat]?.epoch ?? 0) === epoch;
    void chatWorkspaceService.screenshots(chat).then(items => {
      if (current() && items.length) useChatWorkspaceStore.getState().upsert(chat, { id: `browser:${chat}`, kind: 'browser', title: 'Capturas de navegación', sourceConversationId: chat });
    }).catch(() => { /* Browser errors are visible when its result is explicitly opened. */ });
    return () => { active = false; };
  }, [activeConvId, generation, workspaceEpoch, revoked]);

  useEffect(() => {
    if (activeConvId && !revoked) void discoverNativeBoard(activeConvId, generation);
  }, [activeConvId, generation, workspaceEpoch, nativeEpoch, revoked]);

  useEffect(() => {
    const recover = () => {
      const chat = useChatStore.getState().activeConversationId;
      if (!chat || useChatWorkspaceStore.getState().byConversation[chat]?.revoked) return;
      liveVersions.current.delete(chat); useChatWorkspaceStore.getState().revalidate(chat); useNativeCanvasBoardStore.getState().invalidate(chat); void discoverNativeBoard(chat, useAuthStore.getState().sessionGeneration);
    };
    const unsub = useWebSocketStore.subscribe((s, old) => { if (s.status === 'connected' && old.status !== 'connected' && old.status !== 'offline') recover(); });
    let wasHidden = document.visibilityState === 'hidden';
    const visible = () => { if (document.visibilityState === 'hidden') wasHidden = true; else if (wasHidden) { wasHidden = false; recover(); } };
    document.addEventListener('visibilitychange', visible);
    return () => { unsub(); document.removeEventListener('visibilitychange', visible); };
  }, []);
  const legacy = useCanvasStore(s => activeConvId ? s.canvasStates.get(activeConvId) : undefined);
  return { hasContent: Boolean(workspace && Object.keys(workspace.resources).length) || Boolean(legacy?.hasContent), hasNativeCanvas: Boolean(board?.board), canvasType: legacy?.type ?? null };
}


/** Request ownership lives in the stores, so unrelated renders cannot cancel discovery. */
async function discoverNativeBoard(chat: string, generation: number): Promise<void> {
  const workspace = useChatWorkspaceStore.getState().byConversation[chat];
  const state = useNativeCanvasBoardStore.getState().byConversation.get(chat);
  if (workspace?.revoked || state?.board || state?.loading || state?.error) return;
  const epoch = workspace?.epoch ?? 0;
  const nativeEpoch = useNativeCanvasBoardStore.getState().setLoading(chat);
  const current = () => useAuthStore.getState().sessionGeneration === generation && !useChatWorkspaceStore.getState().byConversation[chat]?.revoked && (useChatWorkspaceStore.getState().byConversation[chat]?.epoch ?? 0) === epoch && useNativeCanvasBoardStore.getState().byConversation.get(chat)?.epoch === nativeEpoch;
  try {
    const status = await nativeCanvasService.status();
    if (!current()) return;
    if (!status.native_canvas_enabled) throw new Error('Los tableros no están disponibles.');
    const value = await nativeCanvasService.board(chat);
    if (!current()) return;
    useNativeCanvasBoardStore.getState().setBoard(chat, value, nativeEpoch);
    if (value.widgets?.length || value.tabs?.length) useChatWorkspaceStore.getState().upsert(chat, { id: `board:${chat}`, kind: 'board', title: 'Tablero', sourceConversationId: chat });
  } catch (error) {
    if (current()) useNativeCanvasBoardStore.getState().setError(chat, error instanceof Error ? error.message : 'No se pudo cargar el tablero', nativeEpoch);
  }
}
