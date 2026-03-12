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

import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Loader2, Shield, X } from 'lucide-react';
import type { ConfirmationRequest } from '../hooks/useMoneroRpc';

interface Props {
  confirmation: ConfirmationRequest;
  onConfirm: () => Promise<unknown>;
  onDismiss: () => void;
}

const RISK_COLORS: Record<string, string> = {
  transfer: '#ef4444',
  dangerous: '#f59e0b',
  mining: '#3b82f6',
};

export function SendConfirmDialog({ confirmation, onConfirm, onDismiss }: Props) {
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(confirmation.expires_in);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSecondsLeft(confirmation.expires_in);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [confirmation]);

  const handleConfirm = async () => {
    setExecuting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err: any) {
      setError(err?.message || 'Execution failed');
      setExecuting(false);
    }
  };

  const expired = secondsLeft <= 0;
  const riskColor = RISK_COLORS[confirmation.risk] ?? '#6b7280';

  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${minutes}:${secs.toString().padStart(2, '0')}`;

  return (
    <div className="mw-confirm-overlay" onClick={onDismiss}>
      <div className="mw-confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="mw-confirm-header">
          <Shield size={16} style={{ color: riskColor }} />
          <span>Confirmation Required</span>
          <div style={{ flex: 1 }} />
          <button className="mw-confirm-close" onClick={onDismiss}><X size={14} /></button>
        </div>

        <div className="mw-confirm-body">
          <div className="mw-confirm-risk" style={{ borderColor: riskColor }}>
            <AlertTriangle size={14} style={{ color: riskColor }} />
            <div>
              <div style={{ fontWeight: 500, color: 'var(--text)' }}>{confirmation.method}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{confirmation.risk_label}</div>
            </div>
          </div>

          <div className="mw-confirm-timer" style={{ color: expired ? '#ef4444' : 'var(--text-muted)' }}>
            {expired ? 'Token expired — dismiss and retry' : `Expires in ${timeStr}`}
          </div>

          {error && (
            <div className="mw-confirm-error">{error}</div>
          )}
        </div>

        <div className="mw-confirm-footer">
          <button className="mw-confirm-btn-cancel" onClick={onDismiss}>Cancel</button>
          <button
            className="mw-confirm-btn-ok"
            style={{ background: riskColor }}
            disabled={executing || expired}
            onClick={handleConfirm}
          >
            {executing ? <><Loader2 size={13} className="spin" /> Executing...</> : 'Confirm'}
          </button>
        </div>
      </div>

      <style>{`
        .mw-confirm-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex;
          align-items: center; justify-content: center; z-index: 100;
        }
        .mw-confirm-dialog {
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md);
          width: 380px; max-width: 90vw; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        .mw-confirm-header {
          display: flex; align-items: center; gap: 8px; padding: 12px 16px;
          border-bottom: 1px solid var(--border); font-size: 13px; font-weight: 500; color: var(--text);
        }
        .mw-confirm-close {
          background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px;
          border-radius: var(--radius-sm);
        }
        .mw-confirm-close:hover { color: var(--text); background: var(--surface-hover); }
        .mw-confirm-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .mw-confirm-risk {
          display: flex; align-items: center; gap: 10px; padding: 10px 12px;
          border: 1px solid; border-radius: var(--radius-sm); background: var(--bg);
        }
        .mw-confirm-timer { font-size: 11px; text-align: center; font-variant-numeric: tabular-nums; }
        .mw-confirm-error {
          font-size: 11px; color: #ef4444; background: rgba(239,68,68,0.08);
          padding: 8px 10px; border-radius: var(--radius-sm);
        }
        .mw-confirm-footer {
          display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px;
          border-top: 1px solid var(--border);
        }
        .mw-confirm-btn-cancel {
          padding: 6px 14px; background: var(--bg); border: 1px solid var(--border);
          border-radius: var(--radius-sm); color: var(--text); cursor: pointer;
          font-size: 12px; font-family: var(--font-sans);
        }
        .mw-confirm-btn-cancel:hover { background: var(--surface-hover); }
        .mw-confirm-btn-ok {
          padding: 6px 14px; border: none; border-radius: var(--radius-sm);
          color: white; cursor: pointer; font-size: 12px; font-family: var(--font-sans);
          display: flex; align-items: center; gap: 6px;
        }
        .mw-confirm-btn-ok:disabled { opacity: 0.5; cursor: not-allowed; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
