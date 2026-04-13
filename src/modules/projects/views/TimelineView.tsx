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

import { useMemo, useState, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ZoomIn, ZoomOut, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useProjectsStore } from '@/stores/projects.store';
import { PriorityDot } from '../components/PriorityDot';
import { PRIORITY_COLORS } from '../utils/design-tokens';
import { useCardContextMenu } from '../hooks/use-card-context-menu';
import type { Card } from '../types';

// ─── Sort / Group types ─────────────────────────────

type SortField = 'due_date' | 'start_date' | 'priority' | 'column' | 'title' | 'card_number';
type GroupBy = 'none' | 'column' | 'priority' | 'label';
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'due_date', label: 'Due date' },
  { field: 'start_date', label: 'Start date' },
  { field: 'priority', label: 'Priority' },
  { field: 'column', label: 'Status' },
  { field: 'title', label: 'Title' },
  { field: 'card_number', label: '#' },
];

interface CardGroup {
  key: string;
  label: string;
  color?: string;
  cards: Card[];
}

// ─── Zoom config ──────────────────────────────────────

type ZoomLevel = 'day' | 'week' | 'month' | 'quarter';

const ZOOM_CONFIG: Record<ZoomLevel, { cellWidth: number; label: string }> = {
  day: { cellWidth: 40, label: 'Day' },
  week: { cellWidth: 120, label: 'Week' },
  month: { cellWidth: 200, label: 'Month' },
  quarter: { cellWidth: 80, label: 'Quarter' },
};

const ZOOM_ORDER: ZoomLevel[] = ['day', 'week', 'month', 'quarter'];
const LEFT_PANEL_WIDTH = 250;
const ROW_HEIGHT = 24;
const BAR_HEIGHT = 14;
const SUPER_HEADER_HEIGHT = 20;
const WEEKEND_BG = 'rgba(34,197,94,0.07)';

// ─── Helpers ──────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatHeader(date: Date, zoom: ZoomLevel): string {
  switch (zoom) {
    case 'day': {
      const wd = date.toLocaleString('en-US', { weekday: 'narrow' });
      return `${wd}${date.getDate()}`;
    }
    case 'week':
      return `W${getWeekNumber(date)}`;
    case 'month':
      return date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
    case 'quarter':
      return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
  }
}

function getWeekNumber(d: Date): number {
  const oneJan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
}

function getTimelineRange(cards: Card[], zoom: ZoomLevel): { start: Date; end: Date; cells: Date[] } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let minDate = new Date(today);
  let maxDate = new Date(today);

  for (const card of cards) {
    if (card.start_date) {
      const d = new Date(card.start_date);
      if (d < minDate) minDate = new Date(d);
    }
    if (card.due_date) {
      const d = new Date(card.due_date);
      if (d > maxDate) maxDate = new Date(d);
      if (d < minDate) minDate = new Date(d);
    }
  }

  // Add padding
  minDate = addDays(minDate, -7);
  maxDate = addDays(maxDate, 14);

  const cells: Date[] = [];
  const cursor = new Date(minDate);

  switch (zoom) {
    case 'day':
      while (cursor <= maxDate) {
        cells.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      break;
    case 'week':
      cursor.setDate(cursor.getDate() - cursor.getDay()); // start at Sunday
      while (cursor <= maxDate) {
        cells.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 7);
      }
      break;
    case 'month':
      cursor.setDate(1);
      while (cursor <= maxDate) {
        cells.push(new Date(cursor));
        cursor.setMonth(cursor.getMonth() + 1);
      }
      break;
    case 'quarter':
      cursor.setDate(1);
      cursor.setMonth(Math.floor(cursor.getMonth() / 3) * 3);
      while (cursor <= maxDate) {
        cells.push(new Date(cursor));
        cursor.setMonth(cursor.getMonth() + 3);
      }
      break;
  }

  return { start: minDate, end: maxDate, cells };
}

function getCellDuration(zoom: ZoomLevel): number {
  switch (zoom) {
    case 'day': return 1;
    case 'week': return 7;
    case 'month': return 30;
    case 'quarter': return 90;
  }
}

