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

import { useNavigate } from 'react-router';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

interface OnboardingBannerProps {
  variant: 'unconfigured' | 'completed';
  onDismiss?: () => void;
}

export function OnboardingBanner({ variant, onDismiss }: OnboardingBannerProps) {
  const navigate = useNavigate();
  const isCompleted = variant === 'completed';

  if (!isCompleted) {
    return (
      <button type="button" onClick={() => navigate('/gateway')} style={bannerStyle('#dc2626', true)}>
        <AlertTriangle size={16} aria-hidden="true" />
        <span>OpenClaw necesita configuración. Abre Gateway para completarla.</span>
      </button>
    );
  }

  return (
    <div role="status" style={bannerStyle('#16a34a', false)}>
      <CheckCircle size={16} aria-hidden="true" />
      <span>Configuración completada. Ya puedes usar AI Chat y Agents.</span>
      {onDismiss && (
        <button
          type="button"
          aria-label="Cerrar aviso de configuración completada"
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', marginLeft: 8, opacity: 0.85 }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function bannerStyle(background: string, clickable: boolean): React.CSSProperties {
  return {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    width: '100%',
    minHeight: 40,
    background,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '10px 16px',
    cursor: clickable ? 'pointer' : 'default',
    fontSize: '0.8125rem',
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    letterSpacing: '0.01em',
    userSelect: 'none',
    border: 'none',
    textAlign: 'center',
  };
}
