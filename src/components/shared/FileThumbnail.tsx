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
import { Loader2 } from 'lucide-react';
import { FileIcon } from './FileIcon';
import { isImageMime, isDocPreviewable, getPreviewUrl, getVfsPreviewUrl } from '@/lib/file-utils';
import { api } from '@/services/api';
import type { ApiResponse } from '@/types/api';
import type { FileRecord } from '@/types/files';

interface FileThumbnailProps {
  file: FileRecord;
  /** Requested preview width (server thumbnail). */
  width?: number;
  /** How the image fills the box. */
  fit?: 'contain' | 'cover';
  /** Icon fallback size. */
  iconSize?: 'sm' | 'md' | 'lg';
  /** Click → open the file in its full viewer. */
  onOpen?: () => void;
  /**
   * Render a text snippet for .md/.txt (fetches content → ONLY for the details
   * panel, never grid cells: /files/:id/content bumps the heat score).
   */
  textPreview?: boolean;
  /** Retry budget for pending document thumbnails: panel 'full', grid 'light'. */
  retries?: 'full' | 'light';
  /**
   * Miniatura del prefetch en lote (lib/thumbnail-batch): data URI → pinta al
   * instante sin request; null → no cacheada server-side (cae al <img>
   * individual, que dispara generación); undefined → sin batch (panel).
   */
  prefetchedSrc?: string | null;
  /**
   * Grid con batch: mientras el lote está en vuelo (prefetchedSrc undefined)
   * NO disparar el <img> individual — sin esto, las ~100 celdas emiten su GET
   * antes de que llegue el lote y reaparece la tormenta HTTP/1.1.
   */
  holdWhileBatching?: boolean;
}

// Con la pre-generación (Slot 12 + barrido) la mayoría de thumbnails ya están
// cacheados; los reintentos cubren el caso frío (generación on-demand).
const DOC_RETRY_FULL = [1000, 2500, 6000, 12000, 25000];
const DOC_RETRY_LIGHT = [1500, 4000];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEXT_SNIPPET_MAX_SIZE = 2 * 1024 * 1024; // no descargar textos gigantes
const TEXT_SNIPPET_CHARS = 4000;

/**
 * Miniatura compartida de un fichero:
 *  - imagen → preview server-side (indexada por UUID o VFS por ruta),
 *  - PDF/office → thumbnail de 1ª página (pre-generado; reintenta si está frío),
 *  - .md/.txt (con `textPreview`) → snippet de texto estilizado,
 *  - resto → icono por tipo.
 * Rellena su contenedor; el caller pone el tamaño y monta con `key={file.id}`.
 */
export function FileThumbnail({
  file,
  width = 640,
  fit = 'contain',
  iconSize = 'lg',
  onOpen,
  textPreview = false,
  retries = 'full',
  prefetchedSrc,
  holdWhileBatching = false,
}: FileThumbnailProps) {
  const mime = file.mime_type || '';
  const isVfs = !UUID_RE.test(file.id);
  const isImage = isImageMime(mime);
  const isDoc = isDocPreviewable(mime);
  const isText = mime.startsWith('text/');

  // Qué fuente aplica: (1) data URI del prefetch en lote (instantáneo, sin
  // request); (2) indexado → /files/:id/preview; (3) VFS → /vfs/preview por
  // ruta (imágenes + PDF; office VFS no → icono). En el grid (retries light)
  // los documentos van con wait=0: un doc pendiente no retiene la conexión.
  const noWait = retries === 'light';
  const batchPending = holdWhileBatching && prefetchedSrc === undefined;
  let src = '';
  if (prefetchedSrc) {
    src = prefetchedSrc;
  } else if (!batchPending && (isImage || isDoc)) {
    if (!isVfs) src = getPreviewUrl(file.id, width, noWait && isDoc);
    else if (isImage || mime === 'application/pdf') src = getVfsPreviewUrl(file.id, width);
  }

  const retrySchedule = retries === 'light' ? DOC_RETRY_LIGHT : DOC_RETRY_FULL;

  // Internal state resets per file because callers mount with `key={file.id}`.
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [givenUp, setGivenUp] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleError = useCallback(() => {
    // Documentos: el 404 THUMBNAIL_PENDING significa "generándose" → reintentar.
    // (Nunca para data URIs del prefetch — no hay nada que reintentar.)
    if (!prefetchedSrc && isDoc && attempt < retrySchedule.length) {
      timerRef.current = setTimeout(() => setAttempt((a) => a + 1), retrySchedule[attempt]);
    } else {
      setGivenUp(true);
    }
  }, [prefetchedSrc, isDoc, attempt, retrySchedule]);

  const imgSrc = src && !prefetchedSrc ? src + (attempt ? `&_r=${attempt}` : '') : src;
  const showImg = !!src && !givenUp;
  const showSpinner = !!src && isDoc && !loaded && !givenUp;

  // ─── Snippet de texto (.md/.txt) ────────────────────────
  const wantText = textPreview && isText && !file.is_directory
    && (file.size_bytes ?? 0) < TEXT_SNIPPET_MAX_SIZE;
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!wantText) return;
    let cancelled = false;
    void (async () => {
      try {
        if (isVfs) {
          const raw = await api.getText('/vfs/read', { path: file.id });
          if (!cancelled) setText(raw.slice(0, TEXT_SNIPPET_CHARS));
        } else {
          const res = await api.get<ApiResponse<{ content_text: string }>>(`/files/${file.id}/content`);
          if (!cancelled) setText((res.data.content_text ?? '').slice(0, TEXT_SNIPPET_CHARS));
        }
      } catch {
        if (!cancelled) setText(null); // → icono
      }
    })();
    return () => { cancelled = true; };
  }, [wantText, isVfs, file.id]);

  const inner = (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}>
      {wantText && text ? (
        // Mini-documento: primeras líneas del fichero con fade inferior.
        <div style={{ position: 'absolute', inset: 0, padding: '10px 12px', textAlign: 'left', overflow: 'hidden' }}>
          <pre style={{
            margin: 0, fontSize: 9, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)',
          }}>
            {text}
          </pre>
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: 34,
            background: 'linear-gradient(transparent, var(--bg))', pointerEvents: 'none',
          }} />
        </div>
      ) : (
        <>
          {!loaded && <FileIcon mime={mime} isDirectory={file.is_directory} size={iconSize} />}
          {showImg && (
            <img
              key={imgSrc}
              src={imgSrc}
              alt={file.filename}
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              onError={handleError}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: fit,
                // opacity (no display:none): una img display:none JAMÁS dispara
                // el lazy-load → quedaría oculta para siempre.
                opacity: loaded ? 1 : 0,
                transition: 'opacity 0.12s ease',
              }}
            />
          )}
          {showSpinner && (
            <Loader2 size={14} className="animate-spin" style={{ position: 'absolute', bottom: 6, right: 6, color: 'var(--text-muted)' }} />
          )}
        </>
      )}
    </div>
  );

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        title="Abrir"
        style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', height: '100%' }}
      >
        {inner}
      </button>
    );
  }
  return inner;
}
