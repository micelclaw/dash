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

import { FileText } from 'lucide-react';
import type { InventoryItem } from '@/modules/inventory/types';
import { useI18n } from '@/i18n';
import { sectionLabel } from './drawer-ui';

/** Lista de documentos adjuntos del item (descarga vía files API). */
export function FilesSection({ item }: { item: InventoryItem }) {
  const { t } = useI18n();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={sectionLabel}>{t('inventory.drawer.files')}</span>
      {(item.file_ids ?? []).length === 0 ? (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{t('inventory.drawer.noFiles')}</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(item.file_ids ?? []).map(fid => (
            <div
              key={fid}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <FileText size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              <span
                style={{
                  flex: 1,
                  fontSize: '0.75rem',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-mono, monospace)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {fid}
              </span>
              <button
                onClick={() => window.open(`/api/v1/files/${fid}/download`)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--amber)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: 0,
                }}
              >
                Open
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
