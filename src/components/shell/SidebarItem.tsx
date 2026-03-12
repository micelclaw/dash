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

import { useNavigate, useLocation } from 'react-router';
import type { ModuleConfig } from '@/types/modules';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useSecurityStore } from '@/stores/security.store';

interface SidebarItemProps {
  module: ModuleConfig;
  collapsed: boolean;
  onAction?: () => void;
  onNavigate?: () => void;
}

export function SidebarItem({ module, collapsed, onAction, onNavigate }: SidebarItemProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = module.path ? location.pathname.startsWith(module.path) : false;
  const Icon = module.icon;
  const pendingCount = useSecurityStore((s) => module.id === 'approvals' ? s.pendingCount : 0);

  function handleClick() {
    if (!module.path) {
      onAction?.();
      return;
    }
    navigate(module.path);
    onNavigate?.();
  }

  const button = (
    <button
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        height: 36,
        padding: collapsed ? '0' : '0 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        background: isActive ? 'var(--surface-hover)' : 'transparent',
        border: 'none',
        borderLeft: isActive ? '2px solid var(--amber)' : '2px solid transparent',
        cursor: 'pointer',
        borderRadius: 'var(--radius-sm)',
        transition: 'background var(--transition-fast)',
        color: 'var(--text)',
        fontSize: '0.8125rem',
        fontWeight: isActive ? 500 : 400,
        fontFamily: 'var(--font-sans)',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = 'var(--surface-hover)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'transparent';
      }}
    >
      <Icon
        size={20}
        style={{ color: module.color, flexShrink: 0, opacity: isActive ? 1 : 0.7 }}
      />
      {!collapsed && <span>{module.label}</span>}
      {!collapsed && pendingCount > 0 && (
        <span style={{ marginLeft: 'auto', fontSize: '0.625rem', minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, background: 'var(--amber)', color: '#06060a', fontWeight: 700, fontFamily: 'var(--font-sans)', padding: '0 4px' }}>
          {pendingCount > 99 ? '99+' : pendingCount}
        </span>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{module.label}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
