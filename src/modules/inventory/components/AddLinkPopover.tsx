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

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import type { SearchResult } from '@/types/search';

interface AddLinkPopoverProps {
  itemId: string;
  /** Called after a link is successfully created (refresh the related panel). */
  onLinked: () => void;
}

/** Target domains for manual links. `searchDomain` is what `/search` expects (singular). */
const LINK_DOMAINS: { value: string; label: string; searchDomain: string }[] = [
  { value: 'note', label: 'Note', searchDomain: 'note' },
  { value: 'event', label: 'Event', searchDomain: 'event' },
  { value: 'contact', label: 'Contact', searchDomain: 'contact' },
  { value: 'email', label: 'Email', searchDomain: 'email' },
  { value: 'kanban_card', label: 'Kanban card', searchDomain: 'kanban_card' },
  { value: 'file', label: 'File', searchDomain: 'file' },
  { value: 'inventory_item', label: 'Inventory item', searchDomain: 'inventory' },
];

const inputStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  padding: '5px 8px',
  fontSize: '0.75rem',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const dimText: CSSProperties = {
  fontSize: '0.6875rem',
  color: 'var(--text-dim)',
  padding: '2px 0',
};

function resultTitle(r: SearchResult): string {
  const rec = (r.record ?? {}) as Record<string, unknown>;
  const candidate = rec.title ?? rec.name ?? rec.display_name ?? rec.subject;
  if (typeof candidate === 'string' && candidate.trim()) return candidate;
  return r.snippet || r.record_id;
}

export function AddLinkPopover({ itemId, onLinked }: AddLinkPopoverProps) {
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState('note');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on click outside / Escape.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Debounced search (300ms).
  useEffect(() => {
    if (!open || !query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    let alive = true;
    const searchDomain = LINK_DOMAINS.find(d => d.value === domain)?.searchDomain ?? domain;
    const t = window.setTimeout(() => {
      setSearching(true);
      api
        .get<{ data: SearchResult[] }>('/search', { q: query.trim(), domains: searchDomain, limit: 8 })
        .then(res => {
          if (alive) {
            setResults(res.data ?? []);
            setSearching(false);
          }
        })
        .catch(() => {
          if (alive) {
            setResults([]);
            setSearching(false);
          }
        });
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [query, domain, open]);

  const handleLink = async (r: SearchResult) => {
    try {
      await api.post('/links', {
        source_type: 'inventory_item',
        source_id: itemId,
        target_type: domain,
        target_id: r.record_id,
        relationship: 'relates_to',
      });
      toast.success('Link created');
      onLinked();
      setOpen(false);
      setQuery('');
      setResults([]);
    } catch {
      toast.error('Failed to create link');
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-dim)',
          padding: '2px 8px',
          fontSize: '0.6875rem',
          cursor: 'pointer',
        }}
      >
        <Link2 size={12} /> + Link
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            width: 280,
            zIndex: 30,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          }}
        >
          <select
            value={domain}
            onChange={e => {
              setDomain(e.target.value);
              setResults([]);
            }}
            style={inputStyle}
            aria-label="Link target type"
          >
            {LINK_DOMAINS.map(d => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search…"
            autoFocus
            style={inputStyle}
          />
          {searching && <span style={dimText}>Searching…</span>}
          {!searching && query.trim() && results.length === 0 && <span style={dimText}>No results</span>}
          {results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 220, overflowY: 'auto' }}>
              {results.map(r => (
                <button
                  key={r.record_id}
                  onClick={() => void handleLink(r)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    padding: '6px 8px',
                    fontSize: '0.75rem',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hover)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }}
                >
                  {resultTitle(r)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
