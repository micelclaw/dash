/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved. Proprietary — see repo LICENSE.
 */

// ─── Design system gallery ("Browse all") ───────────────────────────
// The compact picker shows the top-6; this modal browses the WHOLE
// catalog (~150) with search + category filter. Cards are lightweight
// (name + category + swatch count) — no per-card iframe — so it scales
// to hundreds. Selecting a system closes the modal; the intro's single
// instant-preview reflects the pick.

import { useEffect, useMemo, useState } from 'react';
import { Search, X, Check, Star, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore, type StudioDesignSystem } from '@/stores/studio.store';
import { api } from '@/services/api';
import { ImportBrandDialog } from './ImportBrandDialog';

interface Props {
  value: string | null;
  onSelect: (slug: string | null) => void;
  onClose: () => void;
  /** Enables the optional model draft in the import dialog. */
  projectId?: string;
}

export function DesignSystemGalleryModal({ value, onSelect, onClose, projectId }: Props) {
  const searchDesignSystems = useStudioStore((s) => s.searchDesignSystems);
  const [all, setAll] = useState<StudioDesignSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    searchDesignSystems()
      .then((rows) => { if (!cancelled) setAll(rows); })
      .catch(() => { if (!cancelled) setAll([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [searchDesignSystems, reloadKey]);

  // Deleting is soft server-side; a bound project keeps its pinned copy.
  async function handleDelete(slug: string, name: string) {
    try {
      await api.delete(`/studio/design-systems/${encodeURIComponent(slug)}`);
      toast.success(`Removed "${name}"`);
      if (value === slug) onSelect(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove it');
    }
  }

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const categories = useMemo(
    () => [...new Set(all.map((s) => s.category))].sort(),
    [all],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = all.filter((s) =>
      (!category || s.category === category) &&
      (!q || s.slug.includes(q) || s.name.toLowerCase().includes(q)),
    );
    // Yours first, then first-party, then catalog order (already name-sorted).
    return [...list].sort((a, b) =>
      Number(!!b.owned) - Number(!!a.owned)
      || Number(!!b.first_party) - Number(!!a.first_party));
  }, [all, query, category]);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 860, maxWidth: '94vw', height: '82vh', display: 'flex', flexDirection: 'column', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <strong style={{ fontSize: '0.9rem', color: 'var(--text)' }}>Design systems</strong>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{loading ? 'loading…' : `${all.length} to explore`}</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }} aria-label="Close"><X size={16} /></button>
        </div>

        {/* Search + categories */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              placeholder="Search: stripe, notion, linear, apple…"
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 32px', fontSize: '0.82rem', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-sans)' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <CatChip label="All" active={!category} onClick={() => setCategory(null)} />
            {categories.map((c) => <CatChip key={c} label={c} active={category === c} onClick={() => setCategory(c)} />)}
          </div>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '40px 0', fontSize: '0.82rem' }}>Loading…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
              {/* Your own brand, first: the most specific thing in the picker. */}
              <button
                type="button"
                data-import-brand-card
                onClick={() => setImporting(true)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
                  padding: '11px 12px', textAlign: 'left', background: 'var(--surface)',
                  border: '1px dashed var(--amber)', borderRadius: 'var(--radius-md)',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>
                  <Plus size={12} style={{ color: 'var(--amber)' }} /> Import my brand
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>your colours, fonts and rules</span>
              </button>
              {shown.map((s) => {
                const sel = value === s.slug;
                return (
                  <button
                    key={s.slug}
                    type="button"
                    data-gallery-card={s.slug}
                    onClick={() => { onSelect(s.slug); onClose(); }}
                    title={s.slug}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
                      padding: '11px 12px', textAlign: 'left',
                      background: sel ? 'color-mix(in srgb, var(--amber) 10%, var(--surface))' : 'var(--surface)',
                      border: `1px solid ${sel ? 'var(--amber)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', width: '100%' }}>
                      {s.first_party && <Star size={11} style={{ color: 'var(--amber)', fill: 'var(--amber)' }} />}
                      {sel && <Check size={12} style={{ color: 'var(--amber)' }} />}
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                      {s.owned && (
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Remove ${s.name}`}
                          onClick={(e) => { e.stopPropagation(); void handleDelete(s.slug, s.name); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); void handleDelete(s.slug, s.name); } }}
                          style={{ display: 'flex', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                          <Trash2 size={11} />
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {s.owned ? 'yours' : `${s.category}${s.has_brand ? ' · inspired by' : ''}`}
                    </span>
                  </button>
                );
              })}
              {shown.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-dim)', padding: '30px 0', fontSize: '0.82rem' }}>No systems match.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {importing && (
        <ImportBrandDialog
          projectId={projectId}
          onClose={() => setImporting(false)}
          onImported={(slug) => { setReloadKey((k) => k + 1); onSelect(slug); onClose(); }}
        />
      )}
    </div>
  );
}

function CatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 11px', fontSize: '0.7rem', fontWeight: 600, textTransform: 'capitalize',
        borderRadius: 'var(--radius-full)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
        background: active ? 'color-mix(in srgb, var(--amber) 14%, transparent)' : 'transparent',
        border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
        color: active ? 'var(--amber)' : 'var(--text-muted)',
      }}
    >
      {label}
    </button>
  );
}
