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

// ─── Modal: exportar pool (desconectar limpio) ────────────────────

import { useState } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { SectionIntro, ZFS_COPY } from '../ZfsHelp';
import { ZfsModal, ZfsButton, WarnBox } from './ZfsModal';

export function ExportPoolConfirm({ pool, onClose }: { pool: string; onClose: () => void }) {
  const demo = useStorageStore((s) => s.zfs_demo);
  const exportPool = useStorageStore((s) => s.zfsExportPool);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await exportPool(pool); toast.success(`Almacén "${pool}" exportado${demo ? ' (demo)' : ''}`); onClose(); }
    catch (e) { toast.error(`No se pudo exportar: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setBusy(false); }
  };
  return (
    <ZfsModal title={`Exportar "${pool}"`} icon={<Download size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><ZfsButton onClick={onClose}>Cancelar</ZfsButton><ZfsButton danger disabled={busy} onClick={submit}>{busy ? 'Exportando…' : 'Exportar almacén'}</ZfsButton></>}>
      <SectionIntro>{ZFS_COPY.export}</SectionIntro>
      <WarnBox>
        El almacén <strong>{pool}</strong> dejará de estar disponible en este sistema (sus carpetas se desmontarán). No se
        borra ningún dato: podrás volver a conectarlo con «Importar pool». Asegúrate de que nadie esté usando sus datos.
        {!demo && ' Esta operación requiere token + aprobación en el servidor.'}
      </WarnBox>
    </ZfsModal>
  );
}
