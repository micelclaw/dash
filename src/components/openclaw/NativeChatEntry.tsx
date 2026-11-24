import { useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, ApiError } from '@/services/api';
import { ENTITY_REF_MAP } from '@/config/entity-refs';
import { NativeOpenclawHost } from './NativeOpenclawHost';
import { NATIVE_HOST_ADAPTER_DIGEST, type NativeHostNavigation, type NativeHostTarget } from '@/services/openclaw-host-bridge';
import { useAuthStore } from '@/stores/auth.store';

export function NativeChatEntry({ conversationId }: { conversationId: string }) {
  const navigate = useNavigate();
  const previous = useRef<{ context: string; sessionKey: string; sessionId: string } | null>(null);
  const resolveTarget = useCallback(async (signal: AbortSignal): Promise<NativeHostTarget> => {
    const { user, sessionGeneration } = useAuthStore.getState();
    const context = `${user?.id}:${sessionGeneration}:${conversationId}`;
    const { data } = await api.get<{ data: { session_key: string; session_id: string } }>(
      `/conversations/threads/${encodeURIComponent(conversationId)}/native-chat`, undefined, { signal },
    );
    signal.throwIfAborted();
    const target = { sessionKey: data.session_key, sessionId: data.session_id };
    if (previous.current?.context === context &&
      (previous.current.sessionKey !== target.sessionKey || previous.current.sessionId !== target.sessionId)) {
      throw new ApiError('NATIVE_CHAT_SESSION_CHANGED', 'La sesión original ya no está disponible.', undefined, 409);
    }
    previous.current = { context, ...target };
    return { surface: 'chat', ...target };
  }, [conversationId]);

  function followResource(intent: NativeHostNavigation) {
    if (intent.kind === 'voice-settings') {
      void navigate('/settings/voice');
      return;
    }
    // The first extension supports Notes. The module reads the record through
    // its ordinary API and permissions. The message grants no resource access.
    if (intent.kind === 'entity' && intent.entityType === 'note') {
      const route = ENTITY_REF_MAP.note?.route(intent.entityId);
      if (route) void navigate(route);
    }
  }

  return <div className="flex h-full min-h-0 flex-col">
    <div className="border-b px-4 py-2">
      <Link className="text-sm underline" to={`/chat?conversation=${encodeURIComponent(conversationId)}`}>Volver a la conversación</Link>
    </div>
    <div className="min-h-0 flex-1">
      <NativeOpenclawHost key={conversationId} artifactDigest={NATIVE_HOST_ADAPTER_DIGEST} resolveTarget={resolveTarget} onNavigate={followResource} />
    </div>
  </div>;
}
