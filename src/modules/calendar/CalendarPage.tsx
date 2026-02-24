import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { SplitPane } from '@/components/shared/SplitPane';
import { useIsMobile } from '@/hooks/use-media-query';
import { useEvents } from './hooks/use-events';
import { useEventLinks } from './hooks/use-event-links';
import { CalendarToolbar } from './CalendarToolbar';
import { CalendarMiniSidebar } from './CalendarMiniSidebar';
import { CalendarGrid } from './CalendarGrid';
import { EventModal } from './EventModal';
import { EventQuickCreate } from './EventQuickCreate';
import { AddCalendarModal } from './AddCalendarModal';
import type { CalendarView, CalendarEvent } from './types';

export function Component() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>(isMobile ? 'agenda' : 'week');
  const [hiddenCalendars, setHiddenCalendars] = useState<Set<string>>(new Set());

  // Modal state
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Quick create state
  const [quickCreateDate, setQuickCreateDate] = useState<Date | null>(null);

  // Add calendar modal
  const [addCalendarOpen, setAddCalendarOpen] = useState(false);

  // Fetch events for the current view
  const { events, loading, fetchEvents, createEvent, updateEvent, deleteEvent } = useEvents({
    view,
    currentDate,
  });

  // Linked records for the selected event
  const { linkedRecords, loading: linkedRecordsLoading } = useEventLinks(
    selectedEvent?.id ?? null,
  );

  // Handle ?action=new from URL
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setQuickCreateDate(new Date());
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Switch to agenda on mobile
  useEffect(() => {
    if (isMobile && view !== 'agenda') {
      setView('agenda');
    }
  }, [isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setModalOpen(true);
  }, []);

  const handleSlotClick = useCallback((date: Date) => {
    setQuickCreateDate(date);
  }, []);

  const handleCreateEvent = useCallback(() => {
    // Default to now, snapped to the next half hour
    const now = new Date();
    const minutes = now.getMinutes();
    now.setMinutes(minutes < 30 ? 30 : 0);
    if (minutes >= 30) now.setHours(now.getHours() + 1);
    now.setSeconds(0, 0);
    setQuickCreateDate(now);
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
  }, []);

  const handleCloseQuickCreate = useCallback(() => {
    setQuickCreateDate(null);
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
        linkedRecords={linkedRecords}
        linkedRecordsLoading={linkedRecordsLoading}
      />

      {/* Quick create popover */}
      {quickCreateDate && (
        <EventQuickCreate
          date={quickCreateDate}
          onClose={handleCloseQuickCreate}
          onCreate={createEvent}
        />
      )}

      {/* Add calendar modal */}
      <AddCalendarModal
        open={addCalendarOpen}
        onClose={() => setAddCalendarOpen(false)}
      />
    </>
  );
}
