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

import { useMemo, useEffect, useRef, useState } from 'react';
import { X, Layout, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import { useChatStore } from '@/stores/chat.store';
import { useCanvasStore } from '@/stores/canvas.store';
import { BrowserSessionView } from './components/BrowserSessionView';
import { SaveResultsMenu } from './components/SaveResultsMenu';
import { usePersistedScreenshots } from '@/hooks/use-persisted-screenshots';
import { useCanvasHistory } from '@/hooks/use-canvas-history';
import { RetryBanner } from '@/components/settings/shared/RetryBanner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface CanvasPanelProps {
  onClose: () => void;
}

export function CanvasPanel({ onClose }: CanvasPanelProps) {
  const activeConvId = useChatStore((s) => s.activeConversationId);
  const canvasStates = useCanvasStore((s) => s.canvasStates);
  const activeMode = useCanvasStore((s) => s.activeMode);
  const browserSessions = useCanvasStore((s) => s.browserSessions);

  // Canvas content is scoped per conversation. Never fall back to
  // __standalone__ for a real chat — that leaked the last global push
  // (incl. the previous chat's content) into "New chat".
  const canvas = activeConvId ? canvasStates.get(activeConvId) : undefined;

  // Active browser session (any session with status 'active', or most recent)
  const browserSession = useMemo(() => {
    for (const s of browserSessions.values()) {
      if (s.status === 'active') return s;
    }
    // Fallback: most recent session
    const all = [...browserSessions.values()];
    return all.length > 0 ? all[all.length - 1] : undefined;
  }, [browserSessions]);

  // Persisted screenshots for this conversation
  const {
    screenshots: persistedScreenshots,
    currentIndex,
    navigate: navigateScreenshot,
    deleteScreenshot,
    downloadScreenshot,
    refresh: refreshScreenshots,
  } = usePersistedScreenshots(activeConvId);

  // Refresh persisted list when a new snapshot arrives from the live session
  const prevSnapshotRef = useRef(browserSession?.snapshot);
  useEffect(() => {
    if (browserSession?.snapshot && browserSession.snapshot !== prevSnapshotRef.current) {
      prevSnapshotRef.current = browserSession.snapshot;
      // Small delay to let Core persist to DB before fetching
      const t = setTimeout(() => refreshScreenshots(), 1500);
      return () => clearTimeout(t);
    }
  }, [browserSession?.snapshot, refreshScreenshots]);

  const hasPersisted = persistedScreenshots.length > 0;
  const isBrowserMode = (activeMode === 'browser' && browserSession) || hasPersisted;
  const isCanvasError = activeMode === 'canvas' && canvas?.status === 'error';
  const isCanvasMode = activeMode === 'canvas' && canvas?.hasContent && canvas.status !== 'error';

  // Historial de canvases por conversación (barra ← X → con título en medio)
  const {
    history: canvasHistory,
    currentIndex: canvasIndex,
    current: canvasCurrent,
    navigate: navigateCanvas,
    removeCurrent: removeCurrentCanvas,
    canPrev: canPrevCanvas,
    canNext: canNextCanvas,
  } = useCanvasHistory(activeConvId);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const showCanvasNav = isCanvasMode && canvasHistory.length > 1;

  // Header label
  const headerLabel = isBrowserMode
    ? `Browsing${browserSession?.currentUrl ? ': ' + extractDomain(browserSession.currentUrl) : ''}`
    : 'Canvas';

  const HeaderIcon = isBrowserMode ? Globe : Layout;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--card)',
        borderLeft: '1px solid var(--border)',
        minWidth: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <HeaderIcon size={14} style={{ color: isBrowserMode ? '#7c3aed' : 'var(--text-muted)' }} />
        <span style={{
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: 'var(--text-dim)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {headerLabel}
        </span>
        <SaveResultsMenu
          activeMode={activeMode}
          canvas={canvas}
          browserSession={browserSession}
          conversationId={activeConvId}
        />
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: 4,
            display: 'flex',
            borderRadius: 'var(--radius-sm)',
            flexShrink: 0,
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Canvas history nav bar (← title → X) — visible cuando hay 2+ canvases en la conv */}
      {showCanvasNav && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '6px 12px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            fontSize: '0.75rem',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => navigateCanvas(canvasIndex - 1)}
            disabled={!canPrevCanvas}
            title="Canvas anterior"
            style={{
              background: 'none',
              border: 'none',
              cursor: canPrevCanvas ? 'pointer' : 'default',
              color: canPrevCanvas ? 'var(--text-dim)' : 'var(--text-muted)',
              padding: 4,
              display: 'flex',
              opacity: canPrevCanvas ? 1 : 0.4,
            }}
          >
            <ChevronLeft size={14} />
          </button>
          <span
            style={{
              color: 'var(--text-dim)',
              fontFamily: 'var(--font-mono, monospace)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 320,
            }}
            title={canvasCurrent?.path ?? canvasCurrent?.title}
          >
            {canvasCurrent?.title ?? canvasCurrent?.path ?? '—'}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
            ({canvasIndex + 1}/{canvasHistory.length})
          </span>
          <button
            onClick={() => navigateCanvas(canvasIndex + 1)}
            disabled={!canNextCanvas}
            title="Canvas siguiente"
            style={{
              background: 'none',
              border: 'none',
              cursor: canNextCanvas ? 'pointer' : 'default',
              color: canNextCanvas ? 'var(--text-dim)' : 'var(--text-muted)',
              padding: 4,
              display: 'flex',
              opacity: canNextCanvas ? 1 : 0.4,
            }}
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={() => setDeleteDialogOpen(true)}
            title="Borrar este canvas"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 4,
              marginLeft: 4,
              display: 'flex',
            }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Delete confirm dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar canvas</DialogTitle>
            <DialogDescription>
              ¿Cómo quieres eliminar <code>{canvasCurrent?.title ?? canvasCurrent?.path ?? ''}</code>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter style={{ gap: 8, flexWrap: 'wrap' }}>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                setDeleteDialogOpen(false);
                await removeCurrentCanvas({ deleteFile: false });
              }}
            >
              Solo del historial
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setDeleteDialogOpen(false);
                await removeCurrentCanvas({ deleteFile: true });
              }}
            >
              También del disco
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
        {isBrowserMode ? (
          <BrowserSessionView
            session={browserSession ?? {
              sessionId: 'persisted',
              currentUrl: persistedScreenshots[currentIndex]?.url ?? null,
              humanizedAction: null,
              snapshot: null,
              actions: [],
              status: 'complete',
              pagesVisited: 0,
            }}
            persistedScreenshots={persistedScreenshots}
            currentIndex={currentIndex}
            onNavigate={navigateScreenshot}
            onDelete={deleteScreenshot}
            onDownload={downloadScreenshot}
          />
        ) : isCanvasError ? (
          <CanvasErrorState
            message={canvas!.errorMessage ?? 'Error desconocido'}
            code={canvas!.errorCode}
          />
        ) : isCanvasMode ? (
          <CanvasIframe canvas={canvas!} convId={activeConvId} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

// ─── Canvas Iframe ──────────────────────────────────────────────────
//
// Ola 7 (oc7-5.1g): dual-mode renderer.
//   - type='html'  → srcDoc inline (existing behavior)
//   - type='a2ui'  → placeholder pre tag (existing behavior)
//   - type='url'   → src points at our /canvas-host/* proxy. Cache-bust
//                    via reloadKey when canvas.reload event fires.

import type { CanvasState } from '@/stores/canvas.store';

function CanvasIframe({ canvas, convId }: { canvas: CanvasState; convId: string | null }) {
  const setCanvasError = useCanvasStore((s) => s.setCanvasError);

  if (canvas.type === 'url' && canvas.url) {
    // Cache-bust via reloadKey query param. The iframe re-fetches whenever
    // OpenClaw's chokidar fires a `reload` and we bump reloadKey in the store.
    const sep = canvas.url.includes('?') ? '&' : '?';
    const src = `${canvas.url}${sep}_r=${canvas.reloadKey ?? 0}`;

    const handleLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
      // Tercera línea de defensa: si por cualquier motivo el backend deja pasar
      // la Control UI del Gateway, la atrapamos aquí leyendo el <title> del
      // documento cargado (mismo origen, lectura permitida).
      try {
        const title = e.currentTarget.contentDocument?.title;
        if (title === 'OpenClaw Control' && convId) {
          setCanvasError(
            convId,
            'El archivo del canvas no se sirvió correctamente. Pide al agente que regenere el HTML.',
            'IFRAME_SPA_DETECTED',
          );
        }
      } catch {
        // Cross-origin: ignorar. En deploys con dash y canvas-host en
        // dominios distintos no podemos leer el title — backend cubre esto.
      }
    };

    const handleError = () => {
      if (convId) {
        setCanvasError(convId, 'No se pudo cargar el canvas (error de red).', 'IFRAME_NETWORK_ERROR');
      }
    };

    return (
      <iframe
        src={src}
        title="Canvas"
        sandbox="allow-scripts allow-same-origin"
        onLoad={handleLoad}
        onError={handleError}
        style={{ flex: 1, border: 'none', background: '#fff' }}
      />
    );
  }

  if (canvas.type === 'a2ui' && canvas.content) {
    // A2UI: iframe pointing to Gateway renderer, postMessage JSONL
    // Fallback: render raw content as HTML for now
    return (
      <iframe
        srcDoc={wrapHtml('<pre style="padding:16px;color:#ccc;font-size:12px">' + escapeHtml(canvas.content) + '</pre>')}
        title="A2UI Canvas"
        sandbox="allow-scripts"
        style={{ flex: 1, border: 'none', background: '#fff' }}
      />
    );
  }

  // HTML canvas (inline) — sandboxed iframe with srcDoc
  return (
    <iframe
      srcDoc={canvas.content ?? ''}
      title="Canvas"
      sandbox="allow-scripts"
      style={{ flex: 1, border: 'none', background: '#fff' }}
    />
  );
}

// ─── Error State ────────────────────────────────────────────────────

function CanvasErrorState({ message, code }: { message: string; code?: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 420, width: '100%' }}>
        <RetryBanner
          severity="error"
          title="Canvas no disponible"
          message={code ? `${message} (${code})` : message}
        />
        <p
          style={{
            marginTop: 12,
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          Pide al agente que vuelva a generar el HTML.
        </p>
      </div>
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
      }}
    >
      <Layout size={40} style={{ color: 'var(--text-muted)' }} />
      <p
        style={{
          color: 'var(--text-muted)',
          fontSize: '0.875rem',
          textAlign: 'center',
          maxWidth: 240,
          lineHeight: 1.5,
        }}
      >
        Canvas will appear here when the agent sends visual content
      </p>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function wrapHtml(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#1a1a2e;}</style></head><body>${body}</body></html>`;
}
