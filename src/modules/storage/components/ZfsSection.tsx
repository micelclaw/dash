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

// ─── ZFS NAS — sección read-path + escrituras gated ────────────────
// Muestra capabilities (degradado honesto por plataforma), pools observados
// (salud + vdevs + discos con errores en lenguaje claro), datasets/zvols y
// snapshots. En WSL2/read-only el inventario llega vacío y se muestra el motivo
// del degradado en vez de fingir. El modo demo se controla ÚNICAMENTE desde el
// Preview de la cabecera de Storage (no hay toggle dedicado aquí).
//
// Diseño DIDÁCTICO estilo Synology (feedback del usuario): tarjetas de pool
// grandes y sin cortes, nombres de disco completos, errores en texto humano,
// caché/log/metadatos etiquetados en llano, e InfoTips por acción.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { HardDrive, Boxes, Camera, ShieldAlert, ShieldCheck, Trash2, Upload, Database } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { ZfsManageBar, CreateSnapshotForm, ImportPoolModal } from './ZfsModals';
import { ZfsPoolCard } from './ZfsPoolCard';
import { SectionIntro, InfoTip, ZFS_COPY } from './ZfsHelp';

const actBtn: React.CSSProperties = {
  padding: '6px 12px', fontSize: '0.8125rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)',
  display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500,
};

// ─── Helpers compartidos (los consume ZfsPoolCard) ─────────────────
// Se exportan desde aquí (SSOT del módulo ZFS): formato de bytes, color/etiqueta
// de salud, etiqueta humana de vdev, texto de errores y estado de disco.
export function fmtBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n === 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: 20,
};
const th: React.CSSProperties = {
  textAlign: 'left', padding: '8px 10px', fontSize: '0.6875rem', color: 'var(--text-dim)',
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid var(--border)',
};
const td: React.CSSProperties = {
  padding: '9px 10px', fontSize: '0.8125rem', color: 'var(--text)', borderBottom: '1px solid var(--border)',
};
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };

export function healthColor(state: string): string {
  const s = state.toUpperCase();
  if (s === 'ONLINE' || s === 'RUNNING') return 'var(--success, #22c55e)';
  if (s === 'DEGRADED' || s === 'SCRUBBING' || s === 'RESILVERING' || s === 'OFFLINE') return 'var(--warning, #f59e0b)';
  if (s === 'FAULTED' || s === 'SUSPENDED' || s === 'UNAVAIL' || s === 'REMOVED') return 'var(--error, #ef4444)';
  return 'var(--text-dim)';
}

// Salud del pool en lenguaje llano (no la etiqueta cruda de ZFS).
export function healthLabel(state: string): string {
  const s = state.toUpperCase();
  if (s === 'ONLINE') return 'Saludable';
  if (s === 'DEGRADED') return 'Degradado (sigue funcionando, repáralo cuanto antes)';
  if (s === 'SCRUBBING') return 'Verificando integridad…';
  if (s === 'RESILVERING') return 'Reconstruyendo…';
  if (s === 'FAULTED' || s === 'UNAVAIL') return 'Con fallo (datos en riesgo)';
  if (s === 'SUSPENDED') return 'Suspendido';
  return state;
}

// Etiqueta humana del tipo de vdev (caché/log/metadatos vs vdev de datos).
export function vdevLabel(type: string): { label: string; aux: boolean } {
  const t = type.toLowerCase();
  if (t === 'cache') return { label: 'Caché SSD (lectura)', aux: true };
  if (t === 'log') return { label: 'Log SSD (escritura)', aux: true };
  if (t === 'special') return { label: 'Metadatos (SSD)', aux: true };
  if (t === 'spare') return { label: 'Disco de repuesto', aux: true };
  if (t.startsWith('mirror')) return { label: 'Espejo (mirror)', aux: false };
  if (t.startsWith('raidz3')) return { label: 'RAID-Z3', aux: false };
  if (t.startsWith('raidz2')) return { label: 'RAID-Z2', aux: false };
  if (t.startsWith('raidz')) return { label: 'RAID-Z1', aux: false };
  return { label: type, aux: false };
}

