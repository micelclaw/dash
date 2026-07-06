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
// Un enlace de FICHERO muestra una tarjeta de descarga; un enlace de CARPETA
// muestra un NAVEGADOR (breadcrumb + entrar en subcarpetas + descargar item / ZIP).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Download, Lock, Clock, AlertTriangle, Upload, CheckCircle2, FolderArchive, ChevronRight, ArrowLeft } from 'lucide-react';
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

interface ListEntry { name: string; is_directory: boolean; size: number | null; mime_type: string | null; path: string; }

type PageState = 'loading' | 'ready' | 'not_found' | 'gone';

function formatSize(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

async function saveBlob(res: Response, fallbackName: string) {
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fallbackName;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
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
      } catch { setState('not_found'); }
    })();
  }, [token]);

  const pwQs = useCallback((extra?: Record<string, string>) => {
    const p = new URLSearchParams(extra);
    if (info?.has_password && password) p.set('password', password);
    const s = p.toString();
    return s ? `?${s}` : '';
  }, [info, password]);

  const handleDownload = useCallback(async () => {
    if (!token || !info) return;
    setDownloading(true); setPasswordError(false);
    try {
      const res = await fetch(`/api/v1/share/${token}/content${pwQs()}`);
      if (res.status === 401) { setPasswordError(true); return; }
      if (res.status === 410) { setState('gone'); return; }
      if (!res.ok) { setPasswordError(info.has_password); return; }
      await saveBlob(res, info.filename);
      setDone(true);
    } finally { setDownloading(false); }
  }, [token, info, pwQs]);

  const card: React.CSSProperties = {
    width: info?.is_directory && info?.can_download ? 'min(760px, 94vw)' : 'min(420px, 92vw)',
    background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
    padding: info?.is_directory && info?.can_download ? '24px' : '32px 28px',
    display: 'flex', flexDirection: 'column', gap: 16,
    alignItems: info?.is_directory && info?.can_download ? 'stretch' : 'center',
    textAlign: info?.is_directory && info?.can_download ? 'left' : 'center',
  };

  const isFolderBrowse = state === 'ready' && info && info.is_directory && info.can_download;

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20,
      background: 'var(--bg)', color: 'var(--text)', padding: 16,
    }}>
      <div style={card}>
        {state === 'loading' && <span style={{ color: 'var(--text-dim)' }}>Cargando…</span>}

        {state === 'not_found' && (
          <>
            <AlertTriangle size={40} style={{ color: 'var(--warning)' }} />
            <h2 style={{ margin: 0 }}>Enlace no encontrado</h2>
            <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13 }}>Este enlace no existe o ha sido revocado.</p>
          </>
        )}
        {state === 'gone' && (
          <>
            <Clock size={40} style={{ color: 'var(--warning)' }} />
            <h2 style={{ margin: 0 }}>Enlace caducado</h2>
            <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13 }}>Este enlace ha caducado o alcanzó su límite de descargas.</p>
          </>
        )}

        {isFolderBrowse && (
          <FolderBrowser token={token!} info={info!} password={password} setPassword={setPassword} pwQs={pwQs} onGone={() => setState('gone')} />
        )}

        {state === 'ready' && info && !isFolderBrowse && (
          <>
            <FileIcon mime={info.mime_type ?? ''} isDirectory={info.is_directory} size="lg" />
            <div>
              <h2 style={{ margin: 0, wordBreak: 'break-all', fontSize: '1.1rem' }}>{info.filename}</h2>
              <p style={{ margin: '4px 0 0', color: 'var(--text-dim)', fontSize: 13 }}>
                {formatSize(info.size)}
                {info.expires_at && (<> · caduca {new Date(info.expires_at).toLocaleString()}</>)}
                {info.max_downloads != null && (<> · {info.download_count}/{info.max_downloads} descargas</>)}
              </p>
            </div>

            {info.is_uploadable && !info.can_download ? (
              <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Upload size={14} /> Este enlace es un buzón de subida.
              </p>
            ) : (
              <>
                {info.has_password && (
                  <PasswordInput value={password} error={passwordError} onChange={(v) => { setPassword(v); setPasswordError(false); }} onEnter={() => void handleDownload()} />
                )}
                <button
                  onClick={() => void handleDownload()}
                  disabled={downloading || (info.has_password && !password)}
                  style={primaryBtn(downloading || (info.has_password && !password), downloading)}
                >
                  {done ? <CheckCircle2 size={16} /> : <Download size={16} />}
                  {downloading ? 'Descargando…' : done ? 'Descargado' : 'Descargar'}
                </button>
              </>
            )}
          </>
        )}
      </div>

      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
        Con la tecnología de <strong style={{ color: 'var(--amber)' }}>Micelclaw OS</strong>
      </span>
    </div>
  );
}

