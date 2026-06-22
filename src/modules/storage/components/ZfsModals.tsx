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
// módulo (inline-styled). Las acciones por-ítem (scrub/destroy/snapshot/vm) viven
// en ZfsSection; aquí están los formularios de creación + el wizard de pool.

import { useState } from 'react';
import { toast } from 'sonner';
import { X, HardDrive, Boxes, Database, MonitorPlay, Camera } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { DEMO_AVAILABLE_DISKS } from '../zfs-demo';

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};
const modal: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  width: 'min(560px, 100%)', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
};
const head: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)',
};
const body: React.CSSProperties = { padding: 16, display: 'flex', flexDirection: 'column', gap: 12 };
const foot: React.CSSProperties = {
  display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)',
};
const label: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' };
const input: React.CSSProperties = {
  width: '100%', padding: '7px 10px', background: 'var(--bg, var(--surface))', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
};
const btn = (primary?: boolean, danger?: boolean): React.CSSProperties => ({
  padding: '7px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', cursor: 'pointer',
  border: '1px solid var(--border)',
  background: danger ? 'var(--error, #ef4444)' : primary ? 'var(--mod-storage, var(--accent))' : 'transparent',
  color: danger || primary ? '#fff' : 'var(--text)', fontWeight: primary || danger ? 600 : 400,
});

