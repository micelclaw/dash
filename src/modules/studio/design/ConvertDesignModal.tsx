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

// ─── ConvertDesignModal — "Build it…" conversion from the canvas ─────
//
// Opened from the design canvas when the user wants to turn their
// approved design into a buildable project. Four target cards (same
// visual language as the Guided onboarding target cards): App for my OS
// vs Website vs Web app vs Mobile app. The key distinction is BACKEND:
// only "App for my OS" builds a backend + data; the other three publish
// the designed frontend. When the brief says the design needs to store
// data, we nudge toward the app and warn the others are frontend-only.

import { useEffect, useState } from 'react';
import { Hammer, Globe, AppWindow, Smartphone, Info, Loader2, X, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { continueBuildInStudio, type ConvertTarget } from './design.service';

interface Props {
  projectId: string;
  /** The design's brief said it needs to remember data / talk to services —
   *  only 'App for my OS' gives it a backend. Nudge accordingly. */
  needsBackend?: boolean;
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
    desc: 'Your pages become an installable phone app — added to the home screen. Frontend only (no backend).',
    hasBackend: false,
  },
  {
    id: 'webapp',
    icon: AppWindow,
    title: 'Web app',
    desc: 'Your pages become a standalone web app (SPA) that runs in the browser. Frontend only (no backend).',
    hasBackend: false,
  },
  {
    id: 'website',
    icon: Globe,
    title: 'Website',
    desc: 'Your designed pages become a public site on your domain — published directly, no build. Frontend only.',
    hasBackend: false,
  },
];

export function ConvertDesignModal({ projectId, needsBackend, onClose, onConverted }: Props) {
  // Default to the app when the design needs a backend (the only target
  // that provides one); otherwise leave it to the user.
  const [selected, setSelected] = useState<ConvertTarget | null>(needsBackend ? 'micelclaw_app' : null);
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
            Build it…
          </h3>
          <button type="button" onClick={() => !busy && onClose()} disabled={busy} style={iconBtn} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        {needsBackend && (
          <div style={backendNote}>
            <Info size={14} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
            <span>Your design stores data (from your answers), so it needs a <strong>backend</strong> —
              only <strong>App for my OS</strong> builds one. The other three publish the frontend only.</span>
          </div>
        )}

        <div style={cardGrid}>
          {CONVERT_CARDS.map((c) => {
            const active = selected === c.id;
            const Icon = c.icon;
            const recommended = needsBackend && c.hasBackend;
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
          Your design stays pinned — you can revisit it from the phase rail at any time.
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
              ? <><Loader2 size={12} className="animate-spin" /> Deriving docs… ~1 min</>
              : <>Convert &amp; continue</>
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
