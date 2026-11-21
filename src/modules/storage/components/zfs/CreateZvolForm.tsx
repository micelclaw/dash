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

// ─── Modal: nuevo disco virtual (zvol) ─────────────────────────────

import { useState } from 'react';
import { toast } from 'sonner';
import { Boxes } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { SectionIntro, InfoTip } from '../ZfsHelp';
import { ZfsModal, ZfsButton, ZfsInput, Field, WarnBox } from './ZfsModal';
import { useI18n } from '@/i18n';

export function CreateZvolForm({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const create = useStorageStore((s) => s.zfsCreateZvol);
  const demo = useStorageStore((s) => s.zfs_demo);
  const [name, setName] = useState('tank/vms/');
  const [size, setSize] = useState('40');
  const [thin, setThin] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await create({ name, volsize_gb: Number(size), thin }); toast.success(t('storage.zvol.created', { name, demo: demo ? t('storage.common.demoSuffix') : '' })); onClose(); }
    catch (e) { toast.error(t('storage.zvol.createError', { error: e instanceof Error ? e.message : String(e) })); } finally { setBusy(false); }
  };
  return (
    <ZfsModal title={t('storage.zvol.title')} icon={<Boxes size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><ZfsButton onClick={onClose}>{t('storage.common.cancel')}</ZfsButton><ZfsButton primary disabled={busy || !name.includes('/') || !Number(size)} onClick={submit}>{busy ? t('storage.common.creating') : t('storage.common.create')}</ZfsButton></>}>
      <SectionIntro>{t('storage.help.zvol')}</SectionIntro>
      <WarnBox>{t('storage.zvol.warning')}</WarnBox>
      <div>
        <Field hint={t('storage.zvol.nameHint')}>{t('storage.zvol.name')}</Field>
        <ZfsInput aria-label={t('storage.zvol.name')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('storage.zvol.namePlaceholder')} />
      </div>
      <div>
        <Field hint={t('storage.zvol.sizeHint')}>{t('storage.zvol.size')}</Field>
        <ZfsInput type="number" value={size} onChange={(e) => setSize(e.target.value)} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
        <input type="checkbox" checked={thin} onChange={(e) => setThin(e.target.checked)} />
        {t('storage.zvol.thin')}
        <InfoTip text={t('storage.zvol.thinHint')} />
      </label>
    </ZfsModal>
  );
}
