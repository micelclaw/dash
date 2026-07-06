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

// ─── Design canvas — sandboxed iframe + inspector bridge ─────────────
//
// sandbox="allow-scripts" (NO allow-same-origin → opaque origin, no
// cookies/storage) + a strict CSP inside the srcDoc. The only script is
// OUR inspector (nonce'd); the page HTML arrives server-sanitized. The
// bridge validates event.source + the per-doc nonce on every message.

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { buildInspectorScript } from './inspector-script';
import { buildCanvasDoc, type ElementRef } from './design.service';

export interface CanvasSelection extends ElementRef {
  text: string;
}

export interface DesignCanvasHandle {
  requestTextEdit: (clawId: number) => void;
  clearSelection: () => void;
}

interface Props {
  pageHtml: string;
  tokensCss: string | null;
  overridesCss?: string | null;
  device: 'desktop' | 'mobile';
  onSelect: (sel: CanvasSelection | null) => void;
  onTextEdited: (clawId: number, newText: string) => void;
}

export const DesignCanvas = forwardRef<DesignCanvasHandle, Props>(function DesignCanvas(
  { pageHtml, tokensCss, overridesCss, device, onSelect, onTextEdited }, ref,
) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const nonce = useMemo(() => crypto.randomUUID(), []);

  const srcDoc = useMemo(() => buildCanvasDoc({
    pageHtml,
    tokensCss,
    overridesCss,
    inspectorScript: buildInspectorScript(nonce),
    nonce,
  }), [pageHtml, tokensCss, overridesCss, nonce]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data as { t?: string; nonce?: string } & Record<string, unknown>;
      if (!d || d.nonce !== nonce) return;
      if (d.t === 'claw-design:selected') {
        onSelect({
          claw_id: Number(d.claw_id),
          tag: String(d.tag ?? ''),
          path: String(d.path ?? ''),
          outer_html: String(d.outer_html ?? ''),
          text: String(d.text ?? ''),
        });
      }
      if (d.t === 'claw-design:text-edited') {
        onTextEdited(Number(d.claw_id), String(d.new_text ?? ''));
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [nonce, onSelect, onTextEdited]);

  useImperativeHandle(ref, () => ({
    requestTextEdit(clawId: number) {
      iframeRef.current?.contentWindow?.postMessage({ t: 'claw-design:edit-text', nonce, claw_id: clawId }, '*');
    },
    clearSelection() {
      iframeRef.current?.contentWindow?.postMessage({ t: 'claw-design:clear-selection', nonce }, '*');
    },
  }), [nonce]);

  return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'stretch', justifyContent: 'center',
      background: 'var(--surface)', overflow: 'auto', padding: device === 'mobile' ? '16px 0' : 0,
    }}>
      <iframe
        ref={iframeRef}
        title="Design canvas"
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        style={{
          border: device === 'mobile' ? '1px solid var(--border)' : 'none',
          borderRadius: device === 'mobile' ? 18 : 0,
          width: device === 'mobile' ? 390 : '100%',
          height: device === 'mobile' ? 'calc(100% - 0px)' : '100%',
          background: '#fff',
          flexShrink: 0,
        }}
      />
    </div>
  );
});

export default DesignCanvas;
