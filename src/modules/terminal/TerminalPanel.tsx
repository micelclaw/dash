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

import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import type { TerminalWebSocket } from './terminal-ws';

const DARK_AMBER_THEME = {
  background: '#0c0a09',
  foreground: '#e7e5e4',
  cursor: '#f59e0b',
  cursorAccent: '#0c0a09',
  selectionBackground: '#f59e0b33',
  black: '#1c1917',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#f59e0b',
  blue: '#3b82f6',
  magenta: '#a855f7',
  cyan: '#06b6d4',
  white: '#e7e5e4',
  brightBlack: '#57534e',
  brightRed: '#f87171',
  brightGreen: '#4ade80',
  brightYellow: '#fbbf24',
  brightBlue: '#60a5fa',
  brightMagenta: '#c084fc',
  brightCyan: '#22d3ee',
  brightWhite: '#fafaf9',
};

interface TerminalPanelProps {
  sessionId: string;
  ws: TerminalWebSocket;
  isActive: boolean;
  type: 'local' | 'ssh';
  cwd?: string;
  connectionId?: string;
}

export function TerminalPanel({ sessionId, ws, isActive, type, cwd, connectionId }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const openedRef = useRef(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
      fontSize: 14,
      theme: DARK_AMBER_THEME,
      allowProposedApi: true,
    });
    termRef.current = term;

    const fitAddon = new FitAddon();
    fitRef.current = fitAddon;
    term.loadAddon(fitAddon);

    // WebGL renderer (with fallback)
    try {
      term.loadAddon(new WebglAddon());
    } catch {
      // Falls back to canvas renderer
    }

    term.loadAddon(new WebLinksAddon());

    const searchAddon = new SearchAddon();
    searchRef.current = searchAddon;
    term.loadAddon(searchAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    // Send open command to server
    ws.send({
      action: 'open',
      sessionId,
      type,
      cols: term.cols,
      rows: term.rows,
      cwd: cwd || undefined,
      connectionId: connectionId || undefined,
    });
    openedRef.current = true;

    // Listen for server messages for this session
    const unsubscribe = ws.onMessage((msg) => {
      if (msg.sessionId !== sessionId) return;
      switch (msg.event) {
        case 'output':
          if (msg.data) term.write(msg.data);
          break;
        case 'closed':
          term.write('\r\n\x1b[90m[Session ended]\x1b[0m\r\n');
          break;
        case 'error':
          term.write(`\r\n\x1b[31mError: ${msg.message}\x1b[0m\r\n`);
          break;
      }
    });

    // Forward terminal input to server
    const inputDisposable = term.onData((data) => {
      ws.send({ action: 'input', sessionId, data });
    });

    // Resize handling — track last sent dimensions to avoid redundant
    // resize messages that cause bash SIGWINCH + prompt redraw
    let lastCols = term.cols;
    let lastRows = term.rows;
    const ro = new ResizeObserver(() => {
      fitAddon.fit();
      if (ws.isConnected && (term.cols !== lastCols || term.rows !== lastRows)) {
        lastCols = term.cols;
        lastRows = term.rows;
        ws.send({ action: 'resize', sessionId, cols: term.cols, rows: term.rows });
      }
    });
    ro.observe(containerRef.current);

    // Re-open session after WS reconnect (server killed old sessions)
    const unsubReconnect = ws.onReconnect(() => {
      term.write('\r\n\x1b[90m[Reconnecting...]\x1b[0m\r\n');
      ws.send({
        action: 'open',
        sessionId,
        type,
        cols: term.cols,
        rows: term.rows,
        cwd: cwd || undefined,
        connectionId: connectionId || undefined,
      });
    });

    return () => {
      ro.disconnect();
      inputDisposable.dispose();
      unsubscribe();
      unsubReconnect();
      if (openedRef.current) {
        ws.send({ action: 'close', sessionId });
      }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      searchRef.current = null;
    };
  }, [sessionId, ws, type, cwd, connectionId]);

  // Focus and fit when becoming active (skip if a dialog/modal has focus)
  useEffect(() => {
    if (isActive && termRef.current && fitRef.current) {
      fitRef.current.fit();
      const active = document.activeElement;
      const inDialog = active?.closest('[role="dialog"]');
      if (!inDialog) {
        termRef.current.focus();
      }
    }
  }, [isActive]);

  // Ctrl+Shift+F to open search (only when active)
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'F') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isActive]);

  const handleSearchNext = useCallback(() => {
    if (searchRef.current && searchQuery) {
      searchRef.current.findNext(searchQuery);
    }
  }, [searchQuery]);

  const handleSearchPrev = useCallback(() => {
    if (searchRef.current && searchQuery) {
      searchRef.current.findPrevious(searchQuery);
    }
  }, [searchQuery]);

  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    searchRef.current?.clearDecorations();
    termRef.current?.focus();
  }, []);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0c0a09' }}>
      {/* Search bar */}
      {searchOpen && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value && searchRef.current) {
                searchRef.current.findNext(e.target.value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.shiftKey ? handleSearchPrev() : handleSearchNext();
              } else if (e.key === 'Escape') {
                handleCloseSearch();
              }
            }}
            placeholder="Search..."
            autoFocus
            style={{
              flex: 1,
              padding: '3px 8px',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              outline: 'none',
            }}
          />
          <button onClick={handleSearchPrev} style={searchBtnStyle} title="Previous (Shift+Enter)">
            <ChevronUp size={13} />
          </button>
          <button onClick={handleSearchNext} style={searchBtnStyle} title="Next (Enter)">
            <ChevronDown size={13} />
          </button>
          <button onClick={handleCloseSearch} style={searchBtnStyle} title="Close (Escape)">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Terminal container */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'hidden',
        }}
      />
    </div>
  );
}

const searchBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-muted)',
  cursor: 'pointer',
};
