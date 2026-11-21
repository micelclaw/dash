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
import { Boxes, Camera, ShieldAlert, ShieldCheck, Trash2, Upload, Database } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { useI18n } from '@/i18n';
import { ZfsManageBar, CreateSnapshotForm, ImportPoolModal } from './ZfsModals';
import { ZfsPoolCard } from './ZfsPoolCard';
import { SectionIntro, InfoTip } from './ZfsHelp';

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
type Translate = (key: string, values?: Record<string, string | number>) => string;

export function healthLabel(state: string, t: Translate): string {
  const s = state.toUpperCase();
  if (s === 'ONLINE') return t('storage.poolcard.healthOnline');
  if (s === 'DEGRADED') return t('storage.poolcard.healthDegraded');
  if (s === 'SCRUBBING') return t('storage.poolcard.healthScrubbing');
  if (s === 'RESILVERING') return t('storage.poolcard.healthRebuilding');
  if (s === 'FAULTED' || s === 'UNAVAIL') return t('storage.poolcard.healthFaulted');
  if (s === 'SUSPENDED') return t('storage.poolcard.healthSuspended');
  return state;
}

// Etiqueta humana del tipo de vdev (caché/log/metadatos vs vdev de datos).
export function vdevLabel(type: string, t: Translate): { label: string; aux: boolean } {
  const kind = type.toLowerCase();
  if (kind === 'cache') return { label: t('storage.poolcard.vdevCache'), aux: true };
  if (kind === 'log') return { label: t('storage.poolcard.vdevLog'), aux: true };
  if (kind === 'special') return { label: t('storage.poolcard.vdevSpecial'), aux: true };
  if (kind === 'spare') return { label: t('storage.poolcard.vdevSpare'), aux: true };
  if (kind.startsWith('mirror')) return { label: t('storage.poolcard.vdevMirror'), aux: false };
  if (kind.startsWith('raidz3')) return { label: 'RAID-Z3', aux: false };
  if (kind.startsWith('raidz2')) return { label: 'RAID-Z2', aux: false };
  if (kind.startsWith('raidz')) return { label: 'RAID-Z1', aux: false };
  return { label: type, aux: false };
}

// Convierte los contadores de error de un disco en texto humano.
export function errorText(read: number, write: number, cksum: number, t: Translate): string | null {
  const parts: string[] = [];
  if (read > 0) parts.push(t(read === 1 ? 'storage.poolcard.readError' : 'storage.poolcard.readErrors', { count: read }));
  if (write > 0) parts.push(t(write === 1 ? 'storage.poolcard.writeError' : 'storage.poolcard.writeErrors', { count: write }));
  if (cksum > 0) parts.push(t(cksum === 1 ? 'storage.poolcard.checksumError' : 'storage.poolcard.checksumErrors', { count: cksum }));
  return parts.length ? parts.join(' · ') : null;
}

// Estado de disco en lenguaje llano.
export function diskStateLabel(state: string, t: Translate): string {
  const s = state.toUpperCase();
  if (s === 'ONLINE') return t('storage.poolcard.stateOnline');
  if (s === 'FAULTED') return t('storage.poolcard.stateFaulted');
  if (s === 'DEGRADED') return t('storage.poolcard.stateDegraded');
  if (s === 'UNAVAIL') return t('storage.poolcard.stateUnavailable');
  if (s === 'REMOVED') return t('storage.poolcard.stateRemoved');
  if (s === 'OFFLINE') return t('storage.poolcard.stateOffline');
  return state;
}

