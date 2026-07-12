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

// ─── View design — read-only modal preview of a project's design ─────
//
// Lightweight viewer usable from ANY phase: loads the design pages +
// token layer and renders the active page in the same sandboxed iframe
// document the Design Studio uses (buildCanvasDoc), but with NO
// inspector script — pure look, no editing.

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Palette, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  buildCanvasDoc, fetchProjectTokensCss, listDesignPages, type DesignPage,
} from './design.service';

interface Props {
  projectId: string;
  onClose: () => void;
}

export function ViewDesignModal({ projectId, onClose }: Props) {
  const [pages, setPages] = useState<DesignPage[]>([]);
  const [tokensCss, setTokensCss] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePageId, setActivePageId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [pagesRes, tokens] = await Promise.all([
          listDesignPages(projectId),
          fetchProjectTokensCss(projectId),
        ]);
        if (cancelled) return;
        // Chosen pages have no variant_group; before a variant is picked,
        // fall back to the first generated variant so there is SOMETHING.
        const real = pagesRes.pages.filter((p) => !p.variant_group);
        const visible = real.length > 0 ? real : pagesRes.pages.slice(0, 1);
        setPages(visible);
        setActivePageId(visible[0]?.id ?? null);
        setTokensCss(tokens);
      } catch {
        if (!cancelled) toast.error('Could not load the design');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const activePage = pages.find((p) => p.id === activePageId) ?? pages[0] ?? null;
  const nonce = useMemo(() => crypto.randomUUID(), []);

  // Same sandboxed document as the Design Studio canvas, but with a
  // neutral (empty) inspector script — read-only rendering.
  const srcDoc = useMemo(() => (activePage ? buildCanvasDoc({
    pageHtml: activePage.html,
    tokensCss,
    inspectorScript: '',
    nonce,
  }) : ''), [activePage, tokensCss, nonce]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)', padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 900, maxWidth: '94vw', height: '80vh',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <h3 style={{
            margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)',
            display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0,
          }}>
            <Palette size={16} style={{ color: 'var(--amber)' }} />
            Your design
          </h3>
          {pages.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', minWidth: 0, flex: 1 }}>
              {pages.map((p) => {
                const active = p.id === activePage?.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActivePageId(p.id)}
                    style={{
                      padding: '4px 10px', fontSize: '0.72rem', fontWeight: active ? 600 : 500,
                      background: active ? 'color-mix(in srgb, var(--amber) 14%, transparent)' : 'transparent',
                      color: active ? 'var(--amber)' : 'var(--text-dim)',
                      border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
                      borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
                      fontFamily: 'var(--font-sans)', flexShrink: 0,
                    }}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button" onClick={onClose} aria-label="Close"
            style={{
              display: 'flex', marginLeft: 'auto', background: 'none', border: 'none',
              cursor: 'pointer', color: 'var(--text-muted)', padding: 2, flexShrink: 0,
            }}
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', background: 'var(--surface)' }}>
          {loading ? (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, color: 'var(--text-muted)', fontSize: '0.8125rem',
            }}>
              <Loader2 size={16} className="spin" />
              Loading design…
            </div>
          ) : !activePage ? (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: '0.8125rem',
            }}>
              No designed screens yet.
            </div>
          ) : (
            <iframe
              title="Design preview"
              sandbox="allow-scripts"
              srcDoc={srcDoc}
              style={{ flex: 1, width: '100%', height: '100%', border: 'none', background: '#fff' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default ViewDesignModal;
