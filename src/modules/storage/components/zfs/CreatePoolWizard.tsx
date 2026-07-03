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

// ─── Wizard de crear pool (4 pasos: nivel → discos → caché → confirmar) ──

import { useState } from 'react';
import { toast } from 'sonner';
import { HardDrive, Zap } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { SectionIntro, InfoTip, ZFS_COPY } from '../ZfsHelp';
import { ZfsModal, ZfsButton, ZfsInput, Field, WarnBox, DiskPickList, useAvailableDisks, fmtTB } from './ZfsModal';

// Niveles RAID: mínimo de discos, tolerancia a fallos y fórmula de capacidad útil.
// `usable(n, smallest)` estima el espacio aprovechable según el nº de discos elegidos
// (usa el disco más pequeño, como hace ZFS), para mostrarlo en vivo en el wizard.
const TOPOLOGIES = [
  {
    id: 'mirror', label: 'Mirror (espejo)', min: 2, tolText: 'el fallo de 1 disco',
    copy: ZFS_COPY.raid.mirror,
    usable: (_n: number, smallest: number) => smallest, // espejo: capacidad de 1 disco
  },
  {
    id: 'raidz1', label: 'RAID-Z1', min: 3, tolText: 'el fallo de 1 disco',
    copy: ZFS_COPY.raid.raidz1,
    usable: (n: number, smallest: number) => Math.max(0, n - 1) * smallest,
  },
  {
    id: 'raidz2', label: 'RAID-Z2 (recomendado)', min: 4, tolText: 'el fallo de 2 discos a la vez',
    copy: ZFS_COPY.raid.raidz2,
    usable: (n: number, smallest: number) => Math.max(0, n - 2) * smallest,
  },
  {
    id: 'raidz3', label: 'RAID-Z3', min: 5, tolText: 'el fallo de 3 discos a la vez',
    copy: ZFS_COPY.raid.raidz3,
    usable: (n: number, smallest: number) => Math.max(0, n - 3) * smallest,
  },
] as const;