function Modal(props: { title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div style={overlay} onClick={props.onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          {props.icon}
          <strong style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text)' }}>{props.title}</strong>
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

const TOPOLOGIES = [
  { id: 'mirror', label: 'Mirror (espejo)', min: 2, tol: '1 disco por par' },
  { id: 'raidz1', label: 'RAID-Z1', min: 3, tol: '1 disco' },
  { id: 'raidz2', label: 'RAID-Z2 (recomendado)', min: 4, tol: '2 discos' },
  { id: 'raidz3', label: 'RAID-Z3', min: 5, tol: '3 discos' },
];

// ─── Wizard de crear pool (3 pasos: topología → discos → confirmar) ──
function CreatePoolWizard({ onClose }: { onClose: () => void }) {
  const demo = useStorageStore((s) => s.zfs_demo);
  const disksStore = useStorageStore((s) => s.disks);
  const createPool = useStorageStore((s) => s.zfsCreatePool);
  const [step, setStep] = useState(1);
  const [name, setName] = useState('tank');
  const [topology, setTopology] = useState('raidz2');
  const [picked, setPicked] = useState<string[]>([]);
  const [encrypt, setEncrypt] = useState(false);
  const [busy, setBusy] = useState(false);

  const available = demo
    ? DEMO_AVAILABLE_DISKS
    : disksStore.filter((d) => !d.pool).map((d) => ({ by_id: d.serial ? `/dev/disk/by-id/${d.serial}` : d.device, size_bytes: d.size_bytes, model: d.model }));
  const topo = TOPOLOGIES.find((t) => t.id === topology)!;
  const enoughDisks = picked.length >= topo.min;

  const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const submit = async () => {
    setBusy(true);
    try {
      await createPool({ name, topology, disk_by_ids: picked, encrypt });
      toast.success(`Pool "${name}" creado${demo ? ' (demo)' : ''}`);
      onClose();
    } catch (e) {
      toast.error(`No se pudo crear el pool: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  };

  return (
    <Modal title={`Crear pool — paso ${step}/3`} icon={<HardDrive size={16} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={
        <>
          {step > 1 && <button style={btn()} onClick={() => setStep(step - 1)}>Atrás</button>}
          <button style={btn()} onClick={onClose}>Cancelar</button>
          {step < 3 && <button style={btn(true)} disabled={step === 2 && !enoughDisks} onClick={() => setStep(step + 1)}>Siguiente</button>}
          {step === 3 && <button style={btn(true)} disabled={busy || !enoughDisks} onClick={submit}>{busy ? 'Creando…' : 'Crear pool'}</button>}
        </>
      }>
      {step === 1 && (
        <>
          <div><label style={label}>Nombre del pool</label><input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="tank" /></div>
          <div>
            <label style={label}>Topología (redundancia)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {TOPOLOGIES.map((t) => (
                <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, border: `1px solid ${topology === t.id ? 'var(--mod-storage, var(--accent))' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                  <input type="radio" name="topo" checked={topology === t.id} onChange={() => setTopology(t.id)} />
                  <span style={{ flex: 1, fontSize: '0.8125rem' }}>{t.label}</span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>≥{t.min} discos · tolera {t.tol}</span>
                </label>
              ))}
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
            <input type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} /> Cifrar el pool (AES-256-GCM)
          </label>
        </>
      )}
      {step === 2 && (
        <>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Selecciona ≥{topo.min} discos para {topo.label}. Seleccionados: {picked.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {available.length === 0 && <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>No hay discos libres.</div>}
            {available.map((d) => (
              <label key={d.by_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                <input type="checkbox" checked={picked.includes(d.by_id)} onChange={() => toggle(d.by_id)} />
                <span style={{ flex: 1, fontSize: '0.8125rem' }}>{d.model}</span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>{fmtTB(d.size_bytes)}</span>
              </label>
            ))}
          </div>
        </>
      )}
      {step === 3 && (
        <div style={{ fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>Se creará el pool <strong>{name}</strong> ({topo.label}) con <strong>{picked.length}</strong> discos{encrypt ? ', cifrado' : ''}.</div>
          <div style={{ padding: 10, background: 'var(--warning-bg, #f59e0b18)', border: '1px solid var(--warning,#f59e0b)55', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}>
            ⚠ Esto BORRARÁ cualquier dato previo en los {picked.length} discos seleccionados.
            {!demo && ' (Requiere confirmación con token + approval en el backend.)'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
            zpool create {name} {topology} {picked.length} discos
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Formularios simples (dataset / zvol / snapshot / VM) ──────────
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
    <Modal title="Nuevo dataset" icon={<Database size={16} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><button style={btn()} onClick={onClose}>Cancelar</button><button style={btn(true)} disabled={busy || !name.includes('/')} onClick={submit}>{busy ? 'Creando…' : 'Crear'}</button></>}>
      <div><label style={label}>Nombre (pool/ruta)</label><input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="tank/documentos" /></div>
      <div><label style={label}>Compresión</label>
        <select style={input} value={compression} onChange={(e) => setCompression(e.target.value)}>
          <option value="lz4">lz4</option><option value="zstd">zstd</option><option value="off">off</option>
        </select>
      </div>
      <div><label style={label}>Cuota (GB, opcional)</label><input style={input} type="number" value={quota} onChange={(e) => setQuota(e.target.value)} placeholder="500" /></div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
        <input type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} /> Cifrado
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
    <Modal title="Nuevo volumen (zvol)" icon={<Boxes size={16} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><button style={btn()} onClick={onClose}>Cancelar</button><button style={btn(true)} disabled={busy || !name.includes('/') || !Number(size)} onClick={submit}>{busy ? 'Creando…' : 'Crear'}</button></>}>
      <div><label style={label}>Nombre (pool/ruta)</label><input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="tank/vms/win11" /></div>
      <div><label style={label}>Tamaño (GB)</label><input style={input} type="number" value={size} onChange={(e) => setSize(e.target.value)} /></div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
        <input type="checkbox" checked={thin} onChange={(e) => setThin(e.target.checked)} /> Thin provisioning (sin reserva; riesgo de ENOSPC)
      </label>
    </Modal>
  );
}

function CreateVmForm({ onClose }: { onClose: () => void }) {
  const create = useStorageStore((s) => s.zfsCreateVm);
  const zvols = useStorageStore((s) => s.zfs_zvols);
  const demo = useStorageStore((s) => s.zfs_demo);
  const [name, setName] = useState('win11');
  const [vcpus, setVcpus] = useState('4');
  const [mem, setMem] = useState('8192');
  const [disk, setDisk] = useState(zvols[0] ? `/dev/zvol/${zvols[0].name}` : '');
  const [iso, setIso] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await create({ name, vcpus: Number(vcpus), mem_mib: Number(mem), disk_zvol: disk, iso_path: iso || undefined }); toast.success(`VM "claw-${name}" creada${demo ? ' (demo)' : ''}`); onClose(); }
    catch (e) { toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`); } finally { setBusy(false); }
  };
  return (
    <Modal title="Nueva máquina virtual" icon={<MonitorPlay size={16} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><button style={btn()} onClick={onClose}>Cancelar</button><button style={btn(true)} disabled={busy || !name || !disk} onClick={submit}>{busy ? 'Creando…' : 'Crear'}</button></>}>
      <div><label style={label}>Nombre (se prefija claw-)</label><input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="win11" /></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}><label style={label}>vCPUs</label><input style={input} type="number" value={vcpus} onChange={(e) => setVcpus(e.target.value)} /></div>
        <div style={{ flex: 1 }}><label style={label}>Memoria (MiB)</label><input style={input} type="number" value={mem} onChange={(e) => setMem(e.target.value)} /></div>
      </div>
      <div><label style={label}>Disco (zvol)</label>
        <select style={input} value={disk} onChange={(e) => setDisk(e.target.value)}>
          <option value="">— elige un zvol —</option>
          {zvols.map((z) => <option key={z.name} value={`/dev/zvol/${z.name}`}>{z.name}</option>)}
        </select>
      </div>
      <div><label style={label}>ISO de instalación (opcional)</label><input style={input} value={iso} onChange={(e) => setIso(e.target.value)} placeholder="/var/lib/micelclaw/isos/win11.iso" /></div>
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
    <Modal title={`Snapshot de ${target}`} icon={<Camera size={16} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={<><button style={btn()} onClick={onClose}>Cancelar</button><button style={btn(true)} disabled={busy || !snap} onClick={submit}>{busy ? 'Creando…' : 'Crear snapshot'}</button></>}>
      <div><label style={label}>Nombre del snapshot</label><input style={input} value={snap} onChange={(e) => setSnap(e.target.value)} /></div>
    </Modal>
  );
}

// ─── Barra de acciones de creación (botones + hosting de modales) ──
export function ZfsManageBar() {
  const caps = useStorageStore((s) => s.zfs_capabilities);
  const [open, setOpen] = useState<null | 'pool' | 'dataset' | 'zvol' | 'vm'>(null);
  if (!caps) return null;
  const can = (b: boolean) => b;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {can(caps.can_create_pool) && <button style={btn(true)} onClick={() => setOpen('pool')}>+ Crear pool</button>}
      {can(caps.can_create_dataset) && <button style={btn()} onClick={() => setOpen('dataset')}>+ Dataset</button>}
      {can(caps.can_create_zvol) && <button style={btn()} onClick={() => setOpen('zvol')}>+ Zvol</button>}
      {can(caps.can_vm) && <button style={btn()} onClick={() => setOpen('vm')}>+ Máquina virtual</button>}
      {open === 'pool' && <CreatePoolWizard onClose={() => setOpen(null)} />}
      {open === 'dataset' && <CreateDatasetForm onClose={() => setOpen(null)} />}
      {open === 'zvol' && <CreateZvolForm onClose={() => setOpen(null)} />}
      {open === 'vm' && <CreateVmForm onClose={() => setOpen(null)} />}
    </div>
  );
}
