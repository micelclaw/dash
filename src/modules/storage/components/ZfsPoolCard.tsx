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

// ─── ZfsPoolCard — tarjeta de pool densa estilo TrueNAS (Anotación 3) ──
// Cabecera con identidad + píldora de salud + menú «⋯ Acciones» agrupado
// (Mantenimiento · Capacidad · Avanzado · Peligro), barra de capacidad + chip
// RAW, fila de CHIPS de salud (scrub, errores, repuesto, cifrado/features) y una
// zona ampliable con tab-bar inline (Discos · Capacidad · Propiedades).
//
// TODO interactivo en demo: las acciones llaman al store, que en modo demo muta
// estado local (instantáneo). Las entradas se deshabilitan si su capability es
// falsy, con InfoTip del porqué. Estilo inline var(--*), iconos lucide.

import { useState } from 'react';
import { toast } from 'sonner';
import {
  HardDrive, MoreVertical, ChevronDown, ChevronUp, Waves, Thermometer,
  ShieldCheck, ShieldAlert, PlugZap, Trash2, Zap, Settings2, Download,
  ArrowUpCircle, Activity, History, Replace, RefreshCw, Snowflake,
  Database, Lock,
} from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import type { ZfsPoolObservation, ZfsVdevObservation, ZfsDiskObservation } from '../types';
import {
  AddCacheForm, AddSpareForm, RemoveAuxVdevConfirm, DiskMaintenanceModal,
  PoolPropsModal, ExportPoolConfirm,
} from './ZfsModals';
import { SmartHistoryModal } from './SmartHistoryModal';
import { InfoTip, ZFS_COPY } from './ZfsHelp';
import {
  fmtBytes, healthColor, healthLabel, vdevLabel, errorText, diskStateLabel,
} from './ZfsSection';

// ── Estilos compartidos ────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: 20,
};
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };

const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px',
  borderRadius: 'var(--radius-pill, 999px)', fontSize: '0.6875rem', fontWeight: 600,
  border: '1px solid var(--border)', background: 'var(--bg, var(--surface))', color: 'var(--text-dim)',
};

const menuItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px',
  background: 'transparent', border: 'none', color: 'var(--text)', fontSize: '0.8125rem',
  cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)',
};
const menuItemDisabled: React.CSSProperties = {
  ...menuItem, color: 'var(--text-dim)', cursor: 'not-allowed', opacity: 0.6,
};
const menuLabel: React.CSSProperties = {
  padding: '6px 12px 3px', fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: 'var(--text-dim)',
};

// ── Helpers de redundancia / errores ───────────────────────────────
// ¿El pool tiene algún disco de datos con redundancia? Un vdev de datos da
// redundancia si es mirror/raidz y conserva ≥2 discos sanos (o ≥1 además del que
// se va a tocar). Lo usamos para avisar antes de offline/detach destructivos.
function vdevHasRedundancy(v: ZfsVdevObservation): boolean {
  const t = v.type.toLowerCase();
  const healthy = v.disks.filter((d) => d.state.toUpperCase() === 'ONLINE').length;
  if (t.startsWith('mirror')) return healthy >= 2;
  if (t.startsWith('raidz3')) return healthy >= v.disks.length - 3 + 1;
  if (t.startsWith('raidz2')) return healthy >= v.disks.length - 2 + 1;
  if (t.startsWith('raidz')) return healthy >= v.disks.length - 1 + 1;
  return false; // stripe / disco suelto
}

// Errores agregados del pool: usa los contadores de nivel-pool si existen, si no
// suma los de todos los discos de todos los vdevs.
function aggErrors(pool: ZfsPoolObservation): { read: number; write: number; cksum: number; total: number } {
  let read = pool.read_errors;
  let write = pool.write_errors;
  let cksum = pool.cksum_errors;
  if (read == null && write == null && cksum == null) {
    read = 0; write = 0; cksum = 0;
    for (const v of pool.vdevs) for (const d of v.disks) {
      read += d.read_errors; write += d.write_errors; cksum += d.cksum_errors;
    }
  }
  read ??= 0; write ??= 0; cksum ??= 0;
  return { read, write, cksum, total: read + write + cksum };
}

