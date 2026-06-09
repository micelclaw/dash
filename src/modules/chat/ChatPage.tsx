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

import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { ChevronDown, ChevronUp, PanelRight, MessageSquare, X, Lightbulb, RefreshCw, Volume1, Volume2, VolumeX, History } from 'lucide-react';
import { CheckpointsPanel } from '@/components/chat/CheckpointsPanel';
import { useChatStore } from '@/stores/chat.store';
import { useTtsChatState, nextTtsChatState, type TtsChatState } from '@/hooks/use-tts-chat-state';
import { useWebSocket } from '@/hooks/use-websocket';
import { useIsMobile } from '@/hooks/use-media-query';
import { useCanvasEvents } from '@/hooks/use-canvas-events';
import { useBrowserSession } from '@/hooks/use-browser-session';
import { ChatPanel } from '@/components/shell/ChatPanel';
import { ChatInput } from '@/components/shell/ChatInput';
import { ConversationsSidebar } from './ConversationsSidebar';
import { CanvasPanel } from './CanvasPanel';
import { ProviderQuotaBadge } from './components/ProviderQuotaBadge';
import { GpuVramBadge } from './components/GpuVramBadge';
import { ContextRing } from './components/ContextRing';
import { GoalChip } from './components/GoalChip';
import { ContextCard } from '@/components/shell/ContextCard';
import { ContextSignals } from '@/components/shell/ContextSignals';
import { InsightsWidget } from '@/components/shell/InsightsWidget';
import type { InsightsWidgetHandle } from '@/components/shell/InsightsWidget';

