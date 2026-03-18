/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
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

  return (
    <div
      onClick={isCompleted ? undefined : () => navigate('/terminal')}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: isCompleted ? '#16a34a' : '#dc2626',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '10px 16px',
        cursor: isCompleted ? 'default' : 'pointer',
        fontSize: '0.8125rem',
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        letterSpacing: '0.01em',
        userSelect: 'none',
      }}
    >
      {isCompleted ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
      <span>
        {isCompleted
          ? 'Configuracion completada. Ve a Telegram o a Chat para iniciar tu agente.'
          : 'OpenClaw no esta configurado. Haz clic aqui para completar la configuracion.'}
      </span>
      {isCompleted && onDismiss && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            marginLeft: 8,
            opacity: 0.8,
          }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
