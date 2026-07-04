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

// ─── App Module Host (iframe genérico) ───────────────────────────────
// Renderiza el módulo de una app L3 dinámica (servida por Core) como iframe a
// viewport completo. El iframe carga la UI same-origin de Core (/api/v1/app-ui/
// <app_name>/) → la cookie `claw_session` autentica (igual que el proxy de
// Mathesar). Ruta catch-all /app/:appName; el módulo viene del ui-modules store
// (ya filtrado por instalada+activa+cargada+concedida).

import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { PackageOpen, Loader2 } from 'lucide-react';
import { useEmbedFullscreen } from '@/hooks/use-embed-fullscreen';
import { EmbedActions } from '@/components/shared/EmbedActions';
import { useUiModulesStore } from '@/stores/ui-modules.store';
import { useServiceUrlsStore } from '@/stores/service-urls.store';
import { useAuthStore } from '@/stores/auth.store';

export function Component() {
  const { appName } = useParams<{ appName: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { fullscreen, toggle, rootStyle } = useEmbedFullscreen();

  const modules = useUiModulesStore((s) => s.modules);
  const loaded = useUiModulesStore((s) => s.loaded);
  const mod = modules.find((m) => m.app_name === appName);

  // A2: authenticate the embed with a `?token=` param (accepted by the auth
  // plugin), captured ONCE at mount so a later silent token refresh doesn't
  // reload the iframe. Without this, an expired `claw_session` cookie makes
  // the embed render a raw 401 JSON body instead of the app.
  const [embedToken] = useState<string | null>(() => useAuthStore.getState().tokens?.accessToken ?? null);

  // Reenvía la query string de ESTA ruta (p.ej. `?workflow=<id>` de una chip de
  // entidad de app) al iframe — la UI embebida (launcher de n8n, etc.) la lee de
  // su propia `window.location.search` para deep-linkear a un registro concreto.
  const iframeSrc = (() => {
    if (!mod) return undefined;
    const params = new URLSearchParams(searchParams);
    if (embedToken) params.set('token', embedToken);
    const qs = params.toString();
    const sep = mod.iframe_url.includes('?') ? '&' : '?';
    return qs ? `${mod.iframe_url}${sep}${qs}` : mod.iframe_url;
  })();

  const primaryDomain = useServiceUrlsStore((s) => s.primaryDomain);
  const loadServiceUrls = useServiceUrlsStore((s) => s.load);
  useEffect(() => { void loadServiceUrls(); }, [loadServiceUrls]);
  const dashOrigin = primaryDomain ? `https://${primaryDomain}` : window.location.origin;

  // Feedback de carga del iframe: la app embebida (p.ej. n8n) puede hacer
  // cold-start del contenedor, y sin esto se ve el iframe en blanco. El key
  // del iframe lo remonta por app → reseteamos el flag al cambiar de app.
  const [iframeLoaded, setIframeLoaded] = useState(false);
  useEffect(() => { setIframeLoaded(false); }, [mod?.app_name]);

  // App no disponible (no instalada / no concedida / aún cargando los módulos).
  if (!mod) {
    return (
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 14, color: 'var(--text-dim)',
        background: 'var(--bg)',
      }}>
        <PackageOpen size={32} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 14 }}>
          {loaded ? 'Esta app no está disponible' : 'Cargando…'}
        </span>
        {loaded && (
          <button onClick={() => navigate('/micelhub')} style={retryBtn}>Ir a MicelHub</button>
        )}
      </div>
    );
  }

  const accent = mod.color ?? 'var(--accent)';

  // El título + icono del módulo ya los muestra la TopBar (resuelta contra el
  // ui-modules store), así que aquí NO repetimos una fila-header: el iframe va a
  // viewport completo y las acciones (pantalla completa + abrir en pestaña) se
  // superponen en la esquina, sin robar una fila entera.
  return (
    <div style={{ position: 'absolute', inset: 0, ...rootStyle }}>
      {!iframeLoaded && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 10, background: 'var(--bg)', color: 'var(--text-dim)',
        }}>
          <Loader2 size={28} className="animate-spin" style={{ color: accent }} />
          <span style={{ fontSize: 13 }}>Cargando {mod.label}…</span>
        </div>
      )}
      <iframe
        key={mod.app_name}
        src={iframeSrc}
        title={mod.label}
        onLoad={() => setIframeLoaded(true)}
        style={{ width: '100%', height: '100%', border: 'none', background: 'var(--bg)', display: 'block' }}
        allow="clipboard-read; clipboard-write"
      />
      {/* Acciones superpuestas en la esquina del iframe (fullscreen + abrir en
          pestaña). Semitransparente en reposo para no tapar la UI de la app;
          opaca al pasar el ratón. */}
      <div
        style={{
          position: 'absolute', top: 8, right: 8, zIndex: 10,
          display: 'flex', alignItems: 'center',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '3px 8px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.28)',
          opacity: 0.55, transition: 'opacity 0.15s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.55'; }}
      >
        <EmbedActions
          slug={mod.app_name}
          fallbackUrl={mod.iframe_url}
          openUrl={`${dashOrigin}/app/${mod.app_name}?fullscreen=1`}
          fullscreen={fullscreen}
          onToggleFullscreen={toggle}
        />
      </div>
    </div>
  );
}

const retryBtn: React.CSSProperties = {
  padding: '6px 16px', background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  color: 'var(--text)', cursor: 'pointer', fontSize: 13,
};
