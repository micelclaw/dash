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

// ─── TypeToConfirmModal (shared) ────────────────────────────────────
//
// Confirmation modal that requires the user to type a specific word
// (e.g. "SHUTDOWN", "SAVE", "DELETE") before the destructive button
// activates. Industry-standard pattern for ops where a misclick is
// expensive — used by GitHub (delete repo), AWS (terminate instance),
// Stripe (delete account).
//
// Originally inlined in EnergySection (shutdown) and RawConfigPage
// (overwrite openclaw.json). Extracted here so the next destructive
// op (delete user, factory reset, drop database, etc.) can reuse it.

import { useState, useEffect } from 'react';
import { AlertTriangle, X, type LucideIcon } from 'lucide-react';

export interface TypeToConfirmModalProps {
  /** Controls visibility. When false the component renders nothing. */
  open: boolean;
  /** Closes the modal. Called when the user clicks Cancel, the X, or the backdrop. */
  onClose: () => void;
  /** Called when the user has typed the keyword and clicked the action button. */
  onConfirm: () => void;
  /** Heading text (e.g. "Power off the system?", "Overwrite openclaw.json?"). */
  title: string;
  /** Body paragraph explaining what the action does and why it's irreversible. */
  description: React.ReactNode;
  /** Word the user must type (case-insensitive) to enable the action. Default "CONFIRM". */
  requireWord?: string;
  /** Label for the action button (default "Confirm"). */
  confirmLabel?: string;
  /** Label shown while `running` is true (default "Working..."). */
  runningLabel?: string;
  /** When true, the action button shows running state and Cancel is disabled. */
  running?: boolean;
  /** Optional icon to render in the action button (e.g. Power for shutdown). */
  confirmIcon?: LucideIcon;
}

export function TypeToConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  requireWord = 'CONFIRM',
  confirmLabel = 'Confirm',
  runningLabel = 'Working...',
  running = false,
  confirmIcon: ConfirmIcon,
}: TypeToConfirmModalProps) {
  const [typed, setTyped] = useState('');

  // Clear the input when the modal closes so the next time it opens
  // the user starts fresh.
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  if (!open) return null;

  const matched = typed.trim().toUpperCase() === requireWord.toUpperCase();
  const canConfirm = matched && !running;

  return (
    <div
      onClick={() => !running && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(460px, 100%)',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 20,
          fontFamily: 'var(--font-sans)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} style={{ color: '#ef4444' }} />
            <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
              {title}
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={running}
            style={{
              background: 'none', border: 'none',
              cursor: running ? 'not-allowed' : 'pointer',
              color: 'var(--text-dim)', padding: 4, opacity: running ? 0.4 : 1,
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', marginBottom: 14, lineHeight: 1.5 }}>
          {description}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
          Type{' '}
          <code style={{
            padding: '1px 6px', background: 'var(--surface)', borderRadius: 4,
            fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)',
          }}>
            {requireWord.toUpperCase()}
          </code>
          {' '}to confirm:
        </div>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          disabled={running}
          style={{
            width: '100%', height: 34, padding: '0 12px',
            background: 'var(--surface)',
            border: `1px solid ${matched ? '#ef4444' : 'var(--border)'}`,
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text)', fontSize: '0.875rem',
            fontFamily: 'var(--font-mono, monospace)',
            outline: 'none', marginBottom: 16,
            textTransform: 'uppercase',
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={running}
            style={{
              height: 32, padding: '0 14px',
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-dim)',
              fontSize: '0.8125rem', cursor: running ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)', opacity: running ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            style={{
              height: 32, padding: '0 16px',
              background: canConfirm ? '#ef4444' : 'var(--surface)',
              color: canConfirm ? '#fff' : 'var(--text-muted)',
              border: canConfirm ? 'none' : '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem', fontWeight: 600,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-sans)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {ConfirmIcon && <ConfirmIcon size={14} />}
            {running ? runningLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
