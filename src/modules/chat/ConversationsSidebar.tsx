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

import { useEffect, useMemo, useState, useRef } from 'react';
import { Plus, Search, Pencil, Trash2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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

interface ConversationsSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function ConversationsSidebar({ collapsed, onToggleCollapse }: ConversationsSidebarProps) {
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const startNewConversation = useChatStore((s) => s.startNewConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const renameConversation = useChatStore((s) => s.renameConversation);
  const setConversations = useChatStore((s) => s.setConversations);
  const addMessage = useChatStore((s) => s.addMessage);
  const agents = useChatStore((s) => s.agents);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Build agent color/name lookup
  const agentLookup = useMemo(() => {
    const map: Record<string, { color: string; avatar: string; display_name: string }> = {};
    for (const a of agents) {
      map[a.name] = {
        color: a.color ?? 'var(--text-muted)',
        avatar: a.avatar ?? '🤖',
        display_name: a.display_name,
      };
    }
    return map;
  }, [agents]);

  const loadConversations = useChatStore((s) => s.loadConversations);
  const loadMessages = useChatStore((s) => s.loadMessages);

  // Load conversations on mount
  useEffect(() => {
    const isMock = import.meta.env.VITE_MOCK_API === 'true';
    if (isMock) {
      if (conversations.length === 0) {
        const mockConvs = getMockConversations();
        setConversations(mockConvs);
        for (const conv of mockConvs) {
          const msgs = getMockMessages(conv.id);
          for (const msg of msgs) {
            addMessage(msg);
          }
        }
      }
    } else {
      void loadConversations();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.first_message.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  // Collapsed state — show only toggle button
  if (collapsed) {
    return (
      <div
        style={{
          width: 40,
          minWidth: 40,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 8,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
        }}
      >
        <button
          onClick={onToggleCollapse}
          title="Expand sidebar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            background: 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            transition: 'background var(--transition-fast)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <PanelLeftOpen size={16} />
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        width: 280,
        minWidth: 280,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Header with collapse toggle */}
      <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
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
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title="Collapse sidebar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              flexShrink: 0,
              transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <PanelLeftClose size={16} />
          </button>
        )}
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
                const agentInfo = agentLookup[conv.agent];
                const agentColor = agentInfo?.color ?? 'var(--text-muted)';
                const agentName = agentInfo?.display_name ?? conv.agent;
                const isActive = conv.id === activeConversationId;

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
                        if (editingId !== conv.id) {
                          selectConversation(conv.id);
                          void loadMessages(conv.id);
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        width: '100%',
                        padding: '8px 8px',
                        background: isActive ? 'var(--surface-hover)' : 'transparent',
                        border: isActive ? `1px solid ${agentColor}33` : '1px solid transparent',
                        borderLeft: `3px solid ${isActive ? agentColor : 'transparent'}`,
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-md)',
                        transition: 'background var(--transition-fast)',
                        textAlign: 'left',
                        color: 'var(--text)',
                        fontFamily: 'var(--font-sans)',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'var(--surface-hover)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        {/* Agent name */}
                        <div style={{
                          fontSize: '0.625rem',
                          fontWeight: 500,
                          color: agentColor,
                          marginBottom: 2,
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                        }}>
                          {agentName}
                        </div>
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
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              lineHeight: '1.3',
                            }}
                          >
                            {conv.first_message}
                          </div>
                        )}
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
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
