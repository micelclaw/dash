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

// ─── Office WebSocket Hook ──────────────────────────────────────────
// Listens for office:* events from the backend (AI agent commands)
// and executes them via the bridge plugin in ONLYOFFICE.

import { useEffect } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import type { useOfficeBridge } from './use-office-bridge';

type Bridge = ReturnType<typeof useOfficeBridge>;

/**
 * Connects backend AI office commands to the ONLYOFFICE bridge.
 * When the backend broadcasts `office:execute`, this hook picks it up
 * and runs the code inside ONLYOFFICE via the PostMessage bridge.
 *
 * Additional events can be added here:
 * - office:insertText, office:insertTable, etc.
 */
export function useOfficeWs(bridge: Bridge) {
  const executeEvent = useWebSocket('office:execute');
  const insertTextEvent = useWebSocket('office:insertText');
  const insertTableEvent = useWebSocket('office:insertTable');
  const replaceTextEvent = useWebSocket('office:replaceText');
  const getSelectionEvent = useWebSocket('office:getSelection');
  const getDocumentTextEvent = useWebSocket('office:getDocumentText');

  // Raw code execution (from POST /office/execute)
  useEffect(() => {
    if (!executeEvent) return;
    const code = executeEvent.data.code as string;
    if (!code) return;
    bridge.sendCommand({ action: 'execute', code }).catch(() => {
      // Execution failed — bridge may not be ready or iframe not found
    });
  }, [executeEvent, bridge]);

  // High-level commands from AI agent
  useEffect(() => {
    if (!insertTextEvent) return;
    const { text, position } = insertTextEvent.data as { text: string; position?: 'cursor' | 'end' };
    if (text) bridge.insertText(text, position).catch(() => {});
  }, [insertTextEvent, bridge]);

  useEffect(() => {
    if (!insertTableEvent) return;
    const { rows, cols, data } = insertTableEvent.data as { rows: number; cols: number; data?: string[][] };
    if (rows && cols) bridge.insertTable(rows, cols, data).catch(() => {});
  }, [insertTableEvent, bridge]);

  useEffect(() => {
    if (!replaceTextEvent) return;
    const { find, replace } = replaceTextEvent.data as { find: string; replace: string };
    if (find && replace) bridge.replaceText(find, replace).catch(() => {});
  }, [replaceTextEvent, bridge]);

  useEffect(() => {
    if (!getSelectionEvent) return;
    bridge.getSelection().catch(() => {});
  }, [getSelectionEvent, bridge]);

  useEffect(() => {
    if (!getDocumentTextEvent) return;
    bridge.getDocumentText().catch(() => {});
  }, [getDocumentTextEvent, bridge]);
}
