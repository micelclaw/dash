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

interface DeleteConfirmDialogProps {
  open: boolean;
  title: string;
  itemName: string;
  details: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

export function DeleteConfirmDialog({ open, title, itemName, details, onConfirm, onCancel, loading }: DeleteConfirmDialogProps) {
  const [typed, setTyped] = useState('');

  if (!open) return null;

  const canConfirm = typed === itemName && !loading;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, margin: 16, padding: 24,
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#f43f5e', fontFamily: 'var(--font-sans)' }}>
          {title}
        </h3>
        <p style={{ margin: '12px 0', fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
          {details}
        </p>
        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginBottom: 6 }}>
          Type <strong style={{ color: 'var(--text)' }}>{itemName}</strong> to confirm:
        </label>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
          style={{
            width: '100%', padding: '8px 10px', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'var(--font-mono, monospace)',
            outline: 'none', boxSizing: 'border-box',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#f43f5e')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '7px 14px', background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            style={{
              padding: '7px 14px', background: canConfirm ? '#f43f5e' : '#3a1a1e',
              border: 'none', borderRadius: 'var(--radius-sm)',
              color: canConfirm ? '#fff' : '#6b3a3a', fontSize: '0.8125rem', fontWeight: 600,
              fontFamily: 'var(--font-sans)', cursor: canConfirm ? 'pointer' : 'default',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
