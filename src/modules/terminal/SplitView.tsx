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

import { useState, useCallback, useRef } from 'react';
import { TerminalPanel } from './TerminalPanel';
import { useTerminalStore } from '@/stores/terminal.store';
import type { TerminalWebSocket } from './terminal-ws';

interface SplitViewProps {
  ws: TerminalWebSocket;
}

export function SplitView({ ws }: SplitViewProps) {
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const splitMode = useTerminalStore((s) => s.splitMode);
  const splitTabIds = useTerminalStore((s) => s.splitTabIds);

  const [splitRatio, setSplitRatio] = useState(50);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = splitMode === 'vertical'
        ? ((ev.clientX - rect.left) / rect.width) * 100
        : ((ev.clientY - rect.top) / rect.height) * 100;
      setSplitRatio(Math.max(20, Math.min(80, ratio)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [splitMode]);

  // No tabs
  if (tabs.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: 14,
        background: '#0c0a09',
      }}>
        No terminal sessions
      </div>
    );
  }

  // Single mode
  if (splitMode === 'none' || !splitTabIds) {
    const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
    return (
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {tabs.map((tab) => (
          <div
            key={tab.sessionId}
            style={{
              flex: 1,
              display: tab.id === activeTab.id ? 'flex' : 'none',
              overflow: 'hidden',
            }}
          >
            <TerminalPanel
              sessionId={tab.sessionId}
              ws={ws}
              isActive={tab.id === activeTab.id}
              type={tab.type}
              cwd={tab.cwd}
              connectionId={tab.connectionId}
            />
          </div>
        ))}
      </div>
    );
  }

  // Split mode
  const tab1 = tabs.find((t) => t.id === splitTabIds[0]);
  const tab2 = tabs.find((t) => t.id === splitTabIds[1]);
  if (!tab1 || !tab2) {
    // Fallback to single mode if split tabs no longer exist
    const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
    return (
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <TerminalPanel
          sessionId={activeTab.sessionId}
          ws={ws}
          isActive
          type={activeTab.type}
          cwd={activeTab.cwd}
          connectionId={activeTab.connectionId}
        />
      </div>
    );
  }

  const isVertical = splitMode === 'vertical';

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: isVertical ? 'row' : 'column',
        overflow: 'hidden',
      }}
    >
      {/* Panel 1 */}
      <div style={{
        [isVertical ? 'width' : 'height']: `${splitRatio}%`,
        display: 'flex',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <TerminalPanel
          sessionId={tab1.sessionId}
          ws={ws}
          isActive={tab1.id === activeTabId}
          type={tab1.type}
          cwd={tab1.cwd}
          connectionId={tab1.connectionId}
        />
      </div>

      {/* Divider */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          [isVertical ? 'width' : 'height']: 4,
          background: 'var(--border)',
          cursor: isVertical ? 'col-resize' : 'row-resize',
          flexShrink: 0,
        }}
      />

      {/* Panel 2 */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
      }}>
        <TerminalPanel
          sessionId={tab2.sessionId}
          ws={ws}
          isActive={tab2.id === activeTabId}
          type={tab2.type}
          cwd={tab2.cwd}
          connectionId={tab2.connectionId}
        />
      </div>
    </div>
  );
}
