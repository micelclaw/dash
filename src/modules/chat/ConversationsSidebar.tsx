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
import { Plus, Search, Pencil, Trash2, PanelLeftClose, PanelLeftOpen, Info, Copy, Check, GitBranch, Clock3, CircleCheck, CircleX, Paperclip, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useChatStore } from '@/stores/chat.store';
import { getMockConversations, getMockMessages } from '@/services/mock';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ContextMenu } from '@/components/shared/ContextMenu';
import type { ContextMenuItem } from '@/components/shared/ContextMenu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { ChatAttachment, Conversation } from '@/types/chat';
import { api } from '@/services/api';

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);
  const startOfWeek = new Date(startOfToday.getTime() - 86_400_000 * ((startOfToday.getDay() + 6) % 7));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  if (date >= startOfToday) return time;
  if (date >= startOfYesterday) return `Yesterday ${time}`;
  if (date >= startOfWeek) {
    const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' });
    return `${weekday} ${time}`;
  }
  if (date >= startOfMonth) return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function groupByDate<T extends { id: string; created_at: string; updated_at?: string }>(conversations: T[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);
  const startOfWeek = new Date(startOfToday.getTime() - 86_400_000 * ((startOfToday.getDay() + 6) % 7));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const groups: { label: string; items: typeof conversations }[] = [];
  const today: typeof conversations = [];
  const yesterday: typeof conversations = [];
  const thisWeek: typeof conversations = [];
  const thisMonth: typeof conversations = [];
  const older: typeof conversations = [];

  for (const conv of conversations) {
    // Group by last activity (updated_at if present, else created_at).
    // A thread that was created yesterday but is still active today
    // belongs in TODAY, not YESTERDAY.
    const date = new Date(conv.updated_at ?? conv.created_at);
    if (date >= startOfToday) today.push(conv);
    else if (date >= startOfYesterday) yesterday.push(conv);
    else if (date >= startOfWeek) thisWeek.push(conv);
    else if (date >= startOfMonth) thisMonth.push(conv);
    else older.push(conv);
  }

  if (today.length) groups.push({ label: 'Today', items: today });
  if (yesterday.length) groups.push({ label: 'Yesterday', items: yesterday });
  if (thisWeek.length) groups.push({ label: 'This Week', items: thisWeek });
  if (thisMonth.length) groups.push({ label: 'This Month', items: thisMonth });
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
  const unreadByConv = useChatStore((s) => s.unreadByConv);
  const backgroundRuns = useChatStore((s) => s.backgroundRuns);
  const startBackgroundConversation = useChatStore((s) => s.startBackgroundConversation);
  const cancelBackgroundConversation = useChatStore((s) => s.cancelBackgroundConversation);
  const agents = useChatStore((s) => s.agents);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  // Details modal — set to the conversation whose IDs the user wants to inspect.
  const [detailsConv, setDetailsConv] = useState<Conversation | null>(null);
  const [backgroundDialogOpen, setBackgroundDialogOpen] = useState(false);
  const [backgroundAgent, setBackgroundAgent] = useState('francis');
  const [backgroundPrompt, setBackgroundPrompt] = useState('');
  const [backgroundAttachments, setBackgroundAttachments] = useState<ChatAttachment[]>([]);
  const [backgroundUploading, setBackgroundUploading] = useState(false);
  const backgroundFileRef = useRef<HTMLInputElement>(null);

  const uploadBackgroundFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBackgroundUploading(true);
    const uploaded: ChatAttachment[] = [];
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('parent_folder', '/chat-attachments/');
        const response = await api.upload<{ data: ChatAttachment }>('/files/upload', formData);
        uploaded.push(response.data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `No se pudo adjuntar ${file.name}`);
      }
    }
    setBackgroundAttachments((current) => [...current, ...uploaded]);
    setBackgroundUploading(false);
    if (backgroundFileRef.current) backgroundFileRef.current.value = '';
  };

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

  // Los hilos delegados son transcripciones hijas, no chats principales.
  // Conservamos los huérfanos (por ejemplo, si el padre ya no está en la
  // página actual) para que un filtro o una paginación no los oculte.
  const childrenByParent = useMemo(() => {
    const visibleIds = new Set(filtered.map((conversation) => conversation.id));
    const next = new Map<string, Conversation[]>();
    for (const conversation of filtered) {
      if (!conversation.is_delegated || !conversation.parent_conversation_id || !visibleIds.has(conversation.parent_conversation_id)) continue;
      const current = next.get(conversation.parent_conversation_id) ?? [];
      current.push(conversation);
      next.set(conversation.parent_conversation_id, current);
    }
    for (const children of next.values()) children.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return next;
  }, [filtered]);
  const groups = useMemo(() => {
    const childIds = new Set(Array.from(childrenByParent.values()).flatMap((children) => children.map((child) => child.id)));
    return groupByDate(filtered.filter((conversation) => !childIds.has(conversation.id) && !conversation.is_background));
  }, [filtered, childrenByParent]);
  const backgroundConversations = useMemo(
    () => filtered.filter((conversation) => conversation.is_background).sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [filtered],
  );

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
          {backgroundConversations.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ padding: '12px 8px 4px', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>CHATS EN SEGUNDO PLANO</div>
              {backgroundConversations.map((conversation) => {
                const status = backgroundRuns.get(conversation.id) ?? 'completed';
                const Icon = status === 'completed' ? CircleCheck : status === 'failed' || status === 'cancelled' ? CircleX : Clock3;
                const label = status === 'queued' ? 'En cola' : status === 'running' ? 'En curso' : status === 'completed' ? 'Terminado' : status === 'cancelled' ? 'Cancelado' : 'Fallido';
                return (
                  <button key={conversation.id} onClick={() => { selectConversation(conversation.id); void loadMessages(conversation.id); }} style={{ width: '100%', display: 'flex', gap: 8, alignItems: 'center', padding: 8, border: '1px solid transparent', borderRadius: 'var(--radius-md)', background: conversation.id === activeConversationId ? 'var(--surface-hover)' : 'transparent', color: 'var(--text)', textAlign: 'left', cursor: 'pointer' }}>
                    <Icon size={14} style={{ color: status === 'completed' ? 'var(--success, #22c55e)' : status === 'failed' ? 'var(--error, #ef4444)' : 'var(--amber)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conversation.first_message}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{conversation.agent} · {label}</div>
                    </div>
                    {(status === 'running' || status === 'queued') && <button type="button" title="Detener" onClick={(event) => { event.stopPropagation(); cancelBackgroundConversation(conversation.id); }} style={{ border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.65rem' }}>Detener</button>}
                  </button>
                );
              })}
            </div>
          )}
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
              {group.items.flatMap((conversation) => [conversation, ...(childrenByParent.get(conversation.id) ?? [])]).map((conv) => {
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
                  {
                    label: 'Details',
                    icon: Info,
                    onClick: () => setDetailsConv(conv),
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
                        padding: '8px 8px',
                        marginLeft: conv.is_delegated ? 12 : 0,
                        width: conv.is_delegated ? 'calc(100% - 12px)' : '100%',
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
                        {/* Agent avatar + name (G9) */}
                        <div style={{
                          fontSize: '0.625rem',
                          fontWeight: 500,
                          color: agentColor,
                          marginBottom: 2,
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}>
                          <span style={{ fontSize: '0.875rem', lineHeight: 1, textTransform: 'none' }}>
                            {agentInfo?.avatar ?? '🤖'}
                          </span>
                          <span>{agentName}</span>
                          {conv.is_delegated && <span title="Conversación de trabajo delegada" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--amber)' }}><GitBranch size={11} /></span>}
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
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{formatRelativeDate(conv.created_at)}</span>
                          {conv.parent_conversation_id && (
                            <span
                              title="Forked from another conversation at a compaction checkpoint"
                              style={{
                                padding: '0 5px',
                                background: 'var(--amber-dim, #5a430022)',
                                color: 'var(--amber)',
                                borderRadius: 3,
                                fontSize: '0.625rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                              }}
                            >
                              fork
                            </span>
                          )}
                        </div>
                      </div>
                      {(() => {
                        const unread = unreadByConv.get(conv.id) ?? 0;
                        if (unread <= 0) return null;
                        return (
                          <div
                            style={{
                              alignSelf: 'center',
                              minWidth: 18,
                              height: 18,
                              padding: '0 6px',
                              borderRadius: 9,
                              background: 'var(--amber)',
                              color: '#000',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                            aria-label={`${unread} sin leer`}
                          >
                            {unread > 99 ? '99+' : unread}
                          </div>
                        );
                      })()}
                    </button>
                  } items={contextItems} />
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* New chat actions */}
      <div style={{ padding: 8, borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
        <button
          onClick={startNewConversation}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            flex: 1,
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
        <button onClick={() => { setBackgroundAgent(useChatStore.getState().selectedAgent); setBackgroundDialogOpen(true); }} title="Nueva conversación en segundo plano" style={{ width: 36, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          <Clock3 size={14} />
        </button>
      </div>

      <DetailsModal conv={detailsConv} onClose={() => setDetailsConv(null)} />
      <Dialog open={backgroundDialogOpen} onOpenChange={setBackgroundDialogOpen}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Nueva conversación en segundo plano</DialogTitle>
            <DialogDescription>Se abrirá un chat independiente con este encargo. Podrás seguir usando el chat actual; el nuevo aparecerá en «Chats en segundo plano» de la lista izquierda.</DialogDescription>
            <DialogDescription>Se iniciará una conversación independiente sin abandonar el chat actual.</DialogDescription>
          </DialogHeader>
          <div style={{ display: 'grid', gap: 14, marginTop: 12 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: '0.75rem', color: 'var(--text-dim)' }}>Agente
              <select value={backgroundAgent} onChange={(event) => setBackgroundAgent(event.target.value)} style={{ height: 36, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '0 10px' }}>
                {agents.map((agent) => <option key={agent.name} value={agent.name}>{agent.display_name}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: '0.75rem', color: 'var(--text-dim)' }}>Modelo
              <input disabled value="Heredar del agente" style={{ height: 36, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', padding: '0 10px' }} />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: '0.75rem', color: 'var(--text-dim)' }}>Encargo
              <textarea value={backgroundPrompt} onChange={(event) => setBackgroundPrompt(event.target.value)} rows={6} placeholder="Prepara un resumen de estos documentos…" style={{ resize: 'vertical', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: 10 }} />
            </label>
            <div style={{ display: 'grid', gap: 7 }}>
              <input ref={backgroundFileRef} type="file" multiple style={{ display: 'none' }} onChange={(event) => void uploadBackgroundFiles(event.target.files)} accept="image/*,.pdf,.txt,.md,.csv,.json,.yaml,.yml,.xml,.html,.css,.js,.ts,.py,.sh,.sql,.log,.zip,.tar,.gz" />
              <button type="button" disabled={backgroundUploading} onClick={() => backgroundFileRef.current?.click()} style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--text-dim)', cursor: backgroundUploading ? 'wait' : 'pointer' }}>{backgroundUploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />} Añadir adjuntos</button>
              {backgroundAttachments.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{backgroundAttachments.map((attachment) => <span key={attachment.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: 240, padding: '4px 7px', borderRadius: 6, background: 'var(--surface-hover)', color: 'var(--text-dim)', fontSize: '0.7rem' }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.filename}</span><button type="button" aria-label={`Quitar ${attachment.filename}`} onClick={() => setBackgroundAttachments((current) => current.filter((item) => item.id !== attachment.id))} style={{ border: 0, padding: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', display: 'flex' }}><X size={12} /></button></span>)}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setBackgroundDialogOpen(false)} style={{ padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>Cancelar</button>
              <button disabled={!backgroundPrompt.trim() || backgroundUploading} onClick={() => { const result = startBackgroundConversation(backgroundPrompt.trim(), backgroundAgent, backgroundAttachments); if (!result.accepted) { toast.error('No se pudo iniciar la conversación. La entrada se conserva.'); return; } setBackgroundPrompt(''); setBackgroundAttachments([]); setBackgroundDialogOpen(false); toast.success('Conversación iniciada en segundo plano'); }} style={{ padding: '8px 14px', border: 0, borderRadius: 'var(--radius-sm)', background: 'var(--amber)', color: '#111', fontWeight: 600, cursor: backgroundPrompt.trim() && !backgroundUploading ? 'pointer' : 'not-allowed', opacity: backgroundPrompt.trim() && !backgroundUploading ? 1 : 0.5 }}>Iniciar</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Details modal ────────────────────────────────────────────────
// Shown when the user clicks "Details" in a chat card's context menu.
// Exposes the two IDs power users need when correlating a dash
// conversation with backend artifacts:
//   - Conversation ID — the `agent_conversations.conversation_id` UUID
//     (= the row in the database; appears in every Core route).
//   - OpenClaw Session — the deterministic session key
//     `agent:<prefix>--<agentName>:webchat:<convId>`. This is what
//     surfaces in `/tmp/openclaw/*.log` and the agent JSONL transcript.
//     Null when the conv has no webchat row yet.
function DetailsModal({ conv, onClose }: { conv: Conversation | null; onClose: () => void }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(label);
      window.setTimeout(() => setCopiedKey((k) => (k === label ? null : k)), 1500);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Clipboard unavailable');
    }
  };

  return (
    <Dialog open={!!conv} onOpenChange={(open) => { if (!open) onClose(); }}>
      {/* className passes through cn() in DialogContent; do NOT pass `style`
          here — shadcn's DialogContent inlines its background/border in
          `style={...}` BEFORE spreading props, so any `style` we pass would
          clobber the opaque background and the modal would render see-through. */}
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Conversation details</DialogTitle>
          <DialogDescription>
            Internal identifiers for this chat. Useful when correlating the
            conversation with Core logs or the OpenClaw transcript.
          </DialogDescription>
        </DialogHeader>

        {conv && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 }}>
            <DetailRow
              label="Conversation ID"
              value={conv.id}
              hint="The row id in agent_conversations (DB)."
              copied={copiedKey === 'Conversation ID'}
              onCopy={() => copy('Conversation ID', conv.id)}
            />
            <DetailRow
              label="OpenClaw Session"
              value={conv.session_id ?? null}
              fallback="Not assigned yet — send a message in this conversation first."
              hint="Deterministic session key as it appears in OpenClaw logs and the agent JSONL transcript."
              copied={copiedKey === 'OpenClaw Session'}
              onCopy={conv.session_id ? () => copy('OpenClaw Session', conv.session_id!) : undefined}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  label,
  value,
  fallback,
  hint,
  copied,
  onCopy,
}: {
  label: string;
  value: string | null;
  fallback?: string;
  hint?: string;
  copied: boolean;
  onCopy?: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
        <code
          style={{
            flex: 1,
            padding: '8px 10px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: value ? 'var(--text)' : 'var(--text-dim)',
            wordBreak: 'break-all',
            lineHeight: 1.5,
          }}
        >
          {value ?? fallback ?? '—'}
        </code>
        {onCopy && (
          <button
            type="button"
            onClick={onCopy}
            aria-label={`Copy ${label}`}
            title={`Copy ${label}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 10px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: copied ? 'var(--accent, #d4a017)' : 'var(--text-dim)',
              cursor: 'pointer',
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
      </div>
      {hint && (
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}
