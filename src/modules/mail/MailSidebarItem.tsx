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
  /**
   * Los NO LEÍDOS: el número de la pastilla ámbar.
   *
   * Se llama `count` por historia; lo que lleva son los no leídos (el servidor
   * manda los dos: `unread` y `total`).
   */
  count?: number;
  /**
   * El TOTAL de la carpeta, en gris y sin pastilla.
   *
   * Existe porque con un solo número no se distinguía: en Archivo los no leídos
   * eran 463 de 467 y en Spam 219 de 219, así que la pastilla parecía el total; y
   * en una carpeta con todo leído (0 no leídos) no salía NINGÚN número, así que no
   * había forma de ver que tenía seis correos dentro.
   */
  total?: number;
  active?: boolean;
  collapsed?: boolean;
  onClick: () => void;
  colorDot?: string;
}

export function MailSidebarItem({
  icon,
  label,
  count,
  total,
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
          {/* El total, en gris y sin pastilla: cuántos correos hay. Se omite si
              coincide con los no leídos, porque entonces repetir el número no
              informa de nada (y en Spam pasa: 219 de 219). */}
          {total != null && total > 0 && total !== (count ?? 0) && (
            <span
              title={`${total} en total`}
              style={{
                fontSize: '0.625rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                lineHeight: 1.4,
                flexShrink: 0,
              }}
            >
              {total}
            </span>
          )}
          {/* Y los no leídos, con la pastilla ámbar: lo que pide atención. */}
          {count != null && count > 0 && (
            <span
              title={`${count} sin leer`}
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
          {/* Plegado no se ven los números, así que el tooltip los dice — y dice
              QUÉ es cada uno, que era justo la confusión. */}
          {count != null && count > 0 ? ` · ${count} sin leer` : ''}
          {total != null && total > 0 ? ` · ${total} en total` : ''}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
