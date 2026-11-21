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

// ─── Discos físicos (ficha tipo Synology) ──────────────────────────
// Cada disco se expande a una ficha completa (id, marca, modelo, serie, tamaño,
// tipo, interfaz, asignación, estado SMART, temperatura, firmware) + tabla de
// particiones + fila de acciones (test SMART corto/largo, historial SMART,
// localizar unidad y un menú "Acción" con operaciones demo). Solo el test e
// historial SMART tienen backend real; el resto son demo (toast informativo).

import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronRight, ChevronDown, Cpu, Disc3, Zap, Activity, History,
  Lightbulb, MoreHorizontal, FlaskConical, Eraser, Power, PenLine, UploadCloud,
  AlertTriangle,
} from 'lucide-react';
import { formatFileSize } from '@/lib/file-utils';
import { useStorageStore } from '@/stores/storage.store';
import { useI18n } from '@/i18n';
import type { Disk, Partition, SmartStatus } from '../types';
import { InfoTip } from './ZfsHelp';
import { SmartHistoryModal } from './SmartHistoryModal';

const TYPE_CONFIG: Record<string, { icon: typeof Cpu; color: string; label: string }> = {
  ssd: { icon: Cpu, color: '#3b82f6', label: 'SSD' },
  hdd: { icon: Disc3, color: '#6b7280', label: 'HDD' },
  unknown: { icon: Disc3, color: '#6b7280', label: '' },
};

const SMART_COLORS: Record<string, string> = {
  healthy: '#22c55e',
  warning: '#f97316',
  critical: '#f43f5e',
};

// Horas de encendido en formato compacto (igual que SmartStatusCard).
function formatHours(hours: number | null): string {
  if (hours == null) return '—';
  if (hours < 1000) return `${hours} h`;
  return `${(hours / 1000).toFixed(1)}k h`;
}

// Tipo "humano": NVMe se detecta por el transporte aunque el backend lo
// clasifique como ssd (no hay un literal 'nvme' en Disk['type']).
function diskTypeConfig(disk: Disk, unknownLabel: string): { icon: typeof Cpu; color: string; label: string } {
  const t = (disk.transport ?? '').toLowerCase();
  if (t.includes('nvme')) return { icon: Zap, color: '#8b5cf6', label: 'NVMe' };
  const config = TYPE_CONFIG[disk.type] ?? { icon: Disc3, color: '#6b7280', label: '' };
  return { ...config, label: config.label || unknownLabel };
}

// Texto de asignación tipo Synology. Si el disco está en un pool conocido
// (campo pool) lo nombramos; si solo tenemos allocation, mapeamos.
function allocationText(disk: Disk, t: (key: string, values?: Record<string, string | number>) => string): string {
  if (disk.pool) return t('storage.disk.allocationPool', { pool: disk.pool });
  switch (disk.allocation) {
    case 'pool': return t('storage.disk.inPool');
    case 'system': return t('storage.disk.system');
    case 'spare': return t('storage.disk.spare');
    case 'unconfigured': return t('storage.disk.free');
    default: return disk.allocation ?? 'Libre';
  }
}

function MiniBar({ percent }: { percent: number }) {
  return (
    <div style={{ width: 50, height: 5, background: 'var(--card)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${Math.min(percent, 100)}%`,
        background: percent > 90 ? '#f43f5e' : percent > 80 ? '#f97316' : 'var(--amber)',
        borderRadius: 3,
      }} />
    </div>
  );
}

