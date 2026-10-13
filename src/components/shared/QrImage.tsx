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
 * QR reutilizable a partir de un string (dirección, enlace de invitación, …).
 * Genera el data-URI con `qrcode` (cliente) y lo pinta sobre fondo blanco para
 * que sea escaneable. Lo comparten los wizards de canales que exponen un código
 * para que OTRO lo escanee (SimpleX dirección, etc.).
 */

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';

export function QrImage({
  value,
  size = 180,
  style,
}: {
  value: string | null | undefined;
  size?: number;
  style?: React.CSSProperties;
}) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    if (!value) { setUri(null); return; }
    let cancelled = false;
    QRCode.toDataURL(value, { margin: 1, width: size, color: { dark: '#000000', light: '#ffffff' } })
      .then((u) => { if (!cancelled) setUri(u); })
      .catch(() => { if (!cancelled) setUri(null); });
    return () => { cancelled = true; };
  }, [value, size]);

  if (!uri) return null;
  return (
    <img
      src={uri}
      alt="QR"
      width={size}
      height={size}
      style={{ borderRadius: 8, background: '#fff', padding: 8, ...style }}
    />
  );
}
