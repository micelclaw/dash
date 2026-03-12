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

import { ExternalLink, Star, Users, User, FileText } from 'lucide-react';
import { FilePreviewPanel } from '@/components/shared/FilePreviewPanel';
import { formatRelative } from '@/lib/date-helpers';
import type { FileRecord } from '@/types/files';

interface FileExplorerPreviewProps {
  file: FileRecord;
  isWritable: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export function FileExplorerPreview({ file, isWritable, onClose, onDelete }: FileExplorerPreviewProps) {
  const isGDrive = file.custom_fields?.provider_type === 'gdrive';
  const meta = file.metadata as Record<string, any> | null;

  return (
    <div style={{ flexShrink: 0 }}>
      <FilePreviewPanel
        file={file}
        onClose={onClose}
        onDelete={isWritable ? onDelete : undefined}
        showRelated={false}
      />
      {isGDrive && meta && <GDriveDetails meta={meta} createdAt={file.created_at} />}
    </div>
  );
}

function GDriveDetails({ meta, createdAt }: { meta: Record<string, any>; createdAt: string }) {
  const rows: Array<{ label: string; value: string; icon?: React.ReactNode; link?: string }> = [];

  if (meta.drive_type) {
    rows.push({ label: 'Type', value: formatDriveType(meta.drive_type), icon: <FileText size={12} /> });
  }
  if (meta.owner) {
    rows.push({ label: 'Owner', value: meta.owner, icon: <User size={12} /> });
  }
  if (meta.last_modifying_user) {
    rows.push({ label: 'Last modified by', value: meta.last_modifying_user });
  }
  if (meta.shared) {
    rows.push({ label: 'Sharing', value: 'Shared', icon: <Users size={12} /> });
  }
  if (createdAt) {
    rows.push({ label: 'Created', value: formatRelative(new Date(createdAt)) });
  }
  if (meta.description) {
    rows.push({ label: 'Description', value: meta.description });
  }
  if (meta.web_view_link) {
    rows.push({ label: 'Open in Drive', value: 'View', icon: <ExternalLink size={12} />, link: meta.web_view_link });
  }

  if (rows.length === 0) return null;

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      padding: '10px 16px',
      fontFamily: 'var(--font-sans)',
      background: 'var(--surface)',
    }}>
      <div style={{
        fontSize: '0.6875rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: 'var(--text-muted)',
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        {meta.starred && <Star size={10} style={{ color: '#f59e0b', fill: '#f59e0b' }} />}
        Google Drive Details
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map(row => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
            {row.icon && <span style={{ color: 'var(--text-muted)', display: 'flex' }}>{row.icon}</span>}
            <span style={{ color: 'var(--text-dim)', minWidth: 100 }}>{row.label}</span>
            {row.link ? (
              <a
                href={row.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--amber)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
              >
                {row.value}
              </a>
            ) : (
              <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.value}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDriveType(mimeType: string): string {
  const map: Record<string, string> = {
    'application/vnd.google-apps.document': 'Google Docs',
    'application/vnd.google-apps.spreadsheet': 'Google Sheets',
    'application/vnd.google-apps.presentation': 'Google Slides',
    'application/vnd.google-apps.form': 'Google Forms',
    'application/vnd.google-apps.drawing': 'Google Drawings',
    'application/vnd.google-apps.site': 'Google Sites',
    'application/vnd.google-apps.jam': 'Google Jamboard',
    'application/pdf': 'PDF',
  };
  return map[mimeType] ?? mimeType.split('/').pop()?.replace('vnd.google-apps.', '') ?? mimeType;
}
