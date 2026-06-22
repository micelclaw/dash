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

// ─── ZFS NAS — sección read-path (Olas 0-6) ────────────────────────
// Muestra capabilities (degradado honesto por plataforma), pools observados
// (salud + vdevs + discos con errores), datasets/zvols/snapshots y VMs. En
// WSL2/read-only el inventario llega vacío y se muestra el motivo del degradado
// en vez de fingir. Las escrituras (wizards de pool/dataset/VM) son gated y
// llegan con bare-metal (diseño §9); aquí solo lectura.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { HardDrive, Boxes, Camera, MonitorPlay, ShieldAlert, ShieldCheck, FlaskConical, Waves, Trash2, Play, Square } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import type { ZfsPoolObservation } from '../types';
import { ZfsManageBar, CreateSnapshotForm } from './ZfsModals';

const actBtn: React.CSSProperties = {
  padding: '3px 8px', fontSize: '0.6875rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)',
  display: 'inline-flex', alignItems: 'center', gap: 4,
};

function fmtBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n === 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: 14,
};
const th: React.CSSProperties = {
  textAlign: 'left', padding: '6px 8px', fontSize: '0.6875rem', color: 'var(--text-dim)',
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid var(--border)',
};
const td: React.CSSProperties = {
  padding: '6px 8px', fontSize: '0.8125rem', color: 'var(--text)', borderBottom: '1px solid var(--border)',
};
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };

function healthColor(state: string): string {
  const s = state.toUpperCase();
  if (s === 'ONLINE' || s === 'RUNNING') return 'var(--success, #22c55e)';
  if (s === 'DEGRADED' || s === 'SCRUBBING' || s === 'RESILVERING') return 'var(--warning, #f59e0b)';
  if (s === 'FAULTED' || s === 'SUSPENDED' || s === 'UNAVAIL' || s === 'REMOVED') return 'var(--error, #ef4444)';
  return 'var(--text-dim)';
}

