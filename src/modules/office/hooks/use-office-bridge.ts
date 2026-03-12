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

// ─── Office Bridge Hook ─────────────────────────────────────────────
// PostMessage bridge between Dash and the ONLYOFFICE editor iframe.
// Commands are sequential — waits for response before sending the next.

import { useEffect, useRef, useCallback } from 'react';

const COMMAND_TIMEOUT_MS = 10_000;

export interface BridgeCommand {
  action: string;
  code: string;
}

interface PendingCommand {
  id: string;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function useOfficeBridge() {
  const readyRef = useRef(false);
  const queueRef = useRef<Array<{ cmd: BridgeCommand; resolve: (r: unknown) => void; reject: (e: Error) => void }>>([]);
  const pendingRef = useRef<PendingCommand | null>(null);
  const idCounter = useRef(0);

  // Listen for bridge messages
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const { data } = event;
      if (!data || typeof data.type !== 'string') return;

      if (data.type === 'micelclaw:bridge-ready') {
        readyRef.current = true;
        processQueue();
        return;
      }

      if (data.type === 'micelclaw:execute-result') {
        const pending = pendingRef.current;
        if (!pending || pending.id !== data.id) return;

        clearTimeout(pending.timer);
        pendingRef.current = null;

        if (data.error) {
          pending.reject(new Error(data.error));
        } else {
          pending.resolve(data.result);
        }

        processQueue();
      }
    }

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      // Reject any pending command on unmount
      if (pendingRef.current) {
        clearTimeout(pendingRef.current.timer);
        pendingRef.current.reject(new Error('Bridge unmounted'));
        pendingRef.current = null;
      }
      // Reject queued commands
      for (const item of queueRef.current) {
        item.reject(new Error('Bridge unmounted'));
      }
      queueRef.current = [];
      readyRef.current = false;
    };
  }, []);

  function processQueue() {
    if (pendingRef.current) return; // already processing one
    if (!readyRef.current) return;

    const next = queueRef.current.shift();
    if (!next) return;

    const id = `cmd_${++idCounter.current}`;
    const timer = setTimeout(() => {
      if (pendingRef.current?.id === id) {
        pendingRef.current.reject(new Error(`Bridge command timed out after ${COMMAND_TIMEOUT_MS}ms`));
        pendingRef.current = null;
        processQueue();
      }
    }, COMMAND_TIMEOUT_MS);

    pendingRef.current = { id, resolve: next.resolve, reject: next.reject, timer };

    // Find the ONLYOFFICE iframe and post to it
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[name="frameEditor"]');
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'micelclaw:execute', id, code: next.cmd.code }, '*');
    } else {
      clearTimeout(timer);
      pendingRef.current = null;
      next.reject(new Error('ONLYOFFICE iframe not found'));
      processQueue();
    }
  }

  const sendCommand = useCallback((cmd: BridgeCommand): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      queueRef.current.push({ cmd, resolve, reject });
      processQueue();
    });
  }, []);

  // ─── High-level helpers ─────────────────────────────────────────────

  const insertText = useCallback((text: string, position?: 'cursor' | 'end') => {
    const posCode = position === 'end'
      ? 'var doc = Api.GetDocument(); var p = Api.CreateParagraph(); p.AddText(text); doc.Push(p);'
      : 'var doc = Api.GetDocument(); var range = doc.GetRangeBySelect(); if (range) { range.AddText(text); }';
    return sendCommand({
      action: 'insertText',
      code: `var text = ${JSON.stringify(text)};\n${posCode}`,
    });
  }, [sendCommand]);

  const insertTable = useCallback((rows: number, cols: number, data?: string[][]) => {
    return sendCommand({
      action: 'insertTable',
      code: `
        var doc = Api.GetDocument();
        var table = Api.CreateTable(${cols}, ${rows});
        ${data ? `var data = ${JSON.stringify(data)};
        for (var r = 0; r < data.length; r++) {
          var row = table.GetRow(r);
          for (var c = 0; c < data[r].length; c++) {
            var cell = row.GetCell(c);
            cell.GetContent().GetElement(0).AddText(data[r][c]);
          }
        }` : ''}
        doc.Push(table);
      `,
    });
  }, [sendCommand]);

  const replaceText = useCallback((find: string, replace: string) => {
    return sendCommand({
      action: 'replaceText',
      code: `
        var doc = Api.GetDocument();
        var search = doc.Search(${JSON.stringify(find)});
        for (var i = 0; i < search.length; i++) {
          search[i].AddText(${JSON.stringify(replace)});
        }
      `,
    });
  }, [sendCommand]);

  const getSelection = useCallback(() => {
    return sendCommand({
      action: 'getSelection',
      code: `
        var doc = Api.GetDocument();
        var range = doc.GetRangeBySelect();
        return range ? range.GetText() : '';
      `,
    });
  }, [sendCommand]);

  const getDocumentText = useCallback(() => {
    return sendCommand({
      action: 'getDocumentText',
      code: `
        var doc = Api.GetDocument();
        var count = doc.GetElementsCount();
        var texts = [];
        for (var i = 0; i < count; i++) {
          var el = doc.GetElement(i);
          if (el.GetClassType && el.GetClassType() === 'paragraph') {
            texts.push(el.GetText());
          }
        }
        return texts.join('\\n');
      `,
    });
  }, [sendCommand]);

  const formatSelection = useCallback((opts: { bold?: boolean; italic?: boolean; fontSize?: number; color?: string }) => {
    const parts: string[] = [];
    if (opts.bold !== undefined) parts.push(`range.SetBold(${opts.bold});`);
    if (opts.italic !== undefined) parts.push(`range.SetItalic(${opts.italic});`);
    if (opts.fontSize !== undefined) parts.push(`range.SetFontSize(${opts.fontSize * 2});`); // ONLYOFFICE uses half-points
    if (opts.color !== undefined) {
      const hex = opts.color.replace('#', '');
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      parts.push(`range.SetColor(${r}, ${g}, ${b});`);
    }
    return sendCommand({
      action: 'formatSelection',
      code: `
        var doc = Api.GetDocument();
        var range = doc.GetRangeBySelect();
        if (range) { ${parts.join('\n')} }
      `,
    });
  }, [sendCommand]);

  return {
    ready: readyRef.current,
    sendCommand,
    insertText,
    insertTable,
    replaceText,
    getSelection,
    getDocumentText,
    formatSelection,
  };
}
