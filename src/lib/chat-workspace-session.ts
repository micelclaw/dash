import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import { useChatWorkspaceStore } from '@/stores/chat-workspace.store';
import { useCanvasStore } from '@/stores/canvas.store';
import { useNativeCanvasBoardStore } from '@/stores/native-canvas-board.store';

function adoptSession(clearChat = false) {
  const s = useAuthStore.getState();
  if (clearChat) useChatStore.setState({ activeConversationId: null, conversations: [], messages: new Map(), unreadByConv: new Map(), streamingMessage: null, pendingDraft: null, bubbleMessage: null, backgroundRuns: new Map(), agents: [] });
  useChatWorkspaceStore.setState({ owner: s.user?.id ?? null, generation: s.sessionGeneration, byConversation: {} });
  useCanvasStore.setState({ canvasStates: new Map(), canvasHistory: new Map(), currentCanvasIndex: new Map(), browserSessions: new Map(), activeMode: null });
  useNativeCanvasBoardStore.setState({ byConversation: new Map(), previews: new Map() });
}
adoptSession();
// Clear synchronously at the identity boundary, including when the panel is hidden.
useAuthStore.subscribe((s, previous) => {
  if (s.sessionGeneration !== previous.sessionGeneration || s.user?.id !== previous.user?.id) adoptSession(true);
});
