import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { X } from 'lucide-react';
import { useChatStore } from '@/stores/chat.store';
import { useWebSocket } from '@/hooks/use-websocket';
import { useIsMobile } from '@/hooks/use-media-query';
import { ChatInput } from './ChatInput';
import { ChatPanel } from './ChatPanel';

export function BottomBar() {
  const isMobile = useIsMobile();
  const chatState = useChatStore((s) => s.chatState);
  const setChatState = useChatStore((s) => s.setChatState);
  const bubbleMessage = useChatStore((s) => s.bubbleMessage);
  const setBubbleMessage = useChatStore((s) => s.setBubbleMessage);
  const appendStreamToken = useChatStore((s) => s.appendStreamToken);
  const finalizeStream = useChatStore((s) => s.finalizeStream);
  const setStreamingMessage = useChatStore((s) => s.setStreamingMessage);
  const navigate = useNavigate();

  // Listen to chat stream events
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

  // Auto-dismiss bubble after 8s
  useEffect(() => {
    if (!bubbleMessage) return;
    const timer = setTimeout(() => setBubbleMessage(null), 8000);
    return () => clearTimeout(timer);
  }, [bubbleMessage, setBubbleMessage]);

  const handleExpand = useCallback(() => {
    if (chatState === 1) setChatState(2);
    else if (chatState === 2) {
      setChatState(3);
      navigate('/chat');
    }
  }, [chatState, setChatState, navigate]);

  const handleCollapse = useCallback(() => {
    if (chatState === 2) setChatState(1);
  }, [chatState, setChatState]);

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {/* Bubble message (State 1 short responses) */}
      {bubbleMessage && chatState === 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 16,
            right: 16,
            marginBottom: 8,
            padding: '10px 14px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            animation: 'fadeIn 200ms ease',
            zIndex: 10,
          }}
        >
          <button
            onClick={() => setBubbleMessage(null)}
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 2,
              display: 'flex',
            }}
          >
            <X size={12} />
          </button>
          <p style={{ margin: 0, fontSize: '0.875rem', paddingRight: 16 }}>
            {bubbleMessage.content}
          </p>
        </div>
      )}

      {/* Chat panel (State 2) */}
      {chatState === 2 && (
        <div
          style={{
            height: '30vh',
            display: 'flex',
            flexDirection: 'column',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg)',
            animation: 'slideUp 300ms ease',
          }}
        >
          <ChatPanel />
        </div>
      )}

      {/* Input bar */}
      <ChatInput
        onExpand={handleExpand}
        onCollapse={handleCollapse}
        showExpand
        showCollapse={chatState === 2}
        compactAgent={isMobile}
      />

      {/* CSS animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { height: 0; opacity: 0; }
          to { height: 30vh; opacity: 1; }
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
        @keyframes dotFade {
          0%, 20% { opacity: 0; }
          40% { opacity: 1; }
          60%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
