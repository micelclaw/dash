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

import { useState, type ReactNode } from 'react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface MailSidebarItemProps {
  icon: ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  collapsed?: boolean;
  onClick: () => void;
  colorDot?: string;
}

export function MailSidebarItem({
  icon,
  label,
  count,
  active = false,
  collapsed = false,
  onClick,
  colorDot,
}: MailSidebarItemProps) {
  const [hovered, setHovered] = useState(false);

  const button = (
    <button
      onClick={onClick}
      onMouseEnter={(e) => {
        setHovered(true);
        if (!active) e.currentTarget.style.background = 'var(--surface-hover)';
      }}
      onMouseLeave={(e) => {
        setHovered(false);
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        height: 32,
        padding: collapsed ? '4px 0' : '4px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        background: active || hovered ? 'var(--surface-hover)' : 'transparent',
        border: 'none',
        borderLeft: active ? '2px solid var(--amber)' : '2px solid transparent',
        cursor: 'pointer',
        borderRadius: 'var(--radius-sm)',
        transition: 'background var(--transition-fast)',
        color: 'var(--text)',
        fontSize: '0.8125rem',
        fontWeight: active ? 500 : 400,
        fontFamily: 'var(--font-sans)',
      }}
    >
      {colorDot && (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 'var(--radius-full)',
            background: colorDot,
            flexShrink: 0,
          }}
        />
      )}
      {!colorDot && (
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {icon}
        </span>
      )}
      {!collapsed && (
        <>
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'left',
            }}
          >
            {label}
          </span>
          {count != null && count > 0 && (
            <span
              style={{
                fontSize: '0.625rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                background: 'var(--amber)',
                color: '#06060a',
                borderRadius: 'var(--radius-full)',
                padding: '1px 6px',
                lineHeight: 1.4,
                flexShrink: 0,
              }}
            >
              {count}
            </span>
          )}
        </>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">
          {label}
          {count != null && count > 0 ? ` (${count})` : ''}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
