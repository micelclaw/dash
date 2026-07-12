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

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { SplitPane } from '@/components/shared/SplitPane';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-media-query';
import { useBackGuard } from '@/hooks/use-back-guard';
import { useSwipe } from '@/hooks/use-swipe';
import { useSettingsStore } from '@/stores/settings.store';
import { useCalendarUiStore } from '@/stores/calendar-ui.store';
import { api } from '@/services/api';
import { getDateRange, navigateDate } from '@/lib/date-helpers';
import { useEvents } from './hooks/use-events';
import { useEventLinks } from './hooks/use-event-links';
import { CalendarToolbar } from './CalendarToolbar';
import { CalendarMiniSidebar } from './CalendarMiniSidebar';
import type { CalendarInfo } from './CalendarMiniSidebar';
import { CalendarGrid } from './CalendarGrid';
import { EventModal } from './EventModal';
import { AddCalendarModal } from './AddCalendarModal';
import type { CalendarView, CalendarEvent } from './types';

export function Component() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();

  const calSettings = useSettingsStore(s => s.settings?.calendar);
  const defaultView = (calSettings?.default_view ?? 'week') as CalendarView;

  const [currentDate, setCurrentDate] = useState(new Date());
  // Borrado rápido de evento desde la rejilla: confirma (el EventModal ya
  // tiene su propio confirm two-click; esto cubre el menú/X de la rejilla).
  const [confirmDeleteEventId, setConfirmDeleteEventId] = useState<string | null>(null);
  // Última vista USADA (persistida per-browser). Cae al default del servidor
  // (o agenda en móvil la 1ª vez) mientras el usuario no elija ninguna. Así
  // salir del calendario y volver conserva la vista (#2).
  const persistedView = useCalendarUiStore((s) => s.view);
  const setView = useCalendarUiStore((s) => s.setView);
  const view = persistedView ?? (isMobile ? 'agenda' : defaultView);
  const [hiddenCalendars, setHiddenCalendars] = useState<Set<string>>(new Set());
  // Mobile calendars side panel (hamburger → Sheet), mirrors Mail (#5).
  const [mobileNav, setMobileNav] = useState(false);

  // Modal state
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createDate, setCreateDate] = useState<Date | null>(null);

  // Add calendar modal
  const [addCalendarOpen, setAddCalendarOpen] = useState(false);

  const navigate = useNavigate();

  // Fetch calendars from API
  const [calendars, setCalendars] = useState<Array<{ id: string; name: string; color: string; source: string; connector_id: string | null; visible: boolean }>>([]);
  const [connectors, setConnectors] = useState<Array<{ id: string; connector_type: string; display_name: string | null }>>([]);

  // Kanban boards as virtual calendars
  const [boardCalendars, setBoardCalendars] = useState<CalendarInfo[]>([]);
  const [kanbanEvents, setKanbanEvents] = useState<CalendarEvent[]>([]);

  const fetchCalendars = useCallback(async () => {
    try {
      const res = await api.get<{ data: typeof calendars }>('/calendars');
      setCalendars(res.data);
    } catch { /* ignore */ }
  }, []);

  const fetchConnectors = useCallback(async () => {
    try {
      const res = await api.get<{ data: typeof connectors }>('/sync/connectors');
      setConnectors(res.data);
    } catch { /* ignore */ }
  }, []);

  // Fetch boards for sidebar
  const fetchBoards = useCallback(async () => {
    try {
      const res = await api.get<{ data: Array<{ id: string; title: string; color: string | null }> }>('/projects/boards', { archived: false });
      setBoardCalendars(res.data.map(b => ({
        id: b.id,
        name: `kanban:${b.id}`,
        display_name: b.title,
        color: b.color || '#d4a017',
        source: 'kanban',
        visible: true,
      })));
    } catch { /* ignore */ }
  }, []);

  // Fetch kanban card events for the current view range
  const fetchKanbanFeed = useCallback(async () => {
    try {
      const range = getDateRange(view, currentDate);
      const res = await api.get<{ data: CalendarEvent[] }>('/projects/calendar-feed', {
        from: range.from,
        to: range.to,
      });
      setKanbanEvents(res.data);
    } catch { /* ignore */ }
  }, [view, currentDate]);

  useEffect(() => { fetchCalendars(); fetchConnectors(); fetchBoards(); }, [fetchCalendars, fetchConnectors, fetchBoards]);
  useEffect(() => { fetchKanbanFeed(); }, [fetchKanbanFeed]);

  // Merge API calendars with board calendars
  const mergedCalendars = useMemo<CalendarInfo[]>(() => [
    ...calendars,
    ...boardCalendars,
  ], [calendars, boardCalendars]);

  // Build a color map for all calendars (used by CalendarGrid)
  const calendarColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cal of mergedCalendars) {
      map[cal.name] = cal.color;
    }
    return map;
  }, [mergedCalendars]);

  // Fetch events for the current view
  const { events: regularEvents, loading, fetchEvents, createEvent, updateEvent, deleteEvent } = useEvents({
    view,
    currentDate,
  });

  // Merge regular events + kanban events
  const events = useMemo(
    () => [...regularEvents, ...kanbanEvents],
    [regularEvents, kanbanEvents],
  );

  // Linked records for the selected event
  const { linkedRecords, loading: linkedRecordsLoading } = useEventLinks(
    selectedEvent?.id ?? null,
  );

  // Guard: evita re-fetch del deep-link en cada cambio de `events`.
  const deepLinkFetchedId = useRef<string | null>(null);

  // Handle ?action=new and ?id=eventId from URL
  useEffect(() => {
    const action = searchParams.get('action');
    const targetId = searchParams.get('id');

    // Navigate to specific date if provided
    const targetDate = searchParams.get('date');
    if (targetDate) {
      const d = new Date(targetDate + 'T00:00:00');
      if (!isNaN(d.getTime())) setCurrentDate(d);
    }

    // Switch to day view if requested
    const targetView = searchParams.get('view') as CalendarView | null;
    if (targetView && ['day', 'week', 'month', 'agenda'].includes(targetView)) {
      setView(targetView);
    }

    if (action === 'new') {
      setSelectedEvent(null);
      setModalOpen(true);
      setSearchParams({}, { replace: true });
    } else if (targetId) {
      const target = events.find(e => e.id === targetId);
      if (target) {
        setSelectedEvent(target);
        setModalOpen(true);
        setSearchParams({}, { replace: true });
        deepLinkFetchedId.current = null;
      } else if (deepLinkFetchedId.current !== targetId) {
        // El evento no está en el rango cargado (p.ej. en otra fecha — el chip
        // del chat puede enlazar a cualquier evento). Lo traemos por id, saltamos
        // a su fecha y lo abrimos. Sin esto el deep-link solo abría eventos de la
        // vista actual; los demás dejaban la vista en la semana/mes actual.
        deepLinkFetchedId.current = targetId; // guard anti re-fetch al cambiar `events`
        api.get<{ data: CalendarEvent }>(`/events/${targetId}`)
          .then((res) => {
            const ev = res.data;
            if (!ev?.id) return;
            if (ev.start_at) {
              const d = new Date(ev.start_at);
              if (!isNaN(d.getTime())) setCurrentDate(d);
            }
            setSelectedEvent(ev);
            setModalOpen(true);
            setSearchParams({}, { replace: true });
          })
          .catch(() => { /* evento borrado/no accesible — no romper la vista */ });
      }
    }
  }, [searchParams, setSearchParams, events]);

  // (Mobile ya no fuerza 'agenda': la vista recordada manda; agenda es solo el
  // default de primera vez en móvil — resuelto en `view` arriba. Así el usuario
  // puede quedarse en día/semana/mes en el móvil con swipe + pickers.)

  // Swipe horizontal en la rejilla → avanza/retrocede intervalo (= flechas). Solo
  // móvil; touchstart/touchend puros → no pelean con el scroll ni con el
  // long-press-drag de TimeGrid (#4).
  const swipe = useSwipe({
    onSwipeLeft: () => setCurrentDate(navigateDate(view, currentDate, 1)),
    onSwipeRight: () => setCurrentDate(navigateDate(view, currentDate, -1)),
    disabled: !isMobile,
  });

  const handleEventClick = useCallback((event: CalendarEvent) => {
    // Kanban events: navigate to the board and open the card
    if (event.source === 'kanban' && event.source_id) {
      const boardId = event.calendar_name.replace('kanban:', '');
      navigate(`/projects/${boardId}?card=${event.source_id}`);
      return;
    }
    setSelectedEvent(event);
    setModalOpen(true);
  }, [navigate]);

  const handleSlotClick = useCallback((date: Date) => {
    setSelectedEvent(null);
    setCreateDate(date);
    setModalOpen(true);
  }, []);

  const handleCreateEvent = useCallback(() => {
    setSelectedEvent(null);
    setCreateDate(null);
    setModalOpen(true);
  }, []);

  const handleToggleCalendar = useCallback((name: string) => {
    setHiddenCalendars((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setSelectedEvent(null);
    setCreateDate(null);
  }, []);

  // Back jerárquico en móvil: el botón atrás cierra el overlay actual (de más
  // interno a más externo) en vez de salir del módulo.
  useBackGuard(modalOpen, () => handleCloseModal(), isMobile);
  useBackGuard(addCalendarOpen, () => setAddCalendarOpen(false), isMobile);
  useBackGuard(mobileNav, () => setMobileNav(false), isMobile);

  // Toolbar + Grid combined as the main content area
  const mainContent = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <CalendarToolbar
        view={view}
        onViewChange={setView}
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        onCreateEvent={handleCreateEvent}
        onOpenSidebar={isMobile ? () => setMobileNav(true) : undefined}
      />
      <div {...swipe} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {loading && events.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              color: 'var(--text-dim)',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.8125rem',
            }}
          >
            Loading events...
          </div>
        ) : (
          <CalendarGrid
            view={view}
            currentDate={currentDate}
            events={events}
            hiddenCalendars={hiddenCalendars}
            onEventClick={handleEventClick}
            onSlotClick={handleSlotClick}
            onEventUpdate={updateEvent}
            onEventDelete={(id) => setConfirmDeleteEventId(id)}
            calendarColorMap={calendarColorMap}
          />
        )}
      </div>
    </div>
  );

  const sidebar = (
    <CalendarMiniSidebar
      currentDate={currentDate}
      onDateChange={(d) => { setCurrentDate(d); setMobileNav(false); }}
      hiddenCalendars={hiddenCalendars}
      onToggleCalendar={handleToggleCalendar}
      events={events}
      onAddCalendar={() => setAddCalendarOpen(true)}
      onRefresh={fetchEvents}
      calendars={mergedCalendars}
      onCalendarsChange={fetchCalendars}
    />
  );

  return (
    <>
      {isMobile ? (
        // Mobile: main grid + calendars in a left Sheet drawer (hamburger), same
        // pattern as Mail. Desktop keeps the pinned SplitPane sidebar untouched.
        <>
          {mainContent}
          <Sheet open={mobileNav} onOpenChange={setMobileNav}>
            <SheetContent
              side="left"
              style={{ width: 280, padding: 0, paddingTop: 'env(safe-area-inset-top, 0px)', overflow: 'auto' }}
              aria-describedby={undefined}
            >
              {sidebar}
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <SplitPane
          defaultSizes={[20, 80]}
          minSizes={[200, 500]}
          id="calendar-split"
        >
          {sidebar}
          {mainContent}
        </SplitPane>
      )}

      {/* Event detail/edit modal */}
      <EventModal
        event={selectedEvent}
        open={modalOpen}
        onClose={handleCloseModal}
        onUpdate={updateEvent}
        onDelete={deleteEvent}
        onCreate={createEvent}
        defaultDate={createDate}
        linkedRecords={linkedRecords}
        linkedRecordsLoading={linkedRecordsLoading}
      />

      {/* Add calendar modal */}
      <AddCalendarModal
        open={addCalendarOpen}
        onClose={() => setAddCalendarOpen(false)}
        onCreated={fetchCalendars}
        connectors={connectors}
      />

      <ConfirmDialog
        open={confirmDeleteEventId !== null}
        onClose={() => setConfirmDeleteEventId(null)}
        onConfirm={() => { if (confirmDeleteEventId) void deleteEvent(confirmDeleteEventId); setConfirmDeleteEventId(null); }}
        title="Delete event"
        description={(() => {
          const ev = regularEvents.find(e => e.id === confirmDeleteEventId);
          return ev ? `Delete "${ev.title}"?` : 'Delete this event?';
        })()}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
      />
    </>
  );
}
