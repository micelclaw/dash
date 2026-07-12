/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

// Hoja de captura del botón "+" del shell móvil: Foto→Drive, Escanear ticket→
// Inventario, Nota rápida, Marcador. La cámara usa el <input capture> del móvil
// en PWA/navegador; dentro del APK (Capacitor) usa la cámara nativa si está.
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Camera, ScanLine, StickyNote, Bookmark } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { api } from '@/services/api';
import type { Photo } from '@/types/files';

// Detección del puente nativo (lo inyecta el envoltorio Capacitor; el dash no
// importa @capacitor/*). Si está, getPhoto abre la cámara in-app.
interface NativeCamera { getPhoto: (o: Record<string, unknown>) => Promise<{ webPath?: string; dataUrl?: string }> }
interface CapacitorGlobal { isNativePlatform?: () => boolean; Plugins?: { Camera?: NativeCamera } }

async function nativePhotoFile(): Promise<File | null> {
  const c = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  const cam = c?.isNativePlatform?.() ? c.Plugins?.Camera : undefined;
  if (!cam) return null;
  try {
    const photo = await cam.getPhoto({ quality: 85, resultType: 'uri', source: 'CAMERA' });
    const uri = photo.webPath ?? photo.dataUrl;
    if (!uri) return null;
    const blob = await (await fetch(uri)).blob();
    return new File([blob], `captura-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
  } catch { return null; }
}

async function uploadToDrive(file: File, folder: string): Promise<Photo> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('parent_folder', folder);
  const res = await api.upload<{ data: Photo }>('/files/upload', fd);
  return res.data;
}

export function CaptureSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const ticketInput = useRef<HTMLInputElement>(null);

  const close = () => { onOpenChange(false); setBusy(null); };

  const handlePhoto = async (file: File) => {
    setBusy('photo');
    try {
      const record = await uploadToDrive(file, '/Photos');
      toast.success('Foto subida');
      close();
      // Pass the record so Photos shows it INSTANTLY (optimistic prepend + a
      // "processing" badge) instead of waiting for the next timeline fetch.
      navigate('/photos', { state: { uploadedPhoto: record } });
    } catch (e) { toast.error((e as Error).message ?? 'No se pudo subir'); setBusy(null); }
  };
  const handleTicket = async (file: File) => {
    setBusy('ticket');
    try {
      const record = await uploadToDrive(file, '/Inventory');
      await api.post('/inventory/proposals/from-camera', { file_id: record.id });
      toast.success('Ticket enviado a Inventario'); close(); navigate('/inventory');
    } catch (e) { toast.error((e as Error).message ?? 'No se pudo procesar el ticket'); setBusy(null); }
  };

  // Abre cámara nativa si existe; si no, dispara el <input capture>.
  const capture = async (which: 'photo' | 'ticket') => {
    const nativeFile = await nativePhotoFile();
    if (nativeFile) { if (which === 'photo') void handlePhoto(nativeFile); else void handleTicket(nativeFile); return; }
    (which === 'photo' ? photoInput : ticketInput).current?.click();
  };

  const Action = ({ icon: Icon, label, onClick, id }: { icon: typeof Camera; label: string; onClick: () => void; id: string }) => (
    <button onClick={onClick} disabled={!!busy} data-testid={`capture-${id}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 12px',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
        color: 'var(--text)', cursor: busy ? 'default' : 'pointer', fontSize: '0.95rem', opacity: busy && busy !== id ? 0.5 : 1,
      }}>
      <Icon size={20} style={{ color: 'var(--amber)' }} />
      <span>{busy === id ? 'Subiendo…' : label}</span>
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) close(); else onOpenChange(true); }}>
      <SheetContent side="bottom" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }} data-testid="capture-sheet">
        <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>Capturar</div>
        <div style={{ display: 'grid', gap: 8 }}>
          <Action id="photo" icon={Camera} label="Hacer foto → Fotos" onClick={() => void capture('photo')} />
          <Action id="ticket" icon={ScanLine} label="Escanear ticket → Inventario" onClick={() => void capture('ticket')} />
          <Action id="note" icon={StickyNote} label="Nota rápida" onClick={() => { close(); navigate('/notes'); }} />
          <Action id="bookmark" icon={Bookmark} label="Marcador" onClick={() => { close(); navigate('/bookmarks'); }} />
        </div>
        {/* Inputs ocultos: abren la cámara del móvil (fallback web/PWA). */}
        <input ref={photoInput} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handlePhoto(f); }} />
        <input ref={ticketInput} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleTicket(f); }} />
      </SheetContent>
    </Sheet>
  );
}
