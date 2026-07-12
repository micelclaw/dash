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

// ─── Reusable catalog design-system picker (S4) ──────────────────────
//
// Extracted from DocPhaseLayout so other surfaces (Design mode, modals)
// can offer "start from a known design" with the same UX: a debounced
// search over GET /studio/design-systems, a grid of result cards, and a
// DesignPreview of the currently selected system.
//
// The component is DELIBERATELY stateless about the binding: clicking a
// card only calls `onSelect(slug)` (or `onSelect(null)` when toggling
// the selected one off / pressing "remove") — the PARENT decides what to
// do with the slug (persist via setDesignSystem, stage it locally, …).

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useStudioStore, type StudioDesignSystem } from '@/stores/studio.store';
import { DesignPreview } from './DesignPreview';

export interface DesignSystemPickerProps {
  /** Currently selected catalog slug (null = none). */
  value: string | null;
  /** Called with the slug to select, or null to clear the selection. */
  onSelect: (slug: string | null) => void;
  /** Disables the search input and the result cards. */
  disabled?: boolean;
  /** Compact: 2-column grid capped at ~6 visible results (scrolls). */
  compact?: boolean;
  /** Live color tweaks forwarded to the selected system's preview
   *  ({ "primary": "#ff0000", … }). Omit to render it read-only. */
  previewOverrides?: Record<string, string>;
  onPreviewOverride?: (name: string, value: string) => void;
  onResetPreviewOverrides?: () => void;
  /** When set and nothing is selected, renders an always-on brand
   *  preview styled with this `:root { … }` tokens CSS instead of
   *  hiding the preview entirely. */
  fallbackTokensCss?: string;
  /** Suppress the picker's own DesignPreview — the parent owns a single,
   *  prominent preview (e.g. the design intro's template × tokens). */
  hidePreview?: boolean;
}

export function DesignSystemPicker(props: DesignSystemPickerProps) {
  const {
    value, onSelect, disabled, compact,
    previewOverrides, onPreviewOverride, onResetPreviewOverrides,
    fallbackTokensCss, hidePreview,
  } = props;
  const searchDesignSystems = useStudioStore((s) => s.searchDesignSystems);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StudioDesignSystem[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounced catalog search. Fires immediately on mount (empty query →
  // default catalog page), then 250ms after the user stops typing.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      searchDesignSystems(query.trim() || undefined)
        .then((rows) => {
          if (cancelled) return;
          // First-party systems (Micelclaw OS) pinned to the front, so
          // they're visible even inside the compact 6-card slice.
          const sorted = [...rows].sort((a, b) => Number(b.first_party) - Number(a.first_party));
          setResults(sorted.slice(0, compact ? 6 : 12));
        })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, query ? 250 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, compact, searchDesignSystems]);

  return (
    <div>
      <div style={{ position: 'relative', marginTop: 8 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          placeholder="Search: stripe, notion, material…"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 32px',
            fontSize: '0.8rem', background: 'var(--surface)', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-sans)',
            opacity: disabled ? 0.6 : 1,
          }}
        />
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${compact ? 2 : 3}, 1fr)`,
        gap: 8, marginTop: 8,
        ...(compact ? { maxHeight: 200, overflowY: 'auto' as const } : {}),
      }}>
        {results.map((ds) => {
          const sel = value === ds.slug;
          return (
            <button
              key={ds.slug}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(sel ? null : ds.slug)}
              title={ds.has_brand ? `${ds.name} (inspired by — tokens only)` : ds.name}
              style={{
                display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 10px', textAlign: 'left',
                background: sel ? 'color-mix(in srgb, var(--amber) 12%, var(--card))' : 'var(--card)',
                border: `1.5px solid ${sel ? 'var(--amber)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)', cursor: disabled ? 'default' : 'pointer',
                fontFamily: 'var(--font-sans)',
                color: 'var(--text)', minWidth: 0,
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <span style={{ fontSize: '0.78rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ds.name}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                {ds.has_brand ? 'inspired by' : ds.category}
              </span>
            </button>
          );
        })}
      </div>
      {loading && results.length === 0 && (
        <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Searching…</div>
      )}
      {value ? (
        <>
          <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Base design: <strong style={{ color: 'var(--text)' }}>{value}</strong>
            {' · '}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(null)}
              style={{ background: 'none', border: 'none', color: 'var(--amber)', cursor: disabled ? 'default' : 'pointer', padding: 0, font: 'inherit' }}
            >
              remove
            </button>
          </div>
          {!hidePreview && (
            <DesignPreview
              slug={value}
              overrides={previewOverrides}
              onOverride={onPreviewOverride}
              onResetOverrides={onResetPreviewOverrides}
            />
          )}
        </>
      ) : (
        /* A3: ALWAYS-ON brand preview — even with no system picked, the
           user sees how their tokens look (feel-derived in DocPhaseLayout).
           Only rendered when the parent supplies the fallback CSS. */
        !hidePreview && fallbackTokensCss !== undefined && <DesignPreview tokensCssOverride={fallbackTokensCss} />
      )}
    </div>
  );
}
