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

import { useState } from 'react';
import { LayoutGrid, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { workboardApi } from './workboard.service';

interface Props {
  /** ¿el plugin ya está enabled en config pero el Gateway aún no lo cargó? */
  enabledPendingReload: boolean;
  availabilityError?: string | null;
  onEnabled: () => void | Promise<unknown>;
}

export function WorkboardBootstrapCard({ enabledPendingReload, availabilityError, onEnabled }: Props) {
  const [busy, setBusy] = useState(false);

  const enable = async () => {
    setBusy(true);
    try {
      await workboardApi.enable();
      toast.success('Workboard habilitado. Comprobando disponibilidad…');
      await onEnabled();
    } catch {
      toast.error('No se pudo activar el Workboard');
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    setBusy(true);
    try { await onEnabled(); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 16px' }}>
      <div style={{
        maxWidth: 460, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        padding: 28, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)',
      }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'var(--bg-subtle, rgba(245,180,60,0.1))' }}>
          <LayoutGrid size={26} style={{ color: 'var(--amber)' }} />
        </div>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text)' }}>Workboard de coordinación</h3>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          Un tablero kanban para coordinar a tus agentes: tareas con <strong>claim / heartbeat / proof</strong>,
          asignables a agentes, separado del Kanban de Proyectos (esto es coordinación de agentes, no tu trabajo).
        </p>

        {availabilityError ? (
          <div role="alert" style={{ display: 'grid', gap: 10, color: 'var(--error)', fontSize: '0.8125rem' }}>
            <span><AlertTriangle size={15} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Error al acceder a Workboard</span>
            <span>{availabilityError}</span>
            <button type="button" disabled={busy} onClick={() => void retry()} style={{ color: 'var(--text)', padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
              {busy ? 'Comprobando…' : 'Reintentar'}
            </button>
          </div>
        ) : enabledPendingReload ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--amber)', marginTop: 4 }}>
            <Loader2 size={15} className="animate-spin" />
            Habilitado, pero aún no disponible en el Gateway. Comprobando…
          </div>
        ) : (
          <button
            onClick={enable}
            disabled={busy}
            style={{
              marginTop: 6, padding: '9px 18px', borderRadius: 9, fontSize: '0.8125rem', fontWeight: 600,
              border: 'none', background: 'var(--amber)', color: '#1a1205', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Activando…' : 'Activar Workboard'}
          </button>
        )}
        <p style={{ margin: 0, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          Plugin nativo de OpenClaw. Tras activar, recarga el Gateway una vez.
        </p>
      </div>
    </div>
  );
}
