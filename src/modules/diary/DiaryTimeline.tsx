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

import { useMemo, useState, useRef, useEffect } from 'react';
import { Search, Plus, X } from 'lucide-react';
import { DiaryTimelineItem } from './DiaryTimelineItem';
import type { DiaryEntry } from './types';

interface DiaryTimelineProps {
  entries: DiaryEntry[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateToday: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  onRetry: () => void;
}

function SkeletonItem() {
  return (
    <div style={{ padding: '8px 12px', display: 'flex', gap: 8 }}>
      <div style={{ width: 36, height: 32, background: 'var(--surface-hover)', borderRadius: 4 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 12, width: '80%', background: 'var(--surface-hover)', borderRadius: 4 }} />
      </div>
    </div>
  );
}

export function DiaryTimeline({
  entries, loading, error, selectedId, onSelect, onCreateToday, search, onSearchChange, onRetry,
}: DiaryTimelineProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearchChange(localSearch), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [localSearch, onSearchChange]);

  useEffect(() => { setLocalSearch(search); }, [search]);

  // Group entries by month
  const groups = useMemo(() => {
    const map = new Map<string, DiaryEntry[]>();
    for (const entry of entries) {
      const d = new Date(entry.entry_date + 'T12:00:00');
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
      // Store label on first entry for display
      if (!map.has(`label-${key}`)) map.set(`label-${key}`, [{ id: label } as DiaryEntry]);
    }
    const result: { label: string; entries: DiaryEntry[] }[] = [];
    const seen = new Set<string>();
    for (const entry of entries) {
      const d = new Date(entry.entry_date + 'T12:00:00');
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!seen.has(key)) {
        seen.add(key);
        const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        result.push({ label, entries: map.get(key)! });
      }
    }
    return result;
  }, [entries]);

  // Check if today has an entry
  const todayStr = new Date().toISOString().slice(0, 10);
  const hasTodayEntry = entries.some(e => e.entry_date === todayStr);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface)' }}>
      {/* Search */}
      <div style={{ padding: '12px 12px 0' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
        }}>
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            placeholder="Search diary..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
            }}
          />
          {localSearch && (
            <button
              onClick={() => { setLocalSearch(''); onSearchChange(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Today ghost entry */}
      {!hasTodayEntry && !loading && (
        <button
          onClick={onCreateToday}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: '8px 12px',
            padding: '10px 12px',
            background: 'var(--amber-dim)',
            border: '1px dashed var(--amber)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            color: 'var(--amber)',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Plus size={14} />
          Write today's entry
        </button>
      )}

      {/* Entries list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && entries.length === 0 && (
          <><SkeletonItem /><SkeletonItem /><SkeletonItem /><SkeletonItem /></>
        )}

        {error && (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <p style={{ color: 'var(--error)', fontSize: '0.8125rem', marginBottom: 8 }}>{error}</p>
            <button
              onClick={onRetry}
              style={{
                padding: '6px 12px', background: 'var(--surface-hover)', color: 'var(--text)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>No diary entries yet</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: 4 }}>
              Start writing to capture your days
            </p>
          </div>
        )}

        {groups.map(group => (
          <div key={group.label}>
            <div style={{
              padding: '10px 12px 4px',
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {group.label}
            </div>
            {group.entries.map(entry => (
              <DiaryTimelineItem
                key={entry.id}
                id={entry.id}
                entryDate={entry.entry_date}
                content={entry.content}
                mood={entry.mood}
                selected={entry.id === selectedId}
                onClick={() => onSelect(entry.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
