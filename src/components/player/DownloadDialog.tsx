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
import { X, Download, Loader2 } from 'lucide-react';
import { usePlayerStore } from '@/stores/player.store';

interface DownloadDialogProps {
  onClose: () => void;
}

export function DownloadDialog({ onClose }: DownloadDialogProps) {
  const startDownload = usePlayerStore((s) => s.startDownload);
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<string>('best');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      await startDownload(url.trim(), format);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 20,
          width: '100%',
          maxWidth: 440,
          margin: '0 1rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Download Media</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
          URL (YouTube, etc.)
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: '0.85rem',
            outline: 'none',
            boxSizing: 'border-box',
          }}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />

        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginTop: 12, marginBottom: 4 }}>
          Format
        </label>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: '0.85rem',
          }}
        >
          <option value="best">Best quality (video + audio)</option>
          <option value="audio">Audio only (MP3)</option>
          <option value="video-720">Video 720p</option>
          <option value="video-1080">Video 1080p</option>
        </select>

        <button
          onClick={handleSubmit}
          disabled={!url.trim() || loading}
          style={{
            marginTop: 16,
            width: '100%',
            padding: '8px 16px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius)',
            cursor: url.trim() && !loading ? 'pointer' : 'not-allowed',
            opacity: url.trim() && !loading ? 1 : 0.5,
            fontSize: '0.85rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {loading ? 'Starting...' : 'Download'}
        </button>
      </div>
    </div>
  );
}
