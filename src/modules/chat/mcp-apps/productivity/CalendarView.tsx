import { useState } from 'react';
import type { CalendarEvent } from '@/modules/calendar/types';
import { getCalendarColor } from '@/modules/calendar/types';
import { toLocalDatetime } from '@/modules/calendar/components/event-form';
import { getMonthGridDays, isSameMonth } from '@/lib/date-helpers';
import type { ProductivityContext, ProductivityTransport } from './types';
import { pageOf } from './types';
import { useProductivityQuery } from './use-productivity-query';
import { Fields, More, Origin, QueryState, SaveForm, SelectedDetail } from './shared';
import { calendarSelectionRange, pageOffset, pageSize } from './selection-adapters';

const dateText = (value: string | null) => value ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Sin fecha';
const periodText = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
 ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`))
 : dateText(value);
function EventEdit({ event, transport, done, cancel }: { event: CalendarEvent; transport: ProductivityTransport; done(): void; cancel(): void }) {
 const [title, setTitle] = useState(event.title); const [description, setDescription] = useState(event.description || ''); const [location, setLocation] = useState(event.location || '');
 const [startAt, setStartAt] = useState(toLocalDatetime(event.start_at)); const [endAt, setEndAt] = useState(event.end_at ? toLocalDatetime(event.end_at) : ''); const [allDay, setAllDay] = useState(!!event.all_day);
 return <SaveForm onCancel={cancel} onSave={async () => {
  if (!Number.isFinite(new Date(startAt).getTime()) || endAt && new Date(endAt) < new Date(startAt)) throw new Error('Comprueba las fechas de inicio y fin.');
  await transport.call('calendar', 'update', { id: event.id, title, description, location,
   ...(startAt !== toLocalDatetime(event.start_at) ? { start_at: new Date(startAt).toISOString() } : {}),
   ...(endAt && endAt !== (event.end_at ? toLocalDatetime(event.end_at) : '') ? { end_at: new Date(endAt).toISOString() } : {}),
   ...(allDay !== !!event.all_day ? { all_day: allDay } : {}),
  }); done();
 }}>
  <label>Título<input required value={title} onChange={e => setTitle(e.target.value)} /></label><label>Ubicación<input value={location} onChange={e => setLocation(e.target.value)} /></label><label>Descripción<textarea value={description} onChange={e => setDescription(e.target.value)} /></label>
  <label>Inicio<input type="datetime-local" required value={startAt} onChange={e => setStartAt(e.target.value)} /></label><label>Fin<input type="datetime-local" value={endAt} min={startAt} onChange={e => setEndAt(e.target.value)} /></label><label><input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />Todo el día</label>
 </SaveForm>;
}
export default function CalendarView({ context, transport }: { context: ProductivityContext; transport: ProductivityTransport }) {
 const [initialRange] = useState(() => calendarSelectionRange(context)); const [from, setFrom] = useState(initialRange.from); const [to, setTo] = useState(initialRange.to);
 const [fromEdited, setFromEdited] = useState(false); const [toEdited, setToEdited] = useState(false);
 const [offset, setOffset] = useState(() => pageOffset(context)); const [mode, setMode] = useState<'agenda' | 'month'>('agenda');
 const [id, setId] = useState(context.selection.action === 'get' ? String(context.selection.params.id) : ''); const [editing, setEditing] = useState(false);
 const limit = pageSize(context, 50); const filters = context.selection.action === 'list' ? context.selection.params : {}; const { date: _date, ...remaining } = filters;
 const boundary = (value: string, end: boolean) => { const date = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00'}`); return Number.isFinite(date.getTime()) ? date.toISOString() : ''; };
 const queryFrom = !fromEdited && typeof remaining.from === 'string' ? remaining.from : boundary(from, false);
 const queryTo = !toEdited && typeof remaining.to === 'string' ? remaining.to : boundary(to, true);
 const list = useProductivityQuery(`calendar:${queryFrom}:${queryTo}:${offset}`, async signal => {
  if (!queryFrom || !queryTo || new Date(queryFrom) > new Date(queryTo)) throw new RangeError('Invalid period');
  return pageOf(await transport.call<CalendarEvent[]>('calendar', 'list', { ...remaining, from: queryFrom, to: queryTo, limit, offset, sort: remaining.sort ?? 'start_at', order: remaining.order ?? 'asc' }, signal), limit);
 });
 const detail = useProductivityQuery(`event:${id}`, async signal => id ? (await transport.call<CalendarEvent>('calendar', 'get', { id }, signal)).data : null);
 const events = list.data?.items || []; const event = detail.data; const month = new Date(`${from}T12:00:00`);
 return <><div className="productivity-toolbar"><label>Desde<input type="date" value={from} onChange={e => { setFrom(e.target.value); setFromEdited(true); setOffset(0); }} /></label><label>Hasta<input type="date" value={to} min={from} onChange={e => { setTo(e.target.value); setToEdited(true); setOffset(0); }} /></label>
  <button aria-pressed={mode === 'agenda'} onClick={() => setMode('agenda')}>Agenda</button><button aria-pressed={mode === 'month'} onClick={() => setMode('month')}>Calendario</button></div>
  <p>Período: {periodText(queryFrom)} — {periodText(queryTo)}</p>
  {id && <SelectedDetail id={id} label="Detalle del evento"><QueryState {...detail} retry={detail.refresh}>{event && <><h2>{event.title}</h2><Origin entity={event} />
   {editing ? <EventEdit key={event.id} event={event} transport={transport} cancel={() => setEditing(false)} done={() => { setEditing(false); list.refresh(); detail.refresh(); }} /> : <><Fields values={[["Inicio", dateText(event.start_at)], ["Fin", dateText(event.end_at)], ["Ubicación", event.location], ["Descripción", event.description], ["Asistentes", event.attendees?.map(a => a.name || a.email).join(', ')], ["Estado", event.status]]} />{event._shared_permission !== 'view' && <button onClick={() => setEditing(true)}>Editar evento</button>}</>}
  </>}</QueryState></SelectedDetail>}
  <QueryState {...list} empty={!events.length} retry={list.refresh}>
   {mode === 'month' && Number.isFinite(month.getTime()) ? <section aria-label="Calendario del período"><h2>{month.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</h2><div className="productivity-month">
    {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, i) => <strong key={i}>{day}</strong>)}
    {getMonthGridDays(month).map(day => <div key={day.toISOString()} style={{ opacity: isSameMonth(day, month) ? 1 : .5 }}><span>{day.getDate()}</span>
     {events.filter(item => new Date(item.start_at).toDateString() === day.toDateString()).map(item => <button key={item.id} disabled={editing} onClick={() => setId(item.id)} style={{ borderLeft: `3px solid ${getCalendarColor(item.calendar_name)}` }}>{item.title}</button>)}
    </div>)}
   </div></section> : <section aria-label="Agenda">{events.map(item => <button className="productivity-list-row" key={item.id} disabled={editing} onClick={() => setId(item.id)}><strong>{item.title}</strong><time>{dateText(item.start_at)}{item.all_day ? ' · Todo el día' : ''}</time><span>{item.location}</span><Origin entity={item} /></button>)}</section>}
   <More offset={offset} limit={limit} hasMore={list.data?.hasMore ?? false} onChange={setOffset} />{list.data?.hasMore && <p>Hay más eventos. El calendario muestra la página consultada.</p>}
  </QueryState>

 </>;
}
