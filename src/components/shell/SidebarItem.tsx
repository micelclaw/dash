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

import { Link, useLocation } from 'react-router';
import type { ModuleConfig } from '@/types/modules';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useSecurityStore } from '@/stores/security.store';
import { isPlainLeftClick } from '@/lib/nav';

interface SidebarItemProps {
  module: ModuleConfig;
  collapsed: boolean;
  onAction?: () => void;
  onNavigate?: () => void;
}

export function SidebarItem({ module, collapsed, onAction, onNavigate }: SidebarItemProps) {
  const location = useLocation();
  const isActive = module.path ? location.pathname.startsWith(module.path) : false;
  const Icon = module.icon;
  const pendingCount = useSecurityStore((s) => module.id === 'approvals' ? s.pendingCount : 0);

  // Estilo compartido entre el <Link> (items con ruta) y el <button> (acciones).
  const itemStyle = {
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
    textDecoration: 'none',
    boxSizing: 'border-box' as const,
  };
  const onMouseEnter = (e: { currentTarget: HTMLElement }) => {
    if (!isActive) e.currentTarget.style.background = 'var(--surface-hover)';
  };
  const onMouseLeave = (e: { currentTarget: HTMLElement }) => {
    if (!isActive) e.currentTarget.style.background = 'transparent';
  };

  const inner = (
    <>
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
    </>
  );

  // Item con ruta → <Link> (renderiza <a href> real): click izquierdo navega en
  // la SPA, rueda/ctrl/cmd+click abren nueva pestaña de forma nativa. Item de
  // acción (sin ruta) → <button>.
  const button = module.path ? (
    <Link
      to={module.path}
      onClick={(e) => { if (isPlainLeftClick(e)) onNavigate?.(); }}
      style={itemStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {inner}
    </Link>
  ) : (
    <button
      onClick={() => onAction?.()}
      style={itemStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {inner}
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
