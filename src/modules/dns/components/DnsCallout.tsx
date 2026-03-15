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

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface DnsCalloutProps {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  title?: string;
}

export function DnsCallout({ icon: Icon, children, collapsible, defaultCollapsed, title }: DnsCalloutProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? false);

  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: '1px solid rgba(212, 160, 23, 0.25)',
      background: 'rgba(212, 160, 23, 0.06)',
      padding: collapsible ? 0 : 16,
      overflow: 'hidden',
    }}>
      {collapsible ? (
        <>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '12px 16px',
              background: 'none', border: 'none',
              cursor: 'pointer', textAlign: 'left',
              color: 'var(--text-dim)', fontSize: '0.8125rem',
              fontWeight: 600, fontFamily: 'var(--font-sans)',
            }}
          >
            <Icon size={16} style={{ color: '#d4a017', flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{title}</span>
            {collapsed
              ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
              : <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} />}
          </button>
          {!collapsed && (
            <div style={{
              padding: '0 16px 14px',
              fontSize: '0.8125rem', color: 'var(--text-muted)',
              lineHeight: 1.6,
            }}>
              {children}
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Icon size={18} style={{ color: '#d4a017', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
