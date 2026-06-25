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

// Navegación intra-lente Personal (espejo de FacturacionNav): cualquier sub-pestaña
// puede abrir una CUENTA (lleva a la pestaña Cuentas con esa cuenta seleccionada) o
// el DETALLE de un MOVIMIENTO (diálogo). Lo provee PersonalLens (dueño de las
// pestañas + el diálogo de detalle).

import { createContext, useContext } from 'react';
import type { FinanceTransaction } from '@/stores/finance-personal.store';

export interface PersonalNav {
  /** Abre la pestaña Cuentas con esa cuenta seleccionada. */
  openAccount: (accountId: string) => void;
  /** Abre el detalle del movimiento en un diálogo. */
  openMovement: (tx: FinanceTransaction) => void;
}

const noop = () => {};
const PersonalNavContext = createContext<PersonalNav>({ openAccount: noop, openMovement: noop });

export const PersonalNavProvider = PersonalNavContext.Provider;

export function usePersonalNav(): PersonalNav {
  return useContext(PersonalNavContext);
}
