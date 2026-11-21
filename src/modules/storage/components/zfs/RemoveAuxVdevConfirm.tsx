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

// ─── Modal: quitar un vdev auxiliar (caché/log) ───────────────────
// Destructivo en el sentido de quitar aceleración: aviso ámbar + confirmar.

import { useState } from 'react';
import { toast } from 'sonner';
import { Zap } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { SectionIntro } from '../ZfsHelp';
import { ZfsModal, ZfsButton, WarnBox } from './ZfsModal';
import { useI18n } from '@/i18n';

export function RemoveAuxVdevConfirm({ pool, vdevName, vdevLabel, onClose }: { pool: string; vdevName: string; vdevLabel: string; onClose: () => void }) {
  const { t } = useI18n();
  const demo = useStorageStore((s) => s.zfs_demo);
  const removeAux = useStorageStore((s) => s.zfsRemoveAuxVdev);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await removeAux(pool, vdevName);
      toast.success(t('storage.aux.removed', { device: vdevLabel, pool, demo: demo ? t('storage.common.demoSuffix') : '' }));
      onClose();
    } catch (e) {
      toast.error(t('storage.aux.removeError', { error: e instanceof Error ? e.message : String(e) }));
    } finally { setBusy(false); }
  };
  return (
    <ZfsModal title={t('storage.aux.removeTitle', { device: vdevLabel, pool })} icon={<Zap size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><ZfsButton onClick={onClose}>{t('storage.common.cancel')}</ZfsButton><ZfsButton danger disabled={busy} onClick={submit}>{busy ? t('storage.aux.removeBusy') : t('storage.aux.remove')}</ZfsButton></>}>
      <WarnBox>{t('storage.aux.removeWarning')}</WarnBox>
      <SectionIntro>{t('storage.help.cache')}</SectionIntro>
    </ZfsModal>
  );
}
