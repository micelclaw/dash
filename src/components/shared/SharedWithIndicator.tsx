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
 * Indicador "compartido con" para paneles de detalle (Drive Details, foto,
 * cabecera de tablero, header de notas, edición de evento): avatares
 * solapados de las personas con acceso + chip Globe si hay enlaces públicos.
 * 0 shares → no renderiza nada. Click → abre la gestión (EntityShareModal
 * con initialSection:'shared' — lo monta el panel anfitrión vía onManage).
 */

import { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { AvatarInitials } from '@/components/shared/AvatarInitials';
import { shareTargetType } from '@/lib/share-payload';
import { listRecordShares, listFileLinks, type RecordShare } from '@/services/shares.service';

interface SharedWithIndicatorProps {
  entityType: string;
  entityId: string;
  /** Abre la gestión (normalmente EntityShareModal initialSection:'shared'). */
  onManage?: () => void;
  /** Bump para refrescar tras mutaciones (onShared del modal). */
  refreshKey?: number;
  /** Máx. avatares visibles (resto = "+N"). */
  max?: number;
  /** file-ish: muestra chip Globe si hay enlaces públicos activos. */
  showLinkChip?: boolean;
}

export function SharedWithIndicator({
  entityType, entityId, onManage, refreshKey = 0, max = 3, showLinkChip = false,
}: SharedWithIndicatorProps) {
  const [shares, setShares] = useState<RecordShare[]>([]);
  const [linkCount, setLinkCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listRecordShares(shareTargetType(entityType), entityId)
      .then(r => { if (!cancelled) setShares(r); })
      .catch(() => { if (!cancelled) setShares([]); });
    if (showLinkChip) {
      listFileLinks(entityId)
        .then(l => { if (!cancelled) setLinkCount(l.length); })
        .catch(() => { if (!cancelled) setLinkCount(0); });
    }
    return () => { cancelled = true; };
  }, [entityType, entityId, refreshKey, showLinkChip]);

  if (shares.length === 0 && linkCount === 0) return null;

  const visible = shares.slice(0, max);
  const extra = shares.length - visible.length;

  return (
    <button
      onClick={onManage}
      title={[
        ...shares.map(s => {
          const name = s.shared_with?.display_name || s.shared_with?.email || 'Usuario';
          return `${name} · ${s.permission === 'edit' ? 'puede editar' : 'solo lectura'}`;
        }),
        ...(linkCount > 0 ? [`${linkCount} enlace${linkCount > 1 ? 's' : ''} público${linkCount > 1 ? 's' : ''}`] : []),
      ].join('\n')}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: 'transparent', border: 'none', padding: 2,
        cursor: onManage ? 'pointer' : 'default',
      }}
    >
      <span style={{ display: 'inline-flex' }}>
        {visible.map((s, i) => {
          const name = s.shared_with?.display_name || s.shared_with?.email || 'Usuario';
          return (
            <span key={s.id} style={{ marginLeft: i === 0 ? 0 : -6, display: 'inline-flex', borderRadius: '50%', boxShadow: '0 0 0 2px var(--card)' }}>
              <AvatarInitials name={name} src={s.shared_with?.avatar_path ?? undefined} size="sm" />
            </span>
          );
        })}
      </span>
      {extra > 0 && (
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
          +{extra}
        </span>
      )}
      {showLinkChip && linkCount > 0 && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '1px 6px', borderRadius: 'var(--radius-full)',
          background: 'var(--surface)', border: '1px solid var(--border)',
          fontSize: '0.6875rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)',
        }}>
          <Globe size={10} /> {linkCount}
        </span>
      )}
    </button>
  );
}
