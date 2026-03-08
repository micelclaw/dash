import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { ArrowUp, ChevronUp, ChevronDown, Paperclip } from 'lucide-react';
import { useChatStore } from '@/stores/chat.store';
import { useModuleContext } from '@/hooks/use-module-context';
import { AgentSelector } from './AgentSelector';

interface ChatInputProps {
  onExpand?: () => void;
  onCollapse?: () => void;
  showExpand?: boolean;
  showCollapse?: boolean;
  compactAgent?: boolean;
}

export function ChatInput({ onExpand, onCollapse, showExpand, showCollapse, compactAgent }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const moduleContext = useModuleContext();

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage(trimmed, {
      module: moduleContext.moduleId,
      active_item: moduleContext.activeItem,
      editor_context: moduleContext.editorContext,
    });
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, sendMessage, moduleContext]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === 'Escape' && onCollapse) {
        onCollapse();
      }
    },
    [handleSend, onCollapse],
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 72) + 'px';
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        padding: '8px 16px',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      <AgentSelector compact={compactAgent} />

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 4,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '4px 8px',
          transition: 'border-color var(--transition-fast)',
        }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Ask anything..."
          rows={1}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text)',
            fontSize: '0.875rem',
            fontFamily: 'var(--font-sans)',
            resize: 'none',
            lineHeight: 1.5,
            minHeight: 24,
            maxHeight: 72,
            padding: '2px 0',
          }}
        />
      </div>

      {/* Attachment */}
      <button
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: 4,
          display: 'flex',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <Paperclip size={16} />
      </button>

      {/* Send button */}
      {text.trim() && (
        <button
          onClick={handleSend}
          style={{
            background: 'var(--amber)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <ArrowUp size={16} color="#06060a" />
        </button>
      )}

      {/* Expand */}
      {showExpand && (
        <button
          onClick={onExpand}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            padding: 4,
            display: 'flex',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <ChevronUp size={16} />
        </button>
      )}

      {/* Collapse */}
      {showCollapse && (
        <button
          onClick={onCollapse}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            padding: 4,
            display: 'flex',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <ChevronDown size={16} />
        </button>
      )}
    </div>
  );
}