function fmtRelDays(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const days = Math.floor((Date.now() - then) / (24 * 3600 * 1000));
  if (days <= 0) return 'hoy';
  if (days === 1) return 'hace 1 día';
  return `hace ${days} días`;
}

// ── Dropdown «⋯ Acciones» ──────────────────────────────────────────
type MenuAction = {
  key: string; label: string; icon: typeof Waves; onClick: () => void;
  enabled: boolean; disabledHint?: string; danger?: boolean;
};

function ActionsMenu({ groups }: { groups: { label: string; items: MenuAction[] }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button
        aria-label="Acciones del almacén"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32,
          borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--text)', cursor: 'pointer',
        }}
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 40, minWidth: 248,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)', overflow: 'hidden', padding: '4px 0',
          }}>
            {groups.map((g, gi) => (
              <div key={g.label}>
                {gi > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />}
                <div style={menuLabel}>{g.label}</div>
                {g.items.map((it) => {
                  const Icon = it.icon;
                  const color = it.danger ? 'var(--error, #ef4444)' : undefined;
                  return (
                    <div key={it.key} style={{ display: 'flex', alignItems: 'center' }}>
                      <button
                        style={{ ...(it.enabled ? menuItem : menuItemDisabled), ...(color && it.enabled ? { color } : {}), flex: 1 }}
                        disabled={!it.enabled}
                        onClick={() => { if (!it.enabled) return; setOpen(false); it.onClick(); }}
                        onMouseEnter={(e) => { if (it.enabled) e.currentTarget.style.background = 'var(--surface-hover, var(--bg))'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <Icon size={14} style={{ color: color ?? (it.enabled ? 'var(--text-dim)' : 'var(--text-dim)'), flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{it.label}</span>
                      </button>
                      {!it.enabled && it.disabledHint && (
                        <span style={{ paddingRight: 8 }}><InfoTip text={it.disabledHint} /></span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Menú «⋯» por disco (dentro del tab Discos) ─────────────────────
function DiskActionsMenu({ items }: { items: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button
        aria-label="Acciones del disco"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26,
          borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--text-dim)', cursor: 'pointer',
        }}
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 40, minWidth: 210,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)', overflow: 'hidden', padding: '4px 0',
          }}>
            {items.map((it) => {
              const Icon = it.icon;
              const color = it.danger ? 'var(--error, #ef4444)' : undefined;
              return (
                <div key={it.key} style={{ display: 'flex', alignItems: 'center' }}>
                  <button
                    style={{ ...(it.enabled ? menuItem : menuItemDisabled), ...(color && it.enabled ? { color } : {}), flex: 1 }}
                    disabled={!it.enabled}
                    onClick={() => { if (!it.enabled) return; setOpen(false); it.onClick(); }}
                    onMouseEnter={(e) => { if (it.enabled) e.currentTarget.style.background = 'var(--surface-hover, var(--bg))'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Icon size={13} style={{ color: color ?? 'var(--text-dim)', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{it.label}</span>
                  </button>
                  {!it.enabled && it.disabledHint && (
                    <span style={{ paddingRight: 8 }}><InfoTip text={it.disabledHint} /></span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Fila de disco (dentro de un vdev en el tab Discos) ─────────────
function DiskRow({
  disk, vdev, onMaintenance, onSmartTest, onSmartHistory, onReplace,
}: {
  disk: ZfsDiskObservation; vdev: ZfsVdevObservation;
  onMaintenance: (action: 'offline' | 'online' | 'detach') => void;
  onSmartTest: () => void; onSmartHistory: () => void; onReplace: () => void;
}) {
  const caps = useStorageStore((s) => s.zfs_capabilities);
  const { aux } = vdevLabel(vdev.type);
  const err = errorText(disk.read_errors, disk.write_errors, disk.cksum_errors);
  const offline = disk.state.toUpperCase() === 'OFFLINE';
  const isMirror = vdev.type.toLowerCase().startsWith('mirror');

  // Acciones por disco. NUNCA Quitar para data/special; cache/log → Quitar (vdev entero).
  const items: MenuAction[] = [];
  if (offline) {
    items.push({ key: 'online', label: 'Reconectar', icon: PlugZap, enabled: caps?.can_online !== false, disabledHint: 'Tu plataforma no permite reconectar discos.', onClick: () => onMaintenance('online') });
  } else {
    items.push({ key: 'offline', label: 'Desconectar', icon: PlugZap, enabled: caps?.can_offline !== false, disabledHint: 'Tu plataforma no permite desconectar discos.', onClick: () => onMaintenance('offline') });
  }
  // Separar (detach) solo tiene sentido en mirrors.
  items.push({
    key: 'detach', label: 'Separar del espejo', icon: PlugZap,
    enabled: isMirror && caps?.can_detach !== false,
    disabledHint: isMirror ? 'Tu plataforma no permite separar discos.' : 'Solo se puede separar un disco de un espejo (mirror).',
    onClick: () => onMaintenance('detach'), danger: true,
  });
  items.push({ key: 'replace', label: 'Reemplazar', icon: Replace, enabled: caps?.can_replace_disk !== false, disabledHint: 'Tu plataforma no permite reemplazar discos.', onClick: onReplace });
  items.push({ key: 'smart-test', label: 'Test SMART', icon: Activity, enabled: caps?.can_smart_test !== false, disabledHint: 'Tu plataforma no permite lanzar tests SMART.', onClick: onSmartTest });
  items.push({ key: 'smart-history', label: 'Historial SMART', icon: History, enabled: true, onClick: onSmartHistory });

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0' }}>
      <span style={{ color: healthColor(disk.state), flexShrink: 0, marginTop: 3, fontSize: '0.75rem' }}>●</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...mono, fontSize: '0.75rem', color: 'var(--text)', wordBreak: 'break-all', lineHeight: 1.4 }} title={disk.name}>
          {disk.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
          <span style={{ fontSize: '0.6875rem', color: err ? 'var(--error,#ef4444)' : 'var(--text-dim)' }}>
            {diskStateLabel(disk.state)}{err ? ` — ${err}` : ''}
          </span>
          {disk.temperature_c != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.6875rem', color: disk.temperature_c >= 50 ? 'var(--warning,#f59e0b)' : 'var(--text-dim)' }}>
              <Thermometer size={11} /> {disk.temperature_c}°C
            </span>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        {aux ? null : <DiskActionsMenu items={items} />}
      </div>
    </div>
  );
}

// ── Tab: Discos ────────────────────────────────────────────────────
function DisksTab({ pool }: { pool: ZfsPoolObservation }) {
  const caps = useStorageStore((s) => s.zfs_capabilities);
  const [maint, setMaint] = useState<{ disk: string; action: 'offline' | 'online' | 'detach'; redundancy: boolean } | null>(null);
  const [smartHist, setSmartHist] = useState<string | null>(null);
  const [removeAux, setRemoveAux] = useState<{ name: string; label: string } | null>(null);
  const smartTest = useStorageStore((s) => s.smartTest);

  const dataVdevs = pool.vdevs.filter((v) => !vdevLabel(v.type).aux);
  const auxVdevs = pool.vdevs.filter((v) => vdevLabel(v.type).aux);

  const runSmartTest = async (diskName: string) => {
    try { await smartTest(diskName, 'short'); toast.success('Test SMART corto iniciado'); }
    catch (e) { toast.error(`No se pudo iniciar el test SMART: ${e instanceof Error ? e.message : String(e)}`); }
  };

  const onReplace = (diskName: string) => {
    // El store no expone aún replaceDisk; en demo lo reflejamos como aviso.
    toast.info(`Reemplazar ${diskName.split('/').pop()}: asistente de reemplazo (demo)`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {dataVdevs.map((v) => {
        const redundancy = vdevHasRedundancy(v);
        return (
          <div key={v.name} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>{vdevLabel(v.type).label}</span>
              <span style={{ fontSize: '0.75rem', color: healthColor(v.state), fontWeight: 600 }}>● {diskStateLabel(v.state)}</span>
              {!redundancy && (
                <span style={{ ...chip, color: 'var(--warning,#f59e0b)', borderColor: 'var(--warning,#f59e0b)55' }}>
                  <ShieldAlert size={11} /> sin redundancia
                </span>
              )}
            </div>
            {v.disks.map((d) => (
              <DiskRow
                key={d.name} disk={d} vdev={v}
                onMaintenance={(action) => setMaint({ disk: d.name, action, redundancy })}
                onSmartTest={() => runSmartTest(d.name)}
                onSmartHistory={() => setSmartHist(d.name)}
                onReplace={() => onReplace(d.name)}
              />
            ))}
          </div>
        );
      })}

      {auxVdevs.map((v) => {
        const { label } = vdevLabel(v.type);
        return (
          <div key={v.name} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, background: 'color-mix(in srgb, var(--mod-storage) 4%, var(--surface))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Zap size={13} style={{ color: 'var(--mod-storage)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>{label}</span>
              <span style={{ fontSize: '0.75rem', color: healthColor(v.state), fontWeight: 600 }}>● {diskStateLabel(v.state)}</span>
              <span style={{ flex: 1 }} />
              <button
                style={{ ...chip, cursor: caps?.can_remove_aux_vdev !== false ? 'pointer' : 'not-allowed', color: 'var(--error,#ef4444)', opacity: caps?.can_remove_aux_vdev !== false ? 1 : 0.5 }}
                disabled={caps?.can_remove_aux_vdev === false}
                onClick={() => setRemoveAux({ name: v.name, label })}
              >
                <Trash2 size={11} /> Quitar
              </button>
            </div>
            {v.disks.map((d) => {
              const err = errorText(d.read_errors, d.write_errors, d.cksum_errors);
              return (
                <div key={d.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
                  <span style={{ color: healthColor(d.state), flexShrink: 0, marginTop: 3, fontSize: '0.75rem' }}>●</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...mono, fontSize: '0.75rem', color: 'var(--text)', wordBreak: 'break-all', lineHeight: 1.4 }}>{d.name}</div>
                    <div style={{ fontSize: '0.6875rem', color: err ? 'var(--error,#ef4444)' : 'var(--text-dim)' }}>{diskStateLabel(d.state)}{err ? ` — ${err}` : ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {(pool.spares?.length ?? 0) > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <ShieldCheck size={13} style={{ color: 'var(--success,#22c55e)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>Discos de repuesto (en reserva)</span>
            <InfoTip text={ZFS_COPY.spare} />
          </div>
          {pool.spares!.map((d) => (
            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <span style={{ color: healthColor(d.state), flexShrink: 0, fontSize: '0.75rem' }}>●</span>
              <div style={{ ...mono, fontSize: '0.75rem', color: 'var(--text)', wordBreak: 'break-all', flex: 1 }}>{d.name}</div>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>{diskStateLabel(d.state)}</span>
            </div>
          ))}
        </div>
      )}

      {maint && (
        <DiskMaintenanceModal
          pool={pool.name} diskName={maint.disk} action={maint.action} hasRedundancy={maint.redundancy}
          onClose={() => setMaint(null)}
        />
      )}
      {smartHist && <SmartHistoryModal diskId={smartHist} diskLabel={smartHist.split('/').pop()} onClose={() => setSmartHist(null)} />}
      {removeAux && <RemoveAuxVdevConfirm pool={pool.name} vdevName={removeAux.name} vdevLabel={removeAux.label} onClose={() => setRemoveAux(null)} />}
    </div>
  );
}

// ── Tab: Capacidad ─────────────────────────────────────────────────
function CapacityTab({ pool }: { pool: ZfsPoolObservation }) {
  const auxVdevs = pool.vdevs.filter((v) => vdevLabel(v.type).aux);
  const accel: { label: string; plain: string }[] = [];
  for (const v of auxVdevs) {
    const t = v.type.toLowerCase();
    if (t === 'cache') accel.push({ label: 'Caché de lectura (L2ARC)', plain: 'Acelera leer datos que se piden a menudo. Se puede quitar sin riesgo.' });
    else if (t === 'log') accel.push({ label: 'Log de escritura (SLOG)', plain: 'Acelera las escrituras síncronas. Conviene tenerlo en espejo.' });
    else if (t === 'special') accel.push({ label: 'Metadatos (special)', plain: 'Guarda metadatos en SSD para que todo responda más rápido. Forma parte del pool.' });
  }
  const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.8125rem', padding: '6px 0', borderBottom: '1px solid var(--border)' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={row}><span style={{ color: 'var(--text-dim)' }}>Capacidad total (bruta)</span><strong style={{ ...mono, color: 'var(--text)' }}>{fmtBytes(pool.size_bytes)}</strong></div>
        <div style={row}>
          <span style={{ color: 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Usado <InfoTip text={ZFS_COPY.usage_logical_vs_physical} />
          </span>
          <strong style={{ ...mono, color: 'var(--text)' }}>{fmtBytes(pool.alloc_bytes)}</strong>
        </div>
        <div style={row}><span style={{ color: 'var(--text-dim)' }}>Libre</span><strong style={{ ...mono, color: 'var(--text)' }}>{fmtBytes(pool.free_bytes)}</strong></div>
        <div style={{ ...row, borderBottom: 'none' }}><span style={{ color: 'var(--text-dim)' }}>Fragmentación</span><strong style={{ ...mono, color: 'var(--text)' }}>{pool.frag_pct ?? '—'}%</strong></div>
      </div>
      <div>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-dim)', marginBottom: 8 }}>Aceleración</div>
        {accel.length === 0 ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
            Este almacén no tiene SSD de aceleración (L2ARC / SLOG / metadatos). Puedes añadir uno desde «⋯ Acciones → + Caché SSD».
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {accel.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Zap size={13} style={{ color: 'var(--mod-storage)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>{a.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>{a.plain}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Propiedades ───────────────────────────────────────────────
function PropertiesTab({ pool, onOpenProps }: { pool: ZfsPoolObservation; onOpenProps: () => void }) {
  const caps = useStorageStore((s) => s.zfs_capabilities);
  const setAutotrim = useStorageStore((s) => s.zfsSetAutotrim);
  const upgrade = useStorageStore((s) => s.zfsUpgradePool);
  const [autotrimBusy, setAutotrimBusy] = useState(false);
  const features = pool.features ?? [];
  const inactive = features.filter((f) => !f.active);

  const onToggleAutotrim = async () => {
    if (caps?.can_autotrim === false) return;
    const next = pool.autotrim !== 'on';
    setAutotrimBusy(true);
    try { await setAutotrim(pool.name, next); toast.success(`TRIM automático ${next ? 'activado' : 'desactivado'}`); }
    catch (e) { toast.error(`No se pudo cambiar el TRIM automático: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setAutotrimBusy(false); }
  };

  const onUpgrade = async () => {
    try { await upgrade(pool.name); toast.success('Funciones del pool actualizadas'); }
    catch (e) { toast.error(`No se pudo actualizar: ${e instanceof Error ? e.message : String(e)}`); }
  };

  const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: '0.8125rem', padding: '8px 0', borderBottom: '1px solid var(--border)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={row}>
        <span style={{ color: 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          Tamaño de bloque (ashift) <InfoTip text={ZFS_COPY.ashift} />
        </span>
        <strong style={{ ...mono, color: 'var(--text)' }}>{pool.ashift ?? '—'}</strong>
      </div>
      <div style={row}>
        <span style={{ color: 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          TRIM automático <InfoTip text={ZFS_COPY.autotrim} />
        </span>
        <button
          onClick={onToggleAutotrim}
          disabled={autotrimBusy || caps?.can_autotrim === false}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--radius-pill, 999px)',
            border: '1px solid var(--border)', cursor: caps?.can_autotrim === false ? 'not-allowed' : 'pointer',
            background: pool.autotrim === 'on' ? 'color-mix(in srgb, var(--success,#22c55e) 14%, transparent)' : 'transparent',
            color: pool.autotrim === 'on' ? 'var(--success,#22c55e)' : 'var(--text-dim)', fontSize: '0.75rem', fontWeight: 600,
            opacity: caps?.can_autotrim === false ? 0.6 : 1,
          }}
        >
          {pool.autotrim === 'on' ? 'Activado' : 'Desactivado'}
        </button>
      </div>
      <div style={{ ...row, alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
        <span style={{ color: 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          Funciones del almacén <InfoTip text={ZFS_COPY.features} />
        </span>
        {features.length === 0 ? (
          <span style={{ color: 'var(--text-dim)' }}>—</span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {features.map((f) => (
              <span key={f.name} style={{
                ...chip, fontFamily: 'var(--font-mono, monospace)',
                background: f.active ? 'color-mix(in srgb, var(--success,#22c55e) 12%, transparent)' : 'transparent',
                color: f.active ? 'var(--success,#22c55e)' : 'var(--text-dim)',
              }} title={f.active ? 'Activa' : 'Inactiva (puede activarse al actualizar)'}>
                {f.active ? '●' : '○'} {f.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: '0.8125rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: (caps?.can_upgrade === false || inactive.length === 0) ? 'not-allowed' : 'pointer', opacity: (caps?.can_upgrade === false || inactive.length === 0) ? 0.6 : 1 }}
          disabled={caps?.can_upgrade === false || inactive.length === 0}
          onClick={onUpgrade}
        >
          <ArrowUpCircle size={14} /> {inactive.length > 0 ? `Actualizar funciones (${inactive.length})` : 'Todo actualizado'}
          <InfoTip text={ZFS_COPY.upgrade} />
        </button>
        <button
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: '0.8125rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}
          onClick={onOpenProps}
        >
          <Settings2 size={14} /> Más propiedades…
        </button>
      </div>
    </div>
  );
}

// ── PoolCard ────────────────────────────────────────────────────────
export function ZfsPoolCard({ pool }: { pool: ZfsPoolObservation }) {
  const caps = useStorageStore((s) => s.zfs_capabilities);
  const scrub = useStorageStore((s) => s.zfsScrub);
  const stopScrub = useStorageStore((s) => s.zfsStopScrub);
  const trim = useStorageStore((s) => s.zfsTrim);
  const clearErrors = useStorageStore((s) => s.zfsClearErrors);
  const destroy = useStorageStore((s) => s.zfsDestroyPool);

  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<'disks' | 'capacity' | 'props'>('disks');
  const [modal, setModal] = useState<null | 'cache' | 'spare' | 'props' | 'export'>(null);

  const cap = pool.cap_pct;
  const capColor = cap == null ? 'var(--text-dim)' : cap >= 90 ? 'var(--error,#ef4444)' : cap >= 80 ? 'var(--warning,#f59e0b)' : 'var(--success,#22c55e)';
  const errors = aggErrors(pool);
  const encrypted = (pool.features ?? []).some((f) => f.name.toLowerCase().includes('encrypt') && f.active);
  const hasSpare = (pool.spares?.length ?? 0) > 0;

  // ── Wrappers de acción con toast + manejo de error ──
  const wrap = (fn: () => Promise<void>, ok: string) => async () => {
    try { await fn(); toast.success(ok); } catch (e) { toast.error(String(e instanceof Error ? e.message : e)); }
  };
  const onScrub = wrap(() => scrub(pool.name), `Verificación iniciada en ${pool.name}`);
  const onStopScrub = wrap(() => stopScrub(pool.name), `Verificación detenida en ${pool.name}`);
  const onTrim = wrap(() => trim(pool.name), `TRIM iniciado en ${pool.name}`);
  const onClear = wrap(() => clearErrors(pool.name), `Errores de ${pool.name} puestos a cero`);
  const onDestroy = async () => {
    if (!window.confirm(`¿Destruir el almacén "${pool.name}"? Esto borra TODOS sus datos y no se puede deshacer.`)) return;
    try { await destroy(pool.name); toast.success(`Almacén ${pool.name} destruido`); } catch (e) { toast.error(String(e instanceof Error ? e.message : e)); }
  };

  const scrubbing = pool.scrub_state === 'scanning';
  const confirmSimple = (msg: string, fn: () => void) => () => { if (window.confirm(msg)) fn(); };

  // ── Grupos del menú «⋯ Acciones» ──
  const groups: { label: string; items: MenuAction[] }[] = [
    {
      label: 'Mantenimiento',
      items: [
        scrubbing
          ? { key: 'stop-scrub', label: 'Detener verificación', icon: Snowflake, enabled: caps?.can_scrub !== false, disabledHint: 'Tu plataforma no permite gestionar la verificación.', onClick: confirmSimple(`¿Detener la verificación de "${pool.name}"?`, onStopScrub) }
          : { key: 'scrub', label: 'Verificar (scrub)', icon: Waves, enabled: caps?.can_scrub !== false, disabledHint: 'Tu plataforma no permite verificar el pool.', onClick: onScrub },
        { key: 'trim', label: 'TRIM (limpiar SSD)', icon: Snowflake, enabled: caps?.can_trim !== false, disabledHint: 'Tu plataforma no permite lanzar TRIM.', onClick: onTrim },
        { key: 'clear', label: 'Limpiar errores', icon: RefreshCw, enabled: caps?.can_clear !== false && errors.total > 0, disabledHint: caps?.can_clear === false ? 'Tu plataforma no permite limpiar errores.' : 'No hay errores que limpiar.', onClick: confirmSimple(`¿Poner a cero los contadores de error de "${pool.name}"?`, onClear) },
      ],
    },
    {
      label: 'Capacidad',
      items: [
        { key: 'add-cache', label: '+ Caché SSD', icon: Zap, enabled: caps?.can_expand_vdev !== false, disabledHint: 'Tu plataforma no permite ampliar el pool.', onClick: () => setModal('cache') },
        { key: 'add-data', label: '+ Disco de datos', icon: Database, enabled: caps?.can_expand_vdev !== false, disabledHint: 'Tu plataforma no permite ampliar el pool.', onClick: () => setModal('cache') },
        { key: 'add-spare', label: '+ Disco de repuesto', icon: ShieldCheck, enabled: caps?.can_add_spare !== false, disabledHint: 'Tu plataforma no permite añadir repuestos.', onClick: () => setModal('spare') },
      ],
    },
    {
      label: 'Avanzado',
      items: [
        { key: 'props', label: 'Propiedades', icon: Settings2, enabled: caps?.can_set_pool_prop !== false, disabledHint: 'Tu plataforma no permite cambiar propiedades.', onClick: () => setModal('props') },
        { key: 'upgrade', label: 'Actualizar funciones', icon: ArrowUpCircle, enabled: caps?.can_upgrade !== false, disabledHint: 'Tu plataforma no permite actualizar el pool.', onClick: () => { setModal('props'); } },
        { key: 'export', label: 'Exportar', icon: Download, enabled: caps?.can_export !== false, disabledHint: 'Tu plataforma no permite exportar el pool.', onClick: () => setModal('export') },
      ],
    },
    {
      label: 'Peligro',
      items: [
        { key: 'destroy', label: 'Destruir', icon: Trash2, enabled: caps?.can_destroy_pool !== false, disabledHint: 'Tu plataforma no permite destruir pools.', onClick: onDestroy, danger: true },
      ],
    },
  ];

  const openDisksTab = () => { setExpanded(true); setTab('disks'); };

  return (
    <div style={card}>
      {/* Cabecera densa: identidad + salud + acciones */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <HardDrive size={18} style={{ color: 'var(--mod-storage)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ ...mono, fontSize: '1.0625rem', color: 'var(--text)' }}>{pool.name}</strong>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 'var(--radius-pill, 999px)',
              fontSize: '0.6875rem', fontWeight: 700,
              background: `color-mix(in srgb, ${healthColor(pool.health)} 15%, transparent)`,
              color: healthColor(pool.health),
            }}>
              ● {healthLabel(pool.health)}
            </span>
          </div>
        </div>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', ...mono, flexShrink: 0 }}>
          {fmtBytes(pool.alloc_bytes)} / {fmtBytes(pool.size_bytes)}
        </span>
        <ActionsMenu groups={groups} />
      </div>

      {/* Barra de capacidad + chip RAW */}
      {cap != null && (
        <>
          <div style={{ height: 12, background: 'var(--bg, #0001)', borderRadius: 6, overflow: 'hidden', marginBottom: 6, border: '1px solid var(--border)' }}>
            <div style={{ width: `${Math.min(cap, 100)}%`, height: '100%', background: capColor, transition: 'width .2s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 12 }}>
            <span>{cap}% ocupado · {fmtBytes(pool.free_bytes)} libres</span>
            <span style={{ ...chip }} title="Capacidad bruta total de los discos (antes de reservar espacio para la protección).">
              RAW {fmtBytes(pool.size_bytes)}
            </span>
          </div>
        </>
      )}

      {/* Fila de CHIPS de salud */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        {/* Scrub */}
        <span style={{ ...chip }}>
          <Waves size={11} />
          {pool.scrub_state === 'scanning'
            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                Verificando {pool.scrub_progress_pct != null ? `${pool.scrub_progress_pct}%` : ''}
                <span style={{ width: 40, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${pool.scrub_progress_pct ?? 0}%`, background: 'var(--warning,#f59e0b)' }} />
                </span>
              </span>
            : pool.scrub_state === 'finished'
              ? <>Verificado {fmtRelDays(pool.scrub_finished_at)}</>
              : pool.scrub_state === 'canceled'
                ? <>Verificación cancelada</>
                : <>Sin verificar</>}
          <InfoTip text="Un «scrub» lee todos los datos del almacén y repara silenciosamente cualquier corrupción usando la protección RAID. Conviene hacerlo cada mes." />
        </span>

        {/* Errores */}
        <button
          onClick={errors.total > 0 ? openDisksTab : undefined}
          style={{
            ...chip,
            cursor: errors.total > 0 ? 'pointer' : 'default',
            color: errors.total > 0 ? 'var(--error,#ef4444)' : 'var(--text-dim)',
            borderColor: errors.total > 0 ? 'var(--error,#ef4444)55' : 'var(--border)',
          }}
          title={errors.total > 0 ? 'Pulsa para ver los discos afectados' : 'Sin errores registrados'}
        >
          {errors.total > 0 ? <ShieldAlert size={11} /> : <ShieldCheck size={11} />}
          {errors.total > 0 ? `${errors.total} error${errors.total === 1 ? '' : 'es'}` : 'Sin errores'}
        </button>

        {/* Repuesto */}
        <span style={{ ...chip, color: hasSpare ? 'var(--success,#22c55e)' : 'var(--text-dim)' }}>
          <ShieldCheck size={11} /> {hasSpare ? `${pool.spares!.length} repuesto${pool.spares!.length === 1 ? '' : 's'}` : 'Sin repuesto'}
          <InfoTip text={ZFS_COPY.spare} />
        </span>

        {/* Cifrado / Features */}
        <span style={{ ...chip, color: encrypted ? 'var(--success,#22c55e)' : 'var(--text-dim)' }}>
          {encrypted ? <Lock size={11} /> : <Settings2 size={11} />}
          {encrypted ? 'Cifrado' : `${(pool.features ?? []).filter((f) => f.active).length} funciones`}
        </span>
      </div>

      {/* Toggle ver discos y detalles */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, padding: '6px 0',
          background: 'transparent', border: 'none', color: 'var(--mod-storage, var(--accent))',
          fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
        }}
      >
        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        {expanded ? 'Ocultar discos y detalles' : 'Ver discos y detalles'}
      </button>

      {/* Zona ampliable con tab-bar inline */}
      {expanded && (
        <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
            {([['disks', 'Discos'], ['capacity', 'Capacidad'], ['props', 'Propiedades']] as const).map(([k, lbl]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                style={{
                  padding: '7px 12px', background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: '0.8125rem', fontWeight: 600,
                  color: tab === k ? 'var(--mod-storage, var(--accent))' : 'var(--text-dim)',
                  borderBottom: `2px solid ${tab === k ? 'var(--mod-storage, var(--accent))' : 'transparent'}`,
                  marginBottom: -1,
                }}
              >
                {lbl}
              </button>
            ))}
          </div>
          {tab === 'disks' && <DisksTab pool={pool} />}
          {tab === 'capacity' && <CapacityTab pool={pool} />}
          {tab === 'props' && <PropertiesTab pool={pool} onOpenProps={() => setModal('props')} />}
        </div>
      )}

      {/* Modales a nivel pool */}
      {modal === 'cache' && <AddCacheForm pool={pool.name} onClose={() => setModal(null)} />}
      {modal === 'spare' && <AddSpareForm pool={pool.name} onClose={() => setModal(null)} />}
      {modal === 'props' && <PoolPropsModal pool={pool} onClose={() => setModal(null)} />}
      {modal === 'export' && <ExportPoolConfirm pool={pool.name} onClose={() => setModal(null)} />}
    </div>
  );
}
