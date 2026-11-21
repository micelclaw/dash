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

// ─── Modal: mantenimiento de un disco (offline / online / detach) ─
// El "plan" legible avisa según haya o no redundancia: offline/detach de un
// disco sin redundancia pone los datos en riesgo → aviso ámbar fuerte.

import { useState } from 'react';
import { toast } from 'sonner';
import { PlugZap } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { useI18n } from '@/i18n';
import { SectionIntro } from '../ZfsHelp';
import { ZfsModal, ZfsButton, WarnBox } from './ZfsModal';

export function DiskMaintenanceModal({
  pool, diskName, action, hasRedundancy, onClose,
}: {
  pool: string; diskName: string; action: 'offline' | 'online' | 'detach'; hasRedundancy: boolean; onClose: () => void;
}) {
  const demo = useStorageStore((s) => s.zfs_demo);
  const diskAction = useStorageStore((s) => s.zfsDiskAction);
  const [busy, setBusy] = useState(false);
  const { t } = useI18n();

  const META = {
    offline: { title: t('storage.diskMaintenance.offlineTitle'), verb: t('storage.diskMaintenance.offlineVerb'), copy: t('storage.diskMaintenance.copyOffline'), danger: !hasRedundancy, btn: t('storage.diskMaintenance.offline'), icon: <PlugZap size={18} style={{ color: 'var(--mod-storage)' }} /> },
    online: { title: t('storage.diskMaintenance.onlineTitle'), verb: t('storage.diskMaintenance.onlineVerb'), copy: t('storage.diskMaintenance.copyOnline'), danger: false, btn: t('storage.diskMaintenance.online'), icon: <PlugZap size={18} style={{ color: 'var(--mod-storage)' }} /> },
    detach: { title: t('storage.diskMaintenance.detachTitle'), verb: t('storage.diskMaintenance.detachVerb'), copy: t('storage.diskMaintenance.copyDetach'), danger: !hasRedundancy, btn: t('storage.diskMaintenance.detach'), icon: <PlugZap size={18} style={{ color: 'var(--mod-storage)' }} /> },
  }[action];

  const submit = async () => {
    setBusy(true);
    try {
      await diskAction(pool, diskName, action);
      toast.success(t(`storage.diskMaintenance.success${action === 'offline' ? 'Offline' : action === 'online' ? 'Online' : 'Detach'}`, { demo: demo ? t('storage.common.demoSuffix') : '' }));
      onClose();
    } catch (e) {
      toast.error(t('storage.diskMaintenance.error', { verb: META.verb, error: e instanceof Error ? e.message : String(e) }));
    } finally { setBusy(false); }
  };

  return (
    <ZfsModal title={META.title} icon={META.icon} onClose={onClose}
      footer={<><ZfsButton onClick={onClose}>{t('storage.common.cancel')}</ZfsButton><ZfsButton primary={!META.danger} danger={META.danger} disabled={busy} onClick={submit}>{busy ? t('storage.diskMaintenance.busy') : META.btn}</ZfsButton></>}>
      <SectionIntro>{META.copy}</SectionIntro>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text)', lineHeight: 1.6 }}>
        <div>{t('storage.diskMaintenance.pool')} <strong>{pool}</strong></div>
        <div style={{ wordBreak: 'break-all', fontFamily: 'var(--font-mono, monospace)' }}>{t('storage.diskMaintenance.disk')} <strong>{diskName}</strong></div>
        <div>{t('storage.diskMaintenance.action')} <strong>{META.verb}</strong>.</div>
      </div>
      {META.danger ? (
        <WarnBox>
          {t('storage.diskMaintenance.noRedundancy')}
          {!demo && t('storage.common.serverApproval')}
        </WarnBox>
      ) : (
        action !== 'online' && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
            {t('storage.diskMaintenance.redundancy')}
            {!demo && t('storage.common.serverApproval')}
          </div>
        )
      )}
    </ZfsModal>
  );
}
