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

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useProjectsStore } from '@/stores/projects.store';
import { useWebSocket } from '@/hooks/use-websocket';
import { useIsMobile } from '@/hooks/use-media-query';
import { BoardHeader } from './components/BoardHeader';
import { KanbanBoard } from './views/KanbanBoard';
import { ListView } from './views/ListView';
import { TimelineView } from './views/TimelineView';
import { CalendarView } from './views/CalendarView';
import { DashboardView } from './views/DashboardView';
import { CardDetailPanel } from './components/CardDetailPanel';
import { BoardSettings } from './components/BoardSettings';
import { CustomFieldManager } from './components/CustomFieldManager';
import { ShortcutsOverlay } from './components/ShortcutsOverlay';
import { useKanbanKeyboard } from './hooks/use-kanban-keyboard';

export function Component() {
  const { boardId } = useParams<{ boardId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const fetchFullBoard = useProjectsStore((s) => s.fetchFullBoard);
  const selectCard = useProjectsStore((s) => s.selectCard);
  const activeView = useProjectsStore((s) => s.activeView);
  const boardLoading = useProjectsStore((s) => s.boardLoading);
  const selectedCardId = useProjectsStore((s) => s.selectedCardId);
  const cardDetailOpen = useProjectsStore((s) => s.cardDetailOpen);
  const handleWsEvent = useProjectsStore((s) => s.handleWsEvent);
  const isMobile = useIsMobile();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const toggleShortcuts = useCallback(() => setShortcutsOpen(s => !s), []);
  useKanbanKeyboard(toggleShortcuts);

  useEffect(() => {
    if (boardId) fetchFullBoard(boardId);
  }, [boardId, fetchFullBoard]);

  // Handle ?card= query param (e.g. from calendar navigation)
  useEffect(() => {
    const cardId = searchParams.get('card');
    if (cardId && !boardLoading) {
      selectCard(cardId);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, selectCard, boardLoading]);

  // Listen for kanban WebSocket events
  const wsEvent = useWebSocket('kanban.*');
  useEffect(() => {
    if (wsEvent) handleWsEvent(wsEvent.event, wsEvent.data);
  }, [wsEvent, handleWsEvent]);

  if (boardLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="animate-pulse" style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ background: 'var(--surface-hover)', height: 20, width: 200, borderRadius: 4 }} />
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 12, padding: 16, overflow: 'hidden' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                width: 280,
                height: 300,
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <BoardHeader
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenShare={() => {}}
        onOpenFields={() => setFieldsOpen(true)}
      />

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {activeView === 'board' && <KanbanBoard />}
          {activeView === 'list' && <ListView />}
          {activeView === 'timeline' && <TimelineView />}
          {activeView === 'calendar' && <CalendarView />}
          {activeView === 'dashboard' && <DashboardView />}
        </div>

        {cardDetailOpen && selectedCardId && boardId && (
          <CardDetailPanel
            boardId={boardId}
            cardId={selectedCardId}
            isMobile={isMobile}
          />
        )}
      </div>

      {settingsOpen && boardId && (
        <BoardSettings boardId={boardId} onClose={() => setSettingsOpen(false)} />
      )}
      {boardId && (
        <CustomFieldManager boardId={boardId} open={fieldsOpen} onClose={() => setFieldsOpen(false)} />
      )}
      {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}
    </div>
  );
}