export function CreatePoolWizard({ onClose }: { onClose: () => void }) {
  const demo = useStorageStore((s) => s.zfs_demo);
  const createPool = useStorageStore((s) => s.zfsCreatePool);
  const addCache = useStorageStore((s) => s.zfsAddCache);
  const [step, setStep] = useState(1);
  const [name, setName] = useState('tank');
  const [topology, setTopology] = useState<string>('raidz2');
  const [picked, setPicked] = useState<string[]>([]);
  const [encrypt, setEncrypt] = useState(false);
  const [cacheOpen, setCacheOpen] = useState(false);
  const [cacheDisks, setCacheDisks] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const available = useAvailableDisks();

  const topo = TOPOLOGIES.find((t) => t.id === topology)!;
  const enoughDisks = picked.length >= topo.min;

  // Capacidad útil estimada en vivo según los discos de datos elegidos.
  const pickedDisks = available.filter((d) => picked.includes(d.by_id));
  const smallest = pickedDisks.length ? Math.min(...pickedDisks.map((d) => d.size_bytes)) : 0;
  const rawTotal = pickedDisks.reduce((acc, d) => acc + d.size_bytes, 0);
  const usable = pickedDisks.length ? topo.usable(pickedDisks.length, smallest) : 0;

  // Para la caché solo ofrecemos los discos NO seleccionados como datos.
  const cacheCandidates = available.filter((d) => !picked.includes(d.by_id));

  const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleCache = (id: string) => setCacheDisks((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const submit = async () => {
    setBusy(true);
    try {
      await createPool({ name, topology, disk_by_ids: picked, encrypt });
      if (cacheDisks.length) {
        try { await addCache(name, 'cache', cacheDisks); }
        catch (e) { toast.error(`Pool creado, pero no se pudo añadir la caché: ${e instanceof Error ? e.message : String(e)}`); }
      }
      toast.success(`Pool "${name}" creado${demo ? ' (demo)' : ''}`);
      onClose();
    } catch (e) {
      toast.error(`No se pudo crear el pool: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  };

  const StepDots = () => (
    <div style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
      {[1, 2, 3, 4].map((n) => (
        <span key={n} style={{
          height: 4, flex: 1, borderRadius: 2,
          background: n <= step ? 'var(--mod-storage, var(--accent))' : 'var(--border)',
        }} />
      ))}
    </div>
  );

  return (
    <ZfsModal title={`Crear almacén (pool) — paso ${step} de 4`} icon={<HardDrive size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={
        <>
          {step > 1 && <ZfsButton onClick={() => setStep(step - 1)}>Atrás</ZfsButton>}
          <ZfsButton onClick={onClose}>Cancelar</ZfsButton>
          {step < 4 && <ZfsButton primary disabled={step === 2 && !enoughDisks} onClick={() => setStep(step + 1)}>Siguiente</ZfsButton>}
          {step === 4 && <ZfsButton primary disabled={busy || !enoughDisks} onClick={submit}>{busy ? 'Creando…' : 'Crear almacén'}</ZfsButton>}
        </>
      }>
      <StepDots />

      {/* Paso 1: nivel de protección (RAID) */}
      {step === 1 && (
        <>
          <SectionIntro>{ZFS_COPY.pool}</SectionIntro>
          <div>
            <Field hint="Es el nombre con el que verás este almacén en el sistema. Usa minúsculas, sin espacios (p. ej. tank, datos, nas).">
              Nombre del almacén
            </Field>
            <ZfsInput value={name} onChange={(e) => setName(e.target.value)} placeholder="tank" />
          </div>
          <div>
            <Field hint="El nivel de protección decide cuántos discos pueden fallar a la vez sin que pierdas datos. Más protección reserva más espacio.">
              Nivel de protección (RAID)
            </Field>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.5 }}>{ZFS_COPY.raid.intro}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TOPOLOGIES.map((t) => {
                const sel = topology === t.id;
                return (
                  <label key={t.id} style={{
                    display: 'flex', flexDirection: 'column', gap: 6, padding: 12,
                    border: `1px solid ${sel ? 'var(--mod-storage, var(--accent))' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    background: sel ? 'color-mix(in srgb, var(--mod-storage) 8%, transparent)' : 'transparent',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="radio" name="topo" checked={sel} onChange={() => setTopology(t.id)} />
                      <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{t.label}</span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>≥{t.min} discos · tolera {t.tolText}</span>
                    </span>
                    {sel && <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>{t.copy}</span>}
                  </label>
                );
              })}
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
            <input type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} />
            Cifrar el almacén (AES-256-GCM)
            <InfoTip text="Cifra los datos en reposo: si alguien se lleva los discos, no podrá leerlos sin la clave. Recomendado para datos sensibles. No se puede activar después." />
          </label>
        </>
      )}

      {/* Paso 2: elegir discos de datos */}
      {step === 2 && (
        <>
          <SectionIntro>
            Elige los discos que formarán este almacén. Necesitas al menos <strong>{topo.min}</strong> para {topo.label}.
            Todos sus datos actuales se borrarán al crear el almacén.
          </SectionIntro>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Seleccionados: <strong style={{ color: 'var(--text)' }}>{picked.length}</strong> de {topo.min} mínimos</div>
          <DiskPickList disks={available} picked={picked} onToggle={toggle} />
          {pickedDisks.length > 0 && (
            <div style={{
              padding: 12, borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', color: 'var(--text)',
              background: 'color-mix(in srgb, var(--mod-storage) 8%, var(--surface))', border: '1px solid var(--border)',
            }}>
              Capacidad útil estimada: <strong>{fmtTB(usable)}</strong>
              <span style={{ color: 'var(--text-dim)' }}> (de {fmtTB(rawTotal)} brutos; el resto se reserva para la protección)</span>
            </div>
          )}
        </>
      )}

      {/* Paso 3: acelerar con caché SSD (opcional) */}
      {step === 3 && (
        <>
          <SectionIntro>{ZFS_COPY.cache}</SectionIntro>
          <div
            onClick={() => setCacheOpen((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: cacheOpen ? 'color-mix(in srgb, var(--mod-storage) 6%, transparent)' : 'transparent',
            }}
          >
            <Zap size={15} style={{ color: 'var(--mod-storage)' }} />
            <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>Acelerar con caché SSD (opcional)</span>
            <input type="checkbox" checked={cacheOpen} onChange={() => setCacheOpen((v) => !v)} onClick={(e) => e.stopPropagation()} />
          </div>
          {cacheOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                Elige uno o más SSD para usar como <strong>caché de lectura (L2ARC)</strong>. Acelera leer datos que se
                piden a menudo y puedes quitarlo después sin riesgo. Es lo más seguro para empezar.
              </div>
              <DiskPickList disks={cacheCandidates} picked={cacheDisks} onToggle={toggleCache} emptyText="No quedan discos libres para la caché." />
            </div>
          )}
          {!cacheOpen && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              Puedes saltarte este paso: la caché SSD se puede añadir más tarde desde la tarjeta del almacén.
            </div>
          )}
        </>
      )}

      {/* Paso 4: confirmación con resumen humano + aviso de borrado */}
      {step === 4 && (
        <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionIntro>Revisa el resumen antes de crear el almacén. Esta operación borra los discos elegidos.</SectionIntro>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.6 }}>
            <div>Almacén: <strong>{name}</strong></div>
            <div>Protección: <strong>{topo.label}</strong> — tolera {topo.tolText}.</div>
            <div>Discos de datos: <strong>{picked.length}</strong> ({fmtTB(rawTotal)} brutos).</div>
            <div>Capacidad útil estimada: <strong>{fmtTB(usable)}</strong>.</div>
            <div>Caché SSD: <strong>{cacheDisks.length ? `${cacheDisks.length} disco(s) de lectura` : 'ninguna'}</strong>.</div>
            <div>Cifrado: <strong>{encrypt ? 'sí (AES-256-GCM)' : 'no'}</strong>.</div>
          </div>
          <WarnBox style={{ fontSize: '0.875rem' }}>
            Atención: se BORRARÁ cualquier dato que hubiera en los {picked.length} discos seleccionados{cacheDisks.length ? ` y en los ${cacheDisks.length} de caché` : ''}. Esta acción no se puede deshacer.
            {!demo && ' Requiere confirmación con token + aprobación en el servidor.'}
          </WarnBox>
        </div>
      )}
    </ZfsModal>
  );
}
