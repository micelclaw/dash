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

// ─── Studio v2 — Build checklist panel ─────────────────────────────
//
// Collapsible panel between the BuildHeaderStrip and the workspace +
// chat columns. Shows every item, its status, source of update
// (auto / agent / manual), and lets the user override manually with
// a tri-state checkbox click (pending → in_progress → done → pending).
//
// State + WS sync live in `useOpencodeStream` (the items prop comes
// straight from the hook). This component is presentation + the
// PATCH call on click; everything else is upstream.

import { useState } from 'react';
import { toast } from 'sonner';
import { ChevronRight, ChevronDown, Check, Circle, CircleDot, RotateCcw } from 'lucide-react';
import { useStudioStore, type StudioChecklistItem, type StudioChecklistStatus } from '@/stores/studio.store';

interface Props {
  projectId: string;
  items: StudioChecklistItem[];
  /** Forced collapsed state from outside (e.g. localStorage). Optional —
   *  the panel keeps its own internal toggle by default. */
  defaultExpanded?: boolean;
}

export function BuildChecklist({ projectId, items, defaultExpanded }: Props) {
  const patchChecklistItem = useStudioStore((s) => s.patchChecklistItem);
  // Always expanded by default — the user wants to SEE the items, even
  // when all are pending (especially then — that's the roadmap).
  const initialExpanded = defaultExpanded ?? true;
  const [expanded, setExpanded] = useState(initialExpanded);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const total = items.length;
  if (total === 0) return null;

  const done = items.filter((it) => it.status === 'done').length;
  const inProgress = items.filter((it) => it.status === 'in_progress').length;
  const ratio = done / total;

  // Color band for the progress bar + counter.
  const accent =
    ratio >= 0.8 ? '#22c55e'
    : ratio >= 0.4 ? 'var(--amber)'
    : 'var(--danger)';

  const cycleStatus = (cur: StudioChecklistStatus): StudioChecklistStatus => {
    if (cur === 'pending') return 'in_progress';
    if (cur === 'in_progress') return 'done';
    return 'pending';
  };

  async function handleClick(item: StudioChecklistItem, target?: StudioChecklistStatus): Promise<void> {
    const next = target ?? cycleStatus(item.status);
    if (next === item.status) return;
    if (busyIds.has(item.id)) return;
    setBusyIds((prev) => new Set(prev).add(item.id));
    try {
      await patchChecklistItem(projectId, item.id, next);
      // The WS event 'studio.opencode.checklist_updated' will refresh
      // the items prop from upstream — no local mutation needed.
    } catch (err) {
      // The status is store/WS-derived (no local optimistic mutation), so
      // on failure the checkbox simply stays where it was — surface the
      // error so the user knows the change didn't stick instead of silently
      // swallowing it.
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn('[checklist] patch failed', err);
      toast.error(`No se pudo actualizar "${item.text}": ${msg}`);
    } finally {
      setBusyIds((prev) => {
        const next_ = new Set(prev);
        next_.delete(item.id);
        return next_;
      });
    }
  }

  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      background: 'var(--card)',
      flexShrink: 0,
    }}>
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 16px',
          background: 'transparent', border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'var(--font-sans)',
        }}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <strong style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>
          Build checklist
        </strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          · {done} / {total} done ({Math.round(ratio * 100)}%)
        </span>
        {inProgress > 0 && (
          <span style={{ color: 'var(--amber)', fontSize: '0.7rem', fontStyle: 'italic' }}>
            · {inProgress} in progress
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span style={{
          width: 80, height: 4, borderRadius: 2,
          background: 'var(--surface)', overflow: 'hidden',
        }}>
          <span style={{
            display: 'block', height: '100%',
            width: `${ratio * 100}%`, background: accent,
            transition: 'width 200ms ease, background 200ms ease',
          }} />
        </span>
      </button>

      {/* Item list */}
      {expanded && (
        <ul style={{
          margin: 0, padding: '4px 0 8px 0', listStyle: 'none',
          maxHeight: 280, overflowY: 'auto',
        }}>
          {items.map((item) => (
            <li key={item.id} style={{
              display: 'grid', gridTemplateColumns: '24px 1fr auto auto',
              alignItems: 'center', gap: 10,
              padding: '4px 16px 4px 38px',
              fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
              color: item.status === 'done' ? 'var(--text-muted)' : 'var(--text)',
              opacity: busyIds.has(item.id) ? 0.5 : 1,
            }}>
              <button
                type="button"
                onClick={() => handleClick(item)}
                disabled={busyIds.has(item.id)}
                aria-label={`Toggle ${item.id}`}
                style={{
                  width: 18, height: 18, padding: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  cursor: busyIds.has(item.id) ? 'wait' : 'pointer',
                  color: item.status === 'done' ? '#22c55e' : 'var(--text-muted)',
                }}
              >
                {item.status === 'done' && <Check size={12} />}
                {item.status === 'in_progress' && <CircleDot size={12} style={{ color: 'var(--amber)' }} />}
                {item.status === 'pending' && <Circle size={10} />}
              </button>
              <span style={{
                textDecoration: item.status === 'done' ? 'line-through' : 'none',
                wordBreak: 'break-word',
              }}>
                {item.text}
              </span>
              <span style={{
                fontSize: '0.65rem', color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {item.evidence ?? ''}
              </span>
              {item.status !== 'pending' && (
                <button
                  type="button"
                  onClick={() => handleClick(item, 'pending')}
                  aria-label={`Reset ${item.id}`}
                  title="Reset to pending"
                  style={{
                    width: 18, height: 18, padding: 0,
                    background: 'transparent', border: 'none',
                    color: 'var(--text-muted)', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <RotateCcw size={11} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
