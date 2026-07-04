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

import { Download, Power, Scan, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { InstalledApp } from '@/types/apps';
import { useAppActions } from './useAppActions';

interface AppCardProps {
  app: InstalledApp;
  origin?: string;
  selected?: boolean;
  onClick: () => void;
  onRefresh: () => void;
}

const LEVEL_STYLES: Record<string, { border: string; color: string }> = {
  '1': { border: 'var(--text-dim)', color: 'var(--text-dim)' },
  '2': { border: '#3b82f6', color: '#3b82f6' },
  '3': { border: '#a855f7', color: '#a855f7' },
};

const ORIGIN_STYLES: Record<string, { bg: string; color: string }> = {
  Micelclaw: { bg: '#06b6d415', color: '#06b6d4' },
  OpenClaw: { bg: '#9f123915', color: '#9f1239' },
  Tuya: { bg: '#f59e0b15', color: '#f59e0b' },
  Community: { bg: '#64748b15', color: '#64748b' },
};

export function AppCard({ app, origin, selected, onClick, onRefresh }: AppCardProps) {
  const manifest = app.manifest;
  const levelStyle = LEVEL_STYLES[String(app.app_level)] ?? LEVEL_STYLES['1'];
  const { handleScan, handleExport, handleToggleStatus, handleDelete } = useAppActions(app, onRefresh);
  // "Borrar" (eliminar del todo: paquete + datos) solo tiene sentido para una app DISPONIBLE
  // (no activa) con backend propio (L2/L3, no las skills bundled de OpenClaw).
  const canDelete = app.status !== 'active' && app.app_level >= 2
    && app.source !== 'openclaw' && app.source !== 'micelhub' && app.source !== 'local';

  const isError = app.status === 'error';

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--card)',
        border: `1px solid ${selected ? 'var(--amber)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: 14,
        cursor: 'pointer',
        transition: 'border-color var(--transition-fast)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.borderColor = 'var(--border-hover)';
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      {/* Fila 1: punto de elegibilidad + icono + NOMBRE (ancho completo) + nivel.
          Los demás tags bajan a la fila 2 para que el nombre no se corte. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Eligibility indicator — el status real (disabled/error) manda sobre los tags. */}
        <div style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: app.status === 'error' ? '#ef4444'
            : app.status === 'disabled' ? 'var(--text-muted)'
            : manifest?.tags?.includes('unsupported') ? '#ef4444'
            : manifest?.tags?.includes('needs-setup') ? 'var(--amber)'
            : '#22c55e', // available (ready or installable)
        }} title={
          app.status === 'error' ? 'Error'
            : app.status === 'disabled' ? 'Disabled'
            : manifest?.tags?.includes('unsupported') ? 'Not supported on this OS'
            : manifest?.tags?.includes('needs-setup') ? 'Needs API key or configuration'
            : manifest?.tags?.includes('installable') ? 'Available (will install deps on assign)'
            : 'Ready to use'
        } />
        <span style={{ fontSize: 22, flexShrink: 0 }}>
          {manifest?.icon || manifest?.ui?.module?.icon || '📦'}
        </span>
        <span style={{
          fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)',
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {manifest?.name || app.app_name}
        </span>

        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0"
          style={{ borderColor: levelStyle?.border, color: levelStyle?.color, flexShrink: 0 }}
        >
          L{app.app_level}
        </Badge>
      </div>

      {/* Fila 2: tags (origin · tier · verified · error). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {origin && (
          <span style={{
            fontSize: '0.5625rem', fontWeight: 500, padding: '1px 6px',
            background: ORIGIN_STYLES[origin]?.bg ?? '#64748b15',
            color: ORIGIN_STYLES[origin]?.color ?? '#64748b',
            borderRadius: 'var(--radius-sm)',
          }}>
            {origin}
          </span>
        )}

        {/* Tier badge */}
        {manifest?.tier_required === 'pro' && (
          <span style={{ fontSize: '0.5625rem', fontWeight: 600, padding: '1px 5px', background: '#d4a01715', color: 'var(--amber)', borderRadius: 'var(--radius-sm)' }}>Pro</span>
        )}
        {manifest?.tier_required === 'plus' && (
          <span style={{ fontSize: '0.5625rem', fontWeight: 600, padding: '1px 5px', background: '#3b82f615', color: '#3b82f6', borderRadius: 'var(--radius-sm)' }}>Plus</span>
        )}
        {(!manifest?.tier_required || manifest.tier_required === 'free') && (
          <span style={{ fontSize: '0.5625rem', fontWeight: 500, padding: '1px 5px', background: '#22c55e10', color: '#22c55e', borderRadius: 'var(--radius-sm)' }}>Free</span>
        )}

        {/* Verified badge */}
        {manifest?.tags?.includes('verified') && (
          <span style={{ fontSize: '0.5625rem', fontWeight: 500, padding: '1px 5px', background: '#22c55e10', color: '#22c55e', borderRadius: 'var(--radius-sm)' }}>✓</span>
        )}

        {isError && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Error</Badge>
        )}
      </div>

      {/* Description */}
      <p style={{
        fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0,
        lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
        {manifest?.description || 'No description'}
      </p>

      {/* Meta row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: '0.6875rem', color: 'var(--text-dim)',
      }}>
        <span>v{app.version}</span>
        {manifest?.author && (
          <>
            <span>·</span>
            <span>{manifest.author}</span>
          </>
        )}
        {app.status !== 'active' && (
          <>
            <span>·</span>
            <span style={{ color: app.status === 'error' ? 'var(--error)' : 'var(--text-muted)' }}>{app.status}</span>
          </>
        )}
      </div>

      {/* Actions — para TODA app (L1/L2/L3): scan (un SKILL.md puede llevar texto malicioso),
          export .claw y enable/disable (= asignable o no) van por /apps/:name, que ahora resuelve
          también las apps L1 de disco. */}
      <div style={{
        display: 'flex', gap: 4, borderTop: '1px solid var(--border)',
        paddingTop: 8, marginTop: 2, alignItems: 'center',
      }}>
        <ActionButton icon={<Scan size={12} />} label="Scan" onClick={handleScan} />
        <ActionButton icon={<Download size={12} />} label="Export" onClick={handleExport} />
        <div style={{ flex: 1 }} />
        {canDelete && (
          <ActionButton icon={<Trash2 size={12} />} label="Borrar" onClick={handleDelete} warn />
        )}
        <ActionButton
          icon={<Power size={12} />}
          label={app.status === 'active' ? 'Desinstalar' : 'Instalar'}
          onClick={handleToggleStatus}
          warn={app.status === 'active'}
        />
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, warn }: {
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  warn?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        background: 'none', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', padding: '3px 8px',
        color: warn ? 'var(--warning)' : 'var(--text-dim)',
        fontSize: '0.6875rem', cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        transition: 'color var(--transition-fast), border-color var(--transition-fast)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = warn ? 'var(--error)' : 'var(--text)';
        e.currentTarget.style.borderColor = 'var(--border-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = warn ? 'var(--warning)' : 'var(--text-dim)';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      {icon}
      {label}
    </button>
  );
}
