import { useEffect, useMemo, useState, useRef } from 'react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { useChatStore } from '@/stores/chat.store';
import { getMockConversations, getMockMessages } from '@/services/mock';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ContextMenu } from '@/components/shared/ContextMenu';
import type { ContextMenuItem } from '@/components/shared/ContextMenu';

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const dayMs = 86_400_000;

  if (diff < dayMs) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < dayMs * 2) return 'Yesterday';
  if (diff < dayMs * 7) return 'This Week';
  return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

function groupByDate<T extends { id: string; created_at: string }>(conversations: T[]) {
  const now = new Date();
  const dayMs = 86_400_000;
  const groups: { label: string; items: typeof conversations }[] = [];
  const today: typeof conversations = [];
  const yesterday: typeof conversations = [];
  const thisWeek: typeof conversations = [];
  const older: typeof conversations = [];

  for (const conv of conversations) {
    const diff = now.getTime() - new Date(conv.created_at).getTime();
    if (diff < dayMs) today.push(conv);
    else if (diff < dayMs * 2) yesterday.push(conv);
    else if (diff < dayMs * 7) thisWeek.push(conv);
    else older.push(conv);
  }

  if (today.length) groups.push({ label: 'Today', items: today });
  if (yesterday.length) groups.push({ label: 'Yesterday', items: yesterday });
  if (thisWeek.length) groups.push({ label: 'This Week', items: thisWeek });
  if (older.length) groups.push({ label: 'Older', items: older });

  return groups;
}

export function ConversationsSidebar() {
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const startNewConversation = useChatStore((s) => s.startNewConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const renameConversation = useChatStore((s) => s.renameConversation);
  const setConversations = useChatStore((s) => s.setConversations);
  const addMessage = useChatStore((s) => s.addMessage);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Load mock conversations on mount
  useEffect(() => {
    if (conversations.length === 0) {
      const isMock = import.meta.env.VITE_MOCK_API === 'true';
      if (isMock) {
        const mockConvs = getMockConversations();
        setConversations(mockConvs);
        // Pre-load messages for mock conversations
        for (const conv of mockConvs) {
          const msgs = getMockMessages(conv.id);
          for (const msg of msgs) {
            addMessage(msg);
          }
        }
      }
    }
  }, [conversations.length, setConversations, addMessage]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.first_message.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  const agentColors: Record<string, string> = {
    francis: 'var(--mod-chat)',
    elon: 'var(--mod-agents)',
    ana: 'var(--mod-contacts)',
  };

  return (
    <div
      style={{
        width: 260,
        minWidth: 260,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Search */}
      <div style={{ padding: '12px 12px 8px' }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 28, height: 28, fontSize: '0.75rem' }}
          />
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        <div style={{ padding: '0 8px' }}>
          {groups.map((group) => (
            <div key={group.label}>
              <div
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '12px 8px 4px',
                }}
              >
                {group.label}
              </div>
              {group.items.map((conv) => {
                const contextItems: ContextMenuItem[] = [
                  {
                    label: 'Rename',
                    icon: Pencil,
                    onClick: () => {
                      setEditingId(conv.id);
                      setEditingTitle(conv.first_message);
                      setTimeout(() => editInputRef.current?.focus(), 0);
                    },
                  },
                  { label: '', onClick: () => {}, separator: true },
                  {
                    label: 'Delete',
                    icon: Trash2,
                    variant: 'danger',
                    onClick: () => deleteConversation(conv.id),
                  },
                ];

                return (
                  <ContextMenu key={conv.id} trigger={
                    <button
                      onClick={() => {
                        if (editingId !== conv.id) selectConversation(conv.id);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        padding: '8px',
                        background: conv.id === activeConversationId ? 'var(--surface-hover)' : 'transparent',
                        border: conv.id === activeConversationId ? '1px solid var(--amber-dim)' : '1px solid transparent',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-md)',
                        transition: 'background var(--transition-fast)',
                        textAlign: 'left',
                        color: 'var(--text)',
                        fontFamily: 'var(--font-sans)',
                      }}
                      onMouseEnter={(e) => {
                        if (conv.id !== activeConversationId) e.currentTarget.style.background = 'var(--surface-hover)';
                      }}
                      onMouseLeave={(e) => {
                        if (conv.id !== activeConversationId) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 'var(--radius-full)',
                          background: agentColors[conv.agent] ?? 'var(--text-muted)',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        {editingId === conv.id ? (
                          <input
                            ref={editInputRef}
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                renameConversation(conv.id, editingTitle.trim() || conv.first_message);
                                setEditingId(null);
                              }
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            onBlur={() => {
                              renameConversation(conv.id, editingTitle.trim() || conv.first_message);
                              setEditingId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '100%',
                              fontSize: '0.8125rem',
                              background: 'var(--surface)',
                              border: '1px solid var(--amber)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '1px 4px',
                              color: 'var(--text)',
                              fontFamily: 'var(--font-sans)',
                              outline: 'none',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              fontSize: '0.8125rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {conv.first_message}
                          </div>
                        )}
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          {formatRelativeDate(conv.created_at)}
                        </div>
                      </div>
                    </button>
                  } items={contextItems} />
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* New chat button */}
      <div style={{ padding: 8, borderTop: '1px solid var(--border)' }}>
        <button
          onClick={startNewConversation}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            width: '100%',
            height: 32,
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
            transition: 'background var(--transition-fast), border-color var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface-hover)';
            e.currentTarget.style.borderColor = 'var(--border-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        >
          <Plus size={14} />
          New chat
        </button>
      </div>
    </div>
  );
}
