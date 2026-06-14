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

import type { LucideIcon } from 'lucide-react';
import { handleSpaAnchorClick } from '@/lib/nav';

interface Tab {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: number;
  /**
   * Ruta de app a la que apunta la tab (p.ej. `/gateway?tab=models`). Si se
   * provee, la tab se renderiza como <a href> real → click central / ctrl+click
   * abren nueva pestaña del navegador de forma nativa; el click izquierdo sigue
   * llamando a onChange (navegación SPA). Sin href se renderiza como <button>.
   */
  href?: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'pills';
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, variant = 'underline', className }: TabsProps) {
  const isUnderline = variant === 'underline';

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        gap: isUnderline ? 0 : 4,
        borderBottom: isUnderline ? '1px solid var(--border)' : undefined,
        padding: isUnderline ? 0 : 4,
        background: !isUnderline ? 'var(--surface)' : undefined,
        borderRadius: !isUnderline ? 'var(--radius-md)' : undefined,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const Icon = tab.icon;
        const tabStyle = {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: isUnderline ? '8px 16px' : '6px 12px',
          cursor: 'pointer',
          border: 'none',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.8125rem',
          transition: 'all var(--transition-fast)',
          textDecoration: 'none',
          ...(isUnderline
            ? {
                background: 'transparent',
                borderBottom: isActive ? '2px solid var(--amber)' : '2px solid transparent',
                color: isActive ? 'var(--text)' : 'var(--text-dim)',
                marginBottom: -1,
              }
            : {
                background: isActive ? 'var(--surface-hover)' : 'transparent',
                borderRadius: 'var(--radius-md)',
                color: isActive ? 'var(--text)' : 'var(--text-dim)',
              }),
        };
        const content = (
          <>
            {Icon && <Icon size={16} />}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--amber)',
                  color: '#06060a',
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {tab.badge}
              </span>
            )}
          </>
        );
        // Con href → <a> real (middle-click nativo); sin href → <button>.
        return tab.href ? (
          <a
            key={tab.id}
            href={tab.href}
            onClick={(e) => handleSpaAnchorClick(e, () => onChange(tab.id))}
            style={tabStyle}
          >
            {content}
          </a>
        ) : (
          <button key={tab.id} onClick={() => onChange(tab.id)} style={tabStyle}>
            {content}
          </button>
        );
      })}
    </div>
  );
}
