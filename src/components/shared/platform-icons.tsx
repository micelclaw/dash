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

/**
 * Sitio único que pinta el icono de una plataforma de mensajería: el LOGO REAL
 * de la marca, con su color, para que la fila se reconozca de un vistazo.
 *
 * Los trazos viven en `platform-icon-paths.ts` (Simple Icons, CC0). IRC no es
 * una marca sino un protocolo → símbolo de canal `#`.
 *
 * Consumido por el módulo Messages y por Channel Observers.
 */

import { Hash, MessageCircle } from 'lucide-react';
import { platformMeta } from '@/config/messaging-platforms';
import { PLATFORM_ICON_PATHS } from './platform-icon-paths';

/**
 * Blanco o negro según el fondo, para que el logo SIEMPRE se lea.
 * Necesario porque Simple Icons da el trazo monocromo y hay marcas muy oscuras
 * (Slack #4A154B, KakaoTalk #3C1E1E): pintadas a pelo sobre el tema oscuro del
 * dash serían invisibles. Con el badge se ven como en el móvil.
 */
function contrastText(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1] ?? '', 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#111111' : '#ffffff';
}

export interface PlatformIconProps {
  platform: string;
  size?: number;
  className?: string;
  /** Look apagado para filas deshabilitadas / sin soporte. */
  muted?: boolean;
}

export function PlatformIcon({ platform, size = 28, className, muted }: PlatformIconProps) {
  const meta = platformMeta(platform);
  const paths = PLATFORM_ICON_PATHS[platform];
  const bg = muted ? 'var(--muted, #3a3a3a)' : meta.color;
  const fg = muted ? 'var(--text-muted, #999)' : contrastText(meta.color);

  // Sin logo de marca (IRC = protocolo, no marca; o plataforma nueva sin icono
  // todavía): un icono honesto de Lucide, nunca un monograma de letras.
  const Fallback = platform === 'irc' ? Hash : MessageCircle;

  return (
    <span
      className={className}
      role="img"
      aria-label={meta.label}
      title={meta.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: bg,
        flexShrink: 0,
      }}
    >
      {paths ? (
        <svg
          width={size * 0.62}
          height={size * 0.62}
          viewBox="0 0 24 24"
          fill={fg}
          aria-hidden="true"
          style={{ display: 'block' }}
        >
          {paths.map((d) => (
            <path key={d.slice(0, 24)} d={d} />
          ))}
        </svg>
      ) : (
        <Fallback size={size * 0.58} color={fg} aria-hidden="true" />
      )}
    </span>
  );
}
