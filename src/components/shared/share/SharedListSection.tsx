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

/**
 * Sección "Ya compartido" del modal unificado: gestión de lo que ESTE
 * registro ya tiene concedido — personas (cambiar view/edit, revocar).
 * Precursor del panel del Círculo (Ventanas v0).
 */

import { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { AvatarInitials } from '@/components/shared/AvatarInitials';
import {
  updateSharePermission, deleteShare,
  type RecordShare, type SharePermission,
} from '@/services/shares.service';

interface SharedListSectionProps {
  shares: RecordShare[];
  onChanged: () => void;
}

export function SharedListSection({ shares, onChanged }: SharedListSectionProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const handlePermission = useCallback(async (shareId: string, permission: SharePermission) => {
    setBusyId(shareId);
    try {
      await updateSharePermission(shareId, permission);
      toast.success('Permiso actualizado');
      onChanged();
    } catch { toast.error('No se pudo cambiar el permiso'); }
    setBusyId(null);
  }, [onChanged]);

  const handleRevoke = useCallback(async (shareId: string) => {
    setBusyId(shareId);
    try {
      await deleteShare(shareId);
      toast.success('Compartición revocada');
      onChanged();
    } catch { toast.error('No se pudo revocar'); }
    setBusyId(null);
  }, [onChanged]);

  if (shares.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Aún no está compartido con nadie.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {shares.map(s => {
        const name = s.shared_with?.display_name || s.shared_with?.email || 'Usuario';
        return (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--surface)',
            opacity: busyId === s.id ? 0.6 : 1,
          }}>
            <AvatarInitials name={name} src={s.shared_with?.avatar_path ?? undefined} size="sm" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{name}</span>
              {s.shared_with?.email && s.shared_with.email !== name && (
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginLeft: 6 }}>
                  {s.shared_with.email}
                </span>
              )}
            </div>
            <select
              value={s.permission}
              disabled={busyId === s.id}
              onChange={e => void handlePermission(s.id, e.target.value as SharePermission)}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '3px 6px',
                fontSize: '0.6875rem', color: 'var(--text)', fontFamily: 'var(--font-sans)', cursor: 'pointer',
              }}
            >
              <option value="view">Solo lectura</option>
              <option value="edit">Puede editar</option>
            </select>
            <button
              onClick={() => void handleRevoke(s.id)}
              disabled={busyId === s.id}
              title="Revocar"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 2, flexShrink: 0,
              }}
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
