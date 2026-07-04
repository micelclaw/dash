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
import { Cpu, ChevronRight, Trash2, Loader2 } from 'lucide-react';
import { getProviderIcon } from '@/config/provider-icons';
import { PROVIDER_COLORS } from './constants';
import type { ProviderEntry } from './types';

export function ProviderCard({ entry, subtitle, onClick, onDelete, deleting }: {
  entry: ProviderEntry;
  subtitle?: string;
  onClick: () => void;
  onDelete?: (e: React.MouseEvent) => void;
  deleting?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const ProviderIcon = getProviderIcon(entry.provider);
  return (
    // Card clicable como <div role="button">, NO <button>: contiene un <button> de
    // borrar (onDelete, providers custom) y un <button> dentro de otro <button> es
    // HTML inválido → React validateDOMNesting / hydration error. onKeyDown replica
    // la activación por teclado; el delete ya hace e.stopPropagation (ModelsTab).
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: '16px 14px',
        background: hovered ? 'var(--surface-hover)' : 'var(--card)',
        border: `1px solid ${entry.hasAuth ? entry.color + '30' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'var(--transition-fast)',
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
        minHeight: 90,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 'var(--radius-sm)',
          background: `${entry.color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {ProviderIcon
            ? <ProviderIcon size={24} style={{ color: entry.color }} />
            : <Cpu size={14} style={{ color: entry.color }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
            {entry.label}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 1 }}>
            {subtitle ?? `${entry.modelCount} model${entry.modelCount !== 1 ? 's' : ''}${entry.configuredCount > 0 ? ` · ${entry.configuredCount} configured` : ''}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {entry.hasAuth ? (
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0,
            }} />
          ) : (
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: 'var(--text-muted)', opacity: 0.5, flexShrink: 0,
            }} />
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={deleting}
              style={{
                background: 'transparent', border: 'none', cursor: deleting ? 'wait' : 'pointer',
                color: 'var(--text-muted)', padding: 2, display: 'flex', opacity: deleting ? 0.5 : 1,
              }}
              title="Remove provider"
            >
              {deleting ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
            </button>
          )}
          <ChevronRight size={14} style={{ color: 'var(--text-dim)', opacity: 0.5 }} />
        </div>
      </div>
    </div>
  );
}

export function AddProviderTypeCard({ label, description, onClick, provider }: {
  label: string;
  description: string;
  onClick: () => void;
  provider: string;
}) {
  const [hovered, setHovered] = useState(false);
  const ProviderIcon = getProviderIcon(provider);
  const color = PROVIDER_COLORS[provider?.toLowerCase()] ?? 'var(--text-dim)';
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: '16px 14px',
        background: hovered ? 'var(--surface-hover)' : 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'var(--transition-fast)',
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
        minHeight: 90,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 'var(--radius-sm)',
          background: ProviderIcon ? `${color}15` : 'var(--surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {ProviderIcon
            ? <ProviderIcon size={24} style={{ color }} />
            : <Cpu size={14} style={{ color: 'var(--text-dim)' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
            {label}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 1, lineHeight: 1.3 }}>
            {description}
          </div>
        </div>
        <ChevronRight size={14} style={{ color: 'var(--text-dim)', opacity: 0.5 }} />
      </div>
    </button>
  );
}
