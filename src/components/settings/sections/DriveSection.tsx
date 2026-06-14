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

// ─── Settings → System → Drive ──────────────────────────────────────────────
// Sección de Settings que agrupa la configuración del Drive en sub-tabs
// horizontales (el nav lateral ya lo aporta el shell de Settings). El engranaje
// del módulo Drive navega aquí (/settings/drive). Reutiliza los componentes de
// `@/modules/drive/settings/` — los mismos que el modal de versiones del inspector.

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { History, FolderTree, Users, HardDrive, ChevronRight, type LucideIcon } from 'lucide-react';
import { VersioningSection } from '@/modules/drive/settings/VersioningSection';
import { TeamFoldersSection } from '@/modules/drive/settings/TeamFoldersSection';
import { ConnectedClientsSection } from '@/modules/drive/settings/ConnectedClientsSection';

type DriveSettingsTab = 'versioning' | 'team-folders' | 'connected-clients';

const TABS: Array<{ id: DriveSettingsTab; label: string; icon: LucideIcon }> = [
  { id: 'versioning', label: 'Versioning', icon: History },
  { id: 'team-folders', label: 'Team Folders', icon: FolderTree },
  { id: 'connected-clients', label: 'Connected clients', icon: Users },
];

export function DriveSection() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<DriveSettingsTab>('versioning');

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 880,
        fontFamily: 'var(--font-sans)',
        ['--amber' as string]: 'var(--mod-drive)',
      } as React.CSSProperties}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>Drive</h2>
        <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
          Versioning, team folders and connected clients.
        </p>
      </div>

      {/* Mounted volumes link card — los mounts viven en el File Explorer */}
      <button
        onClick={() => navigate('/explorer')}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%',
          padding: '12px 14px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', cursor: 'pointer', textAlign: 'left',
          fontFamily: 'var(--font-sans)', transition: 'background var(--transition-fast)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34, borderRadius: 'var(--radius-sm)',
          background: 'color-mix(in srgb, var(--mod-drive) 15%, transparent)', flexShrink: 0,
        }}>
          <HardDrive size={17} style={{ color: 'var(--mod-drive)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>Mounted volumes</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
            Drive, Media Downloads and cloud mounts are managed in the File Explorer
          </div>
        </div>
        <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </button>

      {/* Sub-tabs horizontales */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(item => {
          const active = tab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 14px', border: 'none', cursor: 'pointer',
                background: 'transparent', fontFamily: 'var(--font-sans)',
                fontSize: '0.8125rem', fontWeight: active ? 600 : 400,
                color: active ? 'var(--mod-drive)' : 'var(--text-dim)',
                borderBottom: `2px solid ${active ? 'var(--mod-drive)' : 'transparent'}`,
                marginBottom: -1, transition: 'color var(--transition-fast)',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-dim)'; }}
            >
              <Icon size={15} />
              {item.label}
            </button>
          );
        })}
      </div>

      <div>
        {tab === 'versioning' && <VersioningSection />}
        {tab === 'team-folders' && <TeamFoldersSection />}
        {tab === 'connected-clients' && <ConnectedClientsSection />}
      </div>
    </div>
  );
}
