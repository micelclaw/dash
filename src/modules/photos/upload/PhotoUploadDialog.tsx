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

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, UploadCloud, Smartphone, Image as ImageIcon } from 'lucide-react';
import QRCode from 'qrcode';
import { useSharedTargetFiles } from './useSharedTargetFiles';

interface PhotoUploadDialogProps {
  open: boolean;
  onClose: () => void;
  /** Performs the actual upload (PhotosPage owns the queue + optimistic insert). */
  onUpload: (files: File[]) => void;
}

/**
 * Upload entry point for the Photos module. Three zones:
 *   1. Drop/pick zone — desktop drag-drop or file picker.
 *   2. "From your phone" — QR to the dash LAN URL + Add-to-Home-Screen guidance
 *      so the phone can share photos straight from the gallery (PWA share
 *      target → /photos?shared=1, drained below).
 *   3. Auto-drain of the share-target cache on open (covers the ?shared=1 land).
 */
export function PhotoUploadDialog({ open, onClose, onUpload }: PhotoUploadDialogProps) {
  const [dragging, setDragging] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { drain } = useSharedTargetFiles();

  const origin = window.location.origin;

  // Generate the QR for the dash origin when the dialog opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    QRCode.toDataURL(origin, { width: 220, margin: 1, color: { dark: '#06060a', light: '#ffffff' } })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(null); });
    return () => { cancelled = true; };
  }, [open, origin]);

  // Drain any files shared from the phone gallery (cached by the SW) on open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    drain().then((files) => {
      if (!cancelled && files.length > 0) onUpload(files);
    });
    return () => { cancelled = true; };
  }, [open, drain, onUpload]);

  const handlePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onUpload(Array.from(files));
      e.target.value = '';
      onClose();
    }
  }, [onUpload, onClose]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (files.length > 0) {
      onUpload(files);
      onClose();
    }
  }, [onUpload, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 100%)',
          maxHeight: '90vh', overflowY: 'auto',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>Upload photos</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Zone 1: drop / pick */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: '28px 16px',
              border: `1.5px dashed ${dragging ? 'var(--mod-photos)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              background: dragging ? 'rgba(236,72,153,0.06)' : 'var(--surface)',
              cursor: 'pointer',
              transition: 'border-color var(--transition-fast), background var(--transition-fast)',
            }}
          >
            <UploadCloud size={28} style={{ color: 'var(--mod-photos)' }} />
            <div style={{ fontSize: '0.8125rem', color: 'var(--text)', fontWeight: 500 }}>
              Drop photos here or click to browse
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Images and videos</div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handlePick}
              style={{ display: 'none' }}
            />
          </div>

          {/* Zone 2: from your phone */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: 14, background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ flexShrink: 0, width: 110, height: 110, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR to open Micelclaw on your phone" style={{ width: '100%', height: '100%' }} />
              ) : (
                <ImageIcon size={28} style={{ color: '#999' }} />
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
                <Smartphone size={14} style={{ color: 'var(--mod-photos)' }} />
                From your phone
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                Scan to open Micelclaw, sign in once, then <strong style={{ color: 'var(--text)' }}>Add to Home Screen</strong>. After that you can share photos from your gallery straight into Micelclaw.
              </div>
              <code style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{origin}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
