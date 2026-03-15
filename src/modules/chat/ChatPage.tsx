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

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { ChevronDown, PanelRight, MessageSquare, X } from 'lucide-react';
import { useChatStore } from '@/stores/chat.store';
import { useWebSocket } from '@/hooks/use-websocket';
import { useIsMobile } from '@/hooks/use-media-query';
import { useCanvasEvents } from '@/hooks/use-canvas-events';
import { useBrowserSession } from '@/hooks/use-browser-session';
import { ChatPanel } from '@/components/shell/ChatPanel';
import { ChatInput } from '@/components/shell/ChatInput';
import { ConversationsSidebar } from './ConversationsSidebar';
import { CanvasPanel } from './CanvasPanel';
import { ContextCard } from '@/components/shell/ContextCard';

export function Component() {
  const isMobile = useIsMobile();
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
        // Dispatch event for TTS auto-play (ChatInput listens)
        window.dispatchEvent(new CustomEvent('claw:tts-autoplay', {
          detail: { text: data.full_text as string },
        }));
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
            <ChatPanel />
          </div>

          {/* Canvas (50/50 split when open) — never shown on mobile */}
          {!isMobile && canvasOpen && <CanvasPanel onClose={() => setCanvasOpen(false)} />}
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
