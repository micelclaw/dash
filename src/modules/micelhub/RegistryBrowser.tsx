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

import { useState, useEffect, useCallback } from 'react';
import { Package, Upload, RefreshCw, Power, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { installApp, uninstallApp } from '@/services/apps.service';
import { useAppsStore } from '@/stores/apps.store';
import { useUiModulesStore } from '@/stores/ui-modules.store';
import type { InstalledApp } from '@/types/apps';

type RegistryStatus = 'installed' | 'available' | 'update_available';

interface RegistryApp {
  name: string;
  version: string;
  description?: string;
  level?: string;
  status?: RegistryStatus;
  claw_file?: string;
  manifest?: Record<string, unknown>;
}

interface RegistryBrowserProps {
  /** Abre el panel de detalles COMÚN (el de la derecha, compartido con las demás tabs). */
  onSelect: (app: InstalledApp) => void;
  /** Nombre del item seleccionado (para resaltar). */
  selectedName: string | null;
  /** Tras install/uninstall: refresca las tarjetas del registry en la pestaña Installed. */
  onChanged?: () => void;
}

// Mapea un item del registry (.claw del store) a la forma InstalledApp que consume el panel
// común AppDetail. El tag 'registry-available' marca los NO instalados (AppDetail oculta las
// acciones de footer para esos: se instalan/desinstalan desde la lista de aquí).
function toInstalledApp(r: RegistryApp): InstalledApp {
  const installed = r.status === 'installed' || r.status === 'update_available';
  const m = (r.manifest ?? {}) as Record<string, unknown>;
  const icon = (typeof m.icon === 'string' && m.icon) ? m.icon : '🔌';
  const mUi = m.ui as Record<string, unknown> | undefined;
  const mMod = mUi?.module as Record<string, unknown> | undefined;
  return {
    id: `registry-${r.name}`,
    app_name: r.name,
    version: r.version,
    app_level: (parseInt(String(r.level ?? '3').replace(/^L/i, ''), 10) || 3) as 1 | 2 | 3,
    status: installed ? 'active' : 'disabled',
    source: 'registry',
    install_path: null,
    manifest: {
      ...m,
      name: r.name,
      icon,
      description: (m.description as string) ?? r.description ?? '',
      tier_required: (m.tier_required as string) ?? 'free',
      tags: [...(installed ? [] : ['registry-available']), 'verified', 'free'],
      ...(mMod ? { ui: { ...mUi, module: { ...mMod, icon } } } : {}),
    },
    forked_from: null,
    installed_by: null,
    installed_at: '',
    updated_at: '',
  } as unknown as InstalledApp;
}

export function RegistryBrowser({ onSelect, selectedName, onChanged }: RegistryBrowserProps) {
  const [apps, setApps] = useState<RegistryApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set()); // app_names en curso (concurrentes)
  const [loadError, setLoadError] = useState<string | null>(null);
  const setRestartRequired = useAppsStore((s) => s.setRestartRequired);

  const startBusy = (n: string) => setBusy((prev) => new Set(prev).add(n));
  const endBusy = (n: string) => setBusy((prev) => { const next = new Set(prev); next.delete(n); return next; });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<{ data: RegistryApp[] }>('/apps/registry');
      setApps(res.data ?? []);
    } catch (err) {
      setLoadError((err as Error)?.message ?? 'No se pudo cargar el registry');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Enable = instalación real (POST /apps/install) de una app del store. source='registry'
  // → la fila queda desinstalable (a diferencia de 'local'=preinstalado). Algunas con backend
  // propio (legacy) requieren reiniciar Core; el resto NO.
  const handleEnable = async (app: RegistryApp) => {
    if (!app.claw_file) { toast.error('Paquete .claw no encontrado'); return; }
    startBusy(app.name);
    try {
      const res = await installApp(
        { source: 'registry', name: app.name, package_path: app.claw_file },
        { timeout: 120_000 }, // unpack + scan + copy + migraciones puede tardar >15s
      );
      if (res.requires_core_restart) {
        setRestartRequired('core', `${app.name} instalada — reinicia para activar el backend`);
        toast.success(`${app.name} instalada`);
      } else if (res.requires_openclaw_restart) {
        // .claw L1 (skill) → la recoge el Gateway al recargar, no Core.
        setRestartRequired('openclaw', `${app.name} instalada — recarga el Gateway para activarla`);
        toast.success(`${app.name} instalada`);
      } else {
        toast.success(`${app.name} instalada y lista`);
      }
      await load();
      onChanged?.();
      // Si este item está abierto en el panel común, refléjalo como instalado al instante
      // (sin esperar a que el usuario reclique).
      if (selectedName === app.name) onSelect(toInstalledApp({ ...app, status: 'installed' }));
      void useUiModulesStore.getState().refresh();
    } catch (err) {
      toast.error('No se pudo instalar la app', { description: (err as Error)?.message });
    } finally {
      endBusy(app.name);
    }
  };

  // Uninstall = DELETE con purge → borra el dir + la fila DB (el .claw SIGUE en el store
  // → vuelve a "available"). Algunas requieren reiniciar Core para descargar rutas/migraciones.
  const handleUninstall = async (app: RegistryApp) => {
    if (!window.confirm(`¿Desinstalar ${app.name}? Volverá a estar disponible para reinstalar.`)) return;
    startBusy(app.name);
    try {
      const res = await uninstallApp(app.name, true); // purge
      if (res.requires_restart) {
        setRestartRequired('core', `${app.name} desinstalada — reinicia para completar`);
      }
      toast.success(`${app.name} desinstalada`);
      await load();
      onChanged?.();
      if (selectedName === app.name) onSelect(toInstalledApp({ ...app, status: 'available' }));
      void useUiModulesStore.getState().refresh();
    } catch (err) {
      toast.error('No se pudo desinstalar la app', { description: (err as Error)?.message });
    } finally {
      endBusy(app.name);
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.claw,.zip';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setImporting(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        await api.upload('/apps/registry/import', formData, 'POST', { timeout: 120_000 });
        toast.success('App imported to registry');
        load();
      } catch (err) {
        toast.error('Failed to import app', { description: (err as Error)?.message });
      }
      setImporting(false);
    };
    input.click();
  };

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
        Loading registry...
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
          Local Registry ({apps.length})
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-dim)' }}>
            <RefreshCw size={12} />
          </button>
          <button
            onClick={handleImport}
            disabled={importing}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
              background: 'var(--amber)', color: '#06060a', border: 'none',
              borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            <Upload size={12} /> {importing ? 'Importing...' : 'Import .claw'}
          </button>
        </div>
      </div>

      {loadError ? (
        <div style={{ padding: 32, textAlign: 'center' }}>
          <Package size={32} style={{ color: 'var(--error)', opacity: 0.5, margin: '0 auto 8px' }} />
          <p style={{ color: 'var(--error)', fontSize: '0.8125rem' }}>No se pudo cargar el registry</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4 }}>{loadError}</p>
          <button onClick={load} style={{ marginTop: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px 12px', color: 'var(--text)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'var(--font-sans)' }}>Reintentar</button>
        </div>
      ) : apps.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center' }}>
          <Package size={32} style={{ color: 'var(--text-muted)', opacity: 0.4, margin: '0 auto 8px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No apps in local registry</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
          {apps.map(app => {
            const status = app.status ?? 'available';
            const desc = app.description ?? (app.manifest?.description as string | undefined);
            const isBusy = busy.has(app.name);
            return (
              <div
                key={app.name}
                onClick={() => onSelect(toInstalledApp(app))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  background: selectedName === app.name ? 'var(--surface-hover)' : 'var(--surface)',
                  border: `1px solid ${selectedName === app.name ? 'var(--amber)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)',
                }}
              >
                <Package size={20} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {app.name}
                    </span>
                    <StatusBadge status={status} />
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    v{app.version}
                    {desc && ` · ${desc.slice(0, 32)}`}
                  </div>
                </div>
                {/* Acciones: Enable (available), Update (update_available), Uninstall (instalada) */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  {status !== 'installed' && (
                    <ActionBtn
                      onClick={() => void handleEnable(app)} disabled={isBusy}
                      bg="var(--amber)" fg="#06060a"
                      icon={isBusy ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />}
                      label={status === 'update_available' ? 'Update' : 'Enable'}
                    />
                  )}
                  {status !== 'available' && (
                    <ActionBtn
                      onClick={() => void handleUninstall(app)} disabled={isBusy}
                      bg="transparent" fg="var(--error)" border
                      icon={isBusy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      label="Uninstall"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ onClick, disabled, bg, fg, border, icon, label }: {
  onClick: () => void; disabled?: boolean; bg: string; fg: string; border?: boolean;
  icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
        background: bg, color: fg, border: border ? '1px solid var(--border)' : 'none',
        borderRadius: 'var(--radius-sm)', fontSize: '0.6875rem', fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon}{label}
    </button>
  );
}

const STATUS_STYLE: Record<RegistryStatus, { label: string; bg: string; color: string }> = {
  installed: { label: 'Installed', bg: '#22c55e15', color: '#22c55e' },
  available: { label: 'Available', bg: '#f59e0b15', color: 'var(--amber)' },
  update_available: { label: 'Update', bg: '#3b82f615', color: '#3b82f6' },
};

function StatusBadge({ status }: { status: RegistryStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span style={{
      fontSize: '0.5625rem', fontWeight: 600, padding: '1px 6px', flexShrink: 0,
      background: s.bg, color: s.color, borderRadius: 'var(--radius-sm)',
    }}>
      {s.label}
    </span>
  );
}
