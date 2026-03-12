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

import { Shield, ShieldAlert, Download, Power, Scan } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { scanApp, exportApp, updateAppStatus } from '@/services/apps.service';
import { useAppsStore } from '@/stores/apps.store';
import type { InstalledApp } from '@/types/apps';

interface AppCardProps {
  app: InstalledApp;
  selected?: boolean;
  onClick: () => void;
  onRefresh: () => void;
}

const LEVEL_STYLES: Record<string, { border: string; color: string }> = {
  '1': { border: 'var(--text-dim)', color: 'var(--text-dim)' },
  '2': { border: '#3b82f6', color: '#3b82f6' },
  '3': { border: '#a855f7', color: '#a855f7' },
};

export function AppCard({ app, selected, onClick, onRefresh }: AppCardProps) {
  const setRestartRequired = useAppsStore((s) => s.setRestartRequired);
  const manifest = app.manifest;
  const levelStyle = LEVEL_STYLES[String(app.appLevel)] ?? LEVEL_STYLES['1'];

  const handleScan = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const result = await scanApp(app.appName);
      if (result.passed) {
        toast.success(`Scan passed — ${result.warnings.length} warning(s)`);
      } else {
        toast.error(`Scan failed — ${result.errors.length} error(s)`);
      }
    } catch {
      toast.error('Scan failed');
    }
  };

  const handleExport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const blob = await exportApp(app.appName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${app.appName}-${app.version}.claw`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  const handleToggleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = app.status === 'active' ? 'disabled' : 'active';
    try {
      await updateAppStatus(app.appName, newStatus);
      if (app.appLevel === 1) {
        setRestartRequired('openclaw', `${app.appName} was ${newStatus}`);
      } else {
        setRestartRequired('core', `${app.appName} was ${newStatus}`);
      }
      onRefresh();
      toast.success(`App ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

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
      {/* Top row: icon + name + badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>
          {manifest?.ui?.module?.icon || '📦'}
        </span>
        <span style={{
          fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)',
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {manifest?.name || app.appName}
        </span>

        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0"
          style={{ borderColor: levelStyle.border, color: levelStyle.color }}
        >
          L{app.appLevel}
        </Badge>

        {manifest?.tier_required === 'pro' && (
          <Badge className="text-[10px] px-1.5 py-0">Pro</Badge>
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
        <span>·</span>
        {app.source === 'adapted' ? (
          <span style={{ color: '#14b8a6', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Shield size={10} /> Adapted
          </span>
        ) : app.source === 'clawhub' ? (
          <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Shield size={10} /> Verified
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ShieldAlert size={10} /> Community
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex', gap: 4, borderTop: '1px solid var(--border)',
        paddingTop: 8, marginTop: 2,
      }}>
        <ActionButton icon={<Scan size={12} />} label="Scan" onClick={handleScan} />
        <ActionButton icon={<Download size={12} />} label="Export" onClick={handleExport} />
        <div style={{ flex: 1 }} />
        <ActionButton
          icon={<Power size={12} />}
          label={app.status === 'active' ? 'Disable' : 'Enable'}
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
