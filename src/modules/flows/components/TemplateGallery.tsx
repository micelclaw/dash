/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { useEffect, useState } from 'react';
import { Workflow, Search } from 'lucide-react';
import { api } from '@/services/api';

interface BuiltInTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  requiresService?: string[];
  wizard: { steps: unknown[] };
}

interface TemplateGalleryProps {
  onSelect: (template: BuiltInTemplate) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  productivity: 'Productivity',
  communication: 'Communication',
  home: 'Home',
  photos: 'Photos',
};

const CATEGORY_ORDER = ['productivity', 'communication', 'home', 'photos'];

export function TemplateGallery({ onSelect }: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<BuiltInTemplate[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: BuiltInTemplate[] }>('/flows/templates/built-in')
      .then((res) => setTemplates(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? templates.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase()))
    : templates;

  const grouped = new Map<string, BuiltInTemplate[]>();
  for (const t of filtered) {
    const list = grouped.get(t.category) ?? [];
    list.push(t);
    grouped.set(t.category, list);
  }

  if (loading) {
    return <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: 40 }}>Loading templates...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', borderRadius: 6, padding: '6px 10px', maxWidth: 320 }}>
        <Search size={14} style={{ color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates..."
          style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', flex: 1 }}
        />
      </div>

      {/* Categories */}
      {CATEGORY_ORDER.map((cat) => {
        const items = grouped.get(cat);
        if (!items?.length) return null;
        return (
          <div key={cat}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {CATEGORY_LABELS[cat] ?? cat} ({items.length})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              {items.map((t) => (
                <div
                  key={t.id}
                  onClick={() => onSelect(t)}
                  style={{
                    background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
                    padding: 14, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8,
                    transition: 'border-color 150ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.color; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <Workflow size={20} style={{ color: t.color }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>{t.description}</div>
                  </div>
                  {((t as any).requires_service ?? t.requiresService)?.length ? (
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                      Requires: {((t as any).requires_service ?? t.requiresService).join(', ')}
                    </div>
                  ) : null}
                  <button
                    style={{
                      padding: '4px 10px', background: `${t.color}20`, color: t.color, border: 'none',
                      borderRadius: 4, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      alignSelf: 'flex-start',
                    }}
                  >
                    Use template
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: 20 }}>No templates match your search.</div>
      )}
    </div>
  );
}
