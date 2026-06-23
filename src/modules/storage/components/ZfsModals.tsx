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

// ─── ZFS — wizards/forms de escritura (read-write UI) ──────────────
// En modo demo mutan estado local (UX completa visible sin bare-metal). En modo
// real llaman al backend gated (plan→token→apply). Modal inline para casar con el
// módulo (inline-styled). Las acciones por-ítem (scrub/destroy/snapshot) viven
// en ZfsSection; aquí están los formularios de creación + el wizard de pool.
//
// Diseño DIDÁCTICO (feedback del usuario, estilo Synology): cada wizard/modal
// explica en lenguaje llano qué hace y para qué, con <SectionIntro> e <InfoTip>
// por campo, tolerancia a fallos y capacidad útil estimada en vivo.

import { useState } from 'react';
import { toast } from 'sonner';
import { X, HardDrive, Boxes, Database, Camera, Zap, ShieldCheck, Download, Upload, ArrowUpCircle, Settings2, PlugZap } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import type { ZfsPoolObservation } from '../types';
import { DEMO_AVAILABLE_DISKS } from '../zfs-demo';
import { SectionIntro, InfoTip, ZFS_COPY } from './ZfsHelp';

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};
const modal: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  width: 'min(620px, 100%)', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
};
const head: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: '1px solid var(--border)',
};
const body: React.CSSProperties = { padding: 18, display: 'flex', flexDirection: 'column', gap: 16 };
const foot: React.CSSProperties = {
  display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 18px', borderTop: '1px solid var(--border)',
};
const label: React.CSSProperties = {
  fontSize: '0.8125rem', color: 'var(--text-dim)', marginBottom: 6,
  display: 'inline-flex', alignItems: 'center', gap: 5,
};
const input: React.CSSProperties = {
  width: '100%', padding: '9px 12px', background: 'var(--bg, var(--surface))', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'var(--font-sans)',
};
const btn = (primary?: boolean, danger?: boolean): React.CSSProperties => ({
  padding: '9px 16px', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', cursor: 'pointer',
  border: '1px solid var(--border)',
  background: danger ? 'var(--error, #ef4444)' : primary ? 'var(--mod-storage, var(--accent))' : 'transparent',
  color: danger || primary ? '#fff' : 'var(--text)', fontWeight: primary || danger ? 600 : 400,
});

function Field({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label style={label}>
      {children}
      {hint && <InfoTip text={hint} />}
    </label>
  );
}

