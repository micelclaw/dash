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

// ─── Modal: exportar pool (desconectar limpio) ────────────────────

import { useState } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { SectionIntro } from '../ZfsHelp';
import { ZfsModal, ZfsButton, WarnBox } from './ZfsModal';
import { useI18n } from '@/i18n';

export function ExportPoolConfirm({ pool, onClose }: { pool: string; onClose: () => void }) {
  const { t } = useI18n();
  const demo = useStorageStore((s) => s.zfs_demo);
  const exportPool = useStorageStore((s) => s.zfsExportPool);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await exportPool(pool); toast.success(t('storage.pool.exported', { name: pool, demo: demo ? t('storage.common.demoSuffix') : '' })); onClose(); }
    catch (e) { toast.error(t('storage.pool.exportError', { error: e instanceof Error ? e.message : String(e) })); }
    finally { setBusy(false); }
  };
  return (
    <ZfsModal title={t('storage.pool.exportTitle', { name: pool })} icon={<Download size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><ZfsButton onClick={onClose}>{t('storage.common.cancel')}</ZfsButton><ZfsButton danger disabled={busy} onClick={submit}>{busy ? t('storage.pool.exportBusy') : t('storage.pool.export')}</ZfsButton></>}>
      <SectionIntro>{t('storage.help.exportPool')}</SectionIntro>
      <WarnBox>
        {t('storage.pool.exportWarning')} {!demo && t('storage.pool.approvalWarning')}
      </WarnBox>
    </ZfsModal>
  );
}
