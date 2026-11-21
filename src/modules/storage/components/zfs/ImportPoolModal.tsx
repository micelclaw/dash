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

// ─── Modal: importar pool (reconectar) ────────────────────────────

import { useState } from 'react';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { SectionIntro } from '../ZfsHelp';
import { ZfsModal, ZfsButton, ZfsInput, Field } from './ZfsModal';
import { useI18n } from '@/i18n';

export function ImportPoolModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const demo = useStorageStore((s) => s.zfs_demo);
  const importPool = useStorageStore((s) => s.zfsImportPool);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await importPool(name.trim()); toast.success(t('storage.pool.imported', { name: name.trim(), demo: demo ? t('storage.common.demoSuffix') : '' })); onClose(); }
    catch (e) { toast.error(t('storage.pool.importError', { error: e instanceof Error ? e.message : String(e) })); }
    finally { setBusy(false); }
  };
  return (
    <ZfsModal title={t('storage.pool.importTitle')} icon={<Upload size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><ZfsButton onClick={onClose}>{t('storage.common.cancel')}</ZfsButton><ZfsButton primary disabled={busy || !name.trim()} onClick={submit}>{busy ? t('storage.pool.importBusy') : t('storage.pool.import')}</ZfsButton></>}>
      <SectionIntro>{t('storage.help.importPool')}</SectionIntro>
      <div>
        <Field hint={t('storage.pool.nameHint')}>{t('storage.pool.name')}</Field>
        <ZfsInput aria-label={t('storage.pool.name')} value={name} onChange={(e) => setName(e.target.value)} placeholder="tank" />
      </div>
    </ZfsModal>
  );
}