function Modal(props: { title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div style={overlay} onClick={props.onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          {props.icon}
          <strong style={{ flex: 1, fontSize: '0.9375rem', color: 'var(--text)' }}>{props.title}</strong>
          <button onClick={props.onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}><X size={16} /></button>
        </div>
        <div style={body}>{props.children}</div>
        <div style={foot}>{props.footer}</div>
      </div>
    </div>
  );
}

const TB = 1024 ** 4;
function fmtTB(n: number): string { return `${(n / TB).toFixed(n >= TB ? 1 : 2)} TB`; }

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

interface AvailDisk { by_id: string; size_bytes: number; model: string }

// ─── Wizard de crear pool (4 pasos: nivel → discos → caché → confirmar) ──
function CreatePoolWizard({ onClose }: { onClose: () => void }) {
  const demo = useStorageStore((s) => s.zfs_demo);
  const disksStore = useStorageStore((s) => s.disks);
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

  const available: AvailDisk[] = demo
    ? DEMO_AVAILABLE_DISKS
    : disksStore.filter((d) => !d.pool).map((d) => ({ by_id: d.serial ? `/dev/disk/by-id/${d.serial}` : d.device, size_bytes: d.size_bytes, model: d.model }));

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
    <Modal title={`Crear almacén (pool) — paso ${step} de 4`} icon={<HardDrive size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={
        <>
          {step > 1 && <button style={btn()} onClick={() => setStep(step - 1)}>Atrás</button>}
          <button style={btn()} onClick={onClose}>Cancelar</button>
          {step < 4 && <button style={btn(true)} disabled={step === 2 && !enoughDisks} onClick={() => setStep(step + 1)}>Siguiente</button>}
          {step === 4 && <button style={btn(true)} disabled={busy || !enoughDisks} onClick={submit}>{busy ? 'Creando…' : 'Crear almacén'}</button>}
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
            <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="tank" />
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {available.length === 0 && <div style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>No hay discos libres disponibles.</div>}
            {available.map((d) => {
              const sel = picked.includes(d.by_id);
              return (
                <label key={d.by_id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: 10,
                  border: `1px solid ${sel ? 'var(--mod-storage, var(--accent))' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                }}>
                  <input type="checkbox" checked={sel} onChange={() => toggle(d.by_id)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text)' }}>{d.model}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)', wordBreak: 'break-all' }}>{d.by_id}</div>
                  </div>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)', flexShrink: 0 }}>{fmtTB(d.size_bytes)}</span>
                </label>
              );
            })}
          </div>
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
              {cacheCandidates.length === 0 && <div style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>No quedan discos libres para la caché.</div>}
              {cacheCandidates.map((d) => {
                const sel = cacheDisks.includes(d.by_id);
                return (
                  <label key={d.by_id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: 10,
                    border: `1px solid ${sel ? 'var(--mod-storage, var(--accent))' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  }}>
                    <input type="checkbox" checked={sel} onChange={() => toggleCache(d.by_id)} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text)' }}>{d.model}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)', wordBreak: 'break-all' }}>{d.by_id}</div>
                    </div>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)', flexShrink: 0 }}>{fmtTB(d.size_bytes)}</span>
                  </label>
                );
              })}
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
          <div style={{ padding: 12, background: 'var(--warning-bg, #f59e0b18)', border: '1px solid var(--warning,#f59e0b)55', borderRadius: 'var(--radius-sm)', color: 'var(--text)', lineHeight: 1.5 }}>
            Atención: se BORRARÁ cualquier dato que hubiera en los {picked.length} discos seleccionados{cacheDisks.length ? ` y en los ${cacheDisks.length} de caché` : ''}. Esta acción no se puede deshacer.
            {!demo && ' Requiere confirmación con token + aprobación en el servidor.'}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Modal: añadir caché SSD a un pool existente (desde la PoolCard) ──
