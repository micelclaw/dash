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

import { useEffect } from 'react';
import { Database, RefreshCw, FileText, FlaskConical } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { StorageSummaryCard } from './components/StorageSummaryCard';
import { DataUsageChart } from './components/DataUsageChart';
import { DiskList } from './components/DiskList';
import { DemoModeBanner } from './components/DemoModeBanner';
import { ZfsSection } from './components/ZfsSection';
import { FileStatsCard } from './components/FileStatsCard';
import { FileDuplicatesCard } from './components/FileDuplicatesCard';
import { CollapsibleSection } from './components/CollapsibleSection';

export function Component() {
  const loading = useStorageStore((s) => s.loading);
  const error = useStorageStore((s) => s.error);
  const status = useStorageStore((s) => s.status);
  const zfsDemo = useStorageStore((s) => s.zfs_demo);
  const fetchAll = useStorageStore((s) => s.fetchAll);
  const setPreviewMode = useStorageStore((s) => s.setPreviewMode);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const isDemo = zfsDemo;

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
          Retry
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
          lectura. */}
      <div className="[&>*]:shrink-0" style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{
          maxWidth: 1400, margin: '0 auto',
          display: 'flex', flexDirection: 'column', gap: 24,
        }}>
          {isDemo && <DemoModeBanner onExit={() => setPreviewMode(false)} />}

          {/* Resumen de capacidad: contexto rápido arriba del todo. */}
          <StorageSummaryCard status={status} />

          {/* Uso de datos a lo largo del tiempo: contexto temprano, justo debajo
              del resumen de capacidad. */}
          <DataUsageChart />

          {/* HÉROE: el NAS ZFS es el protagonista — primero y bien visible.
              Se auto-oculta si el backend ZFS no aplica. */}
          <ZfsSection />

          {/* Discos físicos (cuadro unificado con columnas SMART por fila). */}
          <DiskList />

          {/* Secundario: estadísticas y duplicados de archivos, colapsado por
              defecto para que no compita con el NAS. El data-attr es el ancla del
              "Ver detalles de archivos" del panel Uso de datos (scrollIntoView). */}
          <div data-storage-file-stats>
          <CollapsibleSection
            title="Detalles de archivos"
            icon={<FileText size={16} />}
            defaultOpen={false}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <FileStatsCard />
              <FileDuplicatesCard />
            </div>
          </CollapsibleSection>
          </div>
        </div>
      </div>
    </div>
  );
}
