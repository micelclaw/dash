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

// ─── RewindButton — destructive jump back to an earlier phase ──────
//
// Rendered inside any phase component when the project's `status` is
// AHEAD of the currently viewed phase (i.e. the user is browsing a
// past phase in read-only mode and wants to start editing it). The
// button opens a confirmation dialog listing what will be cleared,
// then calls the backend rewind endpoint and navigates the URL back
// to the no-`?phase=` form so the page re-renders in edit mode.

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Rewind, Loader2, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  useStudioStore,
  type StudioRewindTarget,
} from '@/stores/studio.store';

interface Props {
  projectId: string;
  /** Phase to rewind to. Must be ≤ project.status (caller's contract). */
  target: StudioRewindTarget;
  /** Optional override label for the trigger button (default: "Rewind aquí"). */
  label?: string;
}

// Mirror of the cleared-fields table in `core/src/studio/services/rewind.service.ts`.
// Used purely for the dialog copy.
const CLEARED_BY_TARGET: Record<StudioRewindTarget, string[]> = {
  scoping: [
    'todo el alcance (respuestas + scope + nivel)',
    'el documento de concepto',
    'el documento de frontend',
    'el documento de foundation',
    'el plan de implementación + sesiones generadas',
    'el código generado',
    'los resultados de tests',
    'el paquete .claw construido',
  ],
  concept: [
    'el documento de frontend',
    'el documento de foundation',
    'el plan de implementación + sesiones generadas',
    'el código generado',
    'los resultados de tests',
    'el paquete .claw construido',
  ],
  frontend: [
    'el documento de foundation',
    'el plan de implementación + sesiones generadas',
    'el código generado',
    'los resultados de tests',
    'el paquete .claw construido',
  ],
  foundation: [
    'el plan de implementación + sesiones generadas',
    'el código generado',
    'los resultados de tests',
    'el paquete .claw construido',
  ],
  implementation: [
    'el paquete .claw construido (el código generado se conserva)',
  ],
};

export function RewindButton({ projectId, target, label }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const rewindProject = useStudioStore((s) => s.rewindProject);

  async function confirm() {
    setBusy(true);
    try {
      await rewindProject(projectId, target);
      toast.success(`Proyecto rebobinado a "${target}"`);
      // Drop the ?phase= query param so the page re-renders in edit
      // mode against the new (lower) status. Use replace so the back
      // button doesn't take the user to the now-invalid past view.
      setSearchParams({}, { replace: true });
      // Light navigation kick to make sure ProjectDetailPage refetches
      // (the store update already triggered a re-render, but this also
      // resets any local component state).
      navigate(`/studio/${projectId}`, { replace: true });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rewind failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={triggerStyle}
        title={`Rewind to ${target}`}
      >
        <Rewind size={12} /> {label ?? 'Rewind aquí para editar'}
      </button>

      {open && (
        <div style={overlayStyle} onClick={() => !busy && setOpen(false)}>
          <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
            <div style={dialogHeader}>
              <AlertTriangle size={16} style={{ color: 'var(--amber)' }} />
              <h3 style={{ fontSize: '0.9375rem', margin: 0, color: 'var(--text)', flex: 1 }}>
                Rewind a "{target}"
              </h3>
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                style={iconBtn}
              >
                <X size={14} />
              </button>
            </div>

            <p style={{ margin: '0 0 8px', fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              Esta acción es <strong>destructiva e irreversible</strong>. Al rebobinar a esta fase se borrará:
            </p>

            <ul style={{
              margin: '0 0 12px', paddingLeft: 18,
              fontSize: '0.75rem', color: 'var(--text)', lineHeight: 1.6,
            }}>
              {CLEARED_BY_TARGET[target].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <p style={{ margin: '0 0 16px', fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Solo el alcance, los documentos generados hasta esta fase y los datos del proyecto se conservan.
              Tras rebobinar podrás regenerar las fases siguientes o aceptarlas tal como estaban.
            </p>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                style={cancelBtn}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                style={confirmBtn(busy)}
              >
                {busy
                  ? <><Loader2 size={12} className="animate-spin" /> Rebobinando…</>
                  : <><Rewind size={12} /> Sí, rebobinar</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

const triggerStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px',
  background: 'transparent',
  border: '1px solid var(--amber)',
  color: 'var(--amber)',
  borderRadius: 'var(--radius-md)',
  fontSize: '0.75rem', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 100,
  background: 'color-mix(in srgb, #000 60%, transparent)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16,
};
const dialogStyle: React.CSSProperties = {
  maxWidth: 480, width: '100%',
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
const iconBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
  padding: 4, background: 'transparent',
  border: 'none', color: 'var(--text-dim)', cursor: 'pointer',
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
const confirmBtn = (busy: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px',
  background: 'var(--amber)', color: '#000',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: '0.75rem', fontWeight: 600,
  cursor: busy ? 'wait' : 'pointer',
  fontFamily: 'var(--font-sans)',
});
