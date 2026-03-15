/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  accentColor?: string;
}

export function MetricCard({ icon: Icon, label, value, subtitle, accentColor = 'var(--mod-gateway)' }: MetricCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--card)',
        border: `1px solid ${hovered ? 'var(--border-hover)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        transition: 'var(--transition-fast)',
        borderLeft: `3px solid ${accentColor}`,
        cursor: 'default',
      }}
    >
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 'var(--radius-sm)',
        background: `${accentColor}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={18} style={{ color: accentColor }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.6875rem',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 4,
          fontFamily: 'var(--font-sans)',
        }}>
          {label}
        </div>
        <div style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--text)',
          lineHeight: 1.2,
          fontFamily: 'var(--font-sans)',
        }}>
          {value}
        </div>
        {subtitle && (
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--text-dim)',
            marginTop: 2,
            fontFamily: 'var(--font-sans)',
          }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
