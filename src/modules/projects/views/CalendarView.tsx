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

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useProjectsStore } from '@/stores/projects.store';
import { PriorityDot } from '../components/PriorityDot';
import { useCardContextMenu } from '../hooks/use-card-context-menu';
import type { Card } from '../types';

type CalendarMode = 'month' | 'week';

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekNumber(d: Date): number {
  const oneJan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
}

function getWeekStart(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function CalendarView() {
  const cardsMap = useProjectsStore((s) => s.cards);
  const selectCard = useProjectsStore((s) => s.selectCard);
  const createCard = useProjectsStore((s) => s.createCard);
  const activeBoardId = useProjectsStore((s) => s.activeBoardId);
  const boardColumnIds = useProjectsStore((s) => s.boardColumnIds);
  const { onCardContextMenu, contextMenuPortal } = useCardContextMenu();

  const [viewDate, setViewDate] = useState(() => new Date());
  const [mode, setMode] = useState<CalendarMode>('month');
  const [newCardDate, setNewCardDate] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const showArchived = useProjectsStore((s) => s.filters.show_archived);
  const allCards = useMemo(() => Object.values(cardsMap).filter(c => showArchived || !c.archived), [cardsMap, showArchived]);

  // Index cards by due_date
  const cardsByDate = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const card of allCards) {
      if (!card.due_date) continue;
      const key = card.due_date.split('T')[0]!;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(card);
    }
    return map;
  }, [allCards]);

  // Generate grid days
  const gridDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    if (mode === 'week') {
      const dayOfWeek = viewDate.getDay();
      const weekStart = new Date(year, month, viewDate.getDate() - dayOfWeek);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      });
    }

    // Month mode
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);
    const startDay = firstOfMonth.getDay();

    const days: Date[] = [];
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push(d);
    }
    for (let i = 1; i <= lastOfMonth.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    while (days.length % 7 !== 0) {
      const last = days[days.length - 1]!;
      const d = new Date(last);
      d.setDate(d.getDate() + 1);
      days.push(d);
    }
    return days;
  }, [viewDate, mode]);

  const headerLabel = mode === 'month'
    ? viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })
    : `Week of ${viewDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const prev = () => {
    if (mode === 'month') setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    else setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate() - 7));
  };

  const next = () => {
    if (mode === 'month') setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    else setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate() + 7));
  };

  const goToday = () => setViewDate(new Date());

  // ─── Scroll navigation ─────────────────────────────
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    let cooldown = false;
    const handleWheel = (e: WheelEvent) => {
      if (cooldown) return;

      // Only trigger on significant scroll (not tiny trackpad ticks)
      const delta = mode === 'week' ? e.deltaX || e.deltaY : e.deltaY;
      if (Math.abs(delta) < 30) return;

      e.preventDefault();
      cooldown = true;
      setTimeout(() => { cooldown = false; }, 300);

      if (delta > 0) next();
      else prev();
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }); // intentionally no deps — uses latest prev/next

  // ─── Picker dropdown ───────────────────────────────
  useEffect(() => {
    if (!pickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [pickerOpen]);

  // Generate weeks of the year for week picker
  const yearWeeks = useMemo(() => {
    const year = viewDate.getFullYear();
    const weeks: { weekNum: number; start: Date }[] = [];
    const d = new Date(year, 0, 1);
    // Go to first Sunday
    d.setDate(d.getDate() - d.getDay());
    while (d.getFullYear() <= year) {
      weeks.push({ weekNum: getWeekNumber(d), start: new Date(d) });
      d.setDate(d.getDate() + 7);
      if (d.getFullYear() > year && d.getMonth() > 0) break;
    }
    return weeks;
  }, [viewDate.getFullYear()]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentWeekStart = getWeekStart(viewDate);

  const handleDayClick = useCallback((date: Date) => {
    const key = dateKey(date);
    if (newCardDate === key) {
      setNewCardDate(null);
      return;
    }
    setNewCardDate(key);
    setNewCardTitle('');
  }, [newCardDate]);

  const handleCreateCard = useCallback(async () => {
    if (!newCardTitle.trim() || !newCardDate || !activeBoardId) return;
    const colIds = boardColumnIds[activeBoardId] ?? [];
    const firstCol = colIds[0];
    if (!firstCol) return;
    await createCard(activeBoardId, {
      column_id: firstCol,
      title: newCardTitle.trim(),
    });
    setNewCardDate(null);
    setNewCardTitle('');
  }, [newCardTitle, newCardDate, activeBoardId, boardColumnIds, createCard]);

  const MAX_VISIBLE = mode === 'month' ? 3 : 8;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        <button onClick={prev} style={navBtnStyle}><ChevronLeft size={14} /></button>

        {/* Header label with picker */}
        <div style={{ position: 'relative' }} ref={pickerRef}>
          <button
            onClick={() => setPickerOpen(v => !v)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text)',
              fontSize: 14,
              fontWeight: 600,
              minWidth: 200,
              textAlign: 'center',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            {headerLabel}
            <ChevronDown size={12} style={{ color: 'var(--text-muted)', transform: pickerOpen ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} />
          </button>

          {/* Month picker */}
          {pickerOpen && mode === 'month' && (
            <div style={pickerPanelStyle}>
              {/* Year nav */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1))} style={pickerNavBtn}><ChevronLeft size={12} /></button>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{viewDate.getFullYear()}</span>
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1))} style={pickerNavBtn}><ChevronRight size={12} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, padding: 4 }}>
                {MONTH_NAMES.map((name, i) => {
                  const isCurrent = viewDate.getMonth() === i;
                  const isNow = today.getMonth() === i && today.getFullYear() === viewDate.getFullYear();
                  return (
                    <button
                      key={i}
                      onClick={() => { setViewDate(new Date(viewDate.getFullYear(), i, 1)); setPickerOpen(false); }}
                      style={{
                        padding: '6px 4px',
                        border: 'none',
                        borderRadius: 4,
                        background: isCurrent ? 'var(--amber-dim)' : 'transparent',
                        color: isCurrent ? 'var(--amber)' : isNow ? 'var(--amber)' : 'var(--text)',
                        fontWeight: isCurrent || isNow ? 600 : 400,
                        fontSize: 12,
                        fontFamily: 'var(--font-sans)',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                      onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {name.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Week picker */}
          {pickerOpen && mode === 'week' && (
            <div style={{ ...pickerPanelStyle, maxHeight: 300, overflowY: 'auto' }}>
              {yearWeeks.map(({ weekNum, start }) => {
                const end = new Date(start);
                end.setDate(end.getDate() + 6);
                const isCurrent = isSameDay(start, currentWeekStart);
                const isNow = isSameDay(getWeekStart(today), start);
                const label = `W${weekNum}: ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                return (
                  <button
                    key={weekNum}
                    onClick={() => { setViewDate(new Date(start)); setPickerOpen(false); }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '5px 10px',
                      border: 'none',
                      borderRadius: 4,
                      background: isCurrent ? 'var(--amber-dim)' : 'transparent',
                      color: isCurrent ? 'var(--amber)' : isNow ? 'var(--amber)' : 'var(--text)',
                      fontWeight: isCurrent || isNow ? 600 : 400,
                      fontSize: 12,
                      fontFamily: 'var(--font-sans)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                    onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button onClick={next} style={navBtnStyle}><ChevronRight size={14} /></button>
        <button onClick={goToday} style={{ ...navBtnStyle, fontSize: 11, padding: '4px 8px' }}>Today</button>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 2 }}>
          {(['month', 'week'] as CalendarMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                ...navBtnStyle,
                fontSize: 11,
                padding: '4px 8px',
                background: mode === m ? 'var(--amber-dim)' : 'none',
                color: mode === m ? 'var(--amber)' : 'var(--text-dim)',
                borderColor: mode === m ? 'var(--amber)' : 'var(--border)',
                textTransform: 'capitalize',
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Weekday headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        {WEEKDAYS.map((day) => (
          <div key={day} style={{
            padding: '6px 8px',
            fontSize: 11,
            color: 'var(--text-dim)',
            fontWeight: 600,
            textAlign: 'center',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-sans)',
          }}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div ref={gridRef} style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        flex: 1,
        overflow: 'auto',
      }}>
        {gridDays.map((date, i) => {
          const key = dateKey(date);
          const dayCards = cardsByDate.get(key) ?? [];
          const isCurrentMonth = date.getMonth() === viewDate.getMonth();
          const isToday = isSameDay(date, today);
          const isNewCardDay = newCardDate === key;

          return (
            <div
              key={i}
              onClick={() => handleDayClick(date)}
              style={{
                borderRight: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                padding: 4,
                minHeight: mode === 'month' ? 90 : 200,
                background: isToday ? 'rgba(212,160,23,0.05)' : undefined,
                opacity: isCurrentMonth || mode === 'week' ? 1 : 0.4,
                cursor: 'pointer',
              }}
            >
              {/* Day number */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 4,
              }}>
                <span style={{
                  fontSize: 12,
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? 'var(--amber)' : 'var(--text-dim)',
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isToday ? 'var(--amber)' : 'transparent',
                  ...(isToday ? { color: '#000' } : {}),
                }}>
                  {date.getDate()}
                </span>
              </div>

              {/* Cards */}
              {dayCards.slice(0, MAX_VISIBLE).map((card) => (
                <div
                  key={card.id}
                  onClick={(e) => { e.stopPropagation(); selectCard(card.id); }}
                  onContextMenu={(e) => onCardContextMenu(e, card)}
                  style={{
                    padding: '2px 6px',
                    marginBottom: 2,
                    borderRadius: 3,
                    fontSize: 11,
                    color: card.completed_at ? 'var(--text-muted)' : 'var(--text)',
                    textDecoration: card.completed_at ? 'line-through' : undefined,
                    opacity: card.completed_at ? 0.6 : 1,
                    background: card.color ? card.color + '22' : 'var(--card)',
                    borderLeft: `2px solid ${card.color || 'var(--border)'}`,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <PriorityDot priority={card.priority ?? 'none'} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.title}</span>
                </div>
              ))}
              {dayCards.length > MAX_VISIBLE && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', paddingLeft: 4 }}>
                  +{dayCards.length - MAX_VISIBLE} more
                </span>
              )}

              {/* New card input */}
              {isNewCardDay && (
                <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 4 }}>
                  <input
                    autoFocus
                    placeholder="New card..."
                    value={newCardTitle}
                    onChange={(e) => setNewCardTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateCard();
                      if (e.key === 'Escape') setNewCardDate(null);
                    }}
                    onBlur={() => { if (!newCardTitle.trim()) setNewCardDate(null); }}
                    style={{
                      width: '100%',
                      padding: '2px 4px',
                      fontSize: 11,
                      background: 'var(--card)',
                      border: '1px solid var(--amber)',
                      borderRadius: 3,
                      color: 'var(--text)',
                      fontFamily: 'var(--font-sans)',
                      outline: 'none',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {contextMenuPortal}
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: 4,
  cursor: 'pointer',
  color: 'var(--text-dim)',
  padding: 4,
  display: 'flex',
  fontFamily: 'var(--font-sans)',
};

const pickerNavBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-dim)',
  padding: 4,
  display: 'flex',
};

const pickerPanelStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  marginTop: 4,
  background: 'rgba(17, 17, 24, 0.95)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  boxShadow: '0 8px 24px rgba(0,0,0,.4)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  padding: 4,
  zIndex: 20,
  minWidth: 200,
};
