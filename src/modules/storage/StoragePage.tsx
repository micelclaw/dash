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
import { Database, RefreshCw, Server, FileText } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-media-query';
import { useStorageStore } from '@/stores/storage.store';
import { StorageSummaryCard } from './components/StorageSummaryCard';
import { DataUsageChart } from './components/DataUsageChart';
import { DiskList } from './components/DiskList';
import { VolumeTable } from './components/VolumeTable';
import { SmartStatusCard } from './components/SmartStatusCard';
import { PoolSection } from './components/PoolSection';
import { ShareSection } from './components/ShareSection';
import { NasLayerBanner } from './components/NasLayerBanner';
import { DemoModeBanner } from './components/DemoModeBanner';
import { ZfsSection } from './components/ZfsSection';
import { FileStatsCard } from './components/FileStatsCard';
import { FileDuplicatesCard } from './components/FileDuplicatesCard';
import { CollapsibleSection } from './components/CollapsibleSection';

export function Component() {
  const loading = useStorageStore((s) => s.loading);
  const error = useStorageStore((s) => s.error);
  const status = useStorageStore((s) => s.status);
  const capabilities = useStorageStore((s) => s.capabilities);
  const provider = useStorageStore((s) => s.provider);
  const fetchAll = useStorageStore((s) => s.fetchAll);
  const setPreviewMode = useStorageStore((s) => s.setPreviewMode);
  const isMobile = useIsMobile();

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const showSmart = capabilities?.can_get_smart ?? false;
  const showPools = capabilities?.can_create_pool ?? false;
  const showShares = capabilities?.can_manage_shares ?? false;
  const isDemo = provider === 'demo';

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
        {provider && (
          <span style={{
            padding: '2px 8px', background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', fontSize: '0.6875rem', color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono, monospace)',
          }}>
            {provider}
          </span>
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
          secciones con overflow:hidden (PoolSection/VolumeTable/ShareSection →
          min-height:0) cuando una tarjeta grande genera overflow: deben mantener
          su alto natural y dejar que este contenedor haga scroll. El inner wrapper
          centra el contenido y le pone un ancho máximo cómodo de lectura. */}
      <div className="[&>*]:shrink-0" style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{
          maxWidth: 1400, margin: '0 auto',
          display: 'flex', flexDirection: 'column', gap: 24,
        }}>
          {isDemo && <DemoModeBanner onExit={() => setPreviewMode(false)} />}

          {/* Resumen de capacidad: contexto rápido arriba del todo. */}
          <StorageSummaryCard status={status} />

          {/* HÉROE: el NAS ZFS es el protagonista — primero y bien visible.
              Se auto-oculta si el backend ZFS no aplica (capabilities null). */}
          <ZfsSection />

          {/* Discos físicos + SMART: lado a lado en escritorio, apilado en móvil. */}
          <div style={{
            display: 'flex', gap: 24,
            flexDirection: isMobile || !showSmart ? 'column' : 'row',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <DiskList />
            </div>
            {showSmart && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <SmartStatusCard />
              </div>
            )}
          </div>

          {/* Uso de datos a lo largo del tiempo. */}
          <DataUsageChart />

          {/* NAS clásico (OpenMediaVault): pools/volúmenes/carpetas. Solo cuando
              el proveedor expone estas capacidades (OMV o vista previa demo). */}
          {(showPools || showShares) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-dim)',
                fontFamily: 'var(--font-sans)', textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                <Server size={14} style={{ color: 'var(--mod-storage)' }} />
                NAS clásico (OpenMediaVault)
              </div>
              {showPools && <PoolSection />}
              <VolumeTable />
              {showShares && <ShareSection />}
            </div>
          )}

          {/* Secundario: estadísticas y duplicados de archivos, colapsado por
              defecto para que no compita con el NAS. */}
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

          {!showPools && provider && <NasLayerBanner provider={provider} onPreview={() => setPreviewMode(true)} />}
        </div>
      </div>
    </div>
  );
}
