import { useCoreProductivityProfile } from '@/hooks/use-core-productivity-profile';
import '@/lib/chat-workspace-session';
import { useChatWorkspaceStore } from '@/stores/chat-workspace.store';
import { MCPAppApprovalList } from './mcp-apps/MCPAppApprovalList';
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

import { toast } from 'sonner';

import { useState, useEffect, useCallback, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Activity, ChevronDown, ChevronUp, PanelRight, MessageSquare, X, Lightbulb, RefreshCw, Volume1, Volume2, VolumeX, History } from 'lucide-react';
import { CheckpointsPanel } from '@/components/chat/CheckpointsPanel';
import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import { useTtsChatState, nextTtsChatState, type TtsChatState } from '@/hooks/use-tts-chat-state';
import { useWebSocket } from '@/hooks/use-websocket';
import { useIsMobile } from '@/hooks/use-media-query';
import { useBackGuard } from '@/hooks/use-back-guard';
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
import { ConversationCollaboration } from './ConversationCollaboration';
import { ConversationTasksPanel } from './ConversationTasksPanel';

export function Component() {
  useCoreProductivityProfile();
  const isMobile = useIsMobile();
  const activeConvId = useChatStore((s) => s.activeConversationId);
  const conversations = useChatStore((s) => s.conversations);
  const activeConv = activeConvId ? conversations.find(c => c.id === activeConvId) : null;
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const workspace = useChatWorkspaceStore(s => activeConvId ? s.byConversation[activeConvId] : undefined);
  const canvasOpen = workspace?.panelOpen ?? false;
  const setCanvasOpen = useCallback((open: boolean) => { if (activeConvId) useChatWorkspaceStore.getState().setPanel(activeConvId, open); }, [activeConvId]);
  const [expanded, setExpanded] = useState(false);
  const [canvasSuspendedForApp, setCanvasSuspendedForApp] = useState(false);
  useEffect(() => { setCanvasSuspendedForApp(false); }, [canvasOpen, activeConvId]);
  useEffect(() => {
    const focus = (event: Event) => {
      const detail = (event as CustomEvent<{ conversation_id?: string }>).detail;
      if (detail?.conversation_id !== activeConvId) return;
      if (isMobile && canvasOpen) setCanvasSuspendedForApp(true);
      setTimeout(() => document.querySelector('[data-mcp-app-approvals]')?.scrollIntoView({ block: 'center' }), 0);
    };
    window.addEventListener('micelclaw:mcp-app-focus-chat', focus);
    return () => window.removeEventListener('micelclaw:mcp-app-focus-chat', focus);
  }, [activeConvId, isMobile, canvasOpen]);
  const [canvasWidth, setCanvasWidth] = useState(520);
  const [checkpointsOpen, setCheckpointsOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const setChatState = useChatStore((s) => s.setChatState);
  const loadMessages = useChatStore((s) => s.loadMessages);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const insightsRef = useRef<InsightsWidgetHandle>(null);
  const [insightsCollapsed, setInsightsCollapsed] = useState(() => {
    try { return localStorage.getItem('claw-insights-collapsed') === 'true'; } catch { return false; }
  });
  const toggleInsightsCollapsed = () => {
    const next = !insightsCollapsed;
    setInsightsCollapsed(next);
    try { localStorage.setItem('claw-insights-collapsed', String(next)); } catch { /* ignore */ }
  };
  useEffect(() => {
    if (!userId) return;
    try {
      const saved = Number(localStorage.getItem(`micelclaw.canvas.width.${userId}`));
      if (Number.isFinite(saved) && saved >= 320 && saved <= 900) setCanvasWidth(saved);
    } catch { /* UI preference is optional. */ }
  }, [userId]);
  const resizeCanvas = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (isMobile) return;
    event.preventDefault();
    const startX = event.clientX; const startWidth = canvasWidth;
    // Capture the final width through the updater, avoiding stale state in the
    // closure used by pointerup.
    let finalWidth = startWidth;
    const trackedMove = (moveEvent: PointerEvent) => { const bounds = document.querySelector('[data-workspace-split]')?.getBoundingClientRect(); finalWidth = Math.max(320, Math.min(900, bounds ? bounds.width * .65 : 900, startWidth + startX - moveEvent.clientX)); setCanvasWidth(finalWidth); };
    const trackedEnd = () => { window.removeEventListener('pointermove', trackedMove); window.removeEventListener('pointerup', trackedEnd); if (userId) try { localStorage.setItem(`micelclaw.canvas.width.${userId}`, String(finalWidth)); } catch { /* ignore */ } };
    window.addEventListener('pointermove', trackedMove); window.addEventListener('pointerup', trackedEnd, { once: true });
  }, [canvasWidth, isMobile, userId]);

  // Back jerárquico móvil: cada overlay se cierra con "atrás" (de más interna a
  // más externa) en vez de salir del módulo. Replican el onClose/onClick actual.
  useBackGuard(canvasOpen, () => setCanvasOpen(false), isMobile);
  useBackGuard(checkpointsOpen, () => setCheckpointsOpen(false), isMobile);
  useBackGuard(tasksOpen, () => setTasksOpen(false), isMobile);
  useBackGuard(showSidebar, () => setShowSidebar(false), isMobile);

  // Set chat state to 3 on mount
  useEffect(() => {
    setChatState(3);
    return () => setChatState(1);
  }, [setChatState]);

  // Deep-link `/chat?conversation=<id>` (p.ej. desde "Trabajar ahora" / "Trabajos" del Workboard):
  // selecciona esa conversación (→ el effect de abajo carga sus mensajes) + refresca la lista para
  // que aparezca en el sidebar Y traiga su flag `is_agent_task` (necesario para el chat read-only),
  // y limpia el param para no re-disparar en re-renders.
  useEffect(() => {
    const convId = searchParams.get('conversation');
    if (!convId) return;
    selectConversation(convId);
    void loadConversations();
    navigate('/chat', { replace: true });
  }, [searchParams, selectConversation, loadConversations, navigate]);

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
  const collaborationEvent = useWebSocket('chat.collaboration.changed');
  const revokedEvent = useWebSocket('chat.access.revoked');

  useEffect(() => {
    if (!navEvent) return;
    const route = navEvent.data.route as string;
    const params = navEvent.data.params as Record<string, string> | undefined;
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    setChatState(2);
    navigate(route + query);
  }, [navEvent, navigate, setChatState]);

  useEffect(() => {
    if (!collaborationEvent) return;
    void loadConversations();
    const conversationId = collaborationEvent.data.conversation_id;
    if (typeof conversationId === 'string' && conversationId === activeConvId) void loadMessages(conversationId);
  }, [collaborationEvent, activeConvId, loadConversations, loadMessages]);

  useEffect(() => {
    if (!revokedEvent) return;
    const conversationId = revokedEvent.data.conversation_id;
    if (typeof conversationId !== 'string') return;
    if (conversationId === activeConvId) useChatStore.getState().startNewConversation();
    void loadConversations();
  }, [revokedEvent, activeConvId, loadConversations]);

  // Canvas & browser session hooks — auto-open panel on content
  const { hasContent, hasNativeCanvas } = useCanvasEvents();
  const { isActive: browserActive } = useBrowserSession();

  useEffect(() => {
    const open = () => setCanvasOpen(true);
    window.addEventListener('micelclaw:open-canvas', open);
    return () => window.removeEventListener('micelclaw:open-canvas', open);
  }, [setCanvasOpen]);

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

          <button
            type="button"
            title="Tareas de este chat"
            aria-label="Abrir tareas de este chat"
            aria-pressed={tasksOpen}
            disabled={!activeConvId}
            onClick={() => setTasksOpen((open) => !open)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: tasksOpen ? 'var(--surface-hover)' : 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-dim)', cursor: activeConvId ? 'pointer' : 'default', fontSize: 12 }}
          >
            <Activity size={14} />{!isMobile && 'Trabajo'}
          </button>

          <ConversationCollaboration conversationId={activeConvId} compact={isMobile} />
          {activeConvId && <button type="button" className="px-2 py-1 text-xs underline" onClick={() => {
            void navigate(`/chat?view=native&conversation=${encodeURIComponent(activeConvId)}`);
          }}>Abrir Chat nativo</button>}

          {/* The same Canvas dashboard opens as a split pane on desktop and a
              full-screen overlay on PWA/Android. */}
          <button
              aria-label="Abrir resultados"
              aria-pressed={canvasOpen}
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
              {!isMobile && 'Resultados'}
              {!canvasOpen && (hasContent || hasNativeCanvas || browserActive) && (
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
        </div>

        {/* Chat + Canvas split */}
        <div data-workspace-split style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, position: 'relative' }}>
          {/* Chat column */}
          <div style={{ flex: 1, display: expanded && canvasOpen && !isMobile ? 'none' : 'flex', flexDirection: 'column', minWidth: 0 }}>
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
        <MCPAppApprovalList conversationId={activeConvId} />
        {isMobile && canvasOpen && canvasSuspendedForApp && <button onClick={() => setCanvasSuspendedForApp(false)} style={{ padding: 9, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>Return to App</button>}

        {/* Input */}
        <ChatInput
          onCollapse={handleCollapse}
          showCollapse
        />
          </div>

          {/* One host survives hiding and mobile/desktop changes; loaded tabs keep their frames. */}
          <div role="separator" aria-label="Redimensionar resultados" aria-orientation="vertical" tabIndex={canvasOpen && !isMobile && !expanded ? 0 : -1}
            aria-valuemin={320} aria-valuemax={900} aria-valuenow={canvasWidth}
            onPointerDown={resizeCanvas} onDoubleClick={() => setCanvasWidth(520)}
            onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setCanvasWidth(width => Math.max(320, Math.min(900, width + (event.key === 'ArrowLeft' ? 32 : -32)))); } }}
            style={{ display: canvasOpen && !isMobile && !expanded ? 'block' : 'none', width: 7, flexShrink: 0, cursor: 'col-resize', background: 'var(--border)', touchAction: 'none' }} />
          <div data-workspace-host style={{ display: canvasOpen && !canvasSuspendedForApp ? 'flex' : 'none', ...(isMobile ? { position: 'absolute' as const, inset: 0, zIndex: 60 } : { width: expanded ? '100%' : canvasWidth, maxWidth: expanded ? '100%' : 'min(900px, 65%)', minWidth: expanded ? 0 : 320, flexShrink: 0 }) }}>
            <CanvasPanel onClose={() => setCanvasOpen(false)} expanded={expanded} onExpand={isMobile ? undefined : () => setExpanded(value => !value)} />
          </div>
        </div>

        {/* G8: Checkpoints drawer (fixed overlay, right side) */}
        {checkpointsOpen && activeConvId && (
          <CheckpointsPanel
            conversationId={activeConvId}
            conversationTitle={activeConv?.first_message?.slice(0, 60)}
            onClose={() => setCheckpointsOpen(false)}
          />
        )}

        {tasksOpen && activeConvId && <ConversationTasksPanel conversationId={activeConvId} onClose={() => setTasksOpen(false)} />}


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
    const result = sendMessage(`/tts chat ${next}`);
    if (!result.accepted) toast.error('No se pudo enviar el cambio de TTS.');
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
