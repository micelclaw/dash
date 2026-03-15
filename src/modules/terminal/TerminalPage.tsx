/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useTerminalStore } from '@/stores/terminal.store';
import { TerminalWebSocket } from './terminal-ws';
import { TabBar } from './TabBar';
import { SplitView } from './SplitView';
import { ConnectionDialog } from './ConnectionDialog';
import { SnippetPanel } from './SnippetPanel';

export function Component() {
  const token = useAuthStore((s) => s.tokens?.accessToken);
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const addTab = useTerminalStore((s) => s.addTab);
  const closeTab = useTerminalStore((s) => s.closeTab);
  const setActiveTab = useTerminalStore((s) => s.setActiveTab);
  const splitMode = useTerminalStore((s) => s.splitMode);
  const setSplitMode = useTerminalStore((s) => s.setSplitMode);
  const fetchConnections = useTerminalStore((s) => s.fetchConnections);
  const fetchDefaults = useTerminalStore((s) => s.fetchDefaults);
  const [ws, setWs] = useState<TerminalWebSocket | null>(null);
  const [sshDialogOpen, setSSHDialogOpen] = useState(false);
  const [snippetsOpen, setSnippetsOpen] = useState(false);

  // Connect WS on mount
  useEffect(() => {
    if (!token) return;

    const instance = new TerminalWebSocket(token);
    instance.connect();
    setWs(instance);

    return () => {
      // Clear tabs before disposing WS — TerminalPanels unmount
      // and send 'close' for each session while WS is still alive
      useTerminalStore.getState().clearTabs();
      instance.dispose();
      setWs(null);
    };
  }, [token]);

  // Fetch saved connections on mount
  useEffect(() => {
    fetchConnections();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Open default tabs when WS connects and no tabs exist
  useEffect(() => {
    if (!ws || tabs.length > 0) return;
    fetchDefaults().then((defaults) => {
      for (const d of defaults) {
        addTab(d.type as 'local' | 'ssh', { label: d.label, cwd: d.cwd || undefined });
      }
      // Activate the first tab
      const { tabs: created } = useTerminalStore.getState();
      if (created.length > 0) {
        useTerminalStore.getState().setActiveTab(created[0].id);
      }
    });
  }, [ws]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // All shortcuts require Ctrl+Shift
      if (!e.ctrlKey || !e.shiftKey) return;

      switch (e.key.toUpperCase()) {
        case 'T': // New tab
          e.preventDefault();
          addTab('local');
          break;

        case 'W': // Close active tab
          e.preventDefault();
          if (activeTabId) {
            const tab = tabs.find((t) => t.id === activeTabId);
            if (tab) closeTab(tab.id);
          }
          break;

        case 'D': // Toggle split
          e.preventDefault();
          setSplitMode(splitMode === 'none' ? 'vertical' : 'none');
          break;

        case 'S': // Toggle snippets
          e.preventDefault();
          setSnippetsOpen((v) => !v);
          break;
      }

      // Ctrl+Tab / Ctrl+Shift+Tab for cycling tabs
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        if (tabs.length < 2) return;
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        const next = e.shiftKey
          ? (idx - 1 + tabs.length) % tabs.length
          : (idx + 1) % tabs.length;
        setActiveTab(tabs[next].id);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tabs, activeTabId, splitMode, addTab, closeTab, setActiveTab, setSplitMode]);

  const handleNewTab = () => {
    addTab('local');
  };

  const handleCloseTab = (tabId: string, _sessionId: string) => {
    closeTab(tabId);
  };

  const handleConnectSSH = (connectionId: string, label: string) => {
    addTab('ssh', { connectionId, label });
  };

  const handlePasteSnippet = useCallback((command: string) => {
    // Write snippet command to the active terminal session
    if (!ws || !activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;
    ws.send({ action: 'input', sessionId: tab.sessionId, data: command });
  }, [ws, activeTabId, tabs]);

  if (!ws) {
    return (
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0c0a09',
        color: 'var(--text-muted)',
        fontSize: 14,
      }}>
        Connecting...
      </div>
    );
  }

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      background: '#0c0a09',
    }}>
      <TabBar
        onNewTab={handleNewTab}
        onNewSSH={() => setSSHDialogOpen(true)}
        onConnectSaved={handleConnectSSH}
        onCloseTab={handleCloseTab}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <SplitView ws={ws} />
        <SnippetPanel
          open={snippetsOpen}
          onClose={() => setSnippetsOpen(false)}
          onPaste={handlePasteSnippet}
        />
      </div>

      <ConnectionDialog
        open={sshDialogOpen}
        onClose={() => setSSHDialogOpen(false)}
        onConnect={handleConnectSSH}
      />
    </div>
  );
}
