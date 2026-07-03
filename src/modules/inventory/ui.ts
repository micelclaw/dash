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

// Tokens de estilo compartidos por las vistas de inventario (drawer + tabs).
// El módulo usa estilos inline sobre variables CSS del tema; estos consts
// evitan que cada fichero redeclare su propia copia.

import type { CSSProperties } from 'react';

export const inputStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  padding: '6px 8px',
  fontSize: '0.8125rem',
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

export const selectStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  padding: '5px 8px',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'inherit',
  outline: 'none',
  cursor: 'pointer',
};

export const btnPrimary: CSSProperties = {
  background: 'var(--amber)',
  color: '#06060a',
  fontWeight: 600,
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 12px',
  fontSize: '0.8125rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

export const btnSecondary: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 12px',
  fontSize: '0.8125rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
};
