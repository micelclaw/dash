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

import { useI18n } from '@/i18n';
import { moduleGroupLabel } from '@/i18n/module-labels';
import type { ModuleConfig } from '@/types/modules';

interface SidebarGroupProps {
  label: string;
  collapsed: boolean;
  modules: ModuleConfig[];
  children: React.ReactNode;
}

export function SidebarGroup({ label, collapsed, modules, children }: SidebarGroupProps) {
  const { locale } = useI18n();
  return (
    <div style={{ paddingTop: 16 }}>
      {!collapsed && (
        <>
          <div
            style={{
              height: 1,
              background: 'var(--border)',
              marginBottom: 12,
            }}
          />
          <div
            style={{
              fontSize: '0.6875rem',
              fontWeight: 500,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '0 12px',
              marginBottom: 4,
            }}
          >
            {moduleGroupLabel(label, locale, modules)}
          </div>
        </>
      )}
      {collapsed && (
        <div
          style={{
            height: 1,
            background: 'var(--border)',
            marginBottom: 8,
            marginLeft: 8,
            marginRight: 8,
          }}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {children}
      </div>
    </div>
  );
}
