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

// ─── Barra de acciones de creación (botones + hosting de modales) ──

import { useState } from 'react';
import { useStorageStore } from '@/stores/storage.store';
import { InfoTip } from '../ZfsHelp';
import { ZfsButton } from './ZfsModal';
import { CreatePoolWizard } from './CreatePoolWizard';
import { CreateDatasetForm } from './CreateDatasetForm';
import { CreateZvolForm } from './CreateZvolForm';

export function ZfsManageBar() {
  const caps = useStorageStore((s) => s.zfs_capabilities);
  const [open, setOpen] = useState<null | 'pool' | 'dataset' | 'zvol'>(null);
  if (!caps) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {caps.can_create_pool && (
        <ZfsButton primary onClick={() => setOpen('pool')}>
          + Crear almacén
          <span style={{ marginLeft: 4 }}><InfoTip text="Crea un nuevo almacén (pool) juntando varios discos con protección ante fallos. Es el primer paso para usar el NAS." /></span>
        </ZfsButton>
      )}
      {caps.can_create_dataset && (
        <ZfsButton onClick={() => setOpen('dataset')}>
          + Carpeta
          <span style={{ marginLeft: 4 }}><InfoTip text="Crea una carpeta gestionada (dataset) con sus propios ajustes de compresión, cuota e instantáneas. Es lo que usarás para organizar tus datos." /></span>
        </ZfsButton>
      )}
      {caps.can_create_zvol && (
        <ZfsButton onClick={() => setOpen('zvol')}>
          + Disco virtual
          <span style={{ marginLeft: 4 }}><InfoTip text="Crea un disco virtual (zvol). Solo lo necesitas para máquinas virtuales o iSCSI; para archivos usa una carpeta." /></span>
        </ZfsButton>
      )}
      {open === 'pool' && <CreatePoolWizard onClose={() => setOpen(null)} />}
      {open === 'dataset' && <CreateDatasetForm onClose={() => setOpen(null)} />}
      {open === 'zvol' && <CreateZvolForm onClose={() => setOpen(null)} />}
    </div>
  );
}
