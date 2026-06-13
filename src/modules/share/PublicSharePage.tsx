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

// ─── Landing PÚBLICA de share links ─────────────────────────────────────────
// Página sin login para /share/:token. Usa fetch directo (NO services/api.ts,
// excepción deliberada: es pública sin token de sesión y el 401 de contraseña
// incorrecta NO debe disparar el auto-refresh/redirect del cliente autenticado).

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Download, Lock, Clock, AlertTriangle, Upload, CheckCircle2 } from 'lucide-react';
import { FileIcon } from '@/components/shared/FileIcon';

interface ShareInfo {
  filename: string;
  size: number | null;
  mime_type: string | null;
  is_directory: boolean;
  has_password: boolean;
  permissions: string[];
  is_uploadable: boolean;
  can_download: boolean;
  expires_at: string | null;
  download_count: number;
  max_downloads: number | null;
}

type PageState = 'loading' | 'ready' | 'not_found' | 'gone';

function formatSize(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function Component() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>('loading');
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const res = await fetch(`/api/v1/share/${token}/info`);
        if (res.status === 404) { setState('not_found'); return; }
        if (res.status === 410) { setState('gone'); return; }
        if (!res.ok) { setState('not_found'); return; }
        const json = await res.json();
        setInfo(json.data as ShareInfo);
        setState('ready');
      } catch {
        setState('not_found');
      }
    })();
  }, [token]);

  const handleDownload = useCallback(async () => {
    if (!token || !info) return;
    setDownloading(true);
    setPasswordError(false);
    try {
      const qs = info.has_password ? `?password=${encodeURIComponent(password)}` : '';
      const res = await fetch(`/api/v1/share/${token}/content${qs}`);
      if (res.status === 401) { setPasswordError(true); return; }
      if (res.status === 410) { setState('gone'); return; }
      if (!res.ok) { setPasswordError(info.has_password); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = info.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDone(true);
    } finally {
      setDownloading(false);
    }
  }, [token, info, password]);

  const card: React.CSSProperties = {
    width: 'min(420px, 92vw)',
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '32px 28px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    textAlign: 'center',
  };

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20,
      background: 'var(--bg)', color: 'var(--text)', padding: 16,
    }}>
      <div style={card}>
        {state === 'loading' && <span style={{ color: 'var(--text-dim)' }}>Loading…</span>}

        {state === 'not_found' && (
          <>
            <AlertTriangle size={40} style={{ color: 'var(--warning)' }} />
            <h2 style={{ margin: 0 }}>Link not found</h2>
            <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13 }}>
              This share link does not exist or has been revoked.
            </p>
          </>
        )}

        {state === 'gone' && (
          <>
            <Clock size={40} style={{ color: 'var(--warning)' }} />
            <h2 style={{ margin: 0 }}>Link expired</h2>
            <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13 }}>
              This link has expired or reached its download limit.
            </p>
          </>
        )}

        {state === 'ready' && info && (
          <>
            <FileIcon mime={info.mime_type ?? ''} isDirectory={info.is_directory} size="lg" />
            <div>
              <h2 style={{ margin: 0, wordBreak: 'break-all', fontSize: '1.1rem' }}>{info.filename}</h2>
              <p style={{ margin: '4px 0 0', color: 'var(--text-dim)', fontSize: 13 }}>
                {formatSize(info.size)}
                {info.expires_at && (
                  <> · expires {new Date(info.expires_at).toLocaleString()}</>
                )}
                {info.max_downloads != null && (
                  <> · {info.download_count}/{info.max_downloads} downloads</>
                )}
              </p>
            </div>

            {info.is_uploadable && !info.can_download ? (
              <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Upload size={14} /> This is an upload drop-box link.
              </p>
            ) : (
              <>
                {info.has_password && (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                      <Lock size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                      <input
                        type="password"
                        value={password}
                        placeholder="Password"
                        onChange={(e) => { setPassword(e.target.value); setPasswordError(false); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') void handleDownload(); }}
                        style={{
                          width: '100%', padding: '8px 10px 8px 32px', boxSizing: 'border-box',
                          background: 'var(--surface)', color: 'var(--text)',
                          border: `1px solid ${passwordError ? 'var(--error)' : 'var(--border)'}`,
                          borderRadius: 'var(--radius-md)', fontSize: 13, outline: 'none',
                        }}
                      />
                    </div>
                    {passwordError && (
                      <span style={{ color: 'var(--error)', fontSize: 12 }}>Incorrect password</span>
                    )}
                  </div>
                )}

                <button
                  onClick={() => void handleDownload()}
                  disabled={downloading || (info.has_password && !password)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px',
                    background: 'var(--amber)', color: '#06060a', border: 'none',
                    borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 14,
                    cursor: downloading ? 'wait' : 'pointer',
                    opacity: downloading || (info.has_password && !password) ? 0.6 : 1,
                  }}
                >
                  {done ? <CheckCircle2 size={16} /> : <Download size={16} />}
                  {downloading ? 'Downloading…' : done ? 'Downloaded' : 'Download'}
                </button>
              </>
            )}
          </>
        )}
      </div>

      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
        Powered by <strong style={{ color: 'var(--amber)' }}>Micelclaw OS</strong>
      </span>
    </div>
  );
}
