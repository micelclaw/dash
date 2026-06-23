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
} from 'lucide-react';
import { formatFileSize } from '@/lib/file-utils';
import { useStorageStore } from '@/stores/storage.store';
import type { Disk, Partition } from '../types';
import { InfoTip } from './ZfsHelp';
import { SmartHistoryModal } from './SmartHistoryModal';

const TYPE_CONFIG: Record<string, { icon: typeof Cpu; color: string; label: string }> = {
  ssd: { icon: Cpu, color: '#3b82f6', label: 'SSD' },
  hdd: { icon: Disc3, color: '#6b7280', label: 'HDD' },
  unknown: { icon: Disc3, color: '#6b7280', label: 'Disco' },
};

const SMART_COLORS: Record<string, string> = {
  healthy: '#22c55e',
  warning: '#f97316',
  critical: '#f43f5e',
};
const SMART_LABELS: Record<string, string> = {
  healthy: 'En buen estado',
  warning: 'Aviso',
  critical: 'Crítico',
};

// Tipo "humano": NVMe se detecta por el transporte aunque el backend lo
// clasifique como ssd (no hay un literal 'nvme' en Disk['type']).
function diskTypeConfig(disk: Disk): { icon: typeof Cpu; color: string; label: string } {
  const t = (disk.transport ?? '').toLowerCase();
  if (t.includes('nvme')) return { icon: Zap, color: '#8b5cf6', label: 'NVMe' };
  return TYPE_CONFIG[disk.type] || { icon: Disc3, color: '#6b7280', label: 'Disco' };
}