export function ZfsSection() {
  const { t, locale } = useI18n();
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
    if (!window.confirm(t('storage.section.destroyConfirm', { name: full }))) return;
    try { await destroySnap(full); toast.success(t('storage.section.snapshotDestroyed')); } catch (e) { toast.error(String(e instanceof Error ? e.message : e)); }
  };

  useEffect(() => { fetchZfs(); }, [fetchZfs]);

  const hardened = caps?.level === 'zfs-hardened';

  if (!caps) {
    // Backend ZFS no aplica a este entorno y demo apagado. La cabecera de la
    // zona (SectionHeader "Almacenamiento ZFS") ya da el título; aquí solo el motivo.
    return (
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
        {t('storage.section.unavailable')}
      </div>
    );
  }

  return (
    // El título "Almacenamiento ZFS" + la píldora de nivel los pinta el
    // SectionHeader de la zona en StoragePage; aquí va solo el contenido.
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Intro didáctica de la sección */}
      <SectionIntro>{t('storage.help.pool')}</SectionIntro>

      {/* Banner de degradado honesto (no zfs-hardened) */}
      {!hardened && (
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-start', padding: 14,
          background: 'var(--warning-bg, #f59e0b18)', border: '1px solid var(--warning, #f59e0b)55',
          borderRadius: 'var(--radius)', fontSize: '0.8125rem', color: 'var(--text)', lineHeight: 1.5,
        }}>
          <ShieldAlert size={18} style={{ color: 'var(--warning, #f59e0b)', flexShrink: 0, marginTop: 1 }} />
          <span>{caps.degraded_reason ?? t('storage.section.degraded')}</span>
        </div>
      )}
      {hardened && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.8125rem', color: 'var(--success, #22c55e)' }}>
          <ShieldCheck size={16} /> {t('storage.section.active')}{demo ? t('storage.section.demoWrites') : t('storage.section.approvedWrites')}.
        </div>
      )}

      {/* Barra de creación (almacén / carpeta / disco virtual) + Importar pool, gated por capabilities */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <ZfsManageBar />
        {caps.can_import !== false && (
          <button style={actBtn} onClick={() => setImportOpen(true)}>
            <Upload size={14} /> {t('storage.section.import')}
            <InfoTip text={t('storage.help.importPool')} />
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
            <strong style={{ fontSize: '0.9375rem', color: 'var(--text)' }}>{t('storage.section.datasets')} / {t('storage.section.volumes')}</strong>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 12 }}>
            {t('storage.section.datasetsIntro')}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>{t('storage.section.datasetName')}</th>
                <th style={th}>{t('storage.disk.type')}</th>
                <th style={th}>{t('storage.section.used')}</th>
                <th style={th}>{t('storage.section.available')}</th>
                <th style={th}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {t('storage.section.compression')} <InfoTip text={t('storage.dataset.compressionHint')} />
                  </span>
                </th>
                <th style={th}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {t('storage.section.encryption')} <InfoTip text={t('storage.poolWizard.encryptHint')} />
                  </span>
                </th>
                <th style={th}></th>
              </tr></thead>
              <tbody>
                {[...datasets, ...zvols].map((d) => (
                  <tr key={d.name}>
                    <td style={{ ...td, ...mono, wordBreak: 'break-all' }}>{d.name}</td>
                    <td style={td}>{d.type === 'volume' ? t('storage.manage.zvol').replace(/^\+\s*/, '') : t('storage.manage.dataset').replace(/^\+\s*/, '')}</td>
                    <td style={td}>{fmtBytes(d.used_bytes)}</td>
                    <td style={td}>{fmtBytes(d.available_bytes)}</td>
                    <td style={td}>{d.compression && d.compression !== 'off' ? d.compression : '—'}</td>
                    <td style={td}>{d.encryption && d.encryption !== 'off' ? t('storage.data.yes') : '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {caps.can_snapshot && (
                        <button style={actBtn} onClick={() => setSnapTarget(d.name)}><Camera size={13} /> {t('storage.section.snapshot')}</button>
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
            <strong style={{ fontSize: '0.9375rem', color: 'var(--text)' }}>{t('storage.section.snapshots', { count: snapshots.length })}</strong>
            <InfoTip text={t('storage.section.snapshotHelp')} />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>{t('storage.section.snapshot')}</th><th style={th}>{t('storage.section.space')}</th><th style={th}>{t('storage.section.created')}</th><th style={th}></th>
              </tr></thead>
              <tbody>
                {snapshots.slice(0, 50).map((s) => {
                  const auto = s.snap_name.startsWith('claw-auto-');
                  return (
                    <tr key={s.full_name}>
                      <td style={{ ...td, ...mono, wordBreak: 'break-all' }}>
                        {s.full_name}
                        {auto && <span style={{ marginLeft: 6, fontSize: '0.625rem', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: 3, padding: '0 4px' }}>{t('storage.section.auto')}</span>}
                      </td>
                      <td style={td}>{fmtBytes(s.used_bytes)}</td>
                      <td style={td}>{s.creation ? new Date(s.creation * 1000).toLocaleString(locale) : '—'}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        {caps.can_snapshot && <button aria-label={t('storage.section.destroy')} title={t('storage.section.destroy')} style={{ ...actBtn, color: 'var(--error,#ef4444)', padding: '5px 9px' }} onClick={() => onDestroySnap(s.full_name)}><Trash2 size={13} /></button>}
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
          {t('storage.section.noPools')}
        </div>
      )}

      {/* Modal de crear instantánea (desde la fila de un dataset) */}
      {snapTarget && <CreateSnapshotForm target={snapTarget} onClose={() => setSnapTarget(null)} />}

      {/* Modal de importar pool (a nivel sección) */}
      {importOpen && <ImportPoolModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}
