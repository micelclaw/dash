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

import type { ReactNode } from 'react';
import { Tabs } from '@/components/shared/Tabs';

interface MediaShellProps {
  /** Module identity CSS var, e.g. '--mod-music'. Scopes the accent color. */
  moduleVar: string;
  title: string;
  actions?: ReactNode;
  tabs?: { id: string; label: string }[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  toolbar?: ReactNode;
  inspector?: ReactNode;
  children: ReactNode;
}

/**
 * Page shell for media modules (music / video / books): header with title +
 * actions, optional underline tab row, toolbar slot, scrollable content and
 * an optional right-side inspector panel (~320px).
 *
 * The root scopes `--amber` to the module identity color (same pattern as
 * DrivePage), so shared components (Tabs underline, accent buttons) pick up
 * the module color without forking.
 */
export function MediaShell({
  moduleVar,
  title,
  actions,
  tabs,
  activeTab,
  onTabChange,
  toolbar,
  inspector,
  children,
}: MediaShellProps) {
  return (
    <div
      style={{
        // Scoped override: shared components keyed on --amber pick up the
        // module identity color (the exact DrivePage pattern).
        ['--amber' as string]: `var(${moduleVar})`,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      } as React.CSSProperties}
    >
      {/* Header: title + actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--text)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {title}
        </span>
        <div style={{ flex: 1 }} />
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{actions}</div>
        )}
      </div>

      {/* Tab row (underline style, mirrors Drive/Photos) */}
      {tabs && tabs.length > 0 && (
        <div style={{ padding: '0 16px', flexShrink: 0, overflowX: 'auto' }}>
          <Tabs
            tabs={tabs}
            activeTab={activeTab ?? tabs[0].id}
            onChange={(id) => onTabChange?.(id)}
            variant="underline"
          />
        </div>
      )}

      {/* Toolbar slot */}
      {toolbar}

      {/* Content + inspector */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>{children}</div>
        {inspector && (
          <div
            style={{
              width: 320,
              flexShrink: 0,
              borderLeft: '1px solid var(--border)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {inspector}
          </div>
        )}
      </div>
    </div>
  );
}
