/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { useState } from 'react';
import { X, Search } from 'lucide-react';
import { useFlowsStore } from '@/stores/flows.store';
import { STEP_CATEGORIES } from '../types';

interface StepPaletteProps {
  onSelect: (type: string, label: string) => void;
  onClose: () => void;
}

export function StepPalette({ onSelect, onClose }: StepPaletteProps) {
  const stepTypes = useFlowsStore((s) => s.stepTypes);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filtered = stepTypes.filter((st) => {
    if (search) {
      const q = search.toLowerCase();
      return st.label.toLowerCase().includes(q) || st.description.toLowerCase().includes(q) || st.category.includes(q);
    }
    if (selectedCategory) return st.category === selectedCategory;
    return true;
  });

  // Group by category
  const grouped = new Map<string, typeof stepTypes>();
  for (const st of filtered) {
    const list = grouped.get(st.category) ?? [];
    list.push(st);
    grouped.set(st.category, list);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
          width: '90vw', maxWidth: 480, maxHeight: '70vh', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Add step</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', borderRadius: 6, padding: '6px 10px' }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              autoFocus
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedCategory(null); }}
              placeholder="Search steps..."
              style={{
                background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13,
                fontFamily: 'var(--font-sans)', outline: 'none', flex: 1,
              }}
            />
          </div>
        </div>

        {/* Category chips */}
        {!search && (
          <div style={{ display: 'flex', gap: 4, padding: '8px 16px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedCategory(null)}
              style={{
                ...chipStyle,
                background: !selectedCategory ? 'var(--mod-flows-dim)' : 'var(--surface)',
                color: !selectedCategory ? 'var(--mod-flows)' : 'var(--text-dim)',
              }}
            >
              All
            </button>
            {STEP_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  ...chipStyle,
                  background: selectedCategory === cat.id ? `${cat.color}20` : 'var(--surface)',
                  color: selectedCategory === cat.id ? cat.color : 'var(--text-dim)',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Step list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px 16px' }}>
          {[...grouped.entries()].map(([category, types]) => {
            const catInfo = STEP_CATEGORIES.find((c) => c.id === category);
            return (
              <div key={category} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: catInfo?.color ?? 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {catInfo?.label ?? category}
                </div>
                {types.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => onSelect(st.id, st.label)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '8px 10px', background: 'transparent', border: 'none',
                      borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                      color: 'var(--text)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: catInfo?.color ?? 'var(--text-muted)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{st.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{st.description}</div>
                    </div>
                    {st.side_effect === 'write' && (
                      <span style={{ fontSize: 9, color: 'var(--warning)', background: 'rgba(249,115,22,0.1)', padding: '1px 4px', borderRadius: 3 }}>write</span>
                    )}
                    {st.side_effect === 'ai' && (
                      <span style={{ fontSize: 9, color: '#ec4899', background: 'rgba(236,72,153,0.1)', padding: '1px 4px', borderRadius: 3 }}>AI</span>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
          {grouped.size === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: 20 }}>No steps match your search.</div>
          )}
        </div>
      </div>
    </div>
  );
}

const chipStyle: React.CSSProperties = {
  padding: '3px 8px', borderRadius: 4, border: 'none', fontSize: 11,
  cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
