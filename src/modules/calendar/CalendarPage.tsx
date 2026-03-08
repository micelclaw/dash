import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { SplitPane } from '@/components/shared/SplitPane';
import { useIsMobile } from '@/hooks/use-media-query';
import { useSettingsStore } from '@/stores/settings.store';
import { api } from '@/services/api';
import { getDateRange } from '@/lib/date-helpers';
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
  const [view, setView] = useState<CalendarView>(isMobile ? 'agenda' : defaultView);
  const [hiddenCalendars, setHiddenCalendars] = useState<Set<string>>(new Set());

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
        displayName: b.title,
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

  // Handle ?action=new and ?id=eventId from URL
  useEffect(() => {
    const action = searchParams.get('action');
    const targetId = searchParams.get('id');

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
      }
    }
  }, [searchParams, setSearchParams, events]);

  // Switch to agenda on mobile
  useEffect(() => {
    if (isMobile && view !== 'agenda') {
      setView('agenda');
    }
  }, [isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

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
      />
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
          onEventDelete={deleteEvent}
          calendarColorMap={calendarColorMap}
        />
      )}
    </div>
  );

  const sidebar = (
    <CalendarMiniSidebar
      currentDate={currentDate}
      onDateChange={setCurrentDate}
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
        // Mobile: no sidebar, just the main grid (defaults to agenda view)
        mainContent
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
    </>
  );
}
