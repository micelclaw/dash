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

// ─── FlowMenu ──────────────────────────────────────────────
// Kebab dropdown for FlowCard (grid/list/banner). Surfaces actions
// that previously required opening the editor: delete, run, toggle.
// Delete goes through ConfirmDialog (E14) — accidental clicks on the
// X used to wipe a flow silently.

import { useEffect, useRef, useState } from 'react';
import { MoreVertical, Trash2, Play, Power } from 'lucide-react';
import { toast } from 'sonner';
import { useFlowsStore, type Flow } from '@/stores/flows.store';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

export function FlowMenu({ flow, onAction }: { flow: Flow; onAction?: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const deleteFlow = useFlowsStore((s) => s.deleteFlow);
  const toggleFlow = useFlowsStore((s) => s.toggleFlow);
  const runFlow = useFlowsStore((s) => s.runFlow);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    runFlow(flow.id)
      .then(() => toast.success(`Started "${flow.name}"`))
      .catch((err) => toast.error(err.message));
    onAction?.();
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    toggleFlow(flow.id)
      .then(() => toast.success(flow.enabled ? 'Flow disabled' : 'Flow enabled'))
      .catch((err) => toast.error(err.message));
    onAction?.();
  };

  const handleDelete = () => {
    deleteFlow(flow.id)
      .then(() => toast.success(`Deleted "${flow.name}"`))
      .catch((err) => toast.error(err.message));
    setConfirmDelete(false);
    onAction?.();
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', padding: 2, display: 'flex',
        }}
        title="More actions"
      >
        <MoreVertical size={14} />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            minWidth: 160, zIndex: 10,
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            padding: 4, fontFamily: 'var(--font-sans)',
          }}
        >
          <MenuItem icon={Play} label="Run now" onClick={handleRun} />
          <MenuItem
            icon={Power}
            label={flow.enabled ? 'Disable' : 'Enable'}
            onClick={handleToggle}
          />
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          <MenuItem
            icon={Trash2}
            label="Delete"
            danger
            onClick={(e) => { e.stopPropagation(); setOpen(false); setConfirmDelete(true); }}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title={`Delete "${flow.name}"?`}
        description={
          flow.run_count > 0
            ? `This flow has ${flow.run_count} run${flow.run_count === 1 ? '' : 's'} on record. The runs will stay but the flow won't fire again. This is a soft delete and can be reverted via SQL within 30 days.`
            : 'You can re-create it from a template later — but the cron schedule, webhook secret, and any pending approvals will be lost.'
        }
        confirmLabel="Delete flow"
        variant="danger"
      />
    </div>
  );
}

function MenuItem({ icon: Icon, label, danger, onClick }: {
  icon: typeof Play;
  label: string;
  danger?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '6px 10px',
        background: 'none', border: 'none', cursor: 'pointer',
        color: danger ? 'var(--error)' : 'var(--text)',
        fontSize: 12, textAlign: 'left',
        borderRadius: 4,
        fontFamily: 'var(--font-sans)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}
