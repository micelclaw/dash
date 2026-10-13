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

import { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { X } from 'lucide-react';
import { useChatStore } from '@/stores/chat.store';
import { useIsMobile } from '@/hooks/use-media-query';
import { usePlayerStore } from '@/stores/player.store';
import { useMediaKeys } from '@/hooks/use-media-keys';
import { ChatInput } from './ChatInput';
import { ChatPanel } from './ChatPanel';
import { MiniPlayer } from '../player/MiniPlayer';
import { useAuthStore } from '@/stores/auth.store';

const CHAT_HEIGHT_STORAGE_KEY = 'micelclaw-docked-chat-height';
const MIN_CHAT_HEIGHT = 180;
const MIN_MODULE_HEIGHT = 240;

function storageKey(userId?: string) {
  const orientation = typeof window !== 'undefined' && window.innerWidth < window.innerHeight ? 'portrait' : 'landscape';
  return `${CHAT_HEIGHT_STORAGE_KEY}:${userId ?? 'anonymous'}:${orientation}`;
}

function initialChatHeight(userId?: string): number {
  if (typeof window === 'undefined') return 320;
  const stored = Number(window.localStorage.getItem(storageKey(userId)));
  return Number.isFinite(stored) && stored >= MIN_CHAT_HEIGHT
    ? stored
    : Math.round(window.innerHeight * 0.3);
}

export function BottomBar() {
  const isMobile = useIsMobile();
  const userId = useAuthStore((state) => state.user?.id);
  const miniPlayerVisible = usePlayerStore((s) => s.miniPlayerVisible);
  useMediaKeys();
  const chatState = useChatStore((s) => s.chatState);
  const setChatState = useChatStore((s) => s.setChatState);
  const bubbleMessage = useChatStore((s) => s.bubbleMessage);
  const setBubbleMessage = useChatStore((s) => s.setBubbleMessage);
  const navigate = useNavigate();
  const barRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const maxHeightRef = useRef<number>(Math.round((typeof window === 'undefined' ? 900 : window.innerHeight) * 0.7));
  const [chatHeight, setChatHeight] = useState(() => initialChatHeight(userId));

  const getHeightBounds = useCallback(() => {
    const bar = barRef.current;
    const parent = bar?.parentElement;
    const panel = panelRef.current;
    if (!bar || !parent || !panel) return { min: MIN_CHAT_HEIGHT, max: maxHeightRef.current };
    const fixedBarHeight = Math.max(0, bar.offsetHeight - panel.offsetHeight);
    const max = Math.max(MIN_CHAT_HEIGHT, parent.clientHeight - fixedBarHeight - MIN_MODULE_HEIGHT);
    maxHeightRef.current = max;
    return { min: Math.min(MIN_CHAT_HEIGHT, max), max };
  }, []);

  const clampHeight = useCallback((height: number) => {
    const { min, max } = getHeightBounds();
    return Math.min(max, Math.max(min, height));
  }, [getHeightBounds]);

  useEffect(() => {
    if (chatState !== 2) return;
    const clampToViewport = () => setChatHeight((height) => clampHeight(height));
    clampToViewport();
    window.addEventListener('resize', clampToViewport);
    return () => window.removeEventListener('resize', clampToViewport);
  }, [chatState, clampHeight]);

  useEffect(() => {
    if (!isMobile) window.localStorage.setItem(storageKey(userId), String(Math.round(chatHeight)));
  }, [chatHeight, isMobile, userId]);

  useEffect(() => {
    if (!isMobile) setChatHeight(clampHeight(initialChatHeight(userId)));
  }, [userId, isMobile, clampHeight]);

  const stopDragging = useCallback(() => {
    dragRef.current = null;
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');
  }, []);

  useEffect(() => stopDragging, [stopDragging]);

  const handleResizePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragRef.current = { startY: event.clientY, startHeight: panelRef.current?.offsetHeight ?? chatHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [chatHeight]);

  const handleResizePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setChatHeight(clampHeight(dragRef.current.startHeight + dragRef.current.startY - event.clientY));
  }, [clampHeight]);

  const handleResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (event.key === 'ArrowUp') next = chatHeight + 24;
    if (event.key === 'ArrowDown') next = chatHeight - 24;
    if (event.key === 'Home') next = getHeightBounds().min;
    if (event.key === 'End') next = getHeightBounds().max;
    if (next === null) return;
    event.preventDefault();
    setChatHeight(clampHeight(next));
  }, [chatHeight, clampHeight, getHeightBounds]);

  // `chat.stream.*` se maneja en una ÚNICA suscripción global (Shell,
  // useChatStreamSubscription). Antes vivía aquí Y en ChatPage (duplicado), y
  // ambos se desmontaban al navegar → el `done` se perdía. BottomBar ahora solo
  // renderiza del store.

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
    <div ref={barRef} style={{ position: 'relative', flexShrink: 0 }}>
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
          ref={panelRef}
          style={{
            height: isMobile ? '30vh' : chatHeight,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg)',
            animation: 'slideUp 300ms ease',
          }}
        >
          {!isMobile && <div
            role="separator"
            aria-label="Redimensionar chat"
            aria-orientation="horizontal"
            aria-valuemin={MIN_CHAT_HEIGHT}
            aria-valuemax={Math.round(typeof window === 'undefined' ? 900 : window.innerHeight)}
            aria-valuenow={Math.round(chatHeight)}
            tabIndex={0}
            title="Arrastra para cambiar la altura del chat"
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            onLostPointerCapture={stopDragging}
            onKeyDown={handleResizeKeyDown}
            onDoubleClick={() => setChatHeight(clampHeight(window.innerHeight * 0.3))}
            className="group relative h-2 shrink-0 cursor-row-resize touch-none border-t border-[var(--border)] outline-none focus-visible:bg-[var(--amber)]/20"
          >
            <span className="absolute left-1/2 top-1/2 h-0.5 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--border)] transition-colors group-hover:bg-[var(--amber)] group-focus-visible:bg-[var(--amber)]" />
          </div>}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <ChatPanel />
          </div>
        </div>
      )}

      {/* MiniPlayer (when audio is active) */}
      {miniPlayerVisible && <MiniPlayer />}

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
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
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
