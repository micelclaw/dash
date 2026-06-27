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
  /** Acción SIEMPRE visible a la derecha del título (también colapsado): p.ej. el botón de enlazar. */
  headerRight?: React.ReactNode;
}

export function IntelligencePanelHeader({
  title,
  storageKey,
  defaultCollapsed = true,
  children,
  headerRight,
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
            flex: 1,
            minWidth: 0,
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
        {headerRight && <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{headerRight}</div>}
      </div>
      {!collapsed && (
        <div style={{ paddingTop: 4 }}>
          {children}
        </div>
      )}
    </div>
  );
}
