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

// ─── Modal: instantánea (snapshot) de un dataset ───────────────────

import { useState } from 'react';
import { toast } from 'sonner';
import { Camera } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { SectionIntro } from '../ZfsHelp';
import { ZfsModal, ZfsButton, ZfsInput, Field } from './ZfsModal';

export function CreateSnapshotForm({ target, onClose }: { target: string; onClose: () => void }) {
  const create = useStorageStore((s) => s.zfsCreateSnapshot);
  const demo = useStorageStore((s) => s.zfs_demo);
  const [snap, setSnap] = useState('manual-' + new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await create(target, snap); toast.success(`Snapshot ${target}@${snap} creado${demo ? ' (demo)' : ''}`); onClose(); }
    catch (e) { toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`); } finally { setBusy(false); }
  };
  return (
    <ZfsModal title={`Instantánea (snapshot) de ${target}`} icon={<Camera size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><ZfsButton onClick={onClose}>Cancelar</ZfsButton><ZfsButton primary disabled={busy || !snap} onClick={submit}>{busy ? 'Creando…' : 'Crear instantánea'}</ZfsButton></>}>
      <SectionIntro>
        Una instantánea (snapshot) congela el estado de esta carpeta en este instante, casi sin ocupar espacio.
        Si más tarde borras o estropeas archivos, puedes volver a este punto. Es tu red de seguridad ante errores.
      </SectionIntro>
      <div>
        <Field hint="Un nombre que te ayude a recordar este punto en el tiempo (p. ej. antes-de-migrar). Quedará como carpeta@nombre.">
          Nombre de la instantánea
        </Field>
        <ZfsInput value={snap} onChange={(e) => setSnap(e.target.value)} />
      </div>
    </ZfsModal>
  );
}