function PoolCard({ pool }: { pool: ZfsPoolObservation }) {
  const caps = useStorageStore((s) => s.zfs_capabilities);
  const scrub = useStorageStore((s) => s.zfsScrub);
  const destroy = useStorageStore((s) => s.zfsDestroyPool);
  const onScrub = async () => { try { await scrub(pool.name); toast.success(`Scrub iniciado en ${pool.name}`); } catch (e) { toast.error(String(e instanceof Error ? e.message : e)); } };
  const onDestroy = async () => {
    if (!window.confirm(`¿Destruir el pool "${pool.name}"? Esto borra TODOS sus datos.`)) return;
    try { await destroy(pool.name); toast.success(`Pool ${pool.name} destruido`); } catch (e) { toast.error(String(e instanceof Error ? e.message : e)); }
  };
  const cap = pool.cap_pct;
  const capColor = cap == null ? 'var(--text-dim)' : cap >= 90 ? 'var(--error,#ef4444)' : cap >= 80 ? 'var(--warning,#f59e0b)' : 'var(--success,#22c55e)';
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <strong style={{ ...mono, fontSize: '0.875rem', color: 'var(--text)' }}>{pool.name}</strong>
        <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: healthColor(pool.health) }}>● {pool.health}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          {fmtBytes(pool.alloc_bytes)} / {fmtBytes(pool.size_bytes)}
        </span>
      </div>
      {cap != null && (
        <div style={{ height: 6, background: 'var(--bg, #0001)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ width: `${Math.min(cap, 100)}%`, height: '100%', background: capColor }} />
        </div>
      )}
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginBottom: 4 }}>
        cap {cap ?? '—'}% · frag {pool.frag_pct ?? '—'}% · libre {fmtBytes(pool.free_bytes)}
      </div>
      {/* vdevs → discos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
        {pool.vdevs.map((v) => (
          <div key={v.name} style={{ paddingLeft: 4 }}>
            <div style={{ fontSize: '0.75rem', ...mono }}>
              <span style={{ color: 'var(--text-dim)' }}>{v.type}</span>{' '}
              <span style={{ color: healthColor(v.state) }}>{v.state}</span>
            </div>
            {v.disks.map((d) => {
              const errs = d.read_errors + d.write_errors + d.cksum_errors;
              return (
                <div key={d.name} style={{ paddingLeft: 14, fontSize: '0.6875rem', ...mono, color: 'var(--text-dim)', display: 'flex', gap: 6 }}>
                  <span style={{ color: healthColor(d.state) }}>●</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  {errs > 0 && <span style={{ color: 'var(--error,#ef4444)' }}>R{d.read_errors} W{d.write_errors} C{d.cksum_errors}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {(caps?.can_scrub || caps?.can_destroy_pool) && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {caps?.can_scrub && <button style={actBtn} onClick={onScrub}><Waves size={11} /> Scrub</button>}
          {caps?.can_destroy_pool && <button style={{ ...actBtn, color: 'var(--error,#ef4444)' }} onClick={onDestroy}><Trash2 size={11} /> Destruir</button>}
        </div>
      )}
    </div>
  );
}

export function ZfsSection() {
  const caps = useStorageStore((s) => s.zfs_capabilities);
  const pools = useStorageStore((s) => s.zfs_pools);
  const datasets = useStorageStore((s) => s.zfs_datasets);
  const zvols = useStorageStore((s) => s.zfs_zvols);
  const snapshots = useStorageStore((s) => s.zfs_snapshots);
  const vms = useStorageStore((s) => s.zfs_vms);
  const fetchZfs = useStorageStore((s) => s.fetchZfs);
  const demo = useStorageStore((s) => s.zfs_demo);
  const setZfsDemo = useStorageStore((s) => s.setZfsDemo);
  const destroySnap = useStorageStore((s) => s.zfsDestroySnapshot);
  const vmAction = useStorageStore((s) => s.zfsVmAction);
  const [snapTarget, setSnapTarget] = useState<string | null>(null);

  const onDestroySnap = async (full: string) => {
    if (!window.confirm(`¿Destruir el snapshot "${full}"?`)) return;
    try { await destroySnap(full); toast.success('Snapshot destruido'); } catch (e) { toast.error(String(e instanceof Error ? e.message : e)); }
  };
  const onVm = async (name: string, action: 'start' | 'stop' | 'destroy') => {
    if (action === 'destroy' && !window.confirm(`¿Eliminar la VM "${name}"? (no borra su disco)`)) return;
    try { await vmAction(name, action); toast.success(`VM ${name}: ${action}`); } catch (e) { toast.error(String(e instanceof Error ? e.message : e)); }
  };

  useEffect(() => { fetchZfs(); }, [fetchZfs]);

  const hardened = caps?.level === 'zfs-hardened';

  // Cabecera con el toggle Demo — SIEMPRE visible (incluso si el backend no aplica),
  // para poder explorar todas las interfaces sin bare-metal.
  const demoToggle = (
    <button
      onClick={() => setZfsDemo(!demo)}
      title="Modo demo: entorno ZFS fabricado, 100% local (no toca el backend)"
      style={{
        marginLeft: 'auto', padding: '3px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
        fontSize: '0.6875rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5,
        border: `1px solid ${demo ? 'var(--mod-storage, var(--accent))' : 'var(--border)'}`,
        background: demo ? 'var(--mod-storage, var(--accent))' : 'transparent',
        color: demo ? '#fff' : 'var(--text-dim)',
      }}
    >
      <FlaskConical size={12} /> Demo {demo ? 'ON' : 'OFF'}
    </button>
  );

  if (!caps) {
    // Backend ZFS no aplica a este entorno y demo apagado: ofrecer activar la demo.
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <HardDrive size={16} style={{ color: 'var(--mod-storage)' }} />
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>ZFS NAS</h2>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>no disponible en este entorno</span>
        {demoToggle}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <HardDrive size={16} style={{ color: 'var(--mod-storage)' }} />
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>ZFS NAS</h2>
        <span style={{
          padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: '0.6875rem', fontWeight: 600,
          background: hardened ? 'var(--success-bg, #22c55e22)' : 'var(--surface)',
          color: hardened ? 'var(--success, #22c55e)' : 'var(--text-dim)',
          border: '1px solid var(--border)',
        }}>
          {caps.level}
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>{caps.platform}</span>
        {demo && <span style={{ fontSize: '0.6875rem', color: 'var(--mod-storage, var(--accent))', fontWeight: 600 }}>· DEMO</span>}
        {demoToggle}
      </div>

      {/* Banner de degradado honesto (no zfs-hardened) */}
      {!hardened && (
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12,
          background: 'var(--warning-bg, #f59e0b18)', border: '1px solid var(--warning, #f59e0b)55',
          borderRadius: 'var(--radius)', fontSize: '0.8125rem', color: 'var(--text)',
        }}>
          <ShieldAlert size={16} style={{ color: 'var(--warning, #f59e0b)', flexShrink: 0, marginTop: 1 }} />
          <span>{caps.degraded_reason ?? 'Gestión ZFS no disponible en este entorno.'}</span>
        </div>
      )}
      {hardened && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.75rem', color: 'var(--success, #22c55e)' }}>
          <ShieldCheck size={14} /> Gestión ZFS activa{demo ? ' (demo: cambios locales)' : ' (escritura gated por token + approval)'}.
        </div>
      )}

      {/* Barra de creación (pool / dataset / zvol / VM), gated por capabilities */}
      <ZfsManageBar />

      {/* Pools */}
      {pools.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {pools.map((p) => <PoolCard key={p.name} pool={p} />)}
        </div>
      )}

      {/* Datasets + Zvols */}
      {(datasets.length > 0 || zvols.length > 0) && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Boxes size={14} style={{ color: 'var(--text-dim)' }} />
            <strong style={{ fontSize: '0.8125rem' }}>Datasets y volúmenes</strong>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Nombre</th><th style={th}>Tipo</th><th style={th}>Usado</th>
              <th style={th}>Disp.</th><th style={th}>Compresión</th><th style={th}>Cifrado</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {[...datasets, ...zvols].map((d) => (
                <tr key={d.name}>
                  <td style={{ ...td, ...mono }}>{d.name}</td>
                  <td style={td}>{d.type === 'volume' ? 'zvol' : 'fs'}</td>
                  <td style={td}>{fmtBytes(d.used_bytes)}</td>
                  <td style={td}>{fmtBytes(d.available_bytes)}</td>
                  <td style={td}>{d.compression ?? '—'}</td>
                  <td style={td}>{d.encryption && d.encryption !== 'off' ? d.encryption : '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {caps.can_snapshot && (
                      <button style={actBtn} onClick={() => setSnapTarget(d.name)}><Camera size={11} /> Snapshot</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Snapshots */}
      {snapshots.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Camera size={14} style={{ color: 'var(--text-dim)' }} />
            <strong style={{ fontSize: '0.8125rem' }}>Snapshots ({snapshots.length})</strong>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Snapshot</th><th style={th}>Usado</th><th style={th}>Creado</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {snapshots.slice(0, 50).map((s) => {
                const auto = s.snap_name.startsWith('claw-auto-');
                return (
                  <tr key={s.full_name}>
                    <td style={{ ...td, ...mono }}>
                      {s.full_name}
                      {auto && <span style={{ marginLeft: 6, fontSize: '0.625rem', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: 3, padding: '0 4px' }}>auto</span>}
                    </td>
                    <td style={td}>{fmtBytes(s.used_bytes)}</td>
                    <td style={td}>{s.creation ? new Date(s.creation * 1000).toLocaleString() : '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {caps.can_snapshot && <button style={{ ...actBtn, color: 'var(--error,#ef4444)' }} onClick={() => onDestroySnap(s.full_name)}><Trash2 size={11} /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* VMs (admin-only; vacío si no eres admin o no hay libvirt) */}
      {vms.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <MonitorPlay size={14} style={{ color: 'var(--text-dim)' }} />
            <strong style={{ fontSize: '0.8125rem' }}>Máquinas virtuales</strong>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Nombre</th><th style={th}>Estado</th><th style={th}></th></tr></thead>
            <tbody>
              {vms.map((v) => {
                const running = v.state.toLowerCase().includes('run');
                return (
                  <tr key={v.name}>
                    <td style={{ ...td, ...mono }}>{v.name}</td>
                    <td style={{ ...td, color: healthColor(v.state) }}>{v.state}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {caps.can_vm && (
                        <span style={{ display: 'inline-flex', gap: 4 }}>
                          {running
                            ? <button style={actBtn} onClick={() => onVm(v.name, 'stop')}><Square size={11} /> Parar</button>
                            : <button style={actBtn} onClick={() => onVm(v.name, 'start')}><Play size={11} /> Iniciar</button>}
                          <button style={{ ...actBtn, color: 'var(--error,#ef4444)' }} onClick={() => onVm(v.name, 'destroy')}><Trash2 size={11} /></button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Hardened pero sin inventario observado (pools vacíos): mensaje honesto */}
      {hardened && pools.length === 0 && !demo && (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', padding: 8 }}>
          No se observan pools todavía. Crea uno con "+ Crear pool" (gated por token + approval).
        </div>
      )}

      {/* Modal de crear snapshot (desde la fila de un dataset) */}
      {snapTarget && <CreateSnapshotForm target={snapTarget} onClose={() => setSnapTarget(null)} />}
    </div>
  );
}
