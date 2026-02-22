import { useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chat.store';
import { ChatMessage } from './ChatMessage';
import type { Message } from '@/types/chat';

export function ChatPanel() {
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const messages = useChatStore((s) => s.messages);
  const streamingMessage = useChatStore((s) => s.streamingMessage);
  const scrollRef = useRef<HTMLDivElement>(null);

  const convMessages = activeConversationId
    ? (messages.get(activeConversationId) ?? [])
    : [];

  // Auto-scroll on new messages / streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [convMessages.length, streamingMessage?.tokens]);

  // Build streaming message for display
  const streamingMsg: Message | null =
    streamingMessage && streamingMessage.conversationId === activeConversationId
      ? {
          id: 'streaming',
          conversation_id: streamingMessage.conversationId,
          role: 'assistant',
          content: streamingMessage.tokens,
          timestamp: new Date().toISOString(),
        }
      : null;

  if (convMessages.length === 0 && !streamingMsg) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.875rem',
        }}
      >
        Start a conversation...
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '12px 16px',
      }}
    >
      {convMessages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      {streamingMsg && <ChatMessage message={streamingMsg} isStreaming />}
    </div>
  );
}
