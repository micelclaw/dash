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

import { useEffect, useRef } from 'react';
import { useWebSocketStore } from '@/stores/websocket.store';

// Mantiene una lente de Finance al día SIN recargar la página. Resuelve el
// problema de "la pestaña se queda con datos viejos / vacíos": las lentes solo
// hacían `refreshAll()` al montarse, así que un cambio en el servidor (un agente
// que crea una factura, un re-seed, etc.) no se reflejaba hasta un F5 manual.
//
// Dos señales, complementarias:
//   1. WS `change.finance.*` — Core lo emite en el slot 5 de crud-hooks SOLO para
//      mutaciones de agente/background (`source !== 'user_dash'`); las del propio
//      dash no emiten (el dash ya las conoce). Mismo patrón que usa Inventario con
//      `change.inventory.*`.
//   2. `visibilitychange` / `focus` — al volver a la pestaña refresca, lo que cubre
//      CUALQUIER cambio en el servidor aunque no haya emitido WS (p. ej. los scripts
//      de seed/smoke escriben directo en la BD, saltándose los hooks).
//
// Las ráfagas (una factura con N líneas dispara varios eventos) se agrupan con un
// debounce corto para no encadenar refrescos.
export function useFinanceLiveRefresh(refresh: () => void) {
  const client = useWebSocketStore((s) => s.client);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        refreshRef.current();
      }, 400);
    };

    const offChange = client?.on('change.finance.*', schedule);

    const onVisible = () => {
      if (document.visibilityState === 'visible') schedule();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      if (timer) clearTimeout(timer);
      offChange?.();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [client]);
}
