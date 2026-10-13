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

// ─── "+ Conectar", el mismo botón en los nueve módulos ──────────────────────
//
// Idea del usuario, y la que hace que conectar **deje de ser una cosa de
// Ajustes**: cada módulo lleva este botón al pie de su barra lateral, y al
// pulsarlo abre el MISMO asistente saltándose la primera ventana — el tipo de
// dato ya lo dice el sitio desde el que se pulsó.
//
//   Desde Ajustes:   [ Conectar ] → ventana 1 (qué) → ventana 2 (dónde) → …
//   Desde un módulo: [ + ]        ─────────────────→ ventana 2 (dónde) → …
//
// Es UN componente para los nueve a propósito: si el botón se copiara por módulo,
// en tres meses habría nueve variantes que se comportan distinto. Un módulo nuevo
// que reciba datos hereda el botón sin escribir pantalla nueva.

import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import { ConnectWizard } from '@/components/settings/connect/ConnectWizard';
import type { DataTypeId } from '@/config/data-types';

export interface ConnectButtonProps {
  /** El tipo de dato de ESTE módulo. Es lo que salta la ventana 1. */
  dataType: DataTypeId;
  /** Se llama al terminar, para que el módulo refresque su lista. */
  onConnected?: () => void;
  /** `sidebar` (por defecto) o `inline` para barras de herramientas. */
  variant?: 'sidebar' | 'inline';
  label?: string;
}

export function ConnectButton({ dataType, onConnected, variant = 'sidebar', label = 'Conectar' }: ConnectButtonProps) {
  const [open, setOpen] = useState(false);

  const cerrar = useCallback(() => setOpen(false), []);
  const conectado = useCallback(() => { onConnected?.(); }, [onConnected]);

  const base: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-sans)',
    transition: 'color var(--transition-fast)',
  };

  const estilo: React.CSSProperties = variant === 'sidebar'
    ? {
        ...base,
        width: '100%',
        padding: '8px 10px',
        fontSize: '0.8125rem',
        borderTop: '1px solid var(--border)',
        borderRadius: 0,
      }
    : { ...base, padding: '4px 8px', fontSize: '0.75rem' };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={`Conectar ${label.toLowerCase()} de otro sitio`}
        style={estilo}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--amber)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; }}
      >
        <Plus size={14} />
        {label}
      </button>

      <ConnectWizard
        open={open}
        onClose={cerrar}
        onConnected={conectado}
        fixedDataType={dataType}
      />
    </>
  );
}
