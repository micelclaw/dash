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

// ─── Modal: añadir caché SSD a un pool existente (desde la PoolCard) ──

import { useState } from 'react';
import { toast } from 'sonner';
import { Zap } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { SectionIntro, ZFS_COPY } from '../ZfsHelp';
import { ZfsModal, ZfsButton, Field, WarnBox, DiskPickList, useAvailableDisks } from './ZfsModal';

export function AddCacheForm({ pool, onClose }: { pool: string; onClose: () => void }) {
  const demo = useStorageStore((s) => s.zfs_demo);
  const addCache = useStorageStore((s) => s.zfsAddCache);
  const [kind, setKind] = useState<'cache' | 'log' | 'special'>('cache');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const available = useAvailableDisks();

  const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const KINDS = [
    { id: 'cache' as const, label: 'Caché de lectura (L2ARC)', desc: 'Acelera leer datos frecuentes. Lo más seguro: se puede quitar sin riesgo.' },
    { id: 'log' as const, label: 'Log de escritura (SLOG)', desc: 'Acelera escrituras síncronas. Conviene ponerlo en espejo (2 SSD).' },
    { id: 'special' as const, label: 'Metadatos (special)', desc: 'Acelera todo guardando metadatos en SSD. PERMANENTE: si lo pierdes sin espejo, pierdes el pool.' },
  ];
  const current = KINDS.find((k) => k.id === kind)!;
  const needsMirrorWarn = (kind === 'log' || kind === 'special') && picked.length < 2;

  const submit = async () => {
    setBusy(true);
    try {
      await addCache(pool, kind, picked);
      toast.success(`Caché añadida a "${pool}"${demo ? ' (demo)' : ''}`);
      onClose();
    } catch (e) {
      toast.error(`No se pudo añadir la caché: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  };

  return (
    <ZfsModal title={`Añadir caché SSD a "${pool}"`} icon={<Zap size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><ZfsButton onClick={onClose}>Cancelar</ZfsButton><ZfsButton primary disabled={busy || picked.length === 0} onClick={submit}>{busy ? 'Añadiendo…' : 'Añadir caché'}</ZfsButton></>}>
      <SectionIntro>{ZFS_COPY.cache}</SectionIntro>
      <div>
        <Field hint="Cada tipo de caché acelera algo distinto. Empieza por la de lectura (L2ARC), que es la más segura.">
          Tipo de caché
        </Field>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {KINDS.map((k) => {
            const sel = kind === k.id;
            return (
              <label key={k.id} style={{
                display: 'flex', flexDirection: 'column', gap: 4, padding: 12,
                border: `1px solid ${sel ? 'var(--mod-storage, var(--accent))' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                background: sel ? 'color-mix(in srgb, var(--mod-storage) 8%, transparent)' : 'transparent',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="radio" name="cachekind" checked={sel} onChange={() => setKind(k.id)} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{k.label}</span>
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5, paddingLeft: 24 }}>{k.desc}</span>
              </label>
            );
          })}
        </div>
      </div>
      <div>
        <Field hint="Elige los SSD que quieres dedicar a esta caché. No se borrarán los datos del pool; estos SSD se reservan para la caché.">
          Discos SSD para «{current.label}»
        </Field>
        <DiskPickList disks={available} picked={picked} onToggle={toggle} />
      </div>
      {needsMirrorWarn && (
        <WarnBox>
          Para «{current.label}» se recomienda usar 2 SSD en espejo: si el dispositivo falla sin redundancia, puedes
          perder escrituras recientes{kind === 'special' ? ' o incluso todo el pool' : ''}.
        </WarnBox>
      )}
    </ZfsModal>
  );
}
