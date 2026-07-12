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
import { useIsMobile } from '@/hooks/use-media-query';

interface MediaShellProps {
  /** Module identity CSS var, e.g. '--mod-music'. Scopes the accent color. */
  moduleVar: string;
  actions?: ReactNode;
  tabs?: { id: string; label: string }[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  toolbar?: ReactNode;
  inspector?: ReactNode;
  children: ReactNode;
}

/**
 * Page shell for media modules (music / video / books): a single chrome row
 * (underline tabs on the left, toolbar/search + actions on the right),
 * scrollable content and an optional right-side inspector panel (~320px).
 *
 * There is intentionally NO module title here — the app shell already shows
 * it in the top bar, so a second in-page title was redundant.
 *
 * The root scopes `--amber` to the module identity color (same pattern as
 * DrivePage), so shared components (Tabs underline, accent buttons) pick up
 * the module color without forking.
 */
export function MediaShell({
  moduleVar,
  actions,
  tabs,
  activeTab,
  onTabChange,
  toolbar,
  inspector,
  children,
}: MediaShellProps) {
  const hasTabs = !!tabs && tabs.length > 0;
  const hasChrome = hasTabs || !!toolbar || !!actions;
  const isMobile = useIsMobile();
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
      {/* Chrome. Desktop: a single row — underline tabs on the left, toolbar/
          search + actions on the right (`alignItems: flex-end` + zero bottom
          padding makes the Tabs underline coincide with the row border). Mobile:
          stacks into a COLUMN so the search/filters/actions never crowd out or
          clip the tabs — the tabs get their own horizontally-scrollable row and
          the toolbar+actions wrap below (fixes the cut-off top bar with no
          scroll on Photos/Video/Music/Books). */}
      {hasChrome && (isMobile ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '8px 12px 0',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          {hasTabs && (
            <div style={{ minWidth: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {/* max-content → the tab strip keeps its natural width and scrolls
                  horizontally instead of shrinking / clipping. */}
              <div style={{ width: 'max-content' }}>
                <Tabs
                  tabs={tabs}
                  activeTab={activeTab ?? tabs[0]?.id ?? ''}
                  onChange={(id) => onTabChange?.(id)}
                  variant="underline"
                />
              </div>
            </div>
          )}
          {(toolbar || actions) && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingBottom: 6 }}>
              {toolbar}
              {actions && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {actions}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
            padding: '8px 16px 0',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, overflowX: 'auto' }}>
            {hasTabs && (
              <Tabs
                tabs={tabs}
                activeTab={activeTab ?? tabs[0]?.id ?? ''}
                onChange={(id) => onTabChange?.(id)}
                variant="underline"
              />
            )}
          </div>
          {toolbar}
          {actions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexShrink: 0 }}>
              {actions}
            </div>
          )}
        </div>
      ))}

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
