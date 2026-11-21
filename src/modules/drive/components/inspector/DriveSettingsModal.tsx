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
import { X, History, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import type { ApiResponse } from '@/types/api';
import { SnapshotSettingsForm } from '../../settings/SnapshotSettingsForm';
import { useI18n } from '@/i18n';

interface ReconcileResult { created: number; updated: number; removed: number; fixed: number; total: number }

/**
 * "Resincronizar Drive" (Drive-unify F3): reconcilia el índice del módulo con
 * el disco (indexa lo que llegó por fuera, quita fantasmas, corrige rutas
 * legacy). Con el índice-al-escribir del VFS ya casi nunca hace falta — es la
 * red de seguridad manual.
 */
function ReconcileBlock({ onDone }: { onDone?: () => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const res = await api.post<ApiResponse<ReconcileResult>>('/files/reconcile', {});
      const r = res.data;
      toast.success(t('drive.settingsModal.reconcile.toastSuccess', {
        created: r.created,
        removed: r.removed,
        fixed: r.fixed,
      }));
      onDone?.();
    } catch (e) {
      toast.error(`${t('drive.settingsModal.reconcile.toastFailure')}: ${e instanceof Error ? e.message : e}`);
    }
    setBusy(false);
  };
  return (
    <div style={{
      marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    }}>
      <div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text)', fontWeight: 500 }}>{t('drive.settingsModal.reconcile.title')}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {t('drive.settingsModal.reconcile.description')}
        </div>
      </div>
      <button
        onClick={() => void run()}
        aria-label={t('drive.settingsModal.reconcile.action')}
        disabled={busy}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
          background: 'transparent', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
          fontSize: '0.8125rem', cursor: busy ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)',
          whiteSpace: 'nowrap',
        }}
      >
        <RefreshCw size={13} className={busy ? 'animate-spin' : undefined} />
        {busy ? t('drive.settingsModal.reconcile.busy') : t('drive.settingsModal.reconcile.action')}
      </button>
    </div>
  );
}

interface DriveSettingsModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful save. */
  onSaved?: () => void;
}

/**
 * Drive snapshot settings, modal form (D5). Opened from the inspector
 * → Versions gear. The form body lives in the shared `SnapshotSettingsForm`
 * (also rendered inline by Drive Settings → Versioning); this component is
 * just the modal chrome around it.
 */
export function DriveSettingsModal({ open, onClose, onSaved }: DriveSettingsModalProps) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
          width: 460, maxWidth: '92vw', maxHeight: '85vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <h3 style={{
            margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <History size={15} style={{ color: 'var(--mod-drive)' }} />
            {t('drive.settingsModal.title')}
          </h3>
          <button onClick={onClose} aria-label={t('drive.settingsModal.close')} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', padding: 2, display: 'flex',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Body — shared form */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 20px' }}>
          <SnapshotSettingsForm
            onSaved={() => { onSaved?.(); onClose(); }}
            footerExtra={(
              <button
                onClick={onClose}
                style={{
                  padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
                  fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                {t('drive.settingsModal.cancel')}
              </button>
            )}
          />
          <ReconcileBlock onDone={onSaved} />
        </div>
      </div>
    </div>
  );
}
