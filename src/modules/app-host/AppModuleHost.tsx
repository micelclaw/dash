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
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Minimize2, PackageOpen, Loader2 } from 'lucide-react';
import { useEmbedFullscreen } from '@/hooks/use-embed-fullscreen';
import { EmbedActions } from '@/components/shared/EmbedActions';
import { useUiModulesStore } from '@/stores/ui-modules.store';
import { useServiceUrlsStore } from '@/stores/service-urls.store';
import { lucideLookup } from '@/config/lucide-lookup';

export function Component() {
  const { appName } = useParams<{ appName: string }>();
  const navigate = useNavigate();
  const { fullscreen, toggle, rootStyle } = useEmbedFullscreen();

  const modules = useUiModulesStore((s) => s.modules);
  const loaded = useUiModulesStore((s) => s.loaded);
  const mod = modules.find((m) => m.app_name === appName);

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

  const Icon = lucideLookup(mod.icon);
  const accent = mod.color ?? 'var(--accent)';

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', ...rootStyle }}>
      <div style={{
        height: fullscreen ? 0 : 36, overflow: 'hidden', display: 'flex', alignItems: 'center',
        padding: fullscreen ? 0 : '0 12px', borderBottom: fullscreen ? 'none' : '1px solid var(--border)',
        background: 'var(--surface)', gap: 8, fontSize: 12, color: 'var(--text-dim)', flexShrink: 0,
      }}>
        <button onClick={() => navigate('/chat')} style={iconBtn}>
          <ArrowLeft size={14} />
        </button>
        <Icon size={14} style={{ color: accent }} />
        <span style={{ fontWeight: 500, color: 'var(--text)' }}>{mod.label}</span>
        <div style={{ flex: 1 }} />
        <EmbedActions
          slug={mod.app_name}
          fallbackUrl={mod.iframe_url}
          openUrl={`${dashOrigin}/app/${mod.app_name}?fullscreen=1`}
          fullscreen={fullscreen}
          onToggleFullscreen={toggle}
        />
      </div>
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
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
          src={mod.iframe_url}
          title={mod.label}
          onLoad={() => setIframeLoaded(true)}
          style={{ width: '100%', height: '100%', border: 'none', background: 'var(--bg)' }}
          allow="clipboard-read; clipboard-write"
        />
      </div>
      <button
        onClick={toggle}
        style={{
          position: 'fixed', top: 8, right: 8, zIndex: 60,
          opacity: fullscreen ? 1 : 0, pointerEvents: fullscreen ? 'auto' : 'none',
          transition: 'opacity 0.15s ease',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '4px 8px',
          cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 11,
        }}
        title="Salir de pantalla completa (ESC)"
      >
        <Minimize2 size={12} /> ESC
      </button>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-dim)', display: 'flex', alignItems: 'center',
};

const retryBtn: React.CSSProperties = {
  padding: '6px 16px', background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  color: 'var(--text)', cursor: 'pointer', fontSize: 13,
};
