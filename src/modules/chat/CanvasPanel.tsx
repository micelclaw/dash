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

import { useMemo, useEffect, useRef } from 'react';
import { X, Layout, Globe } from 'lucide-react';
import { useChatStore } from '@/stores/chat.store';
import { useCanvasStore } from '@/stores/canvas.store';
import { BrowserSessionView } from './components/BrowserSessionView';
import { SaveResultsMenu } from './components/SaveResultsMenu';
import { usePersistedScreenshots } from '@/hooks/use-persisted-screenshots';

interface CanvasPanelProps {
  onClose: () => void;
}

export function CanvasPanel({ onClose }: CanvasPanelProps) {
  const activeConvId = useChatStore((s) => s.activeConversationId);
  const canvasStates = useCanvasStore((s) => s.canvasStates);
  const activeMode = useCanvasStore((s) => s.activeMode);
  const browserSessions = useCanvasStore((s) => s.browserSessions);

  // Canvas content for current conversation (fallback to standalone)
  const canvas = canvasStates.get(activeConvId ?? '__standalone__');

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
  const isCanvasMode = activeMode === 'canvas' && canvas?.hasContent;

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
        ) : isCanvasMode ? (
          <CanvasIframe type={canvas!.type!} content={canvas!.content!} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

// ─── Canvas Iframe ──────────────────────────────────────────────────

function CanvasIframe({ type, content }: { type: 'html' | 'a2ui'; content: string }) {
  if (type === 'a2ui') {
    // A2UI: iframe pointing to Gateway renderer, postMessage JSONL
    // Fallback: render raw content as HTML for now
    return (
      <iframe
        srcDoc={wrapHtml('<pre style="padding:16px;color:#ccc;font-size:12px">' + escapeHtml(content) + '</pre>')}
        title="A2UI Canvas"
        sandbox="allow-scripts"
        style={{ flex: 1, border: 'none', background: '#fff' }}
      />
    );
  }

  // HTML canvas — sandboxed iframe
  return (
    <iframe
      srcDoc={content}
      title="Canvas"
      sandbox="allow-scripts"
      style={{ flex: 1, border: 'none', background: '#fff' }}
    />
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
