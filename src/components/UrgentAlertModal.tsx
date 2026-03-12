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

import { useEffect } from 'react';
import { AlertTriangle, Lightbulb } from 'lucide-react';
import { useDigestStore } from '@/stores/digest.store';

export function UrgentAlertModal() {
  const latestUrgent = useDigestStore((s) => s.latestUrgent);
  const dismissUrgent = useDigestStore((s) => s.dismissUrgent);
  const setPanelOpen = useDigestStore((s) => s.setPanelOpen);

  // Auto-dismiss after 30s
  useEffect(() => {
    if (!latestUrgent) return;
    const timer = setTimeout(() => dismissUrgent(), 30_000);
    return () => clearTimeout(timer);
  }, [latestUrgent, dismissUrgent]);

  if (!latestUrgent) return null;

  const summary = latestUrgent.intelligent_summary || latestUrgent.raw_summary;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismissUrgent}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 'var(--z-modal, 400)' as any,
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(420px, 90vw)',
        background: 'var(--card)',
        border: '1px solid #ef4444',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        zIndex: 'calc(var(--z-modal, 400) + 1)' as any,
        boxShadow: '0 0 40px rgba(239, 68, 68, 0.2)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: 16,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={20} style={{ color: '#ef4444' }} />
          </div>
          <span style={{
            fontSize: '1.0625rem', fontWeight: 600,
            color: '#ef4444', fontFamily: 'var(--font-sans)',
          }}>
            Urgent Alert
          </span>
        </div>

        {/* Body */}
        <div style={{
          fontSize: '0.9375rem', color: 'var(--text)',
          fontFamily: 'var(--font-sans)', lineHeight: 1.6,
          marginBottom: 16,
        }}>
          {summary}
        </div>

        {/* Action suggested */}
        {latestUrgent.action_suggested && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '10px 12px',
            background: 'rgba(212, 160, 23, 0.08)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 16,
          }}>
            <Lightbulb size={16} style={{ color: 'var(--amber)', marginTop: 2, flexShrink: 0 }} />
            <span style={{
              fontSize: '0.8125rem', color: 'var(--amber)',
              fontFamily: 'var(--font-sans)', lineHeight: 1.4,
            }}>
              {latestUrgent.action_suggested}
            </span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={dismissUrgent}
            style={{
              height: 36, padding: '0 16px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-dim)',
              fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
          <button
            onClick={() => {
              dismissUrgent();
              setPanelOpen(true);
            }}
            style={{
              height: 36, padding: '0 16px',
              background: 'var(--amber)',
              color: '#06060a',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem', fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
          >
            Open Briefing
          </button>
        </div>
      </div>
    </>
  );
}
