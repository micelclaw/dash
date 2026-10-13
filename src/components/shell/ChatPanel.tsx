/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chat.store';
import { ChatMessage } from './ChatMessage';
import type { Message } from '@/types/chat';
import { useUserAvatar } from '@/hooks/use-user-avatar';

/**
 * The native session ledger persists each tool lifecycle as its own assistant
 * row. Visually they still belong to one uninterrupted activity group when no
 * text was emitted between them. Merge only adjacent, tool-only rows from the
 * same agent; any text/thinking/approval/attachment is a hard boundary.
 */
export function groupConsecutiveToolMessages(messages: Message[]): Message[] {
  const grouped: Message[] = [];
  for (const message of messages) {
    const toolOnly = message.role === 'assistant'
      && !message.content.trim()
      && (message.tool_calls?.length ?? 0) > 0
      && !message.thinking
      && !message.approval
      && (message.attachments?.length ?? 0) === 0;
    const previous = grouped[grouped.length - 1];
    const previousToolOnly = previous?.role === 'assistant'
      && !previous.content.trim()
      && (previous.tool_calls?.length ?? 0) > 0
      && !previous.thinking
      && !previous.approval
      && (previous.attachments?.length ?? 0) === 0;

    if (toolOnly && previous && previousToolOnly && previous.agent === message.agent) {
      grouped[grouped.length - 1] = {
        ...previous,
        id: `${previous.id}+${message.id}`,
        tool_calls: [...(previous.tool_calls ?? []), ...(message.tool_calls ?? [])],
      };
      continue;
    }
    grouped.push(message);
  }
  return grouped;
}

export function ChatPanel() {
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const messages = useChatStore((s) => s.messages);
  const streamingMessage = useChatStore((s) => s.streamingMessage);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userAvatar] = useUserAvatar();

  const convMessages = activeConversationId
    ? (messages.get(activeConversationId) ?? [])
    : [];
  const displayMessages = groupConsecutiveToolMessages(convMessages);

  // Auto-scroll on new messages / streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [convMessages.length, streamingMessage?.tokens, streamingMessage?.thinking]);

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
      {displayMessages.map((msg, idx) => (
        <ChatMessage
          key={msg.id}
          message={msg}
          previousMessage={idx > 0 ? displayMessages[idx - 1] : undefined}
          userAvatar={userAvatar}
        />
      ))}
      {streamingMsg && (
        <ChatMessage
          message={streamingMsg}
          isStreaming
          thinkingText={streamingMessage?.thinking}
          isThinking={streamingMessage?.isThinking}
          tools={streamingMessage?.tools}
          previousMessage={convMessages.length > 0 ? convMessages[convMessages.length - 1] : undefined}
          userAvatar={userAvatar}
        />
      )}
    </div>
  );
}
