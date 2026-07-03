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

// ─── Modal: añadir disco de repuesto (hot spare) al pool ──────────
// Reusa la plantilla de AddCacheForm: elige uno o más discos libres → store.zfsAddSpare.

import { useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { SectionIntro, ZFS_COPY } from '../ZfsHelp';
import { ZfsModal, ZfsButton, Field, DiskPickList, useAvailableDisks } from './ZfsModal';

export function AddSpareForm({ pool, onClose }: { pool: string; onClose: () => void }) {
  const demo = useStorageStore((s) => s.zfs_demo);
  const addSpare = useStorageStore((s) => s.zfsAddSpare);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const available = useAvailableDisks();

  const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const submit = async () => {
    setBusy(true);
    try {
      await addSpare(pool, picked);
      toast.success(`Repuesto añadido a "${pool}"${demo ? ' (demo)' : ''}`);
      onClose();
    } catch (e) {
      toast.error(`No se pudo añadir el repuesto: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  };

  return (
    <ZfsModal title={`Añadir disco de repuesto a "${pool}"`} icon={<ShieldCheck size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><ZfsButton onClick={onClose}>Cancelar</ZfsButton><ZfsButton primary disabled={busy || picked.length === 0} onClick={submit}>{busy ? 'Añadiendo…' : 'Añadir repuesto'}</ZfsButton></>}>
      <SectionIntro>{ZFS_COPY.spare}</SectionIntro>
      <div>
        <Field hint="Elige los discos que quedarán en reserva. No se borran datos del pool: el repuesto solo entra en juego si un disco del pool falla.">
          Discos libres para repuesto
        </Field>
        <DiskPickList disks={available} picked={picked} onToggle={toggle} />
      </div>
    </ZfsModal>
  );
}
