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

import { useEffect, useState, type CSSProperties } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { X, Printer } from 'lucide-react';
import { api } from '@/services/api';

const primaryBtn: CSSProperties = {
  background: 'var(--amber)', color: '#06060a', fontWeight: 600, border: 'none',
  borderRadius: 'var(--radius-sm)', padding: '8px 14px', fontSize: '0.8125rem', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};
const secondaryBtn: CSSProperties = {
  background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)',
  borderRadius: 'var(--radius-sm)', padding: '8px 14px', fontSize: '0.8125rem', cursor: 'pointer',
};

/**
 * Genera una hoja de etiquetas QR (PDF) para los items o ubicaciones dados.
 * Cada QR abre la ficha (?id=) / la ubicación (?location_id=) al escanearlo.
 * Reutiliza el patrón Stirling del dossier (503 si Office está apagado).
 */
export function LabelModal({ target, ids, onClose }: {
  target: 'items' | 'locations';
  ids: string[];
  onClose: () => void;
}) {
  const [previewUri, setPreviewUri] = useState('');
  const [busy, setBusy] = useState(false);
  const origin = window.location.origin;
  const firstUrl = ids[0]
    ? `${origin}/inventory?${target === 'locations' ? 'location_id' : 'id'}=${ids[0]}`
    : '';

  useEffect(() => {
    if (!firstUrl) return;
    let alive = true;
    QRCode.toDataURL(firstUrl, { width: 168, margin: 1, color: { dark: '#0a0a0a', light: '#ffffff' } })
      .then(uri => { if (alive) setPreviewUri(uri); })
      .catch(() => { if (alive) setPreviewUri(''); });
    return () => { alive = false; };
  }, [firstUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const generate = async () => {
    if (ids.length === 0 || busy) return;
    setBusy(true);
    try {
      const res = await api.post<{ data: { file_id: string; filename: string; count: number } }>(
        '/inventory/labels',
        { target, ids, base_url: origin },
        { timeout: 120_000 },
      );
      toast.success(`${res.data.count} label${res.data.count === 1 ? '' : 's'} ready — saved to /Inventory/labels/`);
      window.open(`/api/v1/files/${res.data.file_id}/download`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not generate labels');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 380, maxWidth: 'calc(100vw - 32px)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 18 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            🏷 Print labels
          </h3>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          {previewUri ? (
            <img src={previewUri} alt="QR preview" style={{ width: 168, height: 168, borderRadius: 'var(--radius-sm)', background: '#fff', padding: 6, boxSizing: 'border-box' }} />
          ) : (
            <div style={{ width: 168, height: 168, borderRadius: 'var(--radius-sm)', background: 'var(--surface)' }} />
          )}
          <div style={{ fontSize: '0.8125rem', color: 'var(--text)', fontWeight: 600 }}>
            {ids.length} {target === 'locations' ? 'location' : 'item'}{ids.length === 1 ? '' : 's'} → {ids.length} label{ids.length === 1 ? '' : 's'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.5 }}>
            Each QR opens the {target === 'locations' ? 'location' : 'item'} when scanned. Generates an A4 PDF you can print
            (needs the Office service running).
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button style={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
          <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => void generate()}>
            <Printer size={14} /> {busy ? 'Generating…' : 'Generate PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
