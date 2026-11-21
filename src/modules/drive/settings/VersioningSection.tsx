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

import { History } from 'lucide-react';
import { useI18n } from '@/i18n';
import { SnapshotSettingsForm } from './SnapshotSettingsForm';

/**
 * Drive Settings → Versioning. Renders the shared `SnapshotSettingsForm`
 * inline (same form the inspector gear opens in a modal) inside a DSM-style
 * settings card.
 */
export function VersioningSection() {
  const { t } = useI18n();
  return (
    <div style={{ maxWidth: 560 }}>
      <SectionHeader
        title={t('drive.versioning.title')}
        description={t('drive.versioning.description')}
      />
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 20,
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
          fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)',
        }}>
          <History size={15} style={{ color: 'var(--mod-drive)' }} />
          {t('drive.versioning.policy')}
        </div>
        <SnapshotSettingsForm />
      </div>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>{title}</h2>
      <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
        {description}
      </p>
    </div>
  );
}