export function Component() {
  const isMobile = useIsMobile();
  const activeConvId = useChatStore((s) => s.activeConversationId);
  const conversations = useChatStore((s) => s.conversations);
  const activeConv = activeConvId ? conversations.find(c => c.id === activeConvId) : null;
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [checkpointsOpen, setCheckpointsOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const setChatState = useChatStore((s) => s.setChatState);
  const loadMessages = useChatStore((s) => s.loadMessages);
  const navigate = useNavigate();
  const insightsRef = useRef<InsightsWidgetHandle>(null);
  const [insightsCollapsed, setInsightsCollapsed] = useState(() => {
    try { return localStorage.getItem('claw-insights-collapsed') === 'true'; } catch { return false; }
  });
  const toggleInsightsCollapsed = () => {
    const next = !insightsCollapsed;
    setInsightsCollapsed(next);
    try { localStorage.setItem('claw-insights-collapsed', String(next)); } catch { /* ignore */ }
  };

  // Set chat state to 3 on mount
  useEffect(() => {
    setChatState(3);
    return () => setChatState(1);
  }, [setChatState]);

  // `chat.stream.*` ahora se maneja en una ÚNICA suscripción global (Shell,
  // useChatStreamSubscription) → no se pierde el `done` al navegar fuera del chat.
  // Aquí solo reconciliamos desde DB al montar/volver al chat (P2): si la
  // respuesta se completó mientras el chat estaba desmontado, este refetch la
  // trae (y `loadMessages` mergea idempotente con lo que ya haya en el store).
  useEffect(() => {
    if (activeConvId) void loadMessages(activeConvId);
  }, [activeConvId, loadMessages]);

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

  // Canvas & browser session hooks — auto-open panel on content
  const { hasContent } = useCanvasEvents();
  const { isActive: browserActive } = useBrowserSession();

  useEffect(() => {
    if (!isMobile && (hasContent || browserActive)) {
      setCanvasOpen(true);
    }
  }, [hasContent, browserActive, isMobile]);

  const handleCollapse = useCallback(() => {
    setChatState(2);
    navigate(-1);
  }, [setChatState, navigate]);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Conversations sidebar — desktop: always visible; mobile: overlay */}
      {isMobile ? (
        showSidebar && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setShowSidebar(false)}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                zIndex: 40,
              }}
            />
            {/* Sidebar overlay */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: 280,
                zIndex: 50,
                boxShadow: '2px 0 12px rgba(0,0,0,0.3)',
              }}
            >
              <ConversationsSidebar />
            </div>
          </>
        )
      ) : (
        <ConversationsSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Chat toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isMobile ? 'space-between' : 'flex-end',
            padding: '4px 12px',
            gap: 4,
            flexShrink: 0,
            borderBottom: '1px solid var(--border)',
          }}
        >
          {/* Mobile sidebar toggle */}
          {isMobile && (
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4,
                background: showSidebar ? 'var(--surface-hover)' : 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                color: 'var(--text-dim)',
                transition: 'background var(--transition-fast)',
              }}
            >
              {showSidebar ? <X size={16} /> : <MessageSquare size={16} />}
            </button>
          )}

          {/* Context % ring — a la izquierda del token usage; color por umbral,
              se auto-oculta sin sesión. Avisa antes de la auto-compactación. */}
          {!isMobile && <ContextRing />}

          {/* Provider quota chip (F3.1) — hidden on mobile + when no data */}
          {!isMobile && <ProviderQuotaBadge />}

          {/* GPU/VRAM indicator (F2) — transparencia del árbitro de VRAM */}
          {!isMobile && <GpuVramBadge />}

          {/* Session goal chip (U1, OpenClaw 6.1) — se auto-oculta sin goal */}
          <GoalChip />

          {/* Per-conv TTS toggle (G2) — visible on both desktop and mobile */}
          <TtsToggleButton />

          {/* Checkpoints (G8) — only when there's an active conversation */}
          <CheckpointsButton
            disabled={!activeConvId}
            active={checkpointsOpen}
            onClick={() => setCheckpointsOpen(v => !v)}
          />

          {/* Canvas toggle — hidden on mobile */}
          {!isMobile && (
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
                position: 'relative',
              }}
            >
              <PanelRight size={14} />
              Canvas
              {!canvasOpen && (hasContent || browserActive) && (
                <span style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--amber)',
                }} />
              )}
            </button>
          )}
        </div>

        {/* Chat + Canvas split */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Chat column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <ContextCard />
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
                <Lightbulb size={14} className="text-amber-400" />
                <span className="text-xs font-semibold text-[var(--text)]">Insights</span>
                <div className="flex-1" />
                <button onClick={() => insightsRef.current?.refresh()} className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-muted)]" title="Refresh insights">
                  <RefreshCw size={12} />
                </button>
                <button onClick={toggleInsightsCollapsed} className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-muted)]" title={insightsCollapsed ? 'Expand' : 'Collapse'}>
                  {insightsCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                </button>
              </div>
              {!insightsCollapsed && (
                <>
                  <InsightsWidget ref={insightsRef} />
                  <ContextSignals />
                </>
              )}
            </div>
            <ChatPanel />
          </div>

          {/* Canvas (50/50 split when open) — never shown on mobile */}
          {!isMobile && canvasOpen && <CanvasPanel onClose={() => setCanvasOpen(false)} />}
        </div>

        {/* G8: Checkpoints drawer (fixed overlay, right side) */}
        {checkpointsOpen && activeConvId && (
          <CheckpointsPanel
            conversationId={activeConvId}
            conversationTitle={activeConv?.first_message?.slice(0, 60)}
            onClose={() => setCheckpointsOpen(false)}
          />
        )}

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

/* -------------------------------------------------------------------------- */
/*  TtsToggleButton — header chip cycling through default → on → off → …      */
/* -------------------------------------------------------------------------- */

/** Visual mapping for the three toggle states. */
const TTS_TOGGLE_PRESENTATION: Record<TtsChatState, {
  Icon: typeof Volume1;
  color: string;
  background: string;
  border: string;
  title: string;
}> = {
  default: {
    Icon: Volume1,
    color: 'var(--text-muted)',
    background: 'transparent',
    border: '1px solid var(--border)',
    // What clicking will do next, mirrors `nextTtsChatState`.
    title: 'TTS auto-play: default — heredando setting global. Click para activar siempre en esta conversación.',
  },
  on: {
    Icon: Volume2,
    color: '#3b82f6',
    background: 'rgba(59, 130, 246, 0.12)',
    border: '1px solid rgba(59, 130, 246, 0.45)',
    title: 'TTS auto-play: ON — reproducirá cada respuesta en esta conversación. Click para silenciar.',
  },
  off: {
    Icon: VolumeX,
    color: 'var(--text-muted)',
    background: 'transparent',
    border: '1px solid var(--border)',
    title: 'TTS auto-play: OFF — silenciado en esta conversación. Click para volver al comportamiento por defecto.',
  },
};

const TTS_TOGGLE_BUTTON_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 4,
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  transition: 'background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast)',
};

function TtsToggleButton() {
  const activeConvId = useChatStore((s) => s.activeConversationId);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const state = useTtsChatState(activeConvId);
  const { Icon, color, background, border, title } = TTS_TOGGLE_PRESENTATION[state];

  const onClick = () => {
    const next = nextTtsChatState(state);
    // sendMessage takes care of writeTtsChatState via the early hook inside the
    // store (so localStorage updates synchronously) AND ships the slash to the
    // backend dispatcher, which echoes the confirmation chip into the chat.
    sendMessage(`/tts chat ${next}`);
  };

  return (
    <button
      onClick={onClick}
      style={{ ...TTS_TOGGLE_BUTTON_STYLE, color, background, border }}
      title={title}
      aria-label={title}
    >
      <Icon size={16} />
    </button>
  );
}

/* ───────────────────────────────────────────────────────────────────────────── */
/*  CheckpointsButton (G8) — toolbar button that toggles the side drawer        */
/* ───────────────────────────────────────────────────────────────────────────── */

function CheckpointsButton({ disabled, active, onClick }: { disabled: boolean; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? 'Start a conversation to access checkpoints' : 'Restore points'}
      aria-label="Restore points"
      style={{
        ...TTS_TOGGLE_BUTTON_STYLE,
        color: active ? 'var(--amber)' : 'var(--text-dim)',
        background: active ? 'var(--surface-hover)' : 'transparent',
        border: '1px solid var(--border)',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <History size={16} />
    </button>
  );
}
