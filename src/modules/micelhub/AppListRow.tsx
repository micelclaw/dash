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

import type { MouseEvent } from 'react';
import { Download, Power, Scan } from 'lucide-react';
import type { InstalledApp } from '@/types/apps';
import { useAppActions } from './useAppActions';

// Plantilla de columnas COMPARTIDA por la cabecera y las filas → alineación perfecta.
// app | descripción | nivel | origen | tier | acciones. (Sin columna de Estado: en
// Instaladas todas están instaladas y en Disponibles todas disponibles → sería redundante.)
export const LIST_GRID = 'minmax(150px,1.5fr) minmax(130px,2fr) 48px 92px 48px minmax(112px,max-content)';

const LEVEL_COLOR: Record<string, string> = { '1': 'var(--text-dim)', '2': '#3b82f6', '3': '#a855f7' };
const ORIGIN_COLOR: Record<string, string> = {
  Micelclaw: '#06b6d4', OpenClaw: '#9f1239', Tuya: '#f59e0b', Community: '#64748b',
};

interface AppListRowProps {
  app: InstalledApp;
  origin?: string;
  selected?: boolean;
  onClick: () => void;
  onRefresh: () => void;
}

export function AppListHeader() {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: LIST_GRID, gap: 10, alignItems: 'center',
      padding: '6px 14px', fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.04em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)',
      position: 'sticky', top: 0, background: 'var(--bg, var(--card))', zIndex: 1,
    }}>
      <span>App</span>
      <span>Descripción</span>
      <span>Nivel</span>
      <span>Origen</span>
      <span>Tier</span>
      <span>Acciones</span>
    </div>
  );
}

export function AppListRow({ app, origin, selected, onClick, onRefresh }: AppListRowProps) {
  const manifest = app.manifest;
  const { handleScan, handleExport, handleToggleStatus } = useAppActions(app, onRefresh);

  const dotColor = app.status === 'error' ? '#ef4444'
    : app.status === 'disabled' ? 'var(--text-muted)'
    : manifest?.tags?.includes('unsupported') ? '#ef4444'
    : manifest?.tags?.includes('needs-setup') ? 'var(--amber)'
    : '#22c55e';

  const tier = manifest?.tier_required === 'pro' ? 'Pro'
    : manifest?.tier_required === 'plus' ? 'Plus' : 'Free';

  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid', gridTemplateColumns: LIST_GRID, gap: 10, alignItems: 'center',
        padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
        background: selected ? 'var(--surface-hover)' : 'transparent',
        transition: 'background var(--transition-fast)',
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'var(--surface)'; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* App: punto + icono + nombre */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: dotColor }} title={app.status} />
        <span style={{ fontSize: 16, flexShrink: 0 }}>{manifest?.icon || manifest?.ui?.module?.icon || '📦'}</span>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {manifest?.name || app.app_name}
        </span>
      </div>

      {/* Descripción (recortada) */}
      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {manifest?.description || '—'}
      </span>

      {/* Nivel */}
      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: LEVEL_COLOR[String(app.app_level)] ?? 'var(--text-dim)' }}>
        L{app.app_level}
      </span>

      {/* Origen */}
      <span style={{ fontSize: '0.6875rem', color: origin ? (ORIGIN_COLOR[origin] ?? 'var(--text-dim)') : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {origin ?? '—'}
      </span>

      {/* Tier */}
      <span style={{ fontSize: '0.6875rem', color: tier === 'Free' ? '#22c55e' : tier === 'Pro' ? 'var(--amber)' : '#3b82f6' }}>
        {tier}
      </span>

      {/* Acciones — para toda app (L1/L2/L3) */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
        <IconBtn icon={<Scan size={13} />} title="Scan" onClick={handleScan} />
        <IconBtn icon={<Download size={13} />} title="Export" onClick={handleExport} />
        <IconBtn
          icon={<Power size={13} />}
          title={app.status === 'active' ? 'Desinstalar' : 'Instalar'}
          warn={app.status === 'active'}
          onClick={handleToggleStatus}
        />
      </div>
    </div>
  );
}

function IconBtn({ icon, title, warn, onClick }: {
  icon: React.ReactNode; title: string; warn?: boolean; onClick: (e: MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 24,
        background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        color: warn ? 'var(--warning)' : 'var(--text-dim)', cursor: 'pointer',
        transition: 'color var(--transition-fast), border-color var(--transition-fast)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = warn ? 'var(--error)' : 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = warn ? 'var(--warning)' : 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      {icon}
    </button>
  );
}
