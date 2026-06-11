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

import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { ProUpsellPanel } from '@/components/shared/ProUpsellPanel';
import { FileVersionHistory } from '@/components/shared/FileVersionHistory';
import { api, ApiError } from '@/services/api';
import { DriveSettingsModal } from './DriveSettingsModal';
import type { FileRecord } from '@/types/files';

interface VersionsTabProps {
  file: FileRecord;
}

/**
 * Inspector → Versions: the shared FileVersionHistory (expanded) plus a gear
 * that opens the Drive snapshots settings modal. A 403 FEATURE_NOT_AVAILABLE
 * from the versions endpoint (Free tier) renders the Pro upsell instead.
 */
export function VersionsTab({ file }: VersionsTabProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [proBlocked, setProBlocked] = useState(false);

  // Probe once per file: Free tier answers 403 FEATURE_NOT_AVAILABLE.
  useEffect(() => {
    let cancelled = false;
    setProBlocked(false);
    void api.get(`/files/${file.id}/versions`)
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 403 || err.code === 'FEATURE_NOT_AVAILABLE')) {
          setProBlocked(true);
        }
      });
    return () => { cancelled = true; };
  }, [file.id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Header row with the snapshots settings gear */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          Snapshots of <strong style={{ color: 'var(--text)' }}>{file.filename}</strong>
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setSettingsOpen(true)}
          title="Drive snapshot settings"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 2, display: 'flex',
          }}
        >
          <Settings size={14} />
        </button>
      </div>

      {proBlocked ? (
        <div style={{ padding: 14 }}>
          <ProUpsellPanel
            feature="Version history"
            description="Automatic file snapshots with restore are a Pro feature. Upgrade to keep a full history of every file."
          />
        </div>
      ) : file.is_directory ? (
        <div style={{ padding: 14, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Folders don't have version history.
        </div>
      ) : (
        <FileVersionHistory fileId={file.id} filename={file.filename} defaultExpanded />
      )}

      {settingsOpen && (
        <DriveSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
