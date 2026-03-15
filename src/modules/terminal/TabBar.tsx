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

import { useState, useRef, useEffect } from 'react';
import { Terminal, Globe, Plus, X, Columns2, Rows2, Square } from 'lucide-react';
import { useTerminalStore, type TerminalTab } from '@/stores/terminal.store';

interface TabBarProps {
  onNewTab: () => void;
  onNewSSH: () => void;
  onConnectSaved: (connectionId: string, label: string) => void;
  onCloseTab: (tabId: string, sessionId: string) => void;
}

export function TabBar({ onNewTab, onNewSSH, onConnectSaved, onCloseTab }: TabBarProps) {
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const splitMode = useTerminalStore((s) => s.splitMode);
  const connections = useTerminalStore((s) => s.connections);
  const setActiveTab = useTerminalStore((s) => s.setActiveTab);
  const setSplitMode = useTerminalStore((s) => s.setSplitMode);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div style={{
      height: 36,
      display: 'flex',
      alignItems: 'center',
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface)',
      flexShrink: 0,
      overflow: 'visible',
    }}>
      {/* ─── Tabs ─────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minWidth: 0 }}>
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onClick={() => setActiveTab(tab.id)}
            onClose={() => onCloseTab(tab.id, tab.sessionId)}
          />
        ))}
      </div>

      {/* ─── New tab button + dropdown (outside overflow container) ── */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          ref={btnRef}
          onClick={() => setMenuOpen((v) => !v)}
          title="New tab"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            margin: '0 4px',
            background: 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} />
        </button>

        {menuOpen && (
          <div
            ref={menuRef}
            style={{
              position: 'absolute',
              top: 32,
              left: 0,
              minWidth: 200,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              zIndex: 100,
              padding: 4,
              fontFamily: 'var(--font-sans)',
            }}
          >
            <MenuItem
              icon={<Terminal size={13} />}
              label="Local Shell"
              onClick={() => { onNewTab(); setMenuOpen(false); }}
            />
            <MenuItem
              icon={<Globe size={13} />}
              label="SSH Connection..."
              onClick={() => { onNewSSH(); setMenuOpen(false); }}
            />

            {connections.length > 0 && (
              <>
                <div style={{
                  height: 1,
                  background: 'var(--border)',
                  margin: '4px 0',
                }} />
                <div style={{
                  padding: '4px 8px',
                  fontSize: '0.625rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  Saved
                </div>
                {connections.map((c) => (
                  <MenuItem
                    key={c.id}
                    icon={<Globe size={13} />}
                    label={c.label}
                    sublabel={`${c.username}@${c.host}`}
                    onClick={() => { onConnectSaved(c.id, c.label); setMenuOpen(false); }}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── Split controls ──────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 8px', flexShrink: 0 }}>
        <SplitButton
          icon={<Square size={13} />}
          active={splitMode === 'none'}
          onClick={() => setSplitMode('none')}
          title="No split"
        />
        <SplitButton
          icon={<Columns2 size={13} />}
          active={splitMode === 'vertical'}
          onClick={() => setSplitMode('vertical')}
          title="Split vertical"
        />
        <SplitButton
          icon={<Rows2 size={13} />}
          active={splitMode === 'horizontal'}
          onClick={() => setSplitMode('horizontal')}
          title="Split horizontal"
        />
      </div>
    </div>
  );
}

function MenuItem({ icon, label, sublabel, onClick }: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '6px 8px',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text)',
        fontSize: '0.8125rem',
        cursor: 'pointer',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {sublabel && (
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', flexShrink: 0 }}>{sublabel}</span>
      )}
    </button>
  );
}

function TabItem({ tab, isActive, onClick, onClose }: {
  tab: TerminalTab;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
}) {
  const Icon = tab.type === 'ssh' ? Globe : Terminal;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 10px',
        height: '100%',
        cursor: 'pointer',
        fontSize: 12,
        color: isActive ? 'var(--text)' : 'var(--text-muted)',
        borderBottom: isActive ? '2px solid #f59e0b' : '2px solid transparent',
        background: isActive ? 'var(--bg)' : 'transparent',
        flexShrink: 0,
        maxWidth: 160,
        minWidth: 0,
        userSelect: 'none',
      }}
    >
      <Icon size={13} style={{ flexShrink: 0, color: isActive ? '#22c55e' : undefined }} />
      <span style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {tab.label}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          background: 'transparent',
          border: 'none',
          borderRadius: 2,
          color: 'var(--text-muted)',
          cursor: 'pointer',
          flexShrink: 0,
          opacity: isActive ? 1 : 0.5,
        }}
      >
        <X size={11} />
      </button>
    </div>
  );
}

function SplitButton({ icon, active, onClick, title }: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        background: active ? 'var(--bg)' : 'transparent',
        border: active ? '1px solid var(--border)' : '1px solid transparent',
        borderRadius: 'var(--radius-sm)',
        color: active ? 'var(--text)' : 'var(--text-muted)',
        cursor: 'pointer',
      }}
    >
      {icon}
    </button>
  );
}
