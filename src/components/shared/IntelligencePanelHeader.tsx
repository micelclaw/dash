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

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface IntelligencePanelHeaderProps {
  title: string;
  storageKey: string;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}

export function IntelligencePanelHeader({
  title,
  storageKey,
  defaultCollapsed = true,
  children,
}: IntelligencePanelHeaderProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(`claw:panel:${storageKey}`);
      return stored !== null ? stored === 'true' : defaultCollapsed;
    } catch {
      return defaultCollapsed;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`claw:panel:${storageKey}`, String(collapsed));
    } catch { /* ignore */ }
  }, [collapsed, storageKey]);

  const Chevron = collapsed ? ChevronRight : ChevronDown;

  return (
    <div style={{ padding: '4px 16px 8px' }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
          width: '100%',
          textAlign: 'left',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <Chevron size={12} style={{ color: 'var(--text-muted)' }} />
        <span style={{
          fontSize: '0.6875rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {title}
        </span>
      </button>
      {!collapsed && (
        <div style={{ paddingTop: 4 }}>
          {children}
        </div>
      )}
    </div>
  );
}
