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
import { SectionIntro, ZFS_COPY } from '../ZfsHelp';
import { ZfsModal, ZfsButton, ZfsInput, Field } from './ZfsModal';

export function ImportPoolModal({ onClose }: { onClose: () => void }) {
  const demo = useStorageStore((s) => s.zfs_demo);
  const importPool = useStorageStore((s) => s.zfsImportPool);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await importPool(name.trim()); toast.success(`Almacén "${name.trim()}" importado${demo ? ' (demo)' : ''}`); onClose(); }
    catch (e) { toast.error(`No se pudo importar: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setBusy(false); }
  };
  return (
    <ZfsModal title="Importar un almacén (pool)" icon={<Upload size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><ZfsButton onClick={onClose}>Cancelar</ZfsButton><ZfsButton primary disabled={busy || !name.trim()} onClick={submit}>{busy ? 'Importando…' : 'Importar'}</ZfsButton></>}>
      <SectionIntro>{ZFS_COPY.import_pool}</SectionIntro>
      <div>
        <Field hint="El nombre del almacén que quieres reconectar. Debe coincidir con el nombre con el que se creó/exportó (p. ej. tank, vault).">
          Nombre del almacén
        </Field>
        <ZfsInput value={name} onChange={(e) => setName(e.target.value)} placeholder="tank" />
      </div>
    </ZfsModal>
  );
}
