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

import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { formatRangeLabel, navigateDate } from '@/lib/date-helpers';
import type { CalendarView } from './types';

interface CalendarToolbarProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onCreateEvent: () => void;
}

const VIEW_OPTIONS: { key: CalendarView; label: string }[] = [
  { key: 'day', label: 'D' },
  { key: 'week', label: 'W' },
  { key: 'month', label: 'M' },
  { key: 'agenda', label: 'A' },
];

export function CalendarToolbar({
  view,
  onViewChange,
  currentDate,
  onDateChange,
  onCreateEvent,
}: CalendarToolbarProps) {
  const goToday = () => onDateChange(new Date());
  const goPrev = () => onDateChange(navigateDate(view, currentDate, -1));
  const goNext = () => onDateChange(navigateDate(view, currentDate, 1));

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        fontFamily: 'var(--font-sans)',
        flexShrink: 0,
        minHeight: 44,
        flexWrap: 'wrap',
      }}
    >
      {/* Today button */}
      <button
        onClick={goToday}
        style={{
          ...buttonBase,
          padding: '4px 12px',
          fontSize: '0.75rem',
          fontWeight: 500,
        }}
      >
        Today
      </button>

      {/* Navigation arrows */}
      <button onClick={goPrev} style={{ ...iconButton }}>
        <ChevronLeft size={16} />
      </button>
      <button onClick={goNext} style={{ ...iconButton }}>
        <ChevronRight size={16} />
      </button>

      {/* Range label */}
      <span
        style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--text)',
          marginLeft: 4,
          whiteSpace: 'nowrap',
        }}
      >
        {formatRangeLabel(view, currentDate)}
      </span>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* View switcher */}
      <div
        style={{
          display: 'flex',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}
      >
        {VIEW_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onViewChange(key)}
            style={{
              ...buttonBase,
              padding: '4px 10px',
              fontSize: '0.75rem',
              fontWeight: 500,
              background: view === key ? 'var(--amber-dim)' : 'transparent',
              color: view === key ? 'var(--amber)' : 'var(--text-dim)',
              borderRight: key !== 'agenda' ? '1px solid var(--border)' : 'none',
              borderRadius: 0,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Create button */}
      <button
        onClick={onCreateEvent}
        style={{
          ...iconButton,
          background: 'var(--amber-dim)',
          color: 'var(--amber)',
        }}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

const buttonBase: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  transition: `all var(--transition-fast)`,
};

const iconButton: React.CSSProperties = {
  ...buttonBase,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  padding: 0,
};
