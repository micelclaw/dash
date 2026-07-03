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
import { SectionIntro, ZFS_COPY } from '../ZfsHelp';
import { ZfsModal, ZfsButton, WarnBox } from './ZfsModal';

export function DiskMaintenanceModal({
  pool, diskName, action, hasRedundancy, onClose,
}: {
  pool: string; diskName: string; action: 'offline' | 'online' | 'detach'; hasRedundancy: boolean; onClose: () => void;
}) {
  const demo = useStorageStore((s) => s.zfs_demo);
  const diskAction = useStorageStore((s) => s.zfsDiskAction);
  const [busy, setBusy] = useState(false);

  const META = {
    offline: { title: 'Desconectar disco', verb: 'desconectar', copy: ZFS_COPY.offline, danger: !hasRedundancy, btn: 'Desconectar', icon: <PlugZap size={18} style={{ color: 'var(--mod-storage)' }} /> },
    online: { title: 'Reconectar disco', verb: 'reconectar', copy: ZFS_COPY.online, danger: false, btn: 'Reconectar', icon: <PlugZap size={18} style={{ color: 'var(--mod-storage)' }} /> },
    detach: { title: 'Separar disco', verb: 'separar', copy: ZFS_COPY.detach, danger: !hasRedundancy, btn: 'Separar', icon: <PlugZap size={18} style={{ color: 'var(--mod-storage)' }} /> },
  }[action];

  const submit = async () => {
    setBusy(true);
    try {
      await diskAction(pool, diskName, action);
      toast.success(`Disco ${action === 'offline' ? 'desconectado' : action === 'online' ? 'reconectado' : 'separado'}${demo ? ' (demo)' : ''}`);
      onClose();
    } catch (e) {
      toast.error(`No se pudo ${META.verb} el disco: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  };

  return (
    <ZfsModal title={META.title} icon={META.icon} onClose={onClose}
      footer={<><ZfsButton onClick={onClose}>Cancelar</ZfsButton><ZfsButton primary={!META.danger} danger={META.danger} disabled={busy} onClick={submit}>{busy ? 'Aplicando…' : META.btn}</ZfsButton></>}>
      <SectionIntro>{META.copy}</SectionIntro>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text)', lineHeight: 1.6 }}>
        <div>Almacén: <strong>{pool}</strong></div>
        <div style={{ wordBreak: 'break-all', fontFamily: 'var(--font-mono, monospace)' }}>Disco: <strong>{diskName}</strong></div>
        <div>Acción: <strong>{META.verb}</strong>.</div>
      </div>
      {META.danger ? (
        <WarnBox>
          Atención: este disco <strong>no tiene redundancia suficiente</strong> ahora mismo. Si lo {META.verb}s, el almacén
          puede quedar sin protección o con sus datos en riesgo. Asegúrate de tener una copia antes de continuar.
          {!demo && ' Esta operación requiere token + aprobación en el servidor.'}
        </WarnBox>
      ) : (
        action !== 'online' && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
            El almacén tiene redundancia suficiente: seguirá funcionando con normalidad mientras este disco está fuera.
            {!demo && ' Esta operación requiere token + aprobación en el servidor.'}
          </div>
        )
      )}
    </ZfsModal>
  );
}
