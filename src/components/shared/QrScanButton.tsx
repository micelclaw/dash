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

/**
 * Botón "Escanear QR" reutilizable: abre la cámara del dispositivo, decodifica un
 * QR y devuelve el texto por `onScan`. Lo usan los wizards de canales para leer un
 * enlace/código que otro comparte (p.ej. la invitación de SimpleX) en vez de
 * pegarlo a mano. Es aditivo: el campo de pegar sigue existiendo (fallback si no
 * hay cámara / la conexión no es segura).
 *
 * Ciclo de vida html5-qrcode extraído de ScannerModal (StrictMode-safe: flag
 * `started` para no lanzar en el cleanup si start() aún no resolvió; `handledRef`
 * = decodifica una sola vez). Cámara no disponible / contexto inseguro → mensaje
 * claro, sin romper.
 */

import { useState, useEffect, useRef, useId } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';
import { QrCode, Camera, X } from 'lucide-react';

function cameraErrorMessage(err: unknown): string {
  const msg = String((err as Error)?.message ?? err ?? '');
  if (/permission|NotAllowed/i.test(msg)) return 'Permiso de cámara denegado — pega el enlace a mano.';
  if (/NotFound|no camera/i.test(msg)) return 'No se encontró ninguna cámara.';
  return `No se pudo abrir la cámara: ${msg.slice(0, 80)} — pega el enlace a mano.`;
}

function ScanOverlay({ onClose, onScan }: { onClose: () => void; onScan: (text: string) => void }) {
  const rawId = useId();
  const regionId = `qrscan-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const [error, setError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const handledRef = useRef(false);
  // `onScan`/`onClose` en refs para no reiniciar la cámara en cada render.
  const onScanRef = useRef(onScan); onScanRef.current = onScan;

  useEffect(() => {
    // getUserMedia solo existe en contexto SEGURO (HTTPS o localhost). Sin él, la
    // cámara es imposible → mensaje preciso (el usuario a veces está en http://IP).
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('La cámara necesita una conexión segura (HTTPS). Pega el enlace a mano.');
      return;
    }
    let cancelled = false;
    let started = false;
    let scanner: Html5Qrcode | null = null;
    const stopSafe = (s: Html5Qrcode) => { try { s.stop().then(() => s.clear()).catch(() => {}); } catch { /* not running */ } };

    const onDecode = (decoded: string) => {
      if (cancelled || handledRef.current || !decoded) return;
      handledRef.current = true;
      onScanRef.current(decoded); // el padre cierra → el cleanup para la cámara
    };

    // Import DINÁMICO: html5-qrcode solo se descarga al abrir la cámara (fuera del
    // bundle de arranque). Es el único consumidor de esta librería pesada.
    (async () => {
      let Html5Qrcode: typeof import('html5-qrcode').Html5Qrcode;
      try {
        ({ Html5Qrcode } = await import('html5-qrcode'));
      } catch (err) { if (!cancelled) setError(cameraErrorMessage(err)); return; }
      if (cancelled) return;
      try { scanner = new Html5Qrcode(regionId, { verbose: false }); }
      catch (err) { setError(cameraErrorMessage(err)); return; }
      const s = scanner;
      try {
        const cams = await Html5Qrcode.getCameras();
        if (cancelled) return;
        // En móvil la última suele ser la trasera; en un portátil solo hay una.
        const camId = cams[cams.length - 1]?.id ?? cams[0]?.id;
        if (!camId) { setError('No se encontró ninguna cámara.'); return; }
        await s.start(camId, { fps: 10, qrbox: { width: 220, height: 220 } }, onDecode, () => { /* frame sin QR */ });
        started = true;
        if (cancelled) stopSafe(s); else setCameraOn(true);
      } catch (err) { if (!cancelled) setError(cameraErrorMessage(err)); }
    })();

    return () => { cancelled = true; if (started && scanner) stopSafe(scanner); };
  }, [regionId]);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 400 }} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 320, maxWidth: '92vw', background: 'var(--glass-modal, var(--card))',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          boxShadow: '0 16px 64px rgba(0,0,0,0.5)', zIndex: 401, overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
            <QrCode size={15} /> Escanear QR
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div id={regionId} style={{ width: '100%', minHeight: cameraOn ? 240 : 0, borderRadius: 'var(--radius-md)', overflow: 'hidden', background: cameraOn ? '#000' : 'transparent' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.6875rem', color: error ? 'var(--danger, #f43f5e)' : 'var(--text-dim)' }}>
            <Camera size={13} style={{ flexShrink: 0 }} />
            <span>{error ?? (cameraOn ? 'Apunta al QR…' : 'Iniciando cámara…')}</span>
          </div>
        </div>
      </div>
    </>
  );
}

export function QrScanButton({
  onScan,
  title = 'Escanear un QR',
  size = 13,
}: {
  onScan: (text: string) => void;
  title?: string;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={title}
        aria-label={title}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '7px 10px', background: 'none', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', color: 'var(--text-dim)', cursor: 'pointer',
        }}
      >
        <QrCode size={size} />
      </button>
      {open && <ScanOverlay onClose={() => setOpen(false)} onScan={(t) => { onScan(t); setOpen(false); }} />}
    </>
  );
}