export function AddCacheForm({ pool, onClose }: { pool: string; onClose: () => void }) {
  const demo = useStorageStore((s) => s.zfs_demo);
  const disksStore = useStorageStore((s) => s.disks);
  const addCache = useStorageStore((s) => s.zfsAddCache);
  const [kind, setKind] = useState<'cache' | 'log' | 'special'>('cache');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const available: AvailDisk[] = demo
    ? DEMO_AVAILABLE_DISKS
    : disksStore.filter((d) => !d.pool).map((d) => ({ by_id: d.serial ? `/dev/disk/by-id/${d.serial}` : d.device, size_bytes: d.size_bytes, model: d.model }));

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
    <Modal title={`Añadir caché SSD a "${pool}"`} icon={<Zap size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><button style={btn()} onClick={onClose}>Cancelar</button><button style={btn(true)} disabled={busy || picked.length === 0} onClick={submit}>{busy ? 'Añadiendo…' : 'Añadir caché'}</button></>}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {available.length === 0 && <div style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>No hay discos libres disponibles.</div>}
          {available.map((d) => {
            const sel = picked.includes(d.by_id);
            return (
              <label key={d.by_id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: 10,
                border: `1px solid ${sel ? 'var(--mod-storage, var(--accent))' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              }}>
                <input type="checkbox" checked={sel} onChange={() => toggle(d.by_id)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text)' }}>{d.model}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)', wordBreak: 'break-all' }}>{d.by_id}</div>
                </div>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)', flexShrink: 0 }}>{fmtTB(d.size_bytes)}</span>
              </label>
            );
          })}
        </div>
      </div>
      {needsMirrorWarn && (
        <div style={{ padding: 12, background: 'var(--warning-bg, #f59e0b18)', border: '1px solid var(--warning,#f59e0b)55', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
          Para «{current.label}» se recomienda usar 2 SSD en espejo: si el dispositivo falla sin redundancia, puedes
          perder escrituras recientes{kind === 'special' ? ' o incluso todo el pool' : ''}.
        </div>
      )}
    </Modal>
  );
}

// ─── Formularios simples (dataset / zvol / snapshot) ──────────
function CreateDatasetForm({ onClose }: { onClose: () => void }) {
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
    <Modal title="Nueva carpeta gestionada (dataset)" icon={<Database size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><button style={btn()} onClick={onClose}>Cancelar</button><button style={btn(true)} disabled={busy || !name.includes('/')} onClick={submit}>{busy ? 'Creando…' : 'Crear'}</button></>}>
      <SectionIntro>{ZFS_COPY.dataset}</SectionIntro>
      <div>
        <Field hint="El nombre va dentro de un almacén, con la forma almacén/carpeta (p. ej. tank/documentos). Puedes anidar carpetas con más barras.">
          Nombre (almacén/carpeta)
        </Field>
        <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="tank/documentos" />
      </div>
      <div>
        <Field hint="La compresión reduce el espacio que ocupan los datos al vuelo. lz4 es rápida y casi gratis (recomendada). zstd comprime más a cambio de algo más de CPU. off la desactiva.">
          Compresión
        </Field>
        <select style={input} value={compression} onChange={(e) => setCompression(e.target.value)}>
          <option value="lz4">lz4 (recomendada, rápida)</option>
          <option value="zstd">zstd (comprime más)</option>
          <option value="off">off (sin compresión)</option>
        </select>
      </div>
      <div>
        <Field hint="Límite máximo de espacio que puede ocupar esta carpeta, en gigas. Útil para que un tipo de contenido no se coma todo el almacén. Déjalo vacío para sin límite.">
          Cuota (GB, opcional)
        </Field>
        <input style={input} type="number" value={quota} onChange={(e) => setQuota(e.target.value)} placeholder="500" />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
        <input type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} />
        Cifrar esta carpeta
        <InfoTip text="Cifra solo el contenido de esta carpeta en reposo. Útil si quieres proteger datos sensibles aunque el resto del almacén no esté cifrado." />
      </label>
    </Modal>
  );
}

function CreateZvolForm({ onClose }: { onClose: () => void }) {
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
    <Modal title="Nuevo disco virtual (zvol)" icon={<Boxes size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><button style={btn()} onClick={onClose}>Cancelar</button><button style={btn(true)} disabled={busy || !name.includes('/') || !Number(size)} onClick={submit}>{busy ? 'Creando…' : 'Crear'}</button></>}>
      <SectionIntro>{ZFS_COPY.zvol}</SectionIntro>
      <div style={{
        padding: 12, background: 'var(--warning-bg, #f59e0b18)', border: '1px solid var(--warning,#f59e0b)55',
        borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.8125rem', lineHeight: 1.5,
      }}>
        ¿Solo quieres guardar archivos? Entonces NO necesitas un zvol: crea una carpeta gestionada (dataset) en su lugar.
        El zvol solo tiene sentido para dar disco a una máquina virtual o exportarlo por iSCSI.
      </div>
      <div>
        <Field hint="El nombre va dentro de un almacén (p. ej. tank/vms/win11). Lo normal es agruparlos bajo una carpeta como vms.">
          Nombre (almacén/ruta)
        </Field>
        <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="tank/vms/win11" />
      </div>
      <div>
        <Field hint="Tamaño del disco virtual en gigas, tal y como lo verá quien lo use (la VM o el equipo iSCSI).">
          Tamaño (GB)
        </Field>
        <input style={input} type="number" value={size} onChange={(e) => setSize(e.target.value)} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
        <input type="checkbox" checked={thin} onChange={(e) => setThin(e.target.checked)} />
        Aprovisionamiento fino (thin)
        <InfoTip text="Con thin, el disco solo ocupa lo que realmente uses, no su tamaño completo de golpe. Ahorra espacio, pero si el almacén se llena la VM puede fallar (ENOSPC). Sin thin, se reserva todo el tamaño desde el principio." />
      </label>
    </Modal>
  );
}

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
    <Modal title={`Instantánea (snapshot) de ${target}`} icon={<Camera size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><button style={btn()} onClick={onClose}>Cancelar</button><button style={btn(true)} disabled={busy || !snap} onClick={submit}>{busy ? 'Creando…' : 'Crear instantánea'}</button></>}>
      <SectionIntro>
        Una instantánea (snapshot) congela el estado de esta carpeta en este instante, casi sin ocupar espacio.
        Si más tarde borras o estropeas archivos, puedes volver a este punto. Es tu red de seguridad ante errores.
      </SectionIntro>
      <div>
        <Field hint="Un nombre que te ayude a recordar este punto en el tiempo (p. ej. antes-de-migrar). Quedará como carpeta@nombre.">
          Nombre de la instantánea
        </Field>
        <input style={input} value={snap} onChange={(e) => setSnap(e.target.value)} />
      </div>
    </Modal>
  );
}

// ─── Modal: añadir disco de repuesto (hot spare) al pool ──────────
// Reusa la plantilla de AddCacheForm: elige uno o más discos libres → store.zfsAddSpare.
export function AddSpareForm({ pool, onClose }: { pool: string; onClose: () => void }) {
  const demo = useStorageStore((s) => s.zfs_demo);
  const disksStore = useStorageStore((s) => s.disks);
  const addSpare = useStorageStore((s) => s.zfsAddSpare);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const available: AvailDisk[] = demo
    ? DEMO_AVAILABLE_DISKS
    : disksStore.filter((d) => !d.pool).map((d) => ({ by_id: d.serial ? `/dev/disk/by-id/${d.serial}` : d.device, size_bytes: d.size_bytes, model: d.model }));

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
    <Modal title={`Añadir disco de repuesto a "${pool}"`} icon={<ShieldCheck size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><button style={btn()} onClick={onClose}>Cancelar</button><button style={btn(true)} disabled={busy || picked.length === 0} onClick={submit}>{busy ? 'Añadiendo…' : 'Añadir repuesto'}</button></>}>
      <SectionIntro>{ZFS_COPY.spare}</SectionIntro>
      <div>
        <Field hint="Elige los discos que quedarán en reserva. No se borran datos del pool: el repuesto solo entra en juego si un disco del pool falla.">
          Discos libres para repuesto
        </Field>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {available.length === 0 && <div style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>No hay discos libres disponibles.</div>}
          {available.map((d) => {
            const sel = picked.includes(d.by_id);
            return (
              <label key={d.by_id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: 10,
                border: `1px solid ${sel ? 'var(--mod-storage, var(--accent))' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              }}>
                <input type="checkbox" checked={sel} onChange={() => toggle(d.by_id)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text)' }}>{d.model}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)', wordBreak: 'break-all' }}>{d.by_id}</div>
                </div>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)', flexShrink: 0 }}>{fmtTB(d.size_bytes)}</span>
              </label>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal: quitar un vdev auxiliar (caché/log) ───────────────────
// Destructivo en el sentido de quitar aceleración: aviso ámbar + confirmar.
export function RemoveAuxVdevConfirm({ pool, vdevName, vdevLabel, onClose }: { pool: string; vdevName: string; vdevLabel: string; onClose: () => void }) {
  const demo = useStorageStore((s) => s.zfs_demo);
  const removeAux = useStorageStore((s) => s.zfsRemoveAuxVdev);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await removeAux(pool, vdevName);
      toast.success(`«${vdevLabel}» retirado de "${pool}"${demo ? ' (demo)' : ''}`);
      onClose();
    } catch (e) {
      toast.error(`No se pudo quitar el dispositivo: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  };
  return (
    <Modal title={`Quitar «${vdevLabel}» de "${pool}"`} icon={<Zap size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><button style={btn()} onClick={onClose}>Cancelar</button><button style={btn(false, true)} disabled={busy} onClick={submit}>{busy ? 'Quitando…' : 'Quitar dispositivo'}</button></>}>
      <div style={{ padding: 12, background: 'var(--warning-bg, #f59e0b18)', border: '1px solid var(--warning,#f59e0b)55', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
        Vas a retirar el dispositivo de aceleración <strong>«{vdevLabel}»</strong> del almacén <strong>{pool}</strong>.
        El pool seguirá funcionando con todos sus datos, pero perderá esta aceleración hasta que vuelvas a añadir otro.
        No se borra ningún dato.
      </div>
      <SectionIntro>{ZFS_COPY.cache}</SectionIntro>
    </Modal>
  );
}

// ─── Modal: mantenimiento de un disco (offline / online / detach) ─
// El "plan" legible avisa según haya o no redundancia: offline/detach de un
// disco sin redundancia pone los datos en riesgo → aviso ámbar fuerte.
export function DiskMaintenanceModal({
  pool, diskName, action, hasRedundancy, onClose,
}: {
  pool: string; diskName: string; action: 'offline' | 'online' | 'detach'; hasRedundancy: boolean; onClose: () => void;
}) {
  const demo = useStorageStore((s) => s.zfs_demo);
  const diskAction = useStorageStore((s) => s.zfsDiskAction);
  const [busy, setBusy] = useState(false);

  const META = {
    offline: { title: 'Desconectar disco', verb: 'desconectar', copy: ZFS_COPY.offline, danger: !hasRedundancy, btn: 'Desconectar', icon: <PlugZap size={18} style={{ color: 'var(--mod-storage)' }} /> },
    online: { title: 'Reconectar disco', verb: 'reconectar', copy: ZFS_COPY.online, danger: false, btn: 'Reconectar', icon: <PlugZap size={18} style={{ color: 'var(--mod-storage)' }} /> },
    detach: { title: 'Separar disco', verb: 'separar', copy: ZFS_COPY.detach, danger: !hasRedundancy, btn: 'Separar', icon: <PlugZap size={18} style={{ color: 'var(--mod-storage)' }} /> },
  }[action];

  const submit = async () => {
    setBusy(true);
    try {
      await diskAction(pool, diskName, action);
      toast.success(`Disco ${action === 'offline' ? 'desconectado' : action === 'online' ? 'reconectado' : 'separado'}${demo ? ' (demo)' : ''}`);
      onClose();
    } catch (e) {
      toast.error(`No se pudo ${META.verb} el disco: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  };

  return (
    <Modal title={META.title} icon={META.icon} onClose={onClose}
      footer={<><button style={btn()} onClick={onClose}>Cancelar</button><button style={btn(!META.danger, META.danger)} disabled={busy} onClick={submit}>{busy ? 'Aplicando…' : META.btn}</button></>}>
      <SectionIntro>{META.copy}</SectionIntro>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text)', lineHeight: 1.6 }}>
        <div>Almacén: <strong>{pool}</strong></div>
        <div style={{ wordBreak: 'break-all', fontFamily: 'var(--font-mono, monospace)' }}>Disco: <strong>{diskName}</strong></div>
        <div>Acción: <strong>{META.verb}</strong>.</div>
      </div>
      {META.danger ? (
        <div style={{ padding: 12, background: 'var(--warning-bg, #f59e0b18)', border: '1px solid var(--warning,#f59e0b)55', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
          Atención: este disco <strong>no tiene redundancia suficiente</strong> ahora mismo. Si lo {META.verb}s, el almacén
          puede quedar sin protección o con sus datos en riesgo. Asegúrate de tener una copia antes de continuar.
          {!demo && ' Esta operación requiere token + aprobación en el servidor.'}
        </div>
      ) : (
        action !== 'online' && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
            El almacén tiene redundancia suficiente: seguirá funcionando con normalidad mientras este disco está fuera.
            {!demo && ' Esta operación requiere token + aprobación en el servidor.'}
          </div>
        )
      )}
    </Modal>
  );
}

// ─── Modal: propiedades del pool (autotrim + comentario + features/upgrade) ─
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
    <Modal title={`Propiedades de "${pool.name}"`} icon={<Settings2 size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<button style={btn(true)} onClick={onClose}>Cerrar</button>}>
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
          <input style={{ ...input, flex: 1 }} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Anotación para este almacén" />
          <button style={btn(true)} disabled={busy || !comment.trim()} onClick={onSaveComment}>Guardar</button>
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
        <button style={btn()} disabled={busy || inactive.length === 0} onClick={onUpgrade}>
          <ArrowUpCircle size={14} style={{ marginRight: 6 }} />
          {inactive.length > 0 ? `Actualizar funciones (${inactive.length} nuevas)` : 'Todo actualizado'}
          <span style={{ marginLeft: 4 }}><InfoTip text={ZFS_COPY.upgrade} /></span>
        </button>
      </div>
    </Modal>
  );
}

