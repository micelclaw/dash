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
  const [createDate, setCreateDate] = useState<Date | null>(null);

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
    setSelectedEvent(event);
    setModalOpen(true);
  }, []);

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
        onCreate={createEvent}
        defaultDate={createDate}
        linkedRecords={linkedRecords}
        linkedRecordsLoading={linkedRecordsLoading}
      />

      {/* Add calendar modal */}
      <AddCalendarModal
        open={addCalendarOpen}
        onClose={() => setAddCalendarOpen(false)}
      />
    </>
  );
}
