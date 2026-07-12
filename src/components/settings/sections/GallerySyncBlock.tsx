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

// ─── Gallery sync (Settings → Photos) ───────────────────────────────
// Backup de álbumes de la galería del móvil (estilo Synology Photos).
// Tres modos:
//   - Web/escritorio → tarjeta read-only con el estado de los dispositivos.
//   - APK sin plugin → "Requiere actualizar la app".
//   - APK con plugin → toggle maestro + wifi-only + permiso + picker de
//     álbumes + filas por álbum con progreso vivo y reparación.
// Gestiona su estado contra /gallery-sync/* directamente (NO pasa por
// updateSection → sin carreras del PATCH de sección).

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Smartphone, RefreshCw, FolderSync, Trash2, AlertTriangle, Play } from 'lucide-react';
import { SettingSection } from '../SettingSection';
import { SettingToggle } from '../SettingToggle';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useGallerySyncStore } from '@/stores/gallery-sync.store';
import { gallerySyncService, type GallerySyncDeviceView, type GallerySyncAlbum } from '@/services/gallery-sync.service';
import {
  isNativeShell, isGalleryCapable, getDeviceInfo, checkPermissions, requestPermissions,
  openAppSettings, getAlbums, type GalleryAlbum,
} from '@/lib/gallery-sync/native-gallery';
import { runGallerySync } from '@/lib/gallery-sync/engine';
import { formatRelative } from '@/lib/date-helpers';

const ERROR_LABELS: Record<string, string> = {
  quota: 'Cuota de almacenamiento superada',
  album_missing: 'El álbum se borró en Micelclaw',
  permission: 'Falta permiso de galería',
  network: 'Esperando red (WiFi)',
};

