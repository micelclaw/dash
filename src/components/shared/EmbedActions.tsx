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

// ─── EmbedActions ────────────────────────────────────────────────────
// La "esquina" estándar de todos los módulos que embeben una app: RAM +
// botón de pantalla completa in-page + botón de abrir en pestaña nueva (al
// dominio del servicio). Presentacional: el caller pasa su ramMb y el estado
// de fullscreen (useEmbedFullscreen, o el store de office).

import { Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import { useServiceUrl } from '@/config/service-urls';
import { useI18n } from '@/i18n';

interface EmbedActionsProps {
  /** Slug del servicio (= name en services / exposable-services) para resolver el dominio. */
  slug: string;
  /** URL local de respaldo si no hay dominio configurado. */
  fallbackUrl: string;
  /**
   * Override explícito del destino de "abrir en pestaña nueva". Cuando el dominio del
   * servicio NO es una app navegable para el usuario (p.ej. el editor ONLYOFFICE, cuyo
   * `office.<dom>` es el document server backend), el caller pasa aquí la URL útil
   * (p.ej. el propio editor a pantalla completa en el dash). Si se omite, se usa el dominio.
   */
  openUrl?: string;
  /** RAM en MB (lo que ya muestra cada embebido). Oculto si null/undefined. */
  ramMb?: number | null;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}

const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--text-muted)', padding: 2, lineHeight: 0,
};

export function EmbedActions({ slug, fallbackUrl, openUrl, ramMb, fullscreen, onToggleFullscreen }: EmbedActionsProps) {
  const { t } = useI18n();
  const domainUrl = useServiceUrl(slug, fallbackUrl);
  const href = openUrl ?? domainUrl;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-muted)' }}>
      {ramMb != null && <span>RAM: {ramMb} MB</span>}
      <button
        type="button"
        onClick={onToggleFullscreen}
        style={iconBtn}
        title={t(fullscreen ? 'shared.embed.exitFullscreen' : 'shared.embed.fullscreen')}
        aria-label={t(fullscreen ? 'shared.embed.exitFullscreenLabel' : 'shared.embed.fullscreenLabel')}
        aria-pressed={fullscreen}
      >
        {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...iconBtn, textDecoration: 'none' }}
        title={t('shared.embed.openTab')}
        aria-label={t('shared.embed.openTab')}
      >
        <ExternalLink size={13} />
      </a>
    </div>
  );
}
