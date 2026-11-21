import { useState, type ReactNode } from 'react';
import { Play, X } from 'lucide-react';

export interface ExternalVideo { provider: 'YouTube' | 'Vimeo'; embedUrl: string; originalUrl: string }
/** A closed URL parser; unknown hosts, credentials, ports and arbitrary embeds remain ordinary links. */
export function parseExternalVideo(href: string): ExternalVideo | null {
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    let videoId: string | undefined;
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
      videoId = url.pathname === '/watch' ? url.searchParams.get('v') ?? undefined : /^\/(?:shorts|live)\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1];
    } else if (url.hostname === 'youtu.be') videoId = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1];
    if (videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)) return { provider: 'YouTube', embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`, originalUrl: url.href };
    if (['vimeo.com', 'www.vimeo.com'].includes(url.hostname)) {
      const id = /^\/(\d{1,15})\/?$/.exec(url.pathname)?.[1];
      if (id) return { provider: 'Vimeo', embedUrl: `https://player.vimeo.com/video/${id}?dnt=1`, originalUrl: url.href };
    }
    return null;
  } catch { return null; }
}
export function ExternalVideoCard({ video, children }: { video: ExternalVideo; children: ReactNode }) {
  const [consent, setConsent] = useState(false);
  return <span className="my-3 flex w-full max-w-2xl flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" data-testid="external-video-card">
    <span className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <a href={video.originalUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--amber)]">{children}</a>
      {consent && <button type="button" onClick={() => setConsent(false)} aria-label="Cerrar vídeo" className="inline-flex items-center gap-1"><X size={14} /> Cerrar</button>}
    </span>
    {consent ? <iframe title={`Vídeo de ${video.provider}`} src={video.embedUrl} loading="lazy" referrerPolicy="no-referrer"
      sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="aspect-video w-full rounded-lg border-0" />
      : <><span className="text-xs text-[var(--text-muted)]">Al cargarlo conectarás con {video.provider}. La vista previa no envía datos a este servicio.</span>
        <button type="button" onClick={() => setConsent(true)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--text)]"><Play size={16} /> Cargar vídeo de {video.provider}</button></>}
  </span>;
}