export function GallerySyncBlock() {
  const capable = useGallerySyncStore((s) => s.capable);
  const permission = useGallerySyncStore((s) => s.permission);
  const device = useGallerySyncStore((s) => s.device);
  const albums = useGallerySyncStore((s) => s.albums);
  const running = useGallerySyncStore((s) => s.running);

  const setCapable = useGallerySyncStore((s) => s.setCapable);
  const setPermission = useGallerySyncStore((s) => s.setPermission);
  const setDevice = useGallerySyncStore((s) => s.setDevice);
  const setAlbums = useGallerySyncStore((s) => s.setAlbums);

  // Vista web/escritorio (read-only de todos los dispositivos)
  const [remoteViews, setRemoteViews] = useState<GallerySyncDeviceView[] | null>(null);
  // Picker de álbumes del móvil
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deviceAlbums, setDeviceAlbums] = useState<GalleryAlbum[] | null>(null);
  const [pendingBuckets, setPendingBuckets] = useState<Set<string>>(new Set());
  const [removeTarget, setRemoveTarget] = useState<GallerySyncAlbum | null>(null);

  const native = isNativeShell();

  const refresh = useCallback(async () => {
    if (!native) {
      try { setRemoteViews(await gallerySyncService.listDevices()); } catch { /* sin datos */ }
      return;
    }
    const cap = isGalleryCapable();
    setCapable(cap);
    if (!cap) return;
    const info = getDeviceInfo();
    if (!info) { setCapable(false); return; }
    setPermission(checkPermissions());
    try {
      const view = await gallerySyncService.upsertDevice({
        device_key: info.install_id,
        device_name: info.model,
        platform: 'android',
      });
      setDevice(view.device);
      setAlbums(view.albums);
    } catch { /* Core inaccesible — el engine reintentará */ }
  }, [native, setCapable, setPermission, setDevice, setAlbums]);

  useEffect(() => { void refresh(); }, [refresh]);

  // ─── Acciones ───────────────────────────────────────────

  const openPicker = useCallback(() => {
    setPickerOpen(true);
    setDeviceAlbums(null);
    // getAlbums es síncrono (consulta MediaStore vía puente); un defer evita
    // bloquear el frame de apertura del sheet en galerías grandes.
    window.setTimeout(() => {
      try {
        const found = getAlbums();
        setDeviceAlbums([...found].sort((a, b) => b.count - a.count));
      } catch {
        toast.error('No se pudieron leer los álbumes del móvil');
        setDeviceAlbums([]);
      }
    }, 30);
  }, []);

  const toggleBucket = useCallback(async (bucket: GalleryAlbum, isConfigured: GallerySyncAlbum | undefined) => {
    if (!device) return;
    setPendingBuckets((prev) => new Set(prev).add(bucket.bucket_id));
    try {
      if (isConfigured) {
        const updated = await gallerySyncService.updateAlbum(isConfigured.id, { enabled: !isConfigured.enabled });
        useGallerySyncStore.getState().patchAlbum(isConfigured.id, updated);
      } else {
        await gallerySyncService.enableAlbum(device.id, {
          bucket_id: bucket.bucket_id,
          bucket_name: bucket.name,
          device_count: bucket.count,
        });
        await refresh();
        void runGallerySync('album-enabled');
      }
    } catch {
      toast.error('No se pudo actualizar el álbum');
    } finally {
      setPendingBuckets((prev) => { const n = new Set(prev); n.delete(bucket.bucket_id); return n; });
    }
  }, [device, refresh]);

  const requestPermission = useCallback(async () => {
    const state = await requestPermissions();
    setPermission(state);
    if (state === 'granted' || state === 'limited') { await refresh(); void runGallerySync('manual'); }
  }, [setPermission, refresh]);

  // ─── Render: web/escritorio (read-only) ─────────────────

  if (!native) {
    return (
      <SettingSection
        title="Sincronización de galería"
        description="Copia de seguridad de los álbumes del móvil (Cámara, Capturas…). Se configura desde la app de Micelclaw en el teléfono."
      >
        {!remoteViews || remoteViews.length === 0 ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', padding: '8px 0' }}>
            Ningún dispositivo ha configurado la sincronización todavía.
          </div>
        ) : (
          remoteViews.map((v) => (
            <div key={v.device.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text)' }}>
                <Smartphone size={14} style={{ color: 'var(--amber)' }} />
                <span style={{ fontWeight: 500 }}>{v.device.device_name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  {v.device.enabled ? (v.device.last_sync_at ? `sincronizado ${formatRelative(new Date(v.device.last_sync_at))}` : 'activo') : 'pausado'}
                </span>
              </div>
              {v.albums.map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: 8, fontSize: '0.75rem', color: 'var(--text-dim)', padding: '2px 0 0 22px' }}>
                  <span>{a.bucket_name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{a.synced_count}/{a.device_count || '?'} elementos</span>
                  {a.last_error && <span style={{ color: 'var(--error)' }}>{ERROR_LABELS[a.last_error] ?? a.last_error}</span>}
                </div>
              ))}
            </div>
          ))
        )}
      </SettingSection>
    );
  }

  // ─── Render: APK sin plugin ─────────────────────────────

  if (capable === false) {
    return (
      <SettingSection title="Sincronización de galería" description="Copia de seguridad de los álbumes del móvil.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text-dim)', padding: '8px 0' }}>
          <AlertTriangle size={14} style={{ color: 'var(--amber)' }} />
          Requiere actualizar la app Micelclaw a la última versión (reinstala el APK).
        </div>
      </SettingSection>
    );
  }

  // ─── Render: nativo con plugin ──────────────────────────

  const configuredByBucket = new Map(albums.map((a) => [a.bucket_id, a]));

  return (
    <SettingSection
      title="Sincronización de galería"
      description="Sube automáticamente los álbumes elegidos (fotos y vídeos) a Micelclaw. Borrar en el móvil NUNCA borra la copia."
    >
      {/* Permiso */}
      {(permission === 'denied' || permission === 'prompt') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem' }}>
          <AlertTriangle size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <span style={{ flex: 1, color: 'var(--text-dim)' }}>Micelclaw necesita acceso a tus fotos y vídeos.</span>
          <button onClick={() => void requestPermission()} style={pillBtn(true)}>Conceder</button>
          <button onClick={() => openAppSettings()} style={pillBtn(false)}>Ajustes</button>
        </div>
      )}
      {permission === 'limited' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          <AlertTriangle size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          Acceso parcial: la sincronización solo verá las fotos seleccionadas. Concede acceso completo en Ajustes.
          <button onClick={() => openAppSettings()} style={pillBtn(false)}>Ajustes</button>
        </div>
      )}

      {device && (
        <>
          <SettingToggle
            label="Sincronizar este dispositivo"
            description={device.device_name}
            checked={device.enabled}
            onChange={async (v: boolean) => {
              const updated = await gallerySyncService.updateDevice(device.id, { enabled: v });
              setDevice(updated);
            }}
          />
          <SettingToggle
            label="Solo con WiFi"
            description="Pausa las subidas con datos móviles."
            checked={device.wifi_only}
            onChange={async (v: boolean) => {
              const updated = await gallerySyncService.updateDevice(device.id, { wifi_only: v });
              setDevice(updated);
            }}
          />

          {/* Acciones */}
          <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}>
            <button onClick={() => void openPicker()} style={pillBtn(true)}>
              <FolderSync size={13} /> Elegir álbumes
            </button>
            <button onClick={() => void runGallerySync('manual')} disabled={running} style={pillBtn(false)}>
              <RefreshCw size={13} className={running ? 'animate-spin' : undefined} />
              {running ? 'Sincronizando…' : 'Sincronizar ahora'}
            </button>
          </div>

          {/* Filas por álbum */}
          {albums.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '4px 0' }}>
              Ningún álbum sincronizado todavía — toca «Elegir álbumes».
            </div>
          ) : (
            albums.map((a) => {
              const syncing = running && a.enabled && a.album_alive;
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: '0.8125rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
                      <Play size={11} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.bucket_name}</span>
                      {!a.enabled && <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>PAUSADO</span>}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: syncing ? 'var(--amber)' : 'var(--text-muted)', marginTop: 2 }}>
                      {!a.album_alive
                        ? 'El álbum se borró en Micelclaw'
                        : a.last_error
                          ? (ERROR_LABELS[a.last_error] ?? a.last_error)
                          : syncing
                            ? `Sincronizando… ${a.synced_count}/${a.device_count || '?'}`
                            : a.last_sync_at
                              ? `${a.synced_count} elementos · ${formatRelative(new Date(a.last_sync_at))}`
                              : 'Pendiente de primera sincronización'}
                    </div>
                  </div>
                  {!a.album_alive && (
                    <button
                      onClick={async () => {
                        const updated = await gallerySyncService.resyncAlbum(a.id);
                        useGallerySyncStore.getState().patchAlbum(a.id, updated);
                        void runGallerySync('album-enabled');
                      }}
                      style={pillBtn(true)}
                    >
                      Recrear
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      const updated = await gallerySyncService.updateAlbum(a.id, { enabled: !a.enabled });
                      useGallerySyncStore.getState().patchAlbum(a.id, updated);
                    }}
                    style={pillBtn(false)}
                    title={a.enabled ? 'Pausar' : 'Reanudar'}
                  >
                    {a.enabled ? 'Pausar' : 'Reanudar'}
                  </button>
                  <button onClick={() => setRemoveTarget(a)} style={{ ...pillBtn(false), padding: '4px 6px' }} title="Quitar (la copia se conserva)">
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })
          )}
        </>
      )}

      {/* Picker de álbumes del móvil */}
      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="bottom" style={{ maxHeight: '70vh', overflow: 'auto' }} aria-describedby={undefined}>
          <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>Álbumes del teléfono</div>
          {deviceAlbums === null ? (
            <div style={{ padding: 16, fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Leyendo la galería…</div>
          ) : deviceAlbums.length === 0 ? (
            <div style={{ padding: 16, fontSize: '0.8125rem', color: 'var(--text-dim)' }}>No se encontraron álbumes.</div>
          ) : (
            deviceAlbums.map((b) => {
              const configured = configuredByBucket.get(b.bucket_id);
              const checked = !!configured && configured.enabled;
              const pending = pendingBuckets.has(b.bucket_id);
              return (
                <label key={b.bucket_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', borderBottom: '1px solid var(--border)', cursor: 'pointer', opacity: pending ? 0.5 : 1 }}>
                  <Checkbox checked={checked} disabled={pending} onCheckedChange={() => void toggleBucket(b, configured)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text)', fontWeight: 500 }}>{b.name}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      {b.count} elementos{configured ? ` · ${configured.synced_count} sincronizados` : ''}
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </SheetContent>
      </Sheet>

      {/* Quitar config (conserva la copia) */}
      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={async () => {
          if (!removeTarget) return;
          await gallerySyncService.deleteAlbum(removeTarget.id);
          setRemoveTarget(null);
          await refresh();
        }}
        title={`¿Quitar "${removeTarget?.bucket_name}"?`}
        description="Se deja de sincronizar este álbum. Las fotos y vídeos ya subidos SE CONSERVAN en Micelclaw."
        confirmLabel="Quitar"
        variant="danger"
      />
    </SettingSection>
  );
}

function pillBtn(primary: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '5px 10px', fontSize: '0.75rem', fontWeight: primary ? 600 : 400,
    borderRadius: 'var(--radius-md)', cursor: 'pointer',
    border: primary ? 'none' : '1px solid var(--border)',
    background: primary ? 'var(--amber)' : 'transparent',
    color: primary ? '#06060a' : 'var(--text-dim)',
    fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
  };
}
