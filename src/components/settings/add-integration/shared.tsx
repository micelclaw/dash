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

import { Button } from '@/components/ui/button';

/** Campo etiquetado de los formularios de conexión (label + input + hint). */
export function Field({ label, hint, children }: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
        {label}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

/** Par Back/Connect al pie de cada formulario. Sin `onConfirm` actúa como
 *  submit del <form> que lo envuelve; con `onConfirm` es un botón normal. */
export function FormActions({ onBack, saving, disabled, onConfirm, submitLabel = 'Connect' }: {
  onBack: () => void;
  saving: boolean;
  disabled?: boolean;
  onConfirm?: () => void;
  submitLabel?: string;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
      <Button type="button" variant="outline" onClick={onBack} className="flex-1 text-[var(--text-dim)]">
        Back
      </Button>
      <Button
        type={onConfirm ? 'button' : 'submit'}
        onClick={onConfirm}
        disabled={saving || disabled}
        className="flex-1"
      >
        {saving ? 'Connecting...' : submitLabel}
      </Button>
    </div>
  );
}
