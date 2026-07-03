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

// ─── Modal: nueva carpeta gestionada (dataset) ─────────────────────

import { useState } from 'react';
import { toast } from 'sonner';
import { Database } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { SectionIntro, InfoTip, ZFS_COPY } from '../ZfsHelp';
import { ZfsModal, ZfsButton, ZfsInput, Field, selectStyle } from './ZfsModal';

export function CreateDatasetForm({ onClose }: { onClose: () => void }) {
  const create = useStorageStore((s) => s.zfsCreateDataset);
  const demo = useStorageStore((s) => s.zfs_demo);
  const [name, setName] = useState('tank/');
  const [compression, setCompression] = useState('lz4');
  const [quota, setQuota] = useState('');
  const [encrypt, setEncrypt] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await create({ name, compression, refquota_gb: quota ? Number(quota) : undefined, encrypt }); toast.success(`Dataset "${name}" creado${demo ? ' (demo)' : ''}`); onClose(); }
    catch (e) { toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`); } finally { setBusy(false); }
  };
  return (
    <ZfsModal title="Nueva carpeta gestionada (dataset)" icon={<Database size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><ZfsButton onClick={onClose}>Cancelar</ZfsButton><ZfsButton primary disabled={busy || !name.includes('/')} onClick={submit}>{busy ? 'Creando…' : 'Crear'}</ZfsButton></>}>
      <SectionIntro>{ZFS_COPY.dataset}</SectionIntro>
      <div>
        <Field hint="El nombre va dentro de un almacén, con la forma almacén/carpeta (p. ej. tank/documentos). Puedes anidar carpetas con más barras.">
          Nombre (almacén/carpeta)
        </Field>
        <ZfsInput value={name} onChange={(e) => setName(e.target.value)} placeholder="tank/documentos" />
      </div>
      <div>
        <Field hint="La compresión reduce el espacio que ocupan los datos al vuelo. lz4 es rápida y casi gratis (recomendada). zstd comprime más a cambio de algo más de CPU. off la desactiva.">
          Compresión
        </Field>
        <select style={selectStyle} value={compression} onChange={(e) => setCompression(e.target.value)}>
          <option value="lz4">lz4 (recomendada, rápida)</option>
          <option value="zstd">zstd (comprime más)</option>
          <option value="off">off (sin compresión)</option>
        </select>
      </div>
      <div>
        <Field hint="Límite máximo de espacio que puede ocupar esta carpeta, en gigas. Útil para que un tipo de contenido no se coma todo el almacén. Déjalo vacío para sin límite.">
          Cuota (GB, opcional)
        </Field>
        <ZfsInput type="number" value={quota} onChange={(e) => setQuota(e.target.value)} placeholder="500" />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
        <input type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} />
        Cifrar esta carpeta
        <InfoTip text="Cifra solo el contenido de esta carpeta en reposo. Útil si quieres proteger datos sensibles aunque el resto del almacén no esté cifrado." />
      </label>
    </ZfsModal>
  );
}