// ── Ficha de detalles del disco (rejilla de pares clave/valor) ─────
function DetailGrid({ disk }: { disk: Disk }) {
  const { t } = useI18n();
  const cfg = diskTypeConfig(disk, t('storage.disk.disk'));
  const smartColor = disk.smart_status ? (SMART_COLORS[disk.smart_status] ?? '#6b7280') : '#6b7280';
  const smartLabel = disk.smart_status === 'healthy' ? t('storage.smart.healthy') : disk.smart_status === 'warning' ? t('storage.smart.warning') : disk.smart_status === 'critical' ? t('storage.smart.critical') : disk.smart_status ?? t('storage.disk.smartNoData');

  const rows: { label: string; value: React.ReactNode; tip?: string }[] = [
    { label: t('storage.disk.driveId'), value: disk.device },
    { label: t('storage.disk.vendor'), value: disk.vendor ?? '—' },
    { label: t('storage.disk.model'), value: disk.model || '—' },
    { label: t('storage.disk.serial'), value: disk.serial ?? '—' },
    { label: t('storage.disk.size'), value: formatFileSize(disk.size_bytes) },
    { label: t('storage.disk.type'), value: cfg.label },
    { label: t('storage.disk.interface'), value: disk.transport ?? '—' },
    {
      label: t('storage.disk.allocation'), value: allocationText(disk, t),
      tip: t('storage.disk.allocationHint'),
    },
    {
      label: t('storage.disk.state'),
      value: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: smartColor }} />
          <span style={{ color: 'var(--text)' }}>{smartLabel}</span>
        </span>
      ),
      tip: t('storage.disk.smartState'),
    },
    { label: t('storage.smart.temperature'), value: disk.temperature_c != null ? `${disk.temperature_c}°C` : '—' },
    { label: t('storage.disk.firmware'), value: disk.firmware ?? '—' },
  ];

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
      gap: '8px 20px', padding: '12px 12px 4px 28px',
    }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {r.label}{r.tip && <InfoTip text={r.tip} />}
          </span>
          <span style={{
            fontSize: '0.8125rem', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }} title={typeof r.value === 'string' ? r.value : undefined}>
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function PartitionTable({ partitions }: { partitions: Partition[] }) {
  const { t } = useI18n();
  if (!partitions.length) {
    return <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '4px 0 4px 28px' }}>{t('storage.disk.noPartitions')}</div>;
  }
  return (
    <div style={{ padding: '4px 0 8px 28px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', fontFamily: 'var(--font-sans)' }}>
        <thead>
          <tr style={{ color: 'var(--text-muted)' }}>
            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>{t('storage.disk.partition')}</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>{t('storage.disk.mount')}</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>{t('storage.disk.fs')}</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 500 }}>{t('storage.disk.size')}</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 500 }}>{t('storage.disk.used')}</th>
            <th style={{ padding: '4px 8px', width: 50 }} />
          </tr>
        </thead>
        <tbody>
          {partitions.map((p) => {
            const percent = p.used_bytes != null && p.size_bytes > 0 ? (p.used_bytes / p.size_bytes) * 100 : 0;
            return (
              <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '5px 8px', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>{p.id}</td>
                <td style={{ padding: '5px 8px', color: p.mount ? 'var(--text)' : 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>{p.mount ?? '—'}</td>
                <td style={{ padding: '5px 8px', color: 'var(--text-dim)' }}>{p.filesystem ?? '—'}</td>
                <td style={{ padding: '5px 8px', color: 'var(--text-dim)', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }}>{formatFileSize(p.size_bytes)}</td>
                <td style={{ padding: '5px 8px', color: 'var(--text-dim)', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }}>{p.used_bytes != null ? formatFileSize(p.used_bytes) : '—'}</td>
                <td style={{ padding: '5px 8px' }}>{p.used_bytes != null ? <MiniBar percent={percent} /> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Botones de acción ──────────────────────────────────────────────
const actionBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px',
  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
const menuItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px',
  background: 'transparent', border: 'none', color: 'var(--text)', fontSize: '0.8125rem',
  cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)',
};

function DiskActions({ disk }: { disk: Disk }) {
  const { t } = useI18n();
  const smartTest = useStorageStore((s) => s.smartTest);
  const [smartMenu, setSmartMenu] = useState(false);
  const [actionMenu, setActionMenu] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [testing, setTesting] = useState(false);

  const runTest = async (kind: 'short' | 'long') => {
    setSmartMenu(false);
    setTesting(true);
    try {
      await smartTest(disk.id, kind);
      toast.success(t('storage.disk.testStarted', { kind: t(kind === 'short' ? 'storage.disk.testShort' : 'storage.disk.testLong'), device: disk.device }));
    } catch (e) {
      toast.error(t('storage.disk.testError', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setTesting(false);
    }
  };

  const demoAction = (name: string) => {
    setActionMenu(false);
    toast.info(t('storage.disk.demoAction', { name }));
  };

  // Acciones del menú "Acción" — todas demo salvo SMART (que tiene su propio botón).
  const actions: { key: string; label: string; icon: typeof FlaskConical }[] = [
    { key: 'benchmark', label: t('storage.disk.benchmark'), icon: FlaskConical },
    { key: 'secure-erase', label: t('storage.disk.secureErase'), icon: Eraser },
    { key: 'deactivate', label: t('storage.disk.deactivate'), icon: Power },
    { key: 'write-cache', label: t('storage.disk.writeCache'), icon: PenLine },
    { key: 'firmware', label: t('storage.disk.updateFirmware'), icon: UploadCloud },
  ];

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 12px 12px 28px', position: 'relative' }}>
      {/* Ejecutar test SMART (menú corto/largo) */}
      <div style={{ position: 'relative' }}>
        <button style={actionBtn} disabled={testing} onClick={() => setSmartMenu((v) => !v)}>
          <Activity size={13} /> {testing ? t('storage.disk.testStarting') : t('storage.disk.smartTest')}
        </button>
        {smartMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onClick={() => setSmartMenu(false)} />
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20, minWidth: 180,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)', overflow: 'hidden',
            }}>
              <button style={menuItem} onClick={() => runTest('short')}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                {t('storage.disk.testShort')} <InfoTip text={t('storage.disk.testShortHint')} />
              </button>
              <button style={menuItem} onClick={() => runTest('long')}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                {t('storage.disk.testLong')} <InfoTip text={t('storage.disk.testLongHint')} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Historial SMART */}
      <button style={actionBtn} onClick={() => setHistoryOpen(true)}>
        <History size={13} /> {t('storage.disk.history')}
      </button>

      {/* Localizar unidad (demo) */}
      <button style={actionBtn} onClick={() => toast.info(t('storage.disk.demoBlink', { device: disk.device }))}>
        <Lightbulb size={13} /> {t('storage.disk.locate')}
      </button>

      {/* Menú "Acción" (operaciones demo) */}
      <div style={{ position: 'relative' }}>
        <button style={actionBtn} onClick={() => setActionMenu((v) => !v)}>
          <MoreHorizontal size={13} /> {t('storage.disk.action')}
        </button>
        {actionMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onClick={() => setActionMenu(false)} />
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20, minWidth: 210,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)', overflow: 'hidden',
            }}>
              {actions.map((a) => {
                const ICon = a.icon;
                return (
                  <button key={a.key} style={menuItem} onClick={() => demoAction(a.label)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <ICon size={13} style={{ color: 'var(--text-dim)' }} /> {a.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {historyOpen && (
        <SmartHistoryModal diskId={disk.id} diskLabel={disk.device} onClose={() => setHistoryOpen(false)} />
      )}
    </div>
  );
}

// ── Rejilla compartida cabecera/fila ──────────────────────────────
// Una sola plantilla de columnas para que las celdas SMART queden alineadas
// fila a fila. Cuando hay datos SMART: chevron · disco · modelo · tipo ·
// estado · temp · power-on · sectores · capacidad. Sin SMART: degrada a
// chevron · disco · modelo · tipo · capacidad.
const GRID_WITH_SMART = '16px minmax(80px, max-content) minmax(0, 1fr) max-content max-content 56px 64px 84px max-content';
const GRID_NO_SMART = '16px minmax(80px, max-content) minmax(0, 1fr) max-content max-content';

const headCell: React.CSSProperties = {
  fontSize: '0.6875rem', fontWeight: 500, color: 'var(--text-muted)',
  fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
};

// Semáforo + etiqueta del estado SMART (con icono de aviso ámbar/rojo).
function SmartHealthCell({ smart }: { smart: SmartStatus | undefined }) {
  const { t } = useI18n();
  if (!smart) {
    return <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>—</span>;
  }
  const color = SMART_COLORS[smart.overall_status] ?? '#6b7280';
  const label = smart.overall_status === 'healthy' ? t('storage.smart.healthy') : smart.overall_status === 'warning' ? t('storage.smart.warning') : smart.overall_status === 'critical' ? t('storage.smart.critical') : smart.overall_status;
  const warn = smart.overall_status === 'warning' || smart.overall_status === 'critical';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
      {warn
        ? <AlertTriangle size={13} style={{ color, flexShrink: 0 }} />
        : <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />}
      <span style={{
        fontSize: '0.75rem', color: 'var(--text)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    </span>
  );
}

function DiskRow({ disk, showSmart }: { disk: Disk; showSmart: boolean }) {
  const { t } = useI18n();
  const expanded_disks = useStorageStore((s) => s.expanded_disks);
  const toggleDisk = useStorageStore((s) => s.toggleDisk);
  const smart_cache = useStorageStore((s) => s.smart_cache);

  const isExpanded = expanded_disks.includes(disk.id);
  const cfg = diskTypeConfig(disk, t('storage.disk.disk'));
  const Icon = cfg.icon;
  const smart = smart_cache[disk.id];
  const badSectors = smart ? smart.reallocated_sectors + smart.pending_sectors : 0;

  return (
    <Fragment>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${disk.device} — ${isExpanded ? t('storage.disk.collapse') : t('storage.disk.expand')}`}
        onClick={() => toggleDisk(disk.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDisk(disk.id); } }}
        style={{
          display: 'grid', gridTemplateColumns: showSmart ? GRID_WITH_SMART : GRID_NO_SMART,
          alignItems: 'center', gap: 10, padding: '10px 14px',
          cursor: 'pointer', borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {isExpanded ? <ChevronDown size={14} style={{ color: 'var(--text-dim)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-dim)' }} />}
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem', color: 'var(--text)', whiteSpace: 'nowrap' }}>{disk.device}</span>
        <span style={{
          fontSize: '0.75rem', color: 'var(--text-dim)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={disk.model}>{disk.model}</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, justifySelf: 'start',
          padding: '1px 6px', background: `${cfg.color}18`, borderRadius: 'var(--radius-sm)',
          fontSize: '0.6875rem', color: cfg.color, whiteSpace: 'nowrap',
        }}>
          <Icon size={10} /> {cfg.label}
        </span>

        {showSmart && (
          <>
            {/* Estado SMART */}
            <SmartHealthCell smart={smart} />
            {/* Temperatura */}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)', textAlign: 'right' }}>
              {smart?.temperature_c != null ? `${smart.temperature_c}°C` : '—'}
            </span>
            {/* Horas de encendido */}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)', textAlign: 'right' }}>
              {formatHours(smart?.power_on_hours ?? null)}
            </span>
            {/* Sectores defectuosos (rojo si >0) */}
            <span style={{
              fontSize: '0.75rem', fontFamily: 'var(--font-mono, monospace)', textAlign: 'right',
              color: badSectors > 0 ? '#f43f5e' : 'var(--text-dim)', fontWeight: badSectors > 0 ? 600 : 400,
            }}>
              {smart ? badSectors : '—'}
            </span>
          </>
        )}

        <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)', textAlign: 'right', whiteSpace: 'nowrap' }}>
          {formatFileSize(disk.size_bytes)}
        </span>
      </div>
      {isExpanded && (
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <DetailGrid disk={disk} />
          <PartitionTable partitions={disk.partitions} />
          <DiskActions disk={disk} />
        </div>
      )}
    </Fragment>
  );
}

export function DiskList() {
  const { t } = useI18n();
  const disks = useStorageStore((s) => s.disks);
  const smart_cache = useStorageStore((s) => s.smart_cache);
  // Mostramos las columnas SMART cuando hay datos SMART para algún disco
  // (ya no dependemos del tipo 'capabilities' legacy que se ha eliminado).
  const showSmart = Object.keys(smart_cache).length > 0;

  return (
    // El título "Discos físicos" + el contador los pinta el SectionHeader de la
    // zona en StoragePage; esta tarjeta es solo la tabla de discos.
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      {disks.length === 0 ? (
        <div style={{ padding: '20px 14px', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          {t('storage.disk.noDisks')}
        </div>
      ) : (
        <>
          {/* Cabeceras de columna (solo si hay datos SMART que alinear). */}
          {showSmart && (
            <div style={{
              display: 'grid', gridTemplateColumns: GRID_WITH_SMART, alignItems: 'center', gap: 10,
              padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
            }}>
              <span />
              <span style={headCell}>{t('storage.disk.disk')}</span>
              <span style={headCell}>{t('storage.disk.model')}</span>
              <span style={headCell}>{t('storage.disk.type')}</span>
              <span style={headCell}>{t('storage.disk.state')}</span>
              <span style={{ ...headCell, textAlign: 'right' }}>{t('storage.disk.temperature')}</span>
              <span style={{ ...headCell, textAlign: 'right' }}>{t('storage.disk.powerOn')}</span>
              <span style={{ ...headCell, textAlign: 'right', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                {t('storage.disk.sectors')} <InfoTip text={t('storage.disk.sectorsHint')} />
              </span>
              <span style={{ ...headCell, textAlign: 'right' }}>{t('storage.disk.capacity')}</span>
            </div>
          )}
          {disks.map((disk) => <DiskRow key={disk.id} disk={disk} showSmart={showSmart} />)}
        </>
      )}
    </div>
  );
}
