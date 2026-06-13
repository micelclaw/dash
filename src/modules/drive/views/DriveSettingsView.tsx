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
import { useNavigate } from 'react-router';
import {
  History, FolderTree, Users, HardDrive, ChevronRight, type LucideIcon,
} from 'lucide-react';
import { VersioningSection } from '../settings/VersioningSection';
import { TeamFoldersSection } from '../settings/TeamFoldersSection';
import { ConnectedClientsSection } from '../settings/ConnectedClientsSection';

type SettingsSection = 'versioning' | 'team-folders' | 'connected-clients';

const NAV: Array<{ id: SettingsSection; label: string; icon: LucideIcon }> = [
  { id: 'versioning', label: 'Versioning', icon: History },
  { id: 'team-folders', label: 'Team Folders', icon: FolderTree },
  { id: 'connected-clients', label: 'Connected clients', icon: Users },
];

/**
 * Drive Settings (P5/P8/P9) — Synology DSM-style layout: an inner vertical
 * nav (Versioning / Team Folders / Connected clients) plus a content panel.
 * Mounted volumes are not duplicated here — they live in the File Explorer,
 * linked from the card at the top.
 */
export function DriveSettingsView() {
  const navigate = useNavigate();
  const [section, setSection] = useState<SettingsSection>('versioning');

  return (
    <div
      style={{
        display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden',
        fontFamily: 'var(--font-sans)',
        ['--amber' as string]: 'var(--mod-drive)',
      } as React.CSSProperties}
    >
      {/* Inner nav */}
      <div
        style={{
          width: 200, flexShrink: 0, borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', overflow: 'auto',
          padding: '16px 12px', gap: 2,
        }}
      >
        <div style={{
          fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)',
          padding: '0 8px 12px',
        }}>
          Drive settings
        </div>
        {NAV.map(item => {
          const active = section === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 10px', borderRadius: 'var(--radius-md)',
                border: 'none', textAlign: 'left', cursor: 'pointer',
                fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
                fontWeight: active ? 600 : 400,
                background: active ? 'color-mix(in srgb, var(--mod-drive) 14%, transparent)' : 'transparent',
                color: active ? 'var(--mod-drive)' : 'var(--text-dim)',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon size={15} />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: 24 }}>
        {/* Mounted volumes link card */}
        <button
          onClick={() => navigate('/explorer')}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 720,
            padding: '12px 14px', marginBottom: 24,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', cursor: 'pointer', textAlign: 'left',
            fontFamily: 'var(--font-sans)',
            transition: 'background var(--transition-fast)',
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
            <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>
              Mounted volumes
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
              Drive, Media Downloads and cloud mounts are managed in the File Explorer
            </div>
          </div>
          <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </button>

        {section === 'versioning' && <VersioningSection />}
        {section === 'team-folders' && <TeamFoldersSection />}
        {section === 'connected-clients' && <ConnectedClientsSection />}
      </div>
    </div>
  );
}
