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
import { useNavigate } from 'react-router';
import { X, Layout, Globe, FileText, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { useChatStore } from '@/stores/chat.store';
import { useCanvasStore } from '@/stores/canvas.store';
import MarkdownRenderer from '@/components/markdown/MarkdownRenderer';
import { BrowserSessionView } from './components/BrowserSessionView';
import { SaveResultsMenu } from './components/SaveResultsMenu';
import { usePersistedScreenshots } from '@/hooks/use-persisted-screenshots';
import { useNativeCanvasBoardStore } from '@/stores/native-canvas-board.store';
import { NativeCanvasBoardPanel, NativeCanvasHub } from './NativeCanvasBoardPanel';
import { nativeCanvasService } from '@/services/native-canvas.service';

interface CanvasPanelProps {
  onClose: () => void;
}

export function CanvasPanel({ onClose }: CanvasPanelProps) {
  const navigate = useNavigate();
  const activeConvId = useChatStore((s) => s.activeConversationId);
  const canvasStates = useCanvasStore((s) => s.canvasStates);
  const activeMode = useCanvasStore((s) => s.activeMode);
  const browserSessions = useCanvasStore((s) => s.browserSessions);
  const nativePreviews = useNativeCanvasBoardStore((s) => activeConvId ? s.previews.get(activeConvId) : undefined);
  const nativeBoard = useNativeCanvasBoardStore((s) => activeConvId ? s.byConversation.get(activeConvId) : undefined);
  const [nativeCanvasStatus, setNativeCanvasStatus] = useState<'loading' | 'enabled' | 'disabled' | 'error'>('loading');
  const [nativeCanvasConversationId, setNativeCanvasConversationId] = useState<string | null>(activeConvId);

  // A gallery selection changes only this pane. A shared Canvas must never
  // select its source chat: Canvas collaboration does not disclose a transcript.
  useEffect(() => { setNativeCanvasConversationId(activeConvId); }, [activeConvId]);

  // A board belongs to a durable OpenClaw session and may predate this browser
  // tab. Do not depend on a live canvas.preview event to discover it.
  useEffect(() => {
    let active = true;
    void nativeCanvasService.status()
      .then((status) => { if (active) setNativeCanvasStatus(status.native_canvas_enabled ? 'enabled' : 'disabled'); })
      .catch(() => { if (active) setNativeCanvasStatus('error'); });
    return () => { active = false; };
  }, []);

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
  const workspaceFile = canvas?.type === 'workspace_file' ? canvas.workspaceFile : undefined;
  const isWorkspaceFile = Boolean(workspaceFile);
  const displayedNativeConversationId = nativeCanvasConversationId ?? activeConvId;
  const isNativeCanvasMode = nativeCanvasStatus === 'enabled' || Boolean(nativePreviews?.length || nativeBoard);
  // Canvas visual de agentes: sólo el Dashboard nativo de OpenClaw 9.4.
  // Browser y previsualizaciones explícitas de Workspaces no son Canvas.
  const showNativeCanvas = isNativeCanvasMode && !isBrowserMode && !isWorkspaceFile;

  // Header label. La URL efectiva sigue la MISMA precedencia que el cuerpo
  // (`BrowserSessionView`: `currentScreenshot?.url ?? session.currentUrl`): manda
  // la captura que se está viendo y la sesión viva es el respaldo. Sin esto, al
  // abrir capturas persistidas sin sesión viva la cabecera se quedaba en un
  // "Browsing" pelado y no cambiaba al navegar entre capturas.
  const headerUrl = persistedScreenshots[currentIndex]?.url ?? browserSession?.currentUrl ?? null;
  const headerLabel = showNativeCanvas ? 'Dashboard' : isBrowserMode
    ? `Browsing${headerUrl ? ': ' + extractDomain(headerUrl) : ''}`
    : isWorkspaceFile ? workspaceFile!.title : 'Canvas';

  const HeaderIcon = showNativeCanvas ? Layout : isBrowserMode ? Globe : isWorkspaceFile ? FileText : Layout;

  return (
    <div
      data-testid="canvas-panel"
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
        {!isWorkspaceFile && (
          <SaveResultsMenu
            activeMode={activeMode}
            canvas={canvas}
            browserSession={browserSession}
            conversationId={activeConvId}
          />
        )}
        {isWorkspaceFile && workspaceFile!.deepLink && (
          <button
            onClick={() => navigate(workspaceFile!.deepLink)}
            title="Abrir en Workspaces"
            aria-label="Abrir archivo en Workspaces"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 4, display: 'flex',
              borderRadius: 'var(--radius-sm)', flexShrink: 0,
            }}
          >
            <ExternalLink size={14} />
          </button>
        )}
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

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
        {nativeCanvasStatus === 'error' && !nativePreviews?.length && !nativeBoard ? (
          <div style={{ minHeight: 220, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 10, padding: 24, color: 'var(--text-muted)', textAlign: 'center' }}>
            <AlertTriangle size={20} style={{ color: 'var(--amber)' }} />
            <strong style={{ color: 'var(--text)' }}>No se pudo comprobar Canvas nativo</strong>
            <span>El resto del chat sigue disponible. Cierra y vuelve a abrir Canvas para reintentar.</span>
          </div>
        ) : showNativeCanvas ? (displayedNativeConversationId ? <NativeCanvasBoardPanel conversationId={displayedNativeConversationId} onSelectConversation={setNativeCanvasConversationId} /> : <NativeCanvasHub onSelectConversation={setNativeCanvasConversationId} />) : isBrowserMode ? (
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
        ) : isWorkspaceFile ? (
          <WorkspaceFilePreview canvas={canvas!} convId={activeConvId} />
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

function WorkspaceFilePreview({ canvas, convId }: { canvas: CanvasState; convId: string | null }) {
  const setCanvasError = useCanvasStore((s) => s.setCanvasError);
  const file = canvas.workspaceFile!;

  if (canvas.status === 'loading') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)' }}>
        <Loader2 size={18} className="animate-spin" />
        <span style={{ fontSize: '0.8125rem' }}>Cargando {file.title}…</span>
      </div>
    );
  }

  if (file.previewKind === 'markdown') {
    return (
      <div className="app-detail-md" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 20, color: 'var(--text)', fontSize: '0.875rem', lineHeight: 1.65 }}>
        <MarkdownRenderer content={canvas.content ?? ''} />
      </div>
    );
  }

  if (file.previewKind === 'code') {
    return (
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16 }}>
        <MarkdownRenderer content={asFencedCode(canvas.content ?? '', file.relativePath)} />
      </div>
    );
  }

  if (file.previewKind === 'text') {
    return (
      <pre style={{ flex: 1, minHeight: 0, overflow: 'auto', margin: 0, padding: 20, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', lineHeight: 1.6, color: 'var(--text)' }}>
        {canvas.content ?? ''}
      </pre>
    );
  }

  if (file.previewKind === 'image') {
    return (
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'var(--bg)' }}>
        <img
          src={file.contentUrl}
          alt={file.title}
          onError={() => convId && setCanvasError(convId, 'No se pudo cargar la imagen del workspace.', 'WORKSPACE_IMAGE_FAILED')}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      </div>
    );
  }

  if (file.previewKind === 'pdf') {
    return <iframe src={file.contentUrl} title={file.title} style={{ flex: 1, border: 0, background: '#fff' }} />;
  }

  return (
    <iframe
      src={file.contentUrl}
      title={file.title}
      sandbox="allow-scripts"
      onError={() => convId && setCanvasError(convId, 'No se pudo cargar el HTML del workspace.', 'WORKSPACE_HTML_FAILED')}
      style={{ flex: 1, border: 0, background: '#fff' }}
    />
  );
}

function asFencedCode(content: string, path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const language = ({
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx', mjs: 'javascript', cjs: 'javascript',
    py: 'python', rb: 'ruby', sh: 'bash', bash: 'bash', zsh: 'bash', ps1: 'powershell',
    yml: 'yaml', yaml: 'yaml', json: 'json', jsonl: 'json', css: 'css', scss: 'scss',
    html: 'html', xml: 'xml', sql: 'sql', go: 'go', rs: 'rust', java: 'java',
    kt: 'kotlin', cs: 'csharp', cpp: 'cpp', c: 'c', php: 'php', swift: 'swift',
  } as Record<string, string>)[ext] ?? '';
  const longestRun = Math.max(0, ...(content.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  return `${fence}${language}\n${content}\n${fence}`;
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
        Canvas aparecerá aquí cuando el agente envíe contenido visual
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('micelclaw:chat-draft', { detail: 'Crea un dashboard Canvas con un resumen visual de esta conversación.' }))}>Crear un dashboard</button>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('micelclaw:chat-draft', { detail: 'Genera un diagrama Mermaid que explique esta conversación.' }))}>Generar un diagrama</button>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', margin: 0 }}>La propuesta se prepara en el cuadro de mensaje; tú decides si la envías.</p>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}
