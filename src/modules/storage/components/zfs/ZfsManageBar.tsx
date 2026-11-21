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

// ─── Barra de acciones de creación (botones + hosting de modales) ──

import { useState } from 'react';
import { useStorageStore } from '@/stores/storage.store';
import { useI18n } from '@/i18n';
import { InfoTip } from '../ZfsHelp';
import { ZfsButton } from './ZfsModal';
import { CreatePoolWizard } from './CreatePoolWizard';
import { CreateDatasetForm } from './CreateDatasetForm';
import { CreateZvolForm } from './CreateZvolForm';

export function ZfsManageBar() {
  const caps = useStorageStore((s) => s.zfs_capabilities);
  const { t } = useI18n();
  const [open, setOpen] = useState<null | 'pool' | 'dataset' | 'zvol'>(null);
  if (!caps) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {caps.can_create_pool && (
        <ZfsButton primary onClick={() => setOpen('pool')}>
          {t('storage.manage.createPool')}
          <span style={{ marginLeft: 4 }}><InfoTip text={t('storage.manage.createPoolHint')} /></span>
        </ZfsButton>
      )}
      {caps.can_create_dataset && (
        <ZfsButton onClick={() => setOpen('dataset')}>
          {t('storage.manage.dataset')}
          <span style={{ marginLeft: 4 }}><InfoTip text={t('storage.manage.datasetHint')} /></span>
        </ZfsButton>
      )}
      {caps.can_create_zvol && (
        <ZfsButton onClick={() => setOpen('zvol')}>
          {t('storage.manage.zvol')}
          <span style={{ marginLeft: 4 }}><InfoTip text={t('storage.manage.zvolHint')} /></span>
        </ZfsButton>
      )}
      {open === 'pool' && <CreatePoolWizard onClose={() => setOpen(null)} />}
      {open === 'dataset' && <CreateDatasetForm onClose={() => setOpen(null)} />}
      {open === 'zvol' && <CreateZvolForm onClose={() => setOpen(null)} />}
    </div>
  );
}
