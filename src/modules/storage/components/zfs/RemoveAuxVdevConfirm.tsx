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
import { SectionIntro, ZFS_COPY } from '../ZfsHelp';
import { ZfsModal, ZfsButton, WarnBox } from './ZfsModal';

export function RemoveAuxVdevConfirm({ pool, vdevName, vdevLabel, onClose }: { pool: string; vdevName: string; vdevLabel: string; onClose: () => void }) {
  const demo = useStorageStore((s) => s.zfs_demo);
  const removeAux = useStorageStore((s) => s.zfsRemoveAuxVdev);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await removeAux(pool, vdevName);
      toast.success(`«${vdevLabel}» retirado de "${pool}"${demo ? ' (demo)' : ''}`);
      onClose();
    } catch (e) {
      toast.error(`No se pudo quitar el dispositivo: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  };
  return (
    <ZfsModal title={`Quitar «${vdevLabel}» de "${pool}"`} icon={<Zap size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><ZfsButton onClick={onClose}>Cancelar</ZfsButton><ZfsButton danger disabled={busy} onClick={submit}>{busy ? 'Quitando…' : 'Quitar dispositivo'}</ZfsButton></>}>
      <WarnBox>
        Vas a retirar el dispositivo de aceleración <strong>«{vdevLabel}»</strong> del almacén <strong>{pool}</strong>.
        El pool seguirá funcionando con todos sus datos, pero perderá esta aceleración hasta que vuelvas a añadir otro.
        No se borra ningún dato.
      </WarnBox>
      <SectionIntro>{ZFS_COPY.cache}</SectionIntro>
    </ZfsModal>
  );
}
