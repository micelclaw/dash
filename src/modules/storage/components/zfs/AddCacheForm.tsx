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

// ─── Modal: añadir caché SSD a un pool existente (desde la PoolCard) ──

import { useState } from 'react';
import { toast } from 'sonner';
import { Zap } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { SectionIntro } from '../ZfsHelp';
import { ZfsModal, ZfsButton, Field, WarnBox, DiskPickList, useAvailableDisks } from './ZfsModal';
import { useI18n } from '@/i18n';

export function AddCacheForm({ pool, onClose }: { pool: string; onClose: () => void }) {
  const { t } = useI18n();
  const demo = useStorageStore((s) => s.zfs_demo);
  const addCache = useStorageStore((s) => s.zfsAddCache);
  const [kind, setKind] = useState<'cache' | 'log' | 'special'>('cache');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const available = useAvailableDisks();

  const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const KINDS = [
    { id: 'cache' as const, labelKey: 'storage.cache.read', descKey: 'storage.cache.readDesc' },
    { id: 'log' as const, labelKey: 'storage.cache.log', descKey: 'storage.cache.logDesc' },
    { id: 'special' as const, labelKey: 'storage.cache.special', descKey: 'storage.cache.specialDesc' },
  ];
  const current = KINDS.find((k) => k.id === kind)!;
  const currentLabel = t(current.labelKey);
  const needsMirrorWarn = (kind === 'log' || kind === 'special') && picked.length < 2;

  const submit = async () => {
    setBusy(true);
    try {
      await addCache(pool, kind, picked);
      toast.success(t('storage.cache.added', { pool, demo: demo ? t('storage.common.demoSuffix') : '' }));
      onClose();
    } catch (e) {
      toast.error(t('storage.cache.addError', { error: e instanceof Error ? e.message : String(e) }));
    } finally { setBusy(false); }
  };

  return (
    <ZfsModal title={t('storage.cache.title', { pool })} icon={<Zap size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><ZfsButton onClick={onClose}>{t('storage.common.cancel')}</ZfsButton><ZfsButton primary disabled={busy || picked.length === 0} onClick={submit}>{busy ? t('storage.cache.adding') : t('storage.cache.add')}</ZfsButton></>}>
      <SectionIntro>{t('storage.help.cache')}</SectionIntro>
      <div>
        <Field hint={t('storage.cache.typeHint')}>{t('storage.cache.type')}</Field>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {KINDS.map((k) => {
            const sel = kind === k.id;
            return (
              <label key={k.id} style={{
                display: 'flex', flexDirection: 'column', gap: 4, padding: 12,
                border: `1px solid ${sel ? 'var(--mod-storage, var(--accent))' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                background: sel ? 'color-mix(in srgb, var(--mod-storage) 8%, transparent)' : 'transparent',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="radio" name="cachekind" checked={sel} onChange={() => setKind(k.id)} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{t(k.labelKey)}</span>
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5, paddingLeft: 24 }}>{t(k.descKey)}</span>
              </label>
            );
          })}
        </div>
      </div>
      <div>
        <Field hint={t('storage.cache.diskHint')}>{t('storage.cache.chooseDisks', { kind: currentLabel })}</Field>
        <DiskPickList disks={available} picked={picked} onToggle={toggle} />
      </div>
      {needsMirrorWarn && (
        <WarnBox>
          {t('storage.cache.mirrorWarning', { kind: currentLabel, special: kind === 'special' ? t('storage.cache.specialDataWarning') : '' })}
        </WarnBox>
      )}
    </ZfsModal>
  );
}
