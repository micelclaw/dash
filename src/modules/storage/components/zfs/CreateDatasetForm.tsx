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

// ─── Modal: nueva carpeta gestionada (dataset) ─────────────────────

import { useState } from 'react';
import { toast } from 'sonner';
import { Database } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { SectionIntro, InfoTip } from '../ZfsHelp';
import { ZfsModal, ZfsButton, ZfsInput, Field, selectStyle } from './ZfsModal';
import { useI18n } from '@/i18n';

export function CreateDatasetForm({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const create = useStorageStore((s) => s.zfsCreateDataset);
  const demo = useStorageStore((s) => s.zfs_demo);
  const [name, setName] = useState('tank/');
  const [compression, setCompression] = useState('lz4');
  const [quota, setQuota] = useState('');
  const [encrypt, setEncrypt] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await create({ name, compression, refquota_gb: quota ? Number(quota) : undefined, encrypt }); toast.success(t('storage.dataset.created', { name, demo: demo ? t('storage.common.demoSuffix') : '' })); onClose(); }
    catch (e) { toast.error(t('storage.dataset.createError', { error: e instanceof Error ? e.message : String(e) })); } finally { setBusy(false); }
  };
  return (
    <ZfsModal title={t('storage.dataset.title')} icon={<Database size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><ZfsButton onClick={onClose}>{t('storage.common.cancel')}</ZfsButton><ZfsButton primary disabled={busy || !name.includes('/')} onClick={submit}>{busy ? t('storage.common.creating') : t('storage.common.create')}</ZfsButton></>}>
      <SectionIntro>{t('storage.help.dataset')}</SectionIntro>
      <div>
        <Field hint={t('storage.dataset.nameHint')}>{t('storage.dataset.name')}</Field>
        <ZfsInput aria-label={t('storage.dataset.name')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('storage.dataset.namePlaceholder')} />
      </div>
      <div>
        <Field hint={t('storage.dataset.compressionHint')}>{t('storage.dataset.compression')}</Field>
        <select style={selectStyle} value={compression} onChange={(e) => setCompression(e.target.value)}>
          <option value="lz4">{t('storage.dataset.lz4')}</option>
          <option value="zstd">{t('storage.dataset.zstd')}</option>
          <option value="off">{t('storage.dataset.off')}</option>
        </select>
      </div>
      <div>
        <Field hint={t('storage.dataset.quotaHint')}>{t('storage.dataset.quota')}</Field>
        <ZfsInput type="number" value={quota} onChange={(e) => setQuota(e.target.value)} placeholder="500" />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
        <input type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} />
        {t('storage.dataset.encrypt')}
        <InfoTip text={t('storage.dataset.encryptHint')} />
      </label>
    </ZfsModal>
  );
}
