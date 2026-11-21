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

import { useEffect } from 'react';
import { Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { usePlayerStore, type MediaDownload } from '@/stores/player.store';
import { useI18n } from '@/i18n';

function StatusIcon({ status }: { status: string }) {
  if (status === 'done') return <CheckCircle2 size={14} style={{ color: 'var(--green)' }} />;
  if (status === 'error') return <AlertCircle size={14} style={{ color: 'var(--red)' }} />;
  if (status === 'downloading' || status === 'processing') return <Loader2 size={14} style={{ color: 'var(--accent)' }} />;
  return <Download size={14} style={{ color: 'var(--text-muted)' }} />;
}

function DownloadItem({ item }: { item: MediaDownload }) {
  const { t } = useI18n();
  const isActive = item.status === 'downloading' || item.status === 'processing';
  const statusLabel = item.status === 'done' || item.status === 'error' || item.status === 'downloading' || item.status === 'processing' || item.status === 'queued'
    ? t(`player.status.${item.status}`)
    : item.status;
  return (
    <div role="listitem" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
      <StatusIcon status={item.status} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title || item.url}
        </div>
        {isActive && (
          <div role="progressbar" aria-label={t('player.downloadProgress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(item.progress * 100)} style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginTop: 3 }}>
            <div style={{ width: `${item.progress * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
        )}
        {item.error && (
          <div style={{ fontSize: '0.7rem', color: 'var(--red)', marginTop: 2 }}>{item.error}</div>
        )}
      </div>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>
        {item.status === 'downloading' ? `${Math.round(item.progress * 100)}%` : statusLabel}
      </span>
    </div>
  );
}

export function DownloadQueue() {
  const { t } = useI18n();
  const downloads = usePlayerStore((s) => s.downloads);
  const fetchDownloads = usePlayerStore((s) => s.fetchDownloads);

  useEffect(() => {
    fetchDownloads();
  }, [fetchDownloads]);

  if (downloads.length === 0) return null;

  return (
    <div style={{ padding: '8px 12px' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
        {t('player.downloads')}
      </div>
      <div role="list" aria-label={t('player.downloads')}>
        {downloads.slice(0, 5).map((d) => (
          <DownloadItem key={d.id} item={d} />
        ))}
      </div>
    </div>
  );
}
