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

// ─── Modal: añadir disco de repuesto (hot spare) al pool ──────────
// Reusa la plantilla de AddCacheForm: elige uno o más discos libres → store.zfsAddSpare.

import { useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { SectionIntro } from '../ZfsHelp';
import { ZfsModal, ZfsButton, Field, DiskPickList, useAvailableDisks } from './ZfsModal';
import { useI18n } from '@/i18n';

export function AddSpareForm({ pool, onClose }: { pool: string; onClose: () => void }) {
  const { t } = useI18n();
  const demo = useStorageStore((s) => s.zfs_demo);
  const addSpare = useStorageStore((s) => s.zfsAddSpare);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const available = useAvailableDisks();

  const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const submit = async () => {
    setBusy(true);
    try {
      await addSpare(pool, picked);
      toast.success(t('storage.spare.added', { pool, demo: demo ? t('storage.common.demoSuffix') : '' }));
      onClose();
    } catch (e) {
      toast.error(t('storage.spare.addError', { error: e instanceof Error ? e.message : String(e) }));
    } finally { setBusy(false); }
  };

  return (
    <ZfsModal title={t('storage.spare.title', { pool })} icon={<ShieldCheck size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><ZfsButton onClick={onClose}>{t('storage.common.cancel')}</ZfsButton><ZfsButton primary disabled={busy || picked.length === 0} onClick={submit}>{busy ? t('storage.spare.adding') : t('storage.spare.add')}</ZfsButton></>}>
      <SectionIntro>{t('storage.help.spare')}</SectionIntro>
      <div>
        <Field hint={t('storage.spare.hint')}>{t('storage.spare.disks')}</Field>
        <DiskPickList disks={available} picked={picked} onToggle={toggle} />
      </div>
    </ZfsModal>
  );
}
