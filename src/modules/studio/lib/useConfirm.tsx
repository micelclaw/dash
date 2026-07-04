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

// ─── useConfirm — promise-based confirmation on the shadcn Dialog ────
// B6: replaces the native `window.confirm()` (a jarring OS popup in an
// otherwise polished flow) with a themed dialog. Usage:
//
//   const { confirm, confirmDialog } = useConfirm();
//   const ok = await confirm({ title: '…', body: '…', danger: true });
//   if (!ok) return;
//   …
//   return <>{…}{confirmDialog}</>;

import { useCallback, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive (red). */
  danger?: boolean;
}

interface Pending extends ConfirmOptions {
  resolve: (v: boolean) => void;
}

export function useConfirm(): { confirm: (opts: ConfirmOptions) => Promise<boolean>; confirmDialog: ReactNode } {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => setPending({ ...opts, resolve }));
  }, []);

  const settle = useCallback((v: boolean) => {
    setPending((p) => { p?.resolve(v); return null; });
  }, []);

  const confirmDialog: ReactNode = (
    <Dialog open={pending !== null} onOpenChange={(o) => { if (!o) settle(false); }}>
      {pending && (
        <DialogContent style={{ maxWidth: 440, fontFamily: 'var(--font-sans)' }}>
          <DialogTitle style={{ color: 'var(--text)' }}>{pending.title}</DialogTitle>
          {pending.body && (
            <DialogDescription style={{ marginTop: 8, lineHeight: 1.5 }}>{pending.body}</DialogDescription>
          )}
          <DialogFooter style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => settle(false)} style={cancelBtn}>
              {pending.cancelLabel ?? 'Cancel'}
            </button>
            <button type="button" onClick={() => settle(true)} style={confirmBtn(pending.danger)} autoFocus>
              {pending.confirmLabel ?? 'Confirm'}
            </button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );

  return { confirm, confirmDialog };
}

const cancelBtn: CSSProperties = {
  padding: '7px 14px', fontSize: '0.8125rem', fontWeight: 500,
  fontFamily: 'var(--font-sans)', background: 'transparent',
  color: 'var(--text-dim)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
};

function confirmBtn(danger?: boolean): CSSProperties {
  return {
    padding: '7px 14px', fontSize: '0.8125rem', fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    background: danger ? 'var(--danger)' : 'var(--amber)',
    color: danger ? '#fff' : '#000',
    border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  };
}
