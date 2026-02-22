import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { ChevronDown, PanelRight } from 'lucide-react';
import { useChatStore } from '@/stores/chat.store';
import { useWebSocket } from '@/hooks/use-websocket';
import { ChatPanel } from '@/components/shell/ChatPanel';
import { ChatInput } from '@/components/shell/ChatInput';
import { ConversationsSidebar } from './ConversationsSidebar';
import { CanvasPanel } from './CanvasPanel';

export function Component() {
  const [canvasOpen, setCanvasOpen] = useState(false);
  const setChatState = useChatStore((s) => s.setChatState);
  const appendStreamToken = useChatStore((s) => s.appendStreamToken);
  const finalizeStream = useChatStore((s) => s.finalizeStream);
  const setStreamingMessage = useChatStore((s) => s.setStreamingMessage);
  const navigate = useNavigate();

  // Set chat state to 3 on mount
  useEffect(() => {
    setChatState(3);
    return () => setChatState(1);
  }, [setChatState]);

  // Listen to chat stream events (same as BottomBar but for State 3)
  const streamEvent = useWebSocket('chat.stream.*');

  useEffect(() => {
    if (!streamEvent) return;
    const data = streamEvent.data;
    const convId = data.conversation_id as string;

    switch (streamEvent.event) {
      case 'chat.stream.start':
        setStreamingMessage({ conversationId: convId, tokens: '' });
        break;
      case 'chat.stream.token':
        appendStreamToken(convId, data.token as string);
        break;
      case 'chat.stream.done':
        finalizeStream(
          convId,
          data.full_text as string,
          data.model as string | undefined,
          data.tokens_used as number | undefined,
        );
        break;
    }
  }, [streamEvent, appendStreamToken, finalizeStream, setStreamingMessage]);

  // Listen for dash.navigate events
  const navEvent = useWebSocket('dash.navigate');

  useEffect(() => {
    if (!navEvent) return;
    const route = navEvent.data.route as string;
    const params = navEvent.data.params as Record<string, string> | undefined;
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    setChatState(2);
    navigate(route + query);
  }, [navEvent, navigate, setChatState]);

  const handleCollapse = useCallback(() => {
    setChatState(2);
    navigate(-1);
  }, [setChatState, navigate]);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Conversations sidebar */}
      <ConversationsSidebar />

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Chat toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '4px 12px',
            gap: 4,
            flexShrink: 0,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <button
            onClick={() => setCanvasOpen(!canvasOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              background: canvasOpen ? 'var(--surface-hover)' : 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
              transition: 'background var(--transition-fast)',
            }}
          >
            <PanelRight size={14} />
            Canvas
          </button>
        </div>

        {/* Chat + Canvas split */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Chat column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <ChatPanel />
          </div>

          {/* Canvas (50/50 split when open) */}
          {canvasOpen && <CanvasPanel onClose={() => setCanvasOpen(false)} />}
        </div>

        {/* Input */}
        <ChatInput
          onCollapse={handleCollapse}
          showCollapse
        />
      </div>

      {/* Collapse indicator */}
      <button
        onClick={handleCollapse}
        style={{
          position: 'absolute',
          bottom: 58,
          right: 16,
          display: 'none', // hidden by default, shown via ChatInput's collapse button
        }}
      >
        <ChevronDown size={16} />
      </button>
    </div>
  );
}
