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

import { useState, useRef, useCallback } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface AvatarCropModalProps {
  open: boolean;
  imageSrc: string;
  onConfirm: (croppedBlob: Blob) => void;
  onClose: () => void;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 80 }, 1, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );
}

export function AvatarCropModal({ open, imageSrc, onConfirm, onClose }: AvatarCropModalProps) {
  const [crop, setCrop] = useState<Crop>();
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setCrop(centerAspectCrop(naturalWidth, naturalHeight));
  }, []);

  const handleSave = useCallback(async () => {
    const img = imgRef.current;
    if (!img || !crop) return;

    setSaving(true);
    try {
      const canvas = document.createElement('canvas');
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;

      const pixelCrop = {
        x: (crop.unit === '%' ? (crop.x / 100) * img.width : crop.x) * scaleX,
        y: (crop.unit === '%' ? (crop.y / 100) * img.height : crop.y) * scaleY,
        width: (crop.unit === '%' ? (crop.width / 100) * img.width : crop.width) * scaleX,
        height: (crop.unit === '%' ? (crop.height / 100) * img.height : crop.height) * scaleY,
      };

      const size = Math.min(pixelCrop.width, pixelCrop.height, 512);
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, size, size);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas export failed')), 'image/webp', 0.85);
      });

      onConfirm(blob);
    } finally {
      setSaving(false);
    }
  }, [crop, onConfirm]);

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
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          padding: 24, maxWidth: 480, width: '90vw', fontFamily: 'var(--font-sans)',
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>
          Crop avatar
        </h3>

        <div style={{
          display: 'flex', justifyContent: 'center',
          maxHeight: 360, overflow: 'hidden',
          borderRadius: 'var(--radius-md)',
          background: '#000',
        }}>
          <ReactCrop
            crop={crop}
            onChange={c => setCrop(c)}
            aspect={1}
            circularCrop
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt=""
              onLoad={onImageLoad}
              style={{ maxHeight: 360, maxWidth: '100%', display: 'block' }}
            />
          </ReactCrop>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
              cursor: 'pointer', border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-dim)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
              cursor: saving ? 'wait' : 'pointer', border: 'none',
              background: 'var(--amber)', color: '#000', fontWeight: 600,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
