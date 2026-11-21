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

import {
  MEDIA_STATUS_AVAILABLE,
  REQUEST_STATUS,
  type MediaRequest,
} from '@/services/video.service';
import { useI18n } from '@/i18n';

export type RequestDisplayStatus = 'pending' | 'approved' | 'declined' | 'available' | 'unknown';

/** Collapse Jellyseerr request.status + media.status into one display state. */
export function requestDisplayStatus(req: MediaRequest): RequestDisplayStatus {
  if (req.media?.status === MEDIA_STATUS_AVAILABLE) return 'available';
  switch (req.status) {
    case REQUEST_STATUS.pending: return 'pending';
    case REQUEST_STATUS.approved: return 'approved';
    case REQUEST_STATUS.declined: return 'declined';
    default: return 'unknown';
  }
}

const STATUS_STYLES: Record<RequestDisplayStatus, { key: string; color: string }> = {
  pending: { key: 'video.requestPending', color: '#f59e0b' },
  approved: { key: 'video.requestApproved', color: '#3b82f6' },
  declined: { key: 'video.requestDeclined', color: '#ef4444' },
  available: { key: 'video.requestAvailable', color: '#22c55e' },
  unknown: { key: 'video.requestUnknown', color: 'var(--text-muted)' },
};

/** Small colored pill for a Jellyseerr request status. */
export function StatusBadge({ status }: { status: RequestDisplayStatus }) {
  const { t } = useI18n();
  const { key, color } = STATUS_STYLES[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: '0.6875rem',
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        color,
        border: `1px solid ${color}`,
        background: 'transparent',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      {t(key)}
    </span>
  );
}