// ─── Modal: exportar pool (desconectar limpio) ────────────────────
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
    <Modal title={`Exportar "${pool}"`} icon={<Download size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><button style={btn()} onClick={onClose}>Cancelar</button><button style={btn(false, true)} disabled={busy} onClick={submit}>{busy ? 'Exportando…' : 'Exportar almacén'}</button></>}>
      <SectionIntro>{ZFS_COPY.export}</SectionIntro>
      <div style={{ padding: 12, background: 'var(--warning-bg, #f59e0b18)', border: '1px solid var(--warning,#f59e0b)55', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
        El almacén <strong>{pool}</strong> dejará de estar disponible en este sistema (sus carpetas se desmontarán). No se
        borra ningún dato: podrás volver a conectarlo con «Importar pool». Asegúrate de que nadie esté usando sus datos.
        {!demo && ' Esta operación requiere token + aprobación en el servidor.'}
      </div>
    </Modal>
  );
}

// ─── Modal: importar pool (reconectar) ────────────────────────────
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
    <Modal title="Importar un almacén (pool)" icon={<Upload size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><button style={btn()} onClick={onClose}>Cancelar</button><button style={btn(true)} disabled={busy || !name.trim()} onClick={submit}>{busy ? 'Importando…' : 'Importar'}</button></>}>
      <SectionIntro>{ZFS_COPY.import_pool}</SectionIntro>
      <div>
        <Field hint="El nombre del almacén que quieres reconectar. Debe coincidir con el nombre con el que se creó/exportó (p. ej. tank, vault).">
          Nombre del almacén
        </Field>
        <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="tank" />
      </div>
    </Modal>
  );
}

