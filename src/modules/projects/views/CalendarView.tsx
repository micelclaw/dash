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

import { useMemo, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useProjectsStore } from '@/stores/projects.store';
import { PriorityDot } from '../components/PriorityDot';
import type { Card } from '../types';

type CalendarMode = 'month' | 'week';

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarView() {
  const cardsMap = useProjectsStore((s) => s.cards);
  const selectCard = useProjectsStore((s) => s.selectCard);
  const updateCard = useProjectsStore((s) => s.updateCard);
  const createCard = useProjectsStore((s) => s.createCard);
  const activeBoardId = useProjectsStore((s) => s.activeBoardId);
  const boardColumnIds = useProjectsStore((s) => s.boardColumnIds);

  const [viewDate, setViewDate] = useState(() => new Date());
  const [mode, setMode] = useState<CalendarMode>('month');
  const [newCardDate, setNewCardDate] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const allCards = useMemo(() => Object.values(cardsMap).filter(c => !c.archived), [cardsMap]);

  // Index cards by due_date
  const cardsByDate = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const card of allCards) {
      if (!card.due_date) continue;
      const key = card.due_date.split('T')[0];
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
    const startDay = firstOfMonth.getDay(); // 0-6

    const days: Date[] = [];
    // Pad with previous month
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push(d);
    }
    // Current month
    for (let i = 1; i <= lastOfMonth.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    // Pad to fill last row
    while (days.length % 7 !== 0) {
      const last = days[days.length - 1];
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
    // Update due_date separately
    // Actually we can extend createCard or do updateCard after
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
        <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, minWidth: 200, textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
          {headerLabel}
        </span>
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
      <div style={{
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
          const overdue = dayCards.filter(c => !c.completed_at);
          const hasOverdue = overdue.length > 0 && date < today;

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
