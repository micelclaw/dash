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

// ─── TemplateGallery — bundled starter templates ───────────────────
//
// Phase 11: shows the 6-8 bundled templates as cards. Click → POST
// /studio/templates/<slug>/instantiate → navigate to the new project
// (which lands directly in the `concept` phase, skipping scoping).

import { useEffect, useState } from 'react';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore, type StudioTemplateMeta } from '@/stores/studio.store';

interface Props {
  onInstantiated: (projectId: string) => void;
}

const LEVEL_COLORS: Record<string, string> = {
  L1: '#22c55e',
  L2: '#3b82f6',
  L3: '#a855f7',
};

export function TemplateGallery({ onInstantiated }: Props) {
  const fetchTemplates = useStudioStore((s) => s.fetchTemplates);
  const instantiateTemplate = useStudioStore((s) => s.instantiateTemplate);

  const [templates, setTemplates] = useState<StudioTemplateMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTemplates()
      .then((t) => { if (!cancelled) { setTemplates(t); setLoading(false); } })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load templates');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [fetchTemplates]);

  async function handlePick(t: StudioTemplateMeta) {
    setBusy(t.slug);
    try {
      const project = await instantiateTemplate(t.slug);
      toast.success(`Created "${project.name}"`);
      onInstantiated(project.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not instantiate template');
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div style={hint}>
        <Loader2 size={14} className="animate-spin" /> Cargando plantillas…
      </div>
    );
  }

  if (error) {
    return (
      <div style={hint}>
        <AlertCircle size={14} /> {error}
      </div>
    );
  }

  if (templates.length === 0) {
    return <div style={hint}>No hay plantillas disponibles.</div>;
  }

  // Group by category for visual organisation
  const grouped = templates.reduce<Record<string, StudioTemplateMeta[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <h3 style={{
            fontSize: '0.6875rem',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            color: 'var(--text-muted)', fontWeight: 600,
            margin: '0 0 10px',
          }}>
            {category}
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
          }}>
            {items.map((t) => {
              const isBusy = busy === t.slug;
              const color = LEVEL_COLORS[t.app_level] ?? 'var(--text-muted)';
              return (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => handlePick(t)}
                  disabled={busy !== null}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 8,
                    padding: 14, textAlign: 'left',
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    cursor: busy ? 'wait' : 'pointer',
                    fontFamily: 'var(--font-sans)',
                    color: 'var(--text)',
                    transition: 'all 0.15s',
                    opacity: busy && !isBusy ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (busy) return;
                    e.currentTarget.style.background = 'var(--card-hover)';
                    e.currentTarget.style.borderColor = color;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--card)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.5rem' }}>{t.icon}</span>
                    <span style={{
                      fontSize: '0.875rem', fontWeight: 600, flex: 1,
                    }}>{t.name}</span>
                    <span style={{
                      fontSize: '0.625rem', fontWeight: 700,
                      padding: '2px 6px',
                      background: `${color}22`, color,
                      borderRadius: 'var(--radius-sm)',
                    }}>
                      {t.app_level}
                    </span>
                  </div>
                  <p style={{
                    margin: 0, fontSize: '0.75rem',
                    color: 'var(--text-dim)', lineHeight: 1.5,
                    minHeight: 36,
                  }}>
                    {t.description}
                  </p>
                  {isBusy && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: '0.6875rem', color: 'var(--amber)',
                    }}>
                      <Loader2 size={11} className="animate-spin" /> Instanciando…
                    </div>
                  )}
                  {!isBusy && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: '0.6875rem', color: 'var(--text-muted)',
                    }}>
                      <Sparkles size={10} /> Empezar desde aquí
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const hint: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 8, padding: 32, color: 'var(--text-dim)', fontSize: '0.875rem',
};