// Texto de asignación tipo Synology. Si el disco está en un pool conocido
// (campo pool) lo nombramos; si solo tenemos allocation, mapeamos.
function allocationText(disk: Disk): string {
  if (disk.pool) return `A un pool: ${disk.pool}`;
  switch (disk.allocation) {
    case 'pool': return 'A un pool';
    case 'system': return 'Sistema';
    case 'spare': return 'Reserva';
    case 'unconfigured': return 'Libre';
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
  const cfg = diskTypeConfig(disk);
  const smartColor = disk.smart_status ? (SMART_COLORS[disk.smart_status] ?? '#6b7280') : '#6b7280';
  const smartLabel = disk.smart_status ? (SMART_LABELS[disk.smart_status] ?? disk.smart_status) : 'Sin datos';

  const rows: { label: string; value: React.ReactNode; tip?: string }[] = [
    { label: 'ID de unidad', value: disk.device },
    { label: 'Proveedor', value: disk.vendor ?? '—' },
    { label: 'Modelo', value: disk.model || '—' },
    { label: 'Nº de serie', value: disk.serial ?? '—' },
    { label: 'Tamaño', value: formatFileSize(disk.size_bytes) },
    { label: 'Tipo', value: cfg.label },
    { label: 'Interfaz', value: disk.transport ?? '—' },
    {
      label: 'Asignación', value: allocationText(disk),
      tip: 'Indica para qué se usa el disco: dentro de un pool de almacenamiento, reservado para el sistema, libre (sin asignar) o como disco de reserva (spare).',
    },
    {
      label: 'Estado',
      value: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: smartColor }} />
          <span style={{ color: 'var(--text)' }}>{smartLabel}</span>
        </span>
      ),
      tip: 'Salud SMART de la unidad reportada por el firmware del disco. "En buen estado" = sin avisos; "Aviso"/"Crítico" = revisa el historial SMART y considera reemplazarlo.',
    },
    { label: 'Temperatura', value: disk.temperature_c != null ? `${disk.temperature_c}°C` : '—' },
    { label: 'Firmware', value: disk.firmware ?? '—' },
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
  if (!partitions.length) {
    return <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '4px 0 4px 28px' }}>Sin particiones</div>;
  }
  return (
    <div style={{ padding: '4px 0 8px 28px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', fontFamily: 'var(--font-sans)' }}>
        <thead>
          <tr style={{ color: 'var(--text-muted)' }}>
            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>Partición</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>Montaje</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>FS</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 500 }}>Tamaño</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 500 }}>Usado</th>
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
      toast.success(`Test SMART ${kind === 'short' ? 'corto' : 'largo'} iniciado en ${disk.device}`);
    } catch (e) {
      toast.error(`No se pudo iniciar el test SMART: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTesting(false);
    }
  };

  const demoAction = (name: string) => {
    setActionMenu(false);
    toast.info(`${name}: solo demo (no hay operación real disponible)`);
  };

  // Acciones del menú "Acción" — todas demo salvo SMART (que tiene su propio botón).
  const actions: { key: string; label: string; icon: typeof FlaskConical }[] = [
    { key: 'benchmark', label: 'Banco de pruebas', icon: FlaskConical },
    { key: 'secure-erase', label: 'Borrado seguro', icon: Eraser },
    { key: 'deactivate', label: 'Desactivar', icon: Power },
    { key: 'write-cache', label: 'Caché de escritura', icon: PenLine },
    { key: 'firmware', label: 'Actualizar firmware', icon: UploadCloud },
  ];

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 12px 12px 28px', position: 'relative' }}>
      {/* Ejecutar test SMART (menú corto/largo) */}
      <div style={{ position: 'relative' }}>
        <button style={actionBtn} disabled={testing} onClick={() => setSmartMenu((v) => !v)}>
          <Activity size={13} /> {testing ? 'Iniciando…' : 'Ejecutar test SMART'}
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
                Test corto <InfoTip text="Comprobación rápida (1-2 min) de los componentes electromecánicos principales." />
              </button>
              <button style={menuItem} onClick={() => runTest('long')}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                Test largo <InfoTip text="Análisis exhaustivo de toda la superficie del disco. Puede tardar horas; se ejecuta en segundo plano." />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Historial SMART */}
      <button style={actionBtn} onClick={() => setHistoryOpen(true)}>
        <History size={13} /> Historial SMART
      </button>

      {/* Localizar unidad (demo) */}
      <button style={actionBtn} onClick={() => toast.info(`Parpadeando la bahía de ${disk.device}… (demo)`)}>
        <Lightbulb size={13} /> Localizar unidad
      </button>

      {/* Menú "Acción" (operaciones demo) */}
      <div style={{ position: 'relative' }}>
        <button style={actionBtn} onClick={() => setActionMenu((v) => !v)}>
          <MoreHorizontal size={13} /> Acción
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

function DiskRow({ disk }: { disk: Disk }) {
  const expanded_disks = useStorageStore((s) => s.expanded_disks);
  const toggleDisk = useStorageStore((s) => s.toggleDisk);
  const smart_cache = useStorageStore((s) => s.smart_cache);
  const capabilities = useStorageStore((s) => s.capabilities);

  const isExpanded = expanded_disks.includes(disk.id);
  const cfg = diskTypeConfig(disk);
  const Icon = cfg.icon;
  const smart = smart_cache[disk.id];

  return (
    <Fragment>
      <div
        onClick={() => toggleDisk(disk.id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
          cursor: 'pointer', borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {isExpanded ? <ChevronDown size={14} style={{ color: 'var(--text-dim)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-dim)' }} />}
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem', color: 'var(--text)' }}>{disk.device}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{disk.model}</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '1px 6px', background: `${cfg.color}18`, borderRadius: 'var(--radius-sm)',
          fontSize: '0.6875rem', color: cfg.color,
        }}>
          <Icon size={10} /> {cfg.label}
        </span>
        {disk.smart_status && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem',
            color: 'var(--text-dim)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: SMART_COLORS[disk.smart_status] ?? '#6b7280' }} />
            {SMART_LABELS[disk.smart_status] ?? disk.smart_status}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>
          {formatFileSize(disk.size_bytes)}
        </span>
        {/* Inline SMART temp if expanded + available */}
        {isExpanded && capabilities?.can_get_smart && smart && (
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            {smart.temperature_c != null ? `${smart.temperature_c}°C` : ''}
          </span>
        )}
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
  const disks = useStorageStore((s) => s.disks);

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{
          fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)',
          fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          Discos físicos
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
          {disks.length} {disks.length === 1 ? 'disco' : 'discos'}
        </span>
      </div>
      {disks.length === 0 ? (
        <div style={{ padding: '20px 14px', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          No se han detectado discos
        </div>
      ) : (
        disks.map((disk) => <DiskRow key={disk.id} disk={disk} />)
      )}
    </div>
  );
}
