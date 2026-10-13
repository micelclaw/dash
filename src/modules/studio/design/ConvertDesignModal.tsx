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

// ─── ConvertDesignModal — the Continue sheet (unified funnel, ADR-18) ─
//
// THE moment the project acquires its target: opened by the canvas'
// "Continue →" primary CTA. Four target cards; the brief-derived
// recommendation is pre-selected with a plain-words rationale (R-A).
// The key distinction is BACKEND: only "App for my OS" builds one; the
// other three publish the designed frontend. R-C: nothing is final —
// the design stays pinned and a rewind undoes the choice.

import { useEffect, useState } from 'react';
import { Hammer, Globe, AppWindow, Smartphone, Info, Loader2, X, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { continueBuildInStudio, type ConvertTarget } from './design.service';

interface Props {
  projectId: string;
  /** The design's brief said it needs to remember data / talk to services —
   *  only 'App for my OS' gives it a backend. Nudge accordingly. */
  needsBackend?: boolean;
  /** Brief-derived recommendation (brief-intel mirror of the server's
   *  mapIntakeToScope): pre-selected + pilled. */
  recommendedTarget?: ConvertTarget;
  /** Plain-words one-liner explaining the recommendation (R-A). */
  recommendationReason?: string;
  onClose: () => void;
  onConverted: () => void;
}

interface ConvertCard {
  id: ConvertTarget;
  icon: LucideIcon;
  title: string;
  desc: string;
  /** Does this target build a backend for the designed screens? */
  hasBackend: boolean;
}

const CONVERT_CARDS: ConvertCard[] = [
  {
    id: 'micelclaw_app',
    icon: Hammer,
    title: 'App for my OS',
    desc: 'A full app inside Micelclaw with its OWN backend and data. We build the backend behind your designed screens.',
    hasBackend: true,
  },
  {
    id: 'mobile',
    icon: Smartphone,
    title: 'Mobile app (PWA)',
    desc: 'Your pages become an installable phone app — added to the home screen. Shows your pages; doesn\'t store anything by itself.',
    hasBackend: false,
  },
  {
    id: 'webapp',
    icon: AppWindow,
    title: 'Web app',
    desc: 'Your pages become a standalone app that runs in any browser. Shows your pages; doesn\'t store anything by itself.',
    hasBackend: false,
  },
  {
    id: 'website',
    icon: Globe,
    title: 'Website',
    desc: 'Your designed pages become a public site on your domain — published directly, no build needed.',
    hasBackend: false,
  },
];

export function ConvertDesignModal({ projectId, needsBackend, recommendedTarget, recommendationReason, onClose, onConverted }: Props) {
  // The brief-derived recommendation is pre-selected (backend need wins
  // server-side too); the user can always pick another card.
  const [selected, setSelected] = useState<ConvertTarget | null>(
    recommendedTarget ?? (needsBackend ? 'micelclaw_app' : null),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  async function confirm() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await continueBuildInStudio(projectId, selected);
      toast.success('Converted — everything derived from your design');
      onConverted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Conversion failed');
      setBusy(false);
    }
  }

  return (
    <div style={overlayStyle} onClick={() => !busy && onClose()}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={dialogHeader}>
          <h3 style={{ fontSize: '0.9375rem', margin: 0, color: 'var(--text)', flex: 1 }}>
            Where should this live?
          </h3>
          <button type="button" onClick={() => !busy && onClose()} disabled={busy} style={iconBtn} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        {(recommendationReason || needsBackend) && (
          <div style={backendNote}>
            <Info size={14} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
            <span>
              {recommendationReason ?? 'Your design stores data (from your answers), so it needs a backend.'}
              {needsBackend && <> Only <strong>App for my OS</strong> builds a backend — the other three publish the frontend only.</>}
            </span>
          </div>
        )}

        <div style={cardGrid}>
          {CONVERT_CARDS.map((c) => {
            const active = selected === c.id;
            const Icon = c.icon;
            const recommended = recommendedTarget ? c.id === recommendedTarget : (needsBackend === true && c.hasBackend);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c.id)}
                disabled={busy}
                style={convertCard(active, recommended)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <Icon size={18} style={{ color: active ? 'var(--amber)' : 'var(--text-dim)' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{c.title}</span>
                  {recommended && <span style={recommendedPill}>recommended</span>}
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', lineHeight: 1.45 }}>{c.desc}</span>
              </button>
            );
          })}
        </div>

        <p style={{ margin: '0 0 16px', fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          You can change your mind later — your design stays pinned either way.
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={busy} style={cancelBtn}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { void confirm(); }}
            disabled={!selected || busy}
            style={confirmBtn(!selected || busy)}
          >
            {busy
              ? <><Loader2 size={12} className="animate-spin" /> Setting everything up… usually under a minute</>
              : <>Confirm &amp; continue</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 100,
  background: 'color-mix(in srgb, #000 60%, transparent)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16,
};
const dialogStyle: React.CSSProperties = {
  maxWidth: 560, width: '100%',
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: 18,
  fontFamily: 'var(--font-sans)',
};
const dialogHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  paddingBottom: 8, marginBottom: 12,
  borderBottom: '1px solid var(--border)',
};
const backendNote: React.CSSProperties = {
  display: 'flex', gap: 8, alignItems: 'flex-start',
  padding: '9px 11px', marginBottom: 12,
  background: 'color-mix(in srgb, var(--amber) 8%, transparent)',
  border: '1px solid color-mix(in srgb, var(--amber) 35%, var(--border))',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.5,
};
const iconBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
  padding: 4, background: 'transparent',
  border: 'none', color: 'var(--text-dim)', cursor: 'pointer',
};
const cardGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
  gap: 10, marginBottom: 12,
};
const convertCard = (active: boolean, recommended: boolean): React.CSSProperties => ({
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
  padding: '13px 14px', textAlign: 'left', minHeight: 104,
  background: active ? 'color-mix(in srgb, var(--amber) 8%, var(--card))' : 'var(--card)',
  border: `1px solid ${active ? 'var(--amber)' : recommended ? 'color-mix(in srgb, var(--amber) 40%, var(--border))' : 'var(--border)'}`,
  borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
});
const recommendedPill: React.CSSProperties = {
  marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.03em', color: 'var(--amber)',
  background: 'color-mix(in srgb, var(--amber) 14%, transparent)',
  padding: '2px 6px', borderRadius: 'var(--radius-full)',
};
const cancelBtn: React.CSSProperties = {
  padding: '8px 14px',
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-dim)',
  borderRadius: 'var(--radius-md)',
  fontSize: '0.75rem', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
const confirmBtn = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px',
  background: 'var(--amber)', color: '#000',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: '0.75rem', fontWeight: 600,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.55 : 1,
  fontFamily: 'var(--font-sans)',
});
