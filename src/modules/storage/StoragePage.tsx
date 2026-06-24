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

import { useEffect, useState } from 'react';
import {
  Database, RefreshCw, FileText, FlaskConical, PieChart, HardDrive, Disc3,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { StorageSummaryCard } from './components/StorageSummaryCard';
import { DataUsageChart } from './components/DataUsageChart';
import { DiskList } from './components/DiskList';
import { DemoModeBanner } from './components/DemoModeBanner';
import { ZfsSection } from './components/ZfsSection';
import { FileStatsCard } from './components/FileStatsCard';
import { FileDuplicatesCard } from './components/FileDuplicatesCard';
import { SectionHeader } from './components/SectionHeader';

// ─── Navegación por anclas ─────────────────────────────────────────
// Cada chip lleva al `id` de la cabecera de su zona (scrollIntoView). El
// id «detalles» además abre la zona colapsada de detalles de archivos.
const ZONES = [
  { id: 'zona-uso', label: 'Uso de datos' },
  { id: 'zona-zfs', label: 'Almacenamiento ZFS' },
  { id: 'zona-discos', label: 'Discos físicos' },
  { id: 'zona-detalles', label: 'Detalles' },
] as const;

function AnchorNav({ onJump }: { onJump: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{
        fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)',
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        Ir a
      </span>
      {ZONES.map((z) => (
        <button
          key={z.id}
          type="button"
          onClick={() => onJump(z.id)}
          style={{
            padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-pill, 999px)',
            background: 'transparent', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover, var(--card))'; e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)'; }}
        >
          {z.label}
        </button>
      ))}
    </div>
  );
}

// Zona = cabecera grande + contenido, con su propio aire interno.
function Zone({ children }: { children: React.ReactNode }) {
  return <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</section>;
}

export function Component() {
  const loading = useStorageStore((s) => s.loading);
  const error = useStorageStore((s) => s.error);
  const status = useStorageStore((s) => s.status);
  const disks = useStorageStore((s) => s.disks);
  const pools = useStorageStore((s) => s.zfs_pools);
  const caps = useStorageStore((s) => s.zfs_capabilities);
  const zfsDemo = useStorageStore((s) => s.zfs_demo);
  const fetchAll = useStorageStore((s) => s.fetchAll);
  const setPreviewMode = useStorageStore((s) => s.setPreviewMode);

  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const isDemo = zfsDemo;
  const hardened = caps?.level === 'zfs-hardened';

  const jumpTo = (id: string) => {
    if (id === 'zona-detalles') setDetailsOpen(true);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (error && !status) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: 12, padding: 32, textAlign: 'center',
      }}>
        <div style={{ fontSize: '0.875rem', color: 'var(--error)', fontFamily: 'var(--font-sans)' }}>{error}</div>
        <button
          onClick={fetchAll}
          style={{
            padding: '6px 14px', background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)', cursor: 'pointer',
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <Database size={18} style={{ color: 'var(--mod-storage)' }} />
        <h1 style={{
          fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: 0,
          fontFamily: 'var(--font-sans)', flex: 1,
        }}>
          Storage
        </h1>
        {!isDemo && (
          <button
            onClick={() => setPreviewMode(true)}
            title="Ver una demo simulada del NAS ZFS"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.75rem',
              fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <FlaskConical size={14} /> Vista previa (demo)
          </button>
        )}
        <button
          onClick={fetchAll}
          disabled={loading}
          title="Refresh"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 30, height: 30, background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
        </button>
      </div>

      {/* Scroll container. `[&>*]:shrink-0` evita que flexbox aplaste a 0 las
          secciones con overflow:hidden cuando una tarjeta grande genera overflow:
          deben mantener su alto natural y dejar que este contenedor haga scroll.
          El inner wrapper centra el contenido y le pone un ancho máximo cómodo de
          lectura. El gap entre zonas (28px) es mayor que el gap interno de cada
          zona (16px) para que la jerarquía se lea de un vistazo. */}
      <div className="[&>*]:shrink-0" style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{
          maxWidth: 1400, margin: '0 auto',
          display: 'flex', flexDirection: 'column', gap: 28,
        }}>
          {isDemo && <DemoModeBanner onExit={() => setPreviewMode(false)} />}

          {/* Franja-resumen de primer vistazo: capacidad + pools + discos + salud. */}
          <StorageSummaryCard status={status} poolCount={pools.length} diskCount={disks.length} />

          {/* Navegación por anclas a cada zona. */}
          <AnchorNav onJump={jumpTo} />

          {/* Zona: Uso de datos */}
          <Zone>
            <SectionHeader
              id="zona-uso"
              icon={<PieChart size={18} />}
              title="Uso de datos"
              subtitle="En qué se está gastando tu espacio: por categoría, por almacén o por carpeta."
            />
            <DataUsageChart />
          </Zone>

          {/* Zona: Almacenamiento ZFS (la protagonista) */}
          <Zone>
            <SectionHeader
              id="zona-zfs"
              emphasis
              icon={<HardDrive size={20} />}
              title="Almacenamiento ZFS"
              subtitle="Tus almacenes (pools), carpetas e instantáneas, con protección ante fallos de disco."
              right={caps ? (
                <>
                  <span style={{
                    padding: '3px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.6875rem', fontWeight: 600,
                    background: hardened ? 'var(--success-bg, #22c55e22)' : 'var(--surface)',
                    color: hardened ? 'var(--success, #22c55e)' : 'var(--text-dim)',
                    border: '1px solid var(--border)',
                  }}>
                    {caps.level}
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>{caps.platform}</span>
                  {isDemo && <span style={{ fontSize: '0.6875rem', color: 'var(--mod-storage, var(--accent))', fontWeight: 600 }}>· DEMO</span>}
                </>
              ) : undefined}
            />
            <ZfsSection />
          </Zone>

          {/* Zona: Discos físicos */}
          <Zone>
            <SectionHeader
              id="zona-discos"
              icon={<Disc3 size={18} />}
              title="Discos físicos"
              subtitle="Cada unidad detectada, con su estado de salud SMART, temperatura y particiones."
              right={
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                  {disks.length} {disks.length === 1 ? 'disco' : 'discos'}
                </span>
              }
            />
            <DiskList />
          </Zone>

          {/* Zona: Detalles de archivos (secundaria, colapsada por defecto).
              El data-attr es el ancla del "Ver detalles de archivos" del panel
              Uso de datos (scrollIntoView). */}
          <section
            data-storage-file-stats
            style={{ display: 'flex', flexDirection: 'column', gap: 16, scrollMarginTop: 16 }}
          >
            <SectionHeader
              id="zona-detalles"
              icon={<FileText size={18} />}
              title="Detalles de archivos"
              subtitle="Estadísticas por tipo y archivos duplicados que puedes recuperar."
              right={
                <button
                  type="button"
                  onClick={() => setDetailsOpen((v) => !v)}
                  aria-expanded={detailsOpen}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                    background: 'transparent', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.75rem',
                    fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  {detailsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {detailsOpen ? 'Ocultar' : 'Mostrar'}
                </button>
              }
            />
            {detailsOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <FileStatsCard />
                <FileDuplicatesCard />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
