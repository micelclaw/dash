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

import { useState, useEffect, useCallback } from 'react';
import { Download, Trash2, RefreshCw, Link2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface MediaDownload {
  id: string;
  url: string;
  title: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress?: number;
  size_bytes?: number;
  format?: string;
  created_at: string;
}

interface UrlInfo {
  title: string;
  duration?: number;
  thumbnail?: string;
  formats: Array<{ id: string; label: string; size?: number }>;
}

export function MediaDownloads() {
  const [downloads, setDownloads] = useState<MediaDownload[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [urlInfo, setUrlInfo] = useState<UrlInfo | null>(null);
  const [fetching, setFetching] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: MediaDownload[] }>('/media/downloads');
      setDownloads(res.data ?? []);
    } catch {
      // endpoint may not exist
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const fetchInfo = async () => {
    if (!url.trim()) return;
    setFetching(true);
    setUrlInfo(null);
    try {
      const res = await api.post<{ data: UrlInfo }>('/media/url-info', { url: url.trim() });
      setUrlInfo(res.data);
    } catch {
      toast.error('Failed to fetch URL info');
    }
    setFetching(false);
  };

  const startDownload = async (format?: string) => {
    try {
      await api.post('/media/downloads', { url: url.trim(), format });
      toast.success('Download started');
      setUrl('');
      setUrlInfo(null);
      load();
    } catch {
      toast.error('Failed to start download');
    }
  };

  const deleteDownload = async (id: string) => {
    try {
      await api.delete(`/media/downloads/${id}`);
      setDownloads(prev => prev.filter(d => d.id !== id));
      toast.success('Download removed');
    } catch {
      toast.error('Failed to remove download');
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Download size={18} style={{ color: 'var(--amber)' }} />
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Media Downloads</h2>
        <div style={{ flex: 1 }} />
        <button onClick={load} disabled={loading} style={{ display: 'flex', padding: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-dim)' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* URL input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <Link2 size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchInfo()}
            placeholder="Paste media URL..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)' }}
          />
        </div>
        <button
          onClick={fetchInfo}
          disabled={fetching || !url.trim()}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px',
            background: 'var(--amber)', color: '#06060a', border: 'none',
            borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', fontWeight: 600,
            cursor: !url.trim() ? 'not-allowed' : 'pointer', opacity: !url.trim() ? 0.5 : 1,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Search size={14} /> {fetching ? 'Fetching...' : 'Fetch Info'}
        </button>
      </div>

      {/* URL info preview */}
      {urlInfo && (
        <div style={{ marginBottom: 16, padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 12 }}>
          {urlInfo.thumbnail && (
            <img src={urlInfo.thumbnail} alt="" style={{ width: 120, height: 68, objectFit: 'cover', borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{urlInfo.title}</div>
            {urlInfo.duration && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                {Math.floor(urlInfo.duration / 60)}:{String(urlInfo.duration % 60).padStart(2, '0')}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => startDownload()}
                style={{
                  padding: '4px 10px', background: 'var(--amber)', color: '#06060a',
                  border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem',
                  fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                Download Best
              </button>
              {urlInfo.formats.slice(0, 4).map(fmt => (
                <button
                  key={fmt.id}
                  onClick={() => startDownload(fmt.id)}
                  style={{
                    padding: '4px 10px', background: 'var(--surface-hover)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                    fontSize: '0.6875rem', cursor: 'pointer', color: 'var(--text-dim)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Downloads list */}
      {downloads.length === 0 && !loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          <Download size={32} style={{ opacity: 0.3, margin: '0 auto 8px', display: 'block' }} />
          No downloads yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {downloads.map(dl => (
            <div key={dl.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', fontSize: '0.8125rem',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dl.title}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                  <span style={{
                    padding: '1px 6px', borderRadius: 'var(--radius-sm)',
                    background: dl.status === 'completed' ? 'rgba(34,197,94,0.15)' :
                      dl.status === 'failed' ? 'rgba(239,68,68,0.15)' :
                        dl.status === 'downloading' ? 'rgba(59,130,246,0.15)' : 'var(--surface-hover)',
                    color: dl.status === 'completed' ? '#22c55e' :
                      dl.status === 'failed' ? '#ef4444' :
                        dl.status === 'downloading' ? '#3b82f6' : 'var(--text-dim)',
                    fontWeight: 600,
                  }}>
                    {dl.status}
                  </span>
                  {dl.progress != null && dl.status === 'downloading' && <span>{dl.progress}%</span>}
                  {dl.format && <span>{dl.format}</span>}
                </div>
              </div>
              <button
                onClick={() => deleteDownload(dl.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
