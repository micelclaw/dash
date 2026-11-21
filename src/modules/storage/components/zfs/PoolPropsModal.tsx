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

// ─── Modal: propiedades del pool (autotrim + comentario + features/upgrade) ─

import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowUpCircle, Settings2 } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { useI18n } from '@/i18n';
import type { ZfsPoolObservation } from '../../types';
import { InfoTip } from '../ZfsHelp';
import { ZfsModal, ZfsButton, ZfsInput, Field } from './ZfsModal';

export function PoolPropsModal({ pool, onClose }: { pool: ZfsPoolObservation; onClose: () => void }) {
  const demo = useStorageStore((s) => s.zfs_demo);
  const setProp = useStorageStore((s) => s.zfsSetPoolProp);
  const setAutotrim = useStorageStore((s) => s.zfsSetAutotrim);
  const upgrade = useStorageStore((s) => s.zfsUpgradePool);
  const [autotrim, setAutotrimLocal] = useState(pool.autotrim === 'on');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const { t } = useI18n();

  const features = pool.features ?? [];
  const inactive = features.filter((f) => !f.active);

  const onToggleAutotrim = async (on: boolean) => {
    setAutotrimLocal(on);
    try { await setAutotrim(pool.name, on); toast.success(t(on ? 'storage.props.trimOn' : 'storage.props.trimOff', { demo: demo ? t('storage.common.demoSuffix') : '' })); }
    catch (e) { setAutotrimLocal(!on); toast.error(t('storage.props.trimError', { error: e instanceof Error ? e.message : String(e) })); }
  };

  const onSaveComment = async () => {
    if (!comment.trim()) return;
    setBusy(true);
    try { await setProp(pool.name, 'comment', comment.trim()); toast.success(t('storage.props.commentSaved', { demo: demo ? t('storage.common.demoSuffix') : '' })); }
    catch (e) { toast.error(t('storage.props.commentError', { error: e instanceof Error ? e.message : String(e) })); }
    finally { setBusy(false); }
  };

  const onUpgrade = async () => {
    setBusy(true);
    try { await upgrade(pool.name); toast.success(t('storage.props.upgraded', { demo: demo ? t('storage.common.demoSuffix') : '' })); }
    catch (e) { toast.error(t('storage.props.upgradeError', { error: e instanceof Error ? e.message : String(e) })); }
    finally { setBusy(false); }
  };

  return (
    <ZfsModal title={t('storage.props.title', { pool: pool.name })} icon={<Settings2 size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<ZfsButton primary onClick={onClose}>{t('storage.common.close')}</ZfsButton>}>
      {/* ashift (informativo, no editable) */}
      <div>
        <Field hint={t('storage.props.ashiftHint')}>{t('storage.props.ashift')}</Field>
        <div style={{ fontSize: '0.875rem', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>
          {pool.ashift != null ? `${pool.ashift} (bloques de ${2 ** (pool.ashift) >= 1024 ? `${2 ** pool.ashift / 1024} KB` : `${2 ** pool.ashift} B`})` : '—'}
          <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-sans)', marginLeft: 8, fontSize: '0.75rem' }}>{t('storage.props.ashiftFixed')}</span>
        </div>
      </div>

      {/* autotrim TOGGLE */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
        <input type="checkbox" checked={autotrim} onChange={(e) => onToggleAutotrim(e.target.checked)} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{t('storage.props.autotrim')}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>{t('storage.props.autotrimHint')}</div>
        </div>
      </label>

      {/* comentario */}
      <div>
        <Field hint={t('storage.props.commentHint')}>
          {t('storage.props.comment')}
        </Field>
        <div style={{ display: 'flex', gap: 8 }}>
          <ZfsInput aria-label={t('storage.props.comment')} style={{ flex: 1 }} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('storage.props.commentPlaceholder')} />
          <ZfsButton primary disabled={busy || !comment.trim()} onClick={onSaveComment}>{t('storage.props.save')}</ZfsButton>
        </div>
      </div>

      {/* features + upgrade */}
      <div>
        <Field hint={t('storage.props.featuresHint')}>{t('storage.props.features')}</Field>
        {features.length === 0 ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>{t('storage.props.noFeatures')}</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {features.map((f) => (
              <span key={f.name} style={{
                fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 'var(--radius-pill, 999px)',
                border: '1px solid var(--border)', fontFamily: 'var(--font-mono, monospace)',
                background: f.active ? 'color-mix(in srgb, var(--success, #22c55e) 12%, transparent)' : 'transparent',
                color: f.active ? 'var(--success, #22c55e)' : 'var(--text-dim)',
              }} title={t(f.active ? 'storage.props.active' : 'storage.props.inactive')}>
                {f.active ? '● ' : '○ '}{f.name}
              </span>
            ))}
          </div>
        )}
        <ZfsButton disabled={busy || inactive.length === 0} onClick={onUpgrade}>
          <ArrowUpCircle size={14} style={{ marginRight: 6 }} />
          {inactive.length > 0 ? t('storage.props.upgradeCount', { count: inactive.length }) : t('storage.props.upToDate')}
          <span style={{ marginLeft: 4 }}><InfoTip text={t('storage.props.upgradeHint')} /></span>
        </ZfsButton>
      </div>
    </ZfsModal>
  );
}
