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

import { useEffect } from 'react';

// Cierra un modal/overlay al pulsar Escape mientras está activo. Los modales de
// Finanzas ya cierran con click-fuera + X + Cancelar; esto añade el atajo de teclado
// (esperado e intuitivo) de forma uniforme. Pasa `active=false` cuando el modal está
// cerrado para no escuchar de más. El listener se registra en captura para ganar a
// cualquier otro handler de Escape de la página.
export function useEscapeClose(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [active, onClose]);
}