// ─── Component ────────────────────────────────────────

export function TimelineView() {
  const cardsMap = useProjectsStore((s) => s.cards);
  const columnsMap = useProjectsStore((s) => s.columns);
  const labelsMap = useProjectsStore((s) => s.labels);
  const cardLabelIds = useProjectsStore((s) => s.cardLabelIds);
  const selectCard = useProjectsStore((s) => s.selectCard);
  const updateCard = useProjectsStore((s) => s.updateCard);
  const activeBoardId = useProjectsStore((s) => s.activeBoardId);
  const { onCardContextMenu, contextMenuPortal } = useCardContextMenu();

  const [zoom, setZoom] = useState<ZoomLevel>('day');
  const [showUndated, setShowUndated] = useState(true);
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showSortMenu, setShowSortMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((source: 'left' | 'right') => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    const from = source === 'left' ? leftRef.current : scrollRef.current;
    const to = source === 'left' ? scrollRef.current : leftRef.current;
    if (from && to) to.scrollTop = from.scrollTop;
    syncingRef.current = false;
  }, []);

  const columnMap = useMemo(() => new Map(Object.values(columnsMap).map(c => [c.id, c])), [columnsMap]);

  const showArchived = useProjectsStore((s) => s.filters.show_archived);
  const allCards = useMemo(() => Object.values(cardsMap).filter(c => showArchived || !c.archived), [cardsMap, showArchived]);
  const datedCards = useMemo(() => allCards.filter(c => c.due_date || c.start_date), [allCards]);
  const undatedCards = useMemo(() => allCards.filter(c => !c.due_date && !c.start_date), [allCards]);

  // ─── Sort datedCards ────────────────────────────────
  const sortedDatedCards = useMemo(() => {
    const sorted = [...datedCards].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'due_date': {
          const da = a.due_date ?? a.start_date;
          const db = b.due_date ?? b.start_date;
          if (!da && !db) cmp = 0;
          else if (!da) cmp = 1;
          else if (!db) cmp = -1;
          else cmp = new Date(da).getTime() - new Date(db).getTime();
          break;
        }
        case 'start_date': {
          const sa = a.start_date ?? a.due_date;
          const sb = b.start_date ?? b.due_date;
          if (!sa && !sb) cmp = 0;
          else if (!sa) cmp = 1;
          else if (!sb) cmp = -1;
          else cmp = new Date(sa).getTime() - new Date(sb).getTime();
          break;
        }
        case 'priority':
          cmp = (PRIORITY_ORDER[a.priority ?? 'none'] ?? 4) - (PRIORITY_ORDER[b.priority ?? 'none'] ?? 4);
          break;
        case 'column': {
          const colA = columnMap.get(a.column_id);
          const colB = columnMap.get(b.column_id);
          cmp = (colA?.position ?? 0) - (colB?.position ?? 0);
          break;
        }
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'card_number':
          cmp = (a.card_number ?? 0) - (b.card_number ?? 0);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [datedCards, sortField, sortDir, columnMap]);

  // ─── Group sortedDatedCards ─────────────────────────
  const groups: CardGroup[] = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: '', cards: sortedDatedCards }];

    const map = new Map<string, CardGroup>();
    for (const card of sortedDatedCards) {
      let key: string;
      let label: string;
      let color: string | undefined;

      switch (groupBy) {
        case 'column': {
          const col = columnMap.get(card.column_id);
          key = card.column_id;
          label = col?.title ?? 'Unknown';
          color = col?.color ?? undefined;
          break;
        }
        case 'priority': {
          key = card.priority ?? 'none';
          label = key.charAt(0).toUpperCase() + key.slice(1);
          color = PRIORITY_COLORS[key];
          break;
        }
        case 'label': {
          const ids = cardLabelIds[card.id] ?? [];
          if (ids.length === 0) {
            key = '_none';
            label = 'No label';
          } else {
            const lbl = labelsMap[ids[0]!];
            key = ids[0]!;
            label = lbl?.name ?? 'Unknown';
            color = lbl?.color;
          }
          break;
        }
      }

      if (!map.has(key)) map.set(key, { key, label, color, cards: [] });
      map.get(key)!.cards.push(card);
    }
    return Array.from(map.values());
  }, [sortedDatedCards, groupBy, columnMap, cardLabelIds, labelsMap]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setShowSortMenu(false);
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Flatten groups into renderable rows (cards + group headers)
  const renderRows = useMemo(() => {
    const rows: Array<{ type: 'group'; group: CardGroup } | { type: 'card'; card: Card }> = [];
    for (const group of groups) {
      if (groupBy !== 'none') {
        rows.push({ type: 'group', group });
      }
      if (!collapsedGroups.has(group.key)) {
        for (const card of group.cards) {
          rows.push({ type: 'card', card });
        }
      }
    }
    return rows;
  }, [groups, groupBy, collapsedGroups]);


  const { cells } = useMemo(() => getTimelineRange(sortedDatedCards, zoom), [sortedDatedCards, zoom]);
  const cellWidth = ZOOM_CONFIG[zoom].cellWidth;
  const totalWidth = cells.length * cellWidth;

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  // Calculate today's X position
  const todayX = useMemo(() => {
    if (cells.length === 0) return -1;
    const firstCell = cells[0]!;
    const days = daysBetween(firstCell, today);
    const cellDur = getCellDuration(zoom);
    return (days / cellDur) * cellWidth;
  }, [cells, today, zoom, cellWidth]);

  const hasSuperHeader = zoom === 'day' || zoom === 'week';
  const headerTotalHeight = hasSuperHeader ? SUPER_HEADER_HEIGHT + 32 : 32;

  // Super-header spans: group consecutive cells by parent period
  const superHeaderSpans = useMemo(() => {
    if (!hasSuperHeader || cells.length === 0) return [];

    const spans: { label: string; colSpan: number }[] = [];

    const getKey = (d: Date): string => {
      if (zoom === 'day') {
        // Show "Mon W14 · Mar '26" style
        const wk = getWeekNumber(d);
        const mon = d.toLocaleString('en-US', { month: 'short' });
        const yr = d.toLocaleString('en-US', { year: '2-digit' });
        return `W${wk} · ${mon} '${yr}`;
      }
      // week → show month
      return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    };

    let currentKey = getKey(cells[0]!);
    let count = 1;

    for (let i = 1; i < cells.length; i++) {
      const key = getKey(cells[i]!);
      if (key === currentKey) {
        count++;
      } else {
        spans.push({ label: currentKey, colSpan: count });
        currentKey = key;
        count = 1;
      }
    }
    spans.push({ label: currentKey, colSpan: count });
    return spans;
  }, [cells, zoom, hasSuperHeader]);

  const zoomIn = () => {
    const idx = ZOOM_ORDER.indexOf(zoom);
    if (idx > 0) setZoom(ZOOM_ORDER[idx - 1]!);
  };

  const zoomOut = () => {
    const idx = ZOOM_ORDER.indexOf(zoom);
    if (idx < ZOOM_ORDER.length - 1) setZoom(ZOOM_ORDER[idx + 1]!);
  };

  // Drag state for bar move — stores live pixel delta for visual feedback
  const [drag, setDrag] = useState<{
    cardId: string;
    mode: 'move' | 'resize-start' | 'resize-end';
    startX: number;
    dx: number;
    origStart: string;
    origEnd: string;
  } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;

  const handleBarMouseDown = useCallback((
    e: React.MouseEvent,
    card: Card,
    mode: 'move' | 'resize-start' | 'resize-end',
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const startDate = card.start_date ?? card.due_date ?? '';
    const endDate = card.due_date ?? card.start_date ?? '';
    const startX = e.clientX;

    setDrag({ cardId: card.id, mode, startX, dx: 0, origStart: startDate, origEnd: endDate });

    const handleMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      setDrag(prev => prev ? { ...prev, dx } : null);
    };

    const handleUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);

      const cur = dragRef.current;
      if (!cur || !activeBoardId) {
        setDrag(null);
        return;
      }

      const dx = ev.clientX - startX;
      const cellDur = getCellDuration(zoom);
      const daysDelta = Math.round((dx / cellWidth) * cellDur);

      if (daysDelta !== 0) {
        const origStartD = new Date(startDate);
        const origEndD = new Date(endDate);

        let newStart: Date;
        let newEnd: Date;

        switch (mode) {
          case 'move':
            newStart = addDays(origStartD, daysDelta);
            newEnd = addDays(origEndD, daysDelta);
            break;
          case 'resize-start':
            newStart = addDays(origStartD, daysDelta);
            newEnd = origEndD;
            if (newStart > newEnd) newStart = newEnd;
            break;
          case 'resize-end':
            newStart = origStartD;
            newEnd = addDays(origEndD, daysDelta);
            if (newEnd < newStart) newEnd = newStart;
            break;
        }

        updateCard(activeBoardId, card.id, {
          start_date: newStart.toISOString().split('T')[0],
          due_date: newEnd.toISOString().split('T')[0],
        });
      }

      setDrag(null);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [activeBoardId, cellWidth, zoom, updateCard]);

  // Calculate bar position for a card, applying live drag offset
  const getBarStyle = useCallback((card: Card): { left: number; width: number } | null => {
    const startStr = card.start_date ?? card.due_date;
    const endStr = card.due_date ?? card.start_date;
    if (!startStr || !endStr || cells.length === 0) return null;

    const start = new Date(startStr);
    const end = new Date(endStr);
    const firstCell = cells[0]!;
    const cellDur = getCellDuration(zoom);

    const startDays = daysBetween(firstCell, start);
    const endDays = daysBetween(firstCell, end);

    let left = (startDays / cellDur) * cellWidth;
    let right = ((endDays + 1) / cellDur) * cellWidth;

    // Apply live drag offset
    if (drag && drag.cardId === card.id) {
      const dx = drag.dx;
      switch (drag.mode) {
        case 'move':
          left += dx;
          right += dx;
          break;
        case 'resize-start':
          left += dx;
          if (left > right - cellWidth * 0.3) left = right - cellWidth * 0.3;
          break;
        case 'resize-end':
          right += dx;
          if (right < left + cellWidth * 0.3) right = left + cellWidth * 0.3;
          break;
      }
    }

    return { left, width: Math.max(right - left, cellWidth * 0.3) };
  }, [cells, zoom, cellWidth, drag]);

  if (allCards.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: 14 }}>
        No cards yet. Add cards from the Board view.
      </div>
    );
  }

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
        <button onClick={zoomIn} style={navBtnStyle} title="Zoom in"><ZoomIn size={14} /></button>
        <span style={{ color: 'var(--text-dim)', fontSize: 12, minWidth: 50, textAlign: 'center' }}>
          {ZOOM_CONFIG[zoom].label}
        </span>
        <button onClick={zoomOut} style={navBtnStyle} title="Zoom out"><ZoomOut size={14} /></button>

        <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />

        {/* Sort selector */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowSortMenu(v => !v)}
            style={{ ...navBtnStyle, gap: 4, display: 'flex', alignItems: 'center', fontSize: 11, padding: '4px 8px' }}
          >
            {sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
            {SORT_OPTIONS.find(o => o.field === sortField)?.label}
          </button>
          {showSortMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 4,
              zIndex: 20,
              minWidth: 120,
              boxShadow: '0 4px 12px rgba(0,0,0,.3)',
            }}>
              {SORT_OPTIONS.map(({ field, label }) => (
                <button
                  key={field}
                  onClick={() => toggleSort(field)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    width: '100%',
                    padding: '5px 8px',
                    border: 'none',
                    background: sortField === field ? 'var(--amber-dim)' : 'transparent',
                    color: sortField === field ? 'var(--amber)' : 'var(--text-dim)',
                    fontSize: 11,
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    borderRadius: 4,
                    textAlign: 'left',
                  }}
                >
                  {sortField === field && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />

        {/* Group selector */}
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Group:</span>
        {(['none', 'column', 'priority', 'label'] as GroupBy[]).map(g => (
          <button
            key={g}
            onClick={() => { setGroupBy(g); setCollapsedGroups(new Set()); }}
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              background: groupBy === g ? 'var(--amber-dim)' : 'transparent',
              color: groupBy === g ? 'var(--amber)' : 'var(--text-dim)',
              fontSize: 11,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {g === 'none' ? '—' : g}
          </button>
        ))}

        <div style={{ flex: 1 }} />
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
          {sortedDatedCards.length} scheduled, {undatedCards.length} unscheduled
        </span>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left panel: card list */}
        <div ref={leftRef} onScroll={() => handleScroll('left')} style={{
          width: LEFT_PANEL_WIDTH,
          minWidth: LEFT_PANEL_WIDTH,
          borderRight: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          {/* Header row(s) */}
          <div style={{
            height: headerTotalHeight,
            position: 'sticky',
            top: 0,
            zIndex: 2,
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}>
            <div style={{
              height: 32,
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Card
              </span>
            </div>
          </div>

          {/* Card rows */}
          {renderRows.map((row, idx) => {
            if (row.type === 'group') {
              const g = row.group;
              const isCollapsed = collapsedGroups.has(g.key);
              return (
                <div
                  key={`g-${g.key}`}
                  onClick={() => toggleGroup(g.key)}
                  style={{
                    height: ROW_HEIGHT,
                    padding: '0 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text)',
                    userSelect: 'none',
                  }}
                >
                  <ChevronDown size={12} style={{ transform: isCollapsed ? 'rotate(-90deg)' : undefined, transition: 'transform .15s' }} />
                  {g.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: g.color, flexShrink: 0 }} />}
                  {g.label}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({g.cards.length})</span>
                </div>
              );
            }
            const card = row.card;
            return (
              <div
                key={card.id}
                onClick={() => selectCard(card.id)}
                onContextMenu={(e) => onCardContextMenu(e, card)}
                style={{
                  height: ROW_HEIGHT,
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--text)',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              >
                <PriorityDot priority={card.priority ?? 'none'} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {card.card_number != null && <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>#{card.card_number}</span>}
                  {card.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Right panel: timeline */}
        <div ref={scrollRef} onScroll={() => handleScroll('right')} style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          {/* Header cells */}
          <div style={{
            minWidth: totalWidth,
            position: 'sticky',
            top: 0,
            zIndex: 2,
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
          }}>
            {/* Super header row (day → week+month, week → month) */}
            {hasSuperHeader && (
              <div style={{ display: 'flex', height: SUPER_HEADER_HEIGHT, borderBottom: '1px solid var(--border)' }}>
                {superHeaderSpans.map((span, i) => (
                  <div
                    key={i}
                    style={{
                      width: span.colSpan * cellWidth,
                      minWidth: span.colSpan * cellWidth,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      borderRight: '1px solid var(--border)',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {span.label}
                  </div>
                ))}
              </div>
            )}

            {/* Main header row */}
            <div style={{ display: 'flex', height: 32 }}>
              {cells.map((date, i) => {
                const isToday = zoom === 'day' && date.getTime() === today.getTime();
                const isWeekend = zoom === 'day' && (date.getDay() === 0 || date.getDay() === 6);
                return (
                  <div
                    key={i}
                    style={{
                      width: cellWidth,
                      minWidth: cellWidth,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      color: isToday ? 'var(--amber)' : 'var(--text-dim)',
                      fontWeight: isToday ? 700 : 400,
                      borderRight: '1px solid var(--border)',
                      background: isWeekend ? WEEKEND_BG : undefined,
                    }}
                  >
                    {formatHeader(date, zoom)}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bar rows */}
          <div style={{ position: 'relative', minWidth: totalWidth }}>
            {/* Today marker */}
            {todayX >= 0 && todayX <= totalWidth && (
              <div style={{
                position: 'absolute',
                left: todayX,
                top: 0,
                bottom: 0,
                width: 2,
                background: 'var(--error)',
                opacity: 0.6,
                zIndex: 1,
              }} />
            )}

            {renderRows.map((row) => {
              if (row.type === 'group') {
                return (
                  <div
                    key={`tg-${row.group.key}`}
                    style={{
                      height: ROW_HEIGHT,
                      borderBottom: '1px solid var(--border)',
                      background: 'var(--surface)',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', position: 'absolute', inset: 0 }}>
                      {cells.map((date, i) => {
                        const isWeekend = zoom === 'day' && (date.getDay() === 0 || date.getDay() === 6);
                        return <div key={i} style={{ width: cellWidth, minWidth: cellWidth, borderRight: '1px solid var(--border)', background: isWeekend ? WEEKEND_BG : undefined }} />;
                      })}
                    </div>
                  </div>
                );
              }

              const card = row.card;
              const bar = getBarStyle(card);
              const isDragging = drag?.cardId === card.id;
              const cardColor = card.color || PRIORITY_COLORS[card.priority ?? 'none'] || 'var(--amber)';

              const checklist = card.checklist ?? [];
              const progress = checklist.length > 0
                ? checklist.filter(c => c.checked).length / checklist.length
                : 0;

              return (
                <div
                  key={card.id}
                  style={{
                    height: ROW_HEIGHT,
                    borderBottom: '1px solid var(--border)',
                    position: 'relative',
                  }}
                >
                  {/* Grid cells background */}
                  <div style={{ display: 'flex', position: 'absolute', inset: 0 }}>
                    {cells.map((date, i) => {
                      const isWeekend = zoom === 'day' && (date.getDay() === 0 || date.getDay() === 6);
                      return (
                        <div
                          key={i}
                          style={{
                            width: cellWidth,
                            minWidth: cellWidth,
                            borderRight: '1px solid var(--border)',
                            background: isWeekend ? WEEKEND_BG : undefined,
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Bar (always rendered as bar, never as diamond) */}
                  {bar && (
                    <div
                      style={{
                        position: 'absolute',
                        left: bar.left,
                        width: bar.width,
                        top: (ROW_HEIGHT - BAR_HEIGHT) / 2,
                        height: BAR_HEIGHT,
                        background: cardColor + 'aa',
                        borderRadius: 4,
                        cursor: isDragging ? 'grabbing' : 'grab',
                        display: 'flex',
                        alignItems: 'center',
                        overflow: 'hidden',
                        zIndex: isDragging ? 10 : 1,
                        opacity: isDragging ? 0.9 : 1,
                        transition: isDragging ? undefined : 'left 0.1s, width 0.1s',
                        boxShadow: isDragging ? '0 2px 8px rgba(0,0,0,.3)' : undefined,
                      }}
                      onMouseDown={(e) => handleBarMouseDown(e, card, 'move')}
                      onClick={(e) => { e.stopPropagation(); if (!isDragging) selectCard(card.id); }}
                    >
                      {progress > 0 && (
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${progress * 100}%`,
                          background: cardColor,
                          borderRadius: '4px 0 0 4px',
                        }} />
                      )}

                      <div
                        onMouseDown={(e) => handleBarMouseDown(e, card, 'resize-start')}
                        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize', zIndex: 2 }}
                      />
                      <div
                        onMouseDown={(e) => handleBarMouseDown(e, card, 'resize-end')}
                        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize', zIndex: 2 }}
                      />

                      {bar.width > 60 && (
                        <span style={{
                          position: 'relative',
                          zIndex: 1,
                          fontSize: 10,
                          color: '#fff',
                          padding: '0 8px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {card.title}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Undated cards */}
      {undatedCards.length > 0 && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '8px 16px',
          background: 'var(--surface)',
        }}>
          <button
            onClick={() => setShowUndated(!showUndated)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {showUndated ? <ChevronLeft size={12} style={{ transform: 'rotate(-90deg)' }} /> : <ChevronRight size={12} />}
            Unscheduled ({undatedCards.length})
          </button>
          {showUndated && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, maxHeight: 120, overflow: 'auto' }}>
              {undatedCards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => selectCard(card.id)}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: '4px 8px',
                    color: 'var(--text)',
                    fontSize: 11,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <PriorityDot priority={card.priority ?? 'none'} />
                  {card.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
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
};
