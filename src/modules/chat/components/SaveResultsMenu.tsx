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

import { useState, useRef, useEffect } from 'react';
import { Save, FileText, Image, Bookmark } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { useI18n } from '@/i18n';
import type { ActiveMode, CanvasState, BrowserSessionState } from '@/stores/canvas.store';

interface SaveResultsMenuProps {
  activeMode: ActiveMode;
  canvas?: CanvasState;
  browserSession?: BrowserSessionState;
  conversationId?: string | null;
}

export function SaveResultsMenu({ activeMode, canvas, browserSession, conversationId }: SaveResultsMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const hasContent = (activeMode === 'canvas' && canvas?.hasContent) ||
    (activeMode === 'browser' && browserSession);

  if (!hasContent) return null;

  async function saveAsFile() {
    if (!canvas?.content) return;
    setSaving(true);
    try {
      await api.post('/canvas/save', {
        conversation_id: conversationId,
        type: 'html',
        content: canvas.content,
        title: 'Canvas',
      });
      toast.success(t('chat.saveResults.toast.canvasSaved'));
    } catch {
      toast.error(t('chat.saveResults.toast.canvasFailed'));
    }
    setSaving(false);
    setOpen(false);
  }

  async function saveScreenshot() {
    if (!browserSession?.snapshot) {
      toast.error(t('chat.saveResults.toast.noScreenshot'));
      return;
    }
    setSaving(true);
    try {
      await api.post('/canvas/save', {
        conversation_id: conversationId,
        type: 'screenshot',
        base64: browserSession.snapshot,
        title: browserSession.currentUrl ? new URL(browserSession.currentUrl).hostname : 'browser',
      });
      toast.success(t('chat.saveResults.toast.screenshotSaved'));
    } catch {
      toast.error(t('chat.saveResults.toast.screenshotFailed'));
    }
    setSaving(false);
    setOpen(false);
  }

  async function saveAsBookmark() {
    if (!browserSession?.currentUrl) {
      toast.error(t('chat.saveResults.toast.noUrl'));
      return;
    }
    setSaving(true);
    try {
      await api.post('/bookmarks', {
        url: browserSession.currentUrl,
        title: browserSession.currentUrl,
        tags: ['browser', 'canvas'],
        source: 'canvas',
      });
      toast.success(t('chat.saveResults.toast.bookmarkSaved'));
    } catch {
      toast.error(t('chat.saveResults.toast.bookmarkFailed'));
    }
    setSaving(false);
    setOpen(false);
  }

  const canvasItems = [
    { id: 'save-file', labelKey: 'chat.saveResults.item.file', icon: FileText, action: saveAsFile },
  ];

  const browserItems = [
    { id: 'save-screenshot', labelKey: 'chat.saveResults.item.screenshot', icon: Image, action: saveScreenshot },
    { id: 'save-bookmark', labelKey: 'chat.saveResults.item.bookmark', icon: Bookmark, action: saveAsBookmark },
  ];

  const items = activeMode === 'browser' ? browserItems : canvasItems;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        disabled={saving}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: 4,
          display: 'flex',
          borderRadius: 'var(--radius-sm)',
          opacity: saving ? 0.5 : 1,
        }}
        title={t('chat.saveResults.save')}
        aria-label={t('chat.saveResults.save')}
      >
        <Save size={14} />
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 4,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          minWidth: 160,
          zIndex: 50,
          overflow: 'hidden',
        }}>
          {items.map((item) => (
            <button
              key={item.id}
              onClick={item.action}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-dim)',
                fontSize: 12,
                fontFamily: 'var(--font-sans)',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'none'; }}
            >
              <item.icon size={14} />
              {t(item.labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
