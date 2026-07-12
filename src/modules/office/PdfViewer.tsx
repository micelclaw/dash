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

// ─── PDF Viewer ──────────────────────────────────────────────────────
// Renders the PDF to <canvas> pages with pdf.js so it works in any
// WebView (Android has no native PDFium plugin — <object>/<embed>
// would paint nothing but a gray box). This route is lazy-loaded, so
// the weight of pdf.js only lands when a PDF is actually opened.

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Download, Loader2, AlertTriangle, Wrench } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/services/api';

// Wire up the pdf.js worker via the Vite-emitted URL (module worker).
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const API_BASE = import.meta.env.VITE_API_URL ?? '';
const API_PREFIX = '/api/v1';

// Rendering layout tuning.
const CONTAINER_PAD = 16;   // scroll-area inner padding (px)
const PAGE_GAP = 16;        // vertical gap between pages (px)
const MAX_CSS_WIDTH = 1000; // cap page width on wide screens (px)
const MAX_DPR = 2;          // clamp device pixel ratio to bound memory

async function fetchWithAuth(path: string): Promise<Response> {
  const url = `${API_BASE}${API_PREFIX}${path}`;
  const token = useAuthStore.getState().tokens?.accessToken;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res = await fetch(url, { headers });

  if (res.status === 401) {
    try {
      await useAuthStore.getState().refresh();
      const newToken = useAuthStore.getState().tokens?.accessToken;
      if (newToken) headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { headers });
    } catch {
      throw new Error('Session expired');
    }
  }

  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res;
}

interface FileInfo {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}

export function Component() {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const [file, setFile] = useState<FileInfo | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  const blobUrlRef = useRef<string | null>(null);
  const pdfBytesRef = useRef<Uint8Array | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const renderTasksRef = useRef<RenderTask[]>([]);

  // ─── Fetch metadata + binary (with auth + token refresh) ───────────
  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setFile(null);
    setBlobUrl(null);
    setRendering(true);
    setRenderError(null);

    (async () => {
      try {
        // Fetch file metadata
        const res = await api.get<{ data: FileInfo }>(`/files/${fileId}`);
        if (cancelled) return;
        setFile(res.data);

        // Fetch the binary PDF with auth + token refresh
        const resp = await fetchWithAuth(`/files/${fileId}/download`);
        if (cancelled) return;

        const arrayBuf = await resp.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        pdfBytesRef.current = bytes;

        // Keep a blob URL around purely for the Download button.
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load PDF');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [fileId]);

  // ─── Render the pages to <canvas> once the bytes are ready ─────────
  useEffect(() => {
    if (!blobUrl) return;
    const bytes = pdfBytesRef.current;
    const host = canvasHostRef.current;
    if (!bytes || !host) return;

    let cancelled = false;
    host.replaceChildren();
    renderTasksRef.current = [];
    setRendering(true);
    setRenderError(null);

    (async () => {
      try {
        const scrollEl = scrollRef.current;
        const usableWidth = Math.max(320, (scrollEl?.clientWidth ?? 800) - CONTAINER_PAD * 2);
        const cssWidth = Math.min(usableWidth, MAX_CSS_WIDTH);
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

        // Pass a fresh copy: pdf.js may transfer the buffer to the worker,
        // which would neuter the reusable one held in pdfBytesRef.
        const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
        const doc = await loadingTask.promise;
        if (cancelled) {
          doc.destroy().catch(() => { /* ignore */ });
          return;
        }
        pdfDocRef.current = doc;

        for (let n = 1; n <= doc.numPages; n++) {
          if (cancelled) break;
          const page = await doc.getPage(n);
          if (cancelled) break;

          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });

          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = '100%';
          canvas.style.maxWidth = `${Math.floor(cssWidth)}px`;
          canvas.style.height = 'auto';
          canvas.style.display = 'block';
          canvas.style.background = '#fff';
          canvas.style.boxShadow = '0 1px 6px rgba(0, 0, 0, 0.28)';
          host.appendChild(canvas);

          const task = page.render({ canvas, viewport });
          renderTasksRef.current.push(task);
          try {
            await task.promise;
          } catch (err) {
            if ((err as { name?: string })?.name === 'RenderingCancelledException') return;
            throw err;
          }

          // Reveal as soon as the first page is painted.
          if (n === 1 && !cancelled) setRendering(false);
        }

        if (!cancelled) setRendering(false);
      } catch (err) {
        if (!cancelled) {
          setRenderError(err instanceof Error ? err.message : 'Failed to render PDF');
          setRendering(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const task of renderTasksRef.current) {
        try { task.cancel(); } catch { /* ignore */ }
      }
      renderTasksRef.current = [];
      const doc = pdfDocRef.current;
      pdfDocRef.current = null;
      if (doc) doc.destroy().catch(() => { /* ignore */ });
      host.replaceChildren();
    };
  }, [blobUrl]);

  if (loading) {
    return (
      <div style={centerStyle}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 14 }}>Loading PDF...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !file || !blobUrl) {
    return (
      <div style={centerStyle}>
        <AlertTriangle size={32} style={{ color: 'var(--error)' }} />
        <span style={{ fontSize: 14 }}>Failed to load PDF</span>
        {error && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{error}</span>}
        <button onClick={() => navigate('/office')} style={btnStyle}>Back to Office</button>
      </div>
    );
  }

  const handleDownload = async () => {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = file.filename;
    a.click();
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* ─── Toolbar ──────────────────────────────────── */}
      <div style={{
        height: 40, display: 'flex', alignItems: 'center',
        padding: '0 12px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', gap: 8, fontSize: 12,
        color: 'var(--text-dim)', flexShrink: 0,
      }}>
        <button onClick={() => navigate('/office')} style={iconBtnStyle} title="Back">
          <ArrowLeft size={14} />
        </button>
        <span style={{ fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
          {file.filename}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={handleDownload} style={iconBtnStyle} title="Download">
          <Download size={14} />
        </button>
        <button onClick={() => navigate('/office/pdf/tools')} style={iconBtnStyle} title="Open in PDF Tools">
          <Wrench size={14} />
        </button>
      </div>

      {/* ─── Rendered pages ───────────────────────────── */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <div ref={scrollRef} style={scrollStyle}>
          <div ref={canvasHostRef} style={hostStyle} />
        </div>

        {rendering && !renderError && (
          <div style={overlayStyle}>
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 13 }}>Rendering PDF...</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {renderError && (
          <div style={overlayStyle}>
            <AlertTriangle size={28} style={{ color: 'var(--error)' }} />
            <span style={{ fontSize: 13 }}>Failed to render PDF</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{renderError}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const centerStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex',
  flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: 12, color: 'var(--text-dim)', background: 'var(--bg)',
};

const scrollStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, overflow: 'auto',
  background: 'var(--bg)', padding: CONTAINER_PAD,
};

const hostStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', gap: PAGE_GAP,
};

const overlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex',
  flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: 10, color: 'var(--text-dim)', pointerEvents: 'none',
};

const btnStyle: React.CSSProperties = {
  marginTop: 8, padding: '6px 16px', background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  color: 'var(--text)', cursor: 'pointer', fontSize: 13,
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-dim)', display: 'flex', alignItems: 'center',
};
