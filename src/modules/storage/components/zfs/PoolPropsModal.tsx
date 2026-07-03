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

// ─── Modal: propiedades del pool (autotrim + comentario + features/upgrade) ─

import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowUpCircle, Settings2 } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import type { ZfsPoolObservation } from '../../types';
import { InfoTip, ZFS_COPY } from '../ZfsHelp';
import { ZfsModal, ZfsButton, ZfsInput, Field } from './ZfsModal';

export function PoolPropsModal({ pool, onClose }: { pool: ZfsPoolObservation; onClose: () => void }) {
  const demo = useStorageStore((s) => s.zfs_demo);
  const setProp = useStorageStore((s) => s.zfsSetPoolProp);
  const setAutotrim = useStorageStore((s) => s.zfsSetAutotrim);
  const upgrade = useStorageStore((s) => s.zfsUpgradePool);
  const [autotrim, setAutotrimLocal] = useState(pool.autotrim === 'on');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const features = pool.features ?? [];
  const inactive = features.filter((f) => !f.active);

  const onToggleAutotrim = async (on: boolean) => {
    setAutotrimLocal(on);
    try { await setAutotrim(pool.name, on); toast.success(`TRIM automático ${on ? 'activado' : 'desactivado'}${demo ? ' (demo)' : ''}`); }
    catch (e) { setAutotrimLocal(!on); toast.error(`No se pudo cambiar el TRIM automático: ${e instanceof Error ? e.message : String(e)}`); }
  };

  const onSaveComment = async () => {
    if (!comment.trim()) return;
    setBusy(true);
    try { await setProp(pool.name, 'comment', comment.trim()); toast.success(`Comentario guardado${demo ? ' (demo)' : ''}`); }
    catch (e) { toast.error(`No se pudo guardar el comentario: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setBusy(false); }
  };

  const onUpgrade = async () => {
    setBusy(true);
    try { await upgrade(pool.name); toast.success(`Funciones del pool actualizadas${demo ? ' (demo)' : ''}`); }
    catch (e) { toast.error(`No se pudo actualizar el pool: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setBusy(false); }
  };

  return (
    <ZfsModal title={`Propiedades de "${pool.name}"`} icon={<Settings2 size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<ZfsButton primary onClick={onClose}>Cerrar</ZfsButton>}>
      {/* ashift (informativo, no editable) */}
      <div>
        <Field hint={ZFS_COPY.ashift}>Tamaño de bloque (ashift)</Field>
        <div style={{ fontSize: '0.875rem', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>
          {pool.ashift != null ? `${pool.ashift} (bloques de ${2 ** (pool.ashift) >= 1024 ? `${2 ** pool.ashift / 1024} KB` : `${2 ** pool.ashift} B`})` : '—'}
          <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-sans)', marginLeft: 8, fontSize: '0.75rem' }}>fijado al crear el pool</span>
        </div>
      </div>

      {/* autotrim TOGGLE */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
        <input type="checkbox" checked={autotrim} onChange={(e) => onToggleAutotrim(e.target.checked)} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>TRIM automático</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>{ZFS_COPY.autotrim}</div>
        </div>
      </label>

      {/* comentario */}
      <div>
        <Field hint="Un texto libre para anotar para qué usas este almacén (p. ej. «copias de seguridad de la oficina»). Es solo informativo.">
          Comentario
        </Field>
        <div style={{ display: 'flex', gap: 8 }}>
          <ZfsInput style={{ flex: 1 }} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Anotación para este almacén" />
          <ZfsButton primary disabled={busy || !comment.trim()} onClick={onSaveComment}>Guardar</ZfsButton>
        </div>
      </div>

      {/* features + upgrade */}
      <div>
        <Field hint={ZFS_COPY.features}>Funciones del almacén</Field>
        {features.length === 0 ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>No hay información de funciones para este almacén.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {features.map((f) => (
              <span key={f.name} style={{
                fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 'var(--radius-pill, 999px)',
                border: '1px solid var(--border)', fontFamily: 'var(--font-mono, monospace)',
                background: f.active ? 'color-mix(in srgb, var(--success, #22c55e) 12%, transparent)' : 'transparent',
                color: f.active ? 'var(--success, #22c55e)' : 'var(--text-dim)',
              }} title={f.active ? 'Activa' : 'Inactiva (puede activarse al actualizar)'}>
                {f.active ? '● ' : '○ '}{f.name}
              </span>
            ))}
          </div>
        )}
        <ZfsButton disabled={busy || inactive.length === 0} onClick={onUpgrade}>
          <ArrowUpCircle size={14} style={{ marginRight: 6 }} />
          {inactive.length > 0 ? `Actualizar funciones (${inactive.length} nuevas)` : 'Todo actualizado'}
          <span style={{ marginLeft: 4 }}><InfoTip text={ZFS_COPY.upgrade} /></span>
        </ZfsButton>
      </div>
    </ZfsModal>
  );
}
