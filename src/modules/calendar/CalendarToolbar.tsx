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

import { ChevronLeft, ChevronRight, Plus, Menu } from 'lucide-react';
import { startOfWeek, endOfWeek, navigateDate } from '@/lib/date-helpers';
import { CalendarPeriodPicker } from './CalendarPeriodPicker';
import type { CalendarView } from './types';
import { useI18n } from '@/i18n';
import { formatDate } from '@/i18n/format';
import { useSettingsStore } from '@/stores/settings.store';

interface CalendarToolbarProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onCreateEvent: () => void;
  /** Mobile only: open the calendars side panel (hamburger). Absent on desktop. */
  onOpenSidebar?: () => void;
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
  onOpenSidebar,
}: CalendarToolbarProps) {
  const { t, locale } = useI18n();
  const general = useSettingsStore((s) => s.serverSettings?.general);
  const goToday = () => onDateChange(new Date());
  const goPrev = () => onDateChange(navigateDate(view, currentDate, -1));
  const goNext = () => onDateChange(navigateDate(view, currentDate, 1));
  const rangeLabel = view === 'agenda'
    ? t('calendar.upcoming')
    : view === 'month'
      ? currentDate.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-GB', { month: 'long', year: 'numeric' })
      : view === 'day'
        ? formatDate(currentDate, locale, general)
        : (() => {
            const start = startOfWeek(currentDate);
            const end = endOfWeek(currentDate);
            return `${formatDate(start, locale, general)} – ${formatDate(end, locale, general)}`;
          })();
  // Agenda has no meaningful period to jump to → plain title; the rest get a
  // tap-to-pick popover (month grid / ISO-week list / mini-month day picker).
  const titlePickable = view !== 'agenda';

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
      {/* Hamburger (mobile only) — opens the calendars side panel */}
      {onOpenSidebar && (
        <button onClick={onOpenSidebar} style={iconButton} title={t('calendar.calendars')} aria-label={t('calendar.calendars')}>
          <Menu size={16} />
        </button>
      )}

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
        {t('calendar.today')}
      </button>

      {/* Navigation arrows */}
      <button onClick={goPrev} style={{ ...iconButton }} aria-label={t('calendar.previousPeriod')} title={t('calendar.previousPeriod')}>
        <ChevronLeft size={16} />
      </button>
      <button onClick={goNext} style={{ ...iconButton }} aria-label={t('calendar.nextPeriod')} title={t('calendar.nextPeriod')}>
        <ChevronRight size={16} />
      </button>

      {/* Range label — tappable period picker (month/week/day), plain for agenda */}
      {titlePickable ? (
        <CalendarPeriodPicker view={view} currentDate={currentDate} onDateChange={onDateChange}>
          <button style={titleButton} aria-label={t('calendar.jumpPeriod')}>
            {rangeLabel}
          </button>
        </CalendarPeriodPicker>
      ) : (
        <span
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--text)',
            marginLeft: 4,
            whiteSpace: 'nowrap',
          }}
        >
          {rangeLabel}
        </span>
      )}

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
            aria-label={t(`calendar.view.${key}`)}
            title={t(`calendar.view.${key}`)}
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
        title={t('calendar.newEvent')}
        aria-label={t('calendar.newEvent')}
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

const titleButton: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: 'var(--text)',
  marginLeft: 4,
  padding: '2px 6px',
  borderRadius: 'var(--radius-sm)',
  whiteSpace: 'nowrap',
  fontFamily: 'var(--font-sans)',
};
