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
import { SectionIntro, InfoTip, ZFS_COPY } from '../ZfsHelp';
import { ZfsModal, ZfsButton, ZfsInput, Field, WarnBox } from './ZfsModal';

export function CreateZvolForm({ onClose }: { onClose: () => void }) {
  const create = useStorageStore((s) => s.zfsCreateZvol);
  const demo = useStorageStore((s) => s.zfs_demo);
  const [name, setName] = useState('tank/vms/');
  const [size, setSize] = useState('40');
  const [thin, setThin] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await create({ name, volsize_gb: Number(size), thin }); toast.success(`Zvol "${name}" creado${demo ? ' (demo)' : ''}`); onClose(); }
    catch (e) { toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`); } finally { setBusy(false); }
  };
  return (
    <ZfsModal title="Nuevo disco virtual (zvol)" icon={<Boxes size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><ZfsButton onClick={onClose}>Cancelar</ZfsButton><ZfsButton primary disabled={busy || !name.includes('/') || !Number(size)} onClick={submit}>{busy ? 'Creando…' : 'Crear'}</ZfsButton></>}>
      <SectionIntro>{ZFS_COPY.zvol}</SectionIntro>
      <WarnBox>
        ¿Solo quieres guardar archivos? Entonces NO necesitas un zvol: crea una carpeta gestionada (dataset) en su lugar.
        El zvol solo tiene sentido para dar disco a una máquina virtual o exportarlo por iSCSI.
      </WarnBox>
      <div>
        <Field hint="El nombre va dentro de un almacén (p. ej. tank/vms/win11). Lo normal es agruparlos bajo una carpeta como vms.">
          Nombre (almacén/ruta)
        </Field>
        <ZfsInput value={name} onChange={(e) => setName(e.target.value)} placeholder="tank/vms/win11" />
      </div>
      <div>
        <Field hint="Tamaño del disco virtual en gigas, tal y como lo verá quien lo use (la VM o el equipo iSCSI).">
          Tamaño (GB)
        </Field>
        <ZfsInput type="number" value={size} onChange={(e) => setSize(e.target.value)} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
        <input type="checkbox" checked={thin} onChange={(e) => setThin(e.target.checked)} />
        Aprovisionamiento fino (thin)
        <InfoTip text="Con thin, el disco solo ocupa lo que realmente uses, no su tamaño completo de golpe. Ahorra espacio, pero si el almacén se llena la VM puede fallar (ENOSPC). Sin thin, se reserva todo el tamaño desde el principio." />
      </label>
    </ZfsModal>
  );
}