// ─── Navegador de carpeta pública ───────────────────────────────────────────
function FolderBrowser({ token, info, password, setPassword, pwQs, onGone }: {
  token: string; info: ShareInfo; password: string; setPassword: (v: string) => void;
  pwQs: (extra?: Record<string, string>) => string; onGone: () => void;
}) {
  const [path, setPath] = useState('');
  const [entries, setEntries] = useState<ListEntry[]>([]);
  const [folderName, setFolderName] = useState(info.filename);
  const [truncated, setTruncated] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ok' | 'pwd' | 'error'>('loading');
  const [pwError, setPwError] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (p: string) => {
    setStatus((s) => (s === 'ok' ? 'ok' : 'loading'));
    try {
      const res = await fetch(`/api/v1/share/${token}/list${pwQs({ path: p })}`);
      if (res.status === 401) { setStatus('pwd'); setPwError(!!password); return; }
      if (res.status === 410) { onGone(); return; }
      if (!res.ok) { setStatus('error'); return; }
      const json = await res.json();
      setEntries(json.data.items as ListEntry[]);
      setFolderName(json.data.folder_name as string);
      setTruncated(!!json.data.truncated);
      setPath(p); setStatus('ok'); setPwError(false);
    } catch { setStatus('error'); }
  }, [token, pwQs, password, onGone]);

  // Carga inicial UNA sola vez. NO re-ejecutar cuando cambia `password` (antes `load`
  // dependía de `password` y este efecto reaccionaba a cada tecla → validaba en cada
  // pulsación). La validación de la contraseña ocurre SOLO al pulsar "Acceder"/Enter.
  const inited = useRef(false);
  useEffect(() => { if (inited.current) return; inited.current = true; void load(''); }, [load]);

  const downloadFile = async (entry: ListEntry) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/share/${token}/content${pwQs({ path: entry.path })}`);
      if (res.status === 410) { onGone(); return; }
      if (!res.ok) return;
      await saveBlob(res, entry.name);
    } finally { setBusy(false); }
  };

  const zipUrl = `/api/v1/share/${token}/zip${pwQs({ path })}`;
  const segments = path ? path.split('/') : [];

  if (status === 'pwd') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <FileIcon mime="" isDirectory size="lg" />
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{info.filename}</h2>
        <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13 }}>Esta carpeta está protegida con contraseña.</p>
        <PasswordInput value={password} error={pwError} onChange={(v) => { setPassword(v); setPwError(false); }} onEnter={() => void load(path)} />
        <button onClick={() => void load(path)} disabled={!password} style={primaryBtn(!password, false)}>Acceder</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <FileIcon mime="" isDirectory size="md" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', wordBreak: 'break-all' }}>{info.filename}</h2>
          <p style={{ margin: '2px 0 0', color: 'var(--text-dim)', fontSize: 12 }}>
            Carpeta compartida
            {info.expires_at && (<> · caduca {new Date(info.expires_at).toLocaleDateString()}</>)}
          </p>
        </div>
        <a href={zipUrl} style={{ ...primaryBtn(false, false), textDecoration: 'none', whiteSpace: 'nowrap' }}>
          <FolderArchive size={16} /> Descargar todo (ZIP)
        </a>
      </div>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', fontSize: 13 }}>
        {path && (
          <button onClick={() => void load(segments.slice(0, -1).join('/'))}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0, marginRight: 4 }}>
            <ArrowLeft size={14} /> Atrás
          </button>
        )}
        <button onClick={() => void load('')} style={crumbBtn(!path)}>{folderName}</button>
        {segments.map((seg, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
            <button onClick={() => void load(segments.slice(0, i + 1).join('/'))} style={crumbBtn(i === segments.length - 1)}>{seg}</button>
          </span>
        ))}
      </div>

      {/* Lista */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', maxHeight: '52vh', overflowY: 'auto' }}>
        {status === 'loading' && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>Cargando…</div>}
        {status === 'error' && <div style={{ padding: 24, textAlign: 'center', color: 'var(--error)', fontSize: 13 }}>No se pudo cargar el contenido.</div>}
        {status === 'ok' && entries.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>Carpeta vacía.</div>}
        {status === 'ok' && entries.map((e) => (
          <div key={e.path}
            onClick={() => (e.is_directory ? void load(e.path) : void downloadFile(e))}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
              borderBottom: '1px solid var(--border)', cursor: busy ? 'wait' : 'pointer',
            }}
            onMouseEnter={(ev) => (ev.currentTarget.style.background = 'var(--surface-hover, var(--surface))')}
            onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}
          >
            <FileIcon mime={e.mime_type ?? ''} isDirectory={e.is_directory} size="sm" />
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, wordBreak: 'break-all' }}>{e.name}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
              {e.is_directory ? '' : formatSize(e.size)}
            </span>
            {!e.is_directory && <Download size={14} style={{ color: 'var(--text-dim)' }} />}
          </div>
        ))}
      </div>
      {truncated && <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12 }}>Mostrando los primeros 100 elementos. Descarga el ZIP para el contenido completo.</p>}
    </div>
  );
}

function PasswordInput({ value, error, onChange, onEnter }: { value: string; error: boolean; onChange: (v: string) => void; onEnter: () => void }) {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ position: 'relative', width: '100%' }}>
        <Lock size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
        <input
          type="password" value={value} placeholder="Contraseña"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onEnter(); }}
          style={{
            width: '100%', padding: '8px 10px 8px 32px', boxSizing: 'border-box',
            background: 'var(--surface)', color: 'var(--text)',
            border: `1px solid ${error ? 'var(--error)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)', fontSize: 13, outline: 'none',
          }}
        />
      </div>
      {error && <span style={{ color: 'var(--error)', fontSize: 12 }}>Contraseña incorrecta</span>}
    </div>
  );
}

function primaryBtn(disabled: boolean, busy: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
    background: 'var(--amber)', color: '#06060a', border: 'none',
    borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 14,
    cursor: busy ? 'wait' : disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
  };
}
function crumbBtn(active: boolean): React.CSSProperties {
  return {
    background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: 13,
    color: active ? 'var(--text)' : 'var(--text-dim)', fontWeight: active ? 600 : 400,
  };
}