// ─── Barra de acciones de creación (botones + hosting de modales) ──
export function ZfsManageBar() {
  const caps = useStorageStore((s) => s.zfs_capabilities);
  const [open, setOpen] = useState<null | 'pool' | 'dataset' | 'zvol'>(null);
  if (!caps) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {caps.can_create_pool && (
        <button style={btn(true)} onClick={() => setOpen('pool')}>
          + Crear almacén
          <span style={{ marginLeft: 4 }}><InfoTip text="Crea un nuevo almacén (pool) juntando varios discos con protección ante fallos. Es el primer paso para usar el NAS." /></span>
        </button>
      )}
      {caps.can_create_dataset && (
        <button style={btn()} onClick={() => setOpen('dataset')}>
          + Carpeta
          <span style={{ marginLeft: 4 }}><InfoTip text="Crea una carpeta gestionada (dataset) con sus propios ajustes de compresión, cuota e instantáneas. Es lo que usarás para organizar tus datos." /></span>
        </button>
      )}
      {caps.can_create_zvol && (
        <button style={btn()} onClick={() => setOpen('zvol')}>
          + Disco virtual
          <span style={{ marginLeft: 4 }}><InfoTip text="Crea un disco virtual (zvol). Solo lo necesitas para máquinas virtuales o iSCSI; para archivos usa una carpeta." /></span>
        </button>
      )}
      {open === 'pool' && <CreatePoolWizard onClose={() => setOpen(null)} />}
      {open === 'dataset' && <CreateDatasetForm onClose={() => setOpen(null)} />}
      {open === 'zvol' && <CreateZvolForm onClose={() => setOpen(null)} />}
    </div>
  );
}