// Convierte los contadores de error de un disco en texto humano.
export function errorText(read: number, write: number, cksum: number): string | null {
  const parts: string[] = [];
  if (read > 0) parts.push(`${read} error${read === 1 ? '' : 'es'} de lectura`);
  if (write > 0) parts.push(`${write} error${write === 1 ? '' : 'es'} de escritura`);
  if (cksum > 0) parts.push(`${cksum} error${cksum === 1 ? '' : 'es'} de integridad`);
  return parts.length ? parts.join(' · ') : null;
}

// Estado de disco en lenguaje llano.
export function diskStateLabel(state: string): string {
  const s = state.toUpperCase();
  if (s === 'ONLINE') return 'En línea';
  if (s === 'FAULTED') return 'Con fallo';
  if (s === 'DEGRADED') return 'Degradado';
  if (s === 'UNAVAIL') return 'No disponible';
  if (s === 'REMOVED') return 'Retirado';
  if (s === 'OFFLINE') return 'Desconectado';
  return state;
}

export function ZfsSection() {
  const caps = useStorageStore((s) => s.zfs_capabilities);
  const pools = useStorageStore((s) => s.zfs_pools);
  const datasets = useStorageStore((s) => s.zfs_datasets);
  const zvols = useStorageStore((s) => s.zfs_zvols);
  const snapshots = useStorageStore((s) => s.zfs_snapshots);
  const fetchZfs = useStorageStore((s) => s.fetchZfs);
  const demo = useStorageStore((s) => s.zfs_demo);
  const destroySnap = useStorageStore((s) => s.zfsDestroySnapshot);
  const [snapTarget, setSnapTarget] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const onDestroySnap = async (full: string) => {
    if (!window.confirm(`¿Destruir la instantánea "${full}"?`)) return;
    try { await destroySnap(full); toast.success('Instantánea destruida'); } catch (e) { toast.error(String(e instanceof Error ? e.message : e)); }
  };

  useEffect(() => { fetchZfs(); }, [fetchZfs]);

  const hardened = caps?.level === 'zfs-hardened';

  if (!caps) {
    // Backend ZFS no aplica a este entorno y demo apagado.
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <HardDrive size={16} style={{ color: 'var(--mod-storage)' }} />
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>NAS (ZFS)</h2>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>no disponible en este entorno (actívalo con el Preview de arriba)</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <HardDrive size={18} style={{ color: 'var(--mod-storage)' }} />
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>NAS (ZFS)</h2>
        <span style={{
          padding: '3px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.6875rem', fontWeight: 600,
          background: hardened ? 'var(--success-bg, #22c55e22)' : 'var(--surface)',
          color: hardened ? 'var(--success, #22c55e)' : 'var(--text-dim)',
          border: '1px solid var(--border)',
        }}>
          {caps.level}
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>{caps.platform}</span>
        {demo && <span style={{ fontSize: '0.6875rem', color: 'var(--mod-storage, var(--accent))', fontWeight: 600 }}>· DEMO</span>}
      </div>

      {/* Intro didáctica de la sección */}
      <SectionIntro>{ZFS_COPY.pool}</SectionIntro>

      {/* Banner de degradado honesto (no zfs-hardened) */}
      {!hardened && (
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-start', padding: 14,
          background: 'var(--warning-bg, #f59e0b18)', border: '1px solid var(--warning, #f59e0b)55',
          borderRadius: 'var(--radius)', fontSize: '0.8125rem', color: 'var(--text)', lineHeight: 1.5,
        }}>
          <ShieldAlert size={18} style={{ color: 'var(--warning, #f59e0b)', flexShrink: 0, marginTop: 1 }} />
          <span>{caps.degraded_reason ?? 'La gestión ZFS no está disponible en este entorno.'}</span>
        </div>
      )}
      {hardened && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.8125rem', color: 'var(--success, #22c55e)' }}>
          <ShieldCheck size={16} /> Gestión ZFS activa{demo ? ' (demo: los cambios son locales y no tocan el servidor)' : ' (las escrituras requieren token + aprobación)'}.
        </div>
      )}

      {/* Barra de creación (almacén / carpeta / disco virtual) + Importar pool, gated por capabilities */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <ZfsManageBar />
        {caps.can_import !== false && (
          <button style={actBtn} onClick={() => setImportOpen(true)}>
            <Upload size={14} /> Importar pool
            <InfoTip text={ZFS_COPY.import_pool} />
          </button>
        )}
      </div>

      {/* Pools — tarjetas densas (1-2 por fila) */}
      {pools.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
          {pools.map((p) => <ZfsPoolCard key={p.name} pool={p} />)}
        </div>
      )}

      {/* Datasets + Zvols */}
      {(datasets.length > 0 || zvols.length > 0) && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Database size={16} style={{ color: 'var(--mod-storage)' }} />
            <strong style={{ fontSize: '0.9375rem', color: 'var(--text)' }}>Carpetas y discos virtuales</strong>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 12 }}>
            Las <strong>carpetas gestionadas</strong> (datasets) son donde organizas tus datos; los
            <strong> discos virtuales</strong> (zvols) solo se usan para máquinas virtuales o iSCSI.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Nombre</th>
                <th style={th}>Tipo</th>
                <th style={th}>Usado</th>
                <th style={th}>Disponible</th>
                <th style={th}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Compresión <InfoTip text="Reduce el espacio ocupado al vuelo. lz4 es rápida y casi gratis; zstd comprime más." />
                  </span>
                </th>
                <th style={th}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Cifrado <InfoTip text="Si está activo, los datos en reposo se guardan cifrados (AES-256-GCM) y no se pueden leer sin la clave." />
                  </span>
                </th>
                <th style={th}></th>
              </tr></thead>
              <tbody>
                {[...datasets, ...zvols].map((d) => (
                  <tr key={d.name}>
                    <td style={{ ...td, ...mono, wordBreak: 'break-all' }}>{d.name}</td>
                    <td style={td}>{d.type === 'volume' ? 'Disco virtual' : 'Carpeta'}</td>
                    <td style={td}>{fmtBytes(d.used_bytes)}</td>
                    <td style={td}>{fmtBytes(d.available_bytes)}</td>
                    <td style={td}>{d.compression && d.compression !== 'off' ? d.compression : '—'}</td>
                    <td style={td}>{d.encryption && d.encryption !== 'off' ? 'Sí' : '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {caps.can_snapshot && (
                        <button style={actBtn} onClick={() => setSnapTarget(d.name)}><Camera size={13} /> Instantánea</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Snapshots */}
      {snapshots.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Camera size={16} style={{ color: 'var(--mod-storage)' }} />
            <strong style={{ fontSize: '0.9375rem', color: 'var(--text)' }}>Instantáneas ({snapshots.length})</strong>
            <InfoTip text="Una instantánea (snapshot) congela el estado de una carpeta en un momento dado, casi sin ocupar espacio. Si borras o estropeas archivos, puedes volver a ese punto. Las marcadas «auto» las crea el sistema según la política de retención." />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Instantánea</th><th style={th}>Espacio</th><th style={th}>Creada</th><th style={th}></th>
              </tr></thead>
              <tbody>
                {snapshots.slice(0, 50).map((s) => {
                  const auto = s.snap_name.startsWith('claw-auto-');
                  return (
                    <tr key={s.full_name}>
                      <td style={{ ...td, ...mono, wordBreak: 'break-all' }}>
                        {s.full_name}
                        {auto && <span style={{ marginLeft: 6, fontSize: '0.625rem', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: 3, padding: '0 4px' }}>auto</span>}
                      </td>
                      <td style={td}>{fmtBytes(s.used_bytes)}</td>
                      <td style={td}>{s.creation ? new Date(s.creation * 1000).toLocaleString() : '—'}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        {caps.can_snapshot && <button style={{ ...actBtn, color: 'var(--error,#ef4444)', padding: '5px 9px' }} onClick={() => onDestroySnap(s.full_name)}><Trash2 size={13} /></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hardened pero sin inventario observado (pools vacíos): mensaje honesto */}
      {hardened && pools.length === 0 && !demo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text-dim)', padding: 12 }}>
          <Boxes size={16} />
          Todavía no hay ningún almacén. Crea el primero con «+ Crear almacén» (requiere token + aprobación).
        </div>
      )}

      {/* Modal de crear instantánea (desde la fila de un dataset) */}
      {snapTarget && <CreateSnapshotForm target={snapTarget} onClose={() => setSnapTarget(null)} />}

      {/* Modal de importar pool (a nivel sección) */}
      {importOpen && <ImportPoolModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}
