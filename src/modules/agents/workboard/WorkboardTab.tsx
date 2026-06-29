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
import { Plus, RefreshCw, Loader2 } from 'lucide-react';
import { useWorkboard } from './use-workboard';
import { WorkboardBoard } from './WorkboardBoard';
import { WorkboardBootstrapCard } from './WorkboardBootstrapCard';
import { DiagnosticsBanner } from './DiagnosticsBanner';
import { NewCardModal } from './NewCardModal';
import type { ManagedAgent } from '../types';

interface Props {
  agents: ManagedAgent[];
}

export function WorkboardTab({ agents }: Props) {
  const { status, cards, diagnostics, loading, refreshStatus, loadCards } = useWorkboard();
  const [showNew, setShowNew] = useState(false);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 48, color: 'var(--text-dim)' }}>
        <Loader2 size={16} className="animate-spin" /> Cargando Workboard…
      </div>
    );
  }

  // No activado, o activado pero el Gateway aún no cargó el plugin → bootstrap.
  if (!status?.enabled || !status.reachable) {
    return (
      <WorkboardBootstrapCard
        enabledPendingReload={Boolean(status?.enabled && !status.reachable)}
        onEnabled={refreshStatus}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>Workboard</h3>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>coordinación de agentes</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={loadCards} title="Refrescar" style={{ display: 'inline-flex', alignItems: 'center', padding: 7, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setShowNew(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: 'none', background: 'var(--amber)', color: '#1a1205', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} /> Nueva tarea
          </button>
        </div>
      </div>

      <DiagnosticsBanner diagnostics={diagnostics} />

      {cards.length === 0 && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-subtle, rgba(127,127,127,0.06))', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
          Sin tareas todavía. Crea una con <strong>Nueva tarea</strong>, o un council las generará al cerrar.
          Las columnas de abajo muestran el flujo: por reclamar → en curso → en revisión → hecho.
        </div>
      )}
      <WorkboardBoard cards={cards} agents={agents} onChanged={loadCards} />

      <NewCardModal agents={agents} open={showNew} onClose={() => setShowNew(false)} onCreated={loadCards} />
    </div>
  );
}
