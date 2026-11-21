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

// ─── Modal: instantánea (snapshot) de un dataset ───────────────────

import { useState } from 'react';
import { toast } from 'sonner';
import { Camera } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { SectionIntro } from '../ZfsHelp';
import { ZfsModal, ZfsButton, ZfsInput, Field } from './ZfsModal';
import { useI18n } from '@/i18n';

export function CreateSnapshotForm({ target, onClose }: { target: string; onClose: () => void }) {
  const { t } = useI18n();
  const create = useStorageStore((s) => s.zfsCreateSnapshot);
  const demo = useStorageStore((s) => s.zfs_demo);
  const [snap, setSnap] = useState('manual-' + new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await create(target, snap); toast.success(t('storage.snapshot.created', { target, name: snap, demo: demo ? t('storage.common.demoSuffix') : '' })); onClose(); }
    catch (e) { toast.error(t('storage.snapshot.createError', { error: e instanceof Error ? e.message : String(e) })); } finally { setBusy(false); }
  };
  return (
    <ZfsModal title={t('storage.snapshot.title', { target })} icon={<Camera size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><ZfsButton onClick={onClose}>{t('storage.common.cancel')}</ZfsButton><ZfsButton primary disabled={busy || !snap} onClick={submit}>{busy ? t('storage.common.creating') : t('storage.snapshot.create')}</ZfsButton></>}>
      <SectionIntro>
        {t('storage.snapshot.intro')}
      </SectionIntro>
      <div>
        <Field hint={t('storage.snapshot.nameHint')}>{t('storage.snapshot.name')}</Field>
        <ZfsInput aria-label={t('storage.snapshot.name')} value={snap} onChange={(e) => setSnap(e.target.value)} />
      </div>
    </ZfsModal>
  );
}
