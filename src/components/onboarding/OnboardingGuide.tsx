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

import { Bot, CheckCircle2, Cpu, RefreshCw, Settings2 } from 'lucide-react';

interface OnboardingGuideProps {
  open: boolean;
  checking?: boolean;
  onOpenGateway: () => void;
  onRetry: () => void | Promise<void>;
}

const steps = [
  {
    icon: Bot,
    title: 'Runtime de OpenClaw',
    description: 'Micelclaw administra una única instancia compartida y comprueba que esté disponible.',
  },
  {
    icon: Cpu,
    title: 'Proveedor y modelo',
    description: 'Configura el proveedor y el modelo desde Gateway. No necesitas instalar otro daemon.',
  },
  {
    icon: Settings2,
    title: 'Agentes de Micelclaw',
    description: 'Al completar la configuración, Micelclaw crea y sincroniza los agentes del grupo.',
  },
];

export function OnboardingGuide({ open, checking = false, onOpenGateway, onRetry }: OnboardingGuideProps) {
  if (!open) return null;

  return (
    <section
      aria-labelledby="openclaw-setup-title"
      style={{
        width: 'min(100%, 560px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 'clamp(16px, 4vw, 28px)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--surface)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'color-mix(in srgb, var(--amber) 18%, transparent)', color: 'var(--amber)' }}>
          <Bot size={18} />
        </span>
        <div>
          <h2 id="openclaw-setup-title" style={{ margin: 0, color: 'var(--text)', fontSize: '1rem' }}>
            Configuración de OpenClaw
          </h2>
          <p style={{ margin: '5px 0 0', color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
            Micelclaw administra el Gateway. Completa la configuración desde el panel Gateway.
          </p>
        </div>
      </header>

      <ol style={{ display: 'grid', gap: 10, margin: 0, padding: 0, listStyle: 'none' }}>
        {steps.map(({ icon: Icon, title, description }, index) => (
          <li key={title} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr)', gap: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg)' }}>
            <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: '50%', background: 'var(--amber)', color: '#06060a', fontSize: '0.75rem', fontWeight: 700 }}>
              {index + 1}
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)', fontSize: '0.8125rem', fontWeight: 600 }}>
                <Icon size={14} aria-hidden="true" />
                {title}
              </div>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.45 }}>
                {description}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <button type="button" onClick={onOpenGateway} style={primaryButtonStyle}>
          <Settings2 size={16} aria-hidden="true" />
          Abrir Gateway
        </button>
        <button type="button" onClick={() => void onRetry()} disabled={checking} style={{ ...secondaryButtonStyle, opacity: checking ? 0.7 : 1 }}>
          <RefreshCw size={16} aria-hidden="true" className={checking ? 'animate-spin' : undefined} />
          {checking ? 'Comprobando…' : 'Comprobar de nuevo'}
        </button>
      </div>

      <p style={{ display: 'flex', alignItems: 'flex-start', gap: 7, margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.45 }}>
        <CheckCircle2 size={15} aria-hidden="true" style={{ color: 'var(--green)', flexShrink: 0, marginTop: 1 }} />
        Los canales externos se configuran después y no forman parte de este paso.
      </p>
    </section>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '0 14px',
  border: '1px solid var(--amber)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--amber)',
  color: '#06060a',
  fontSize: '0.8125rem',
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '0 14px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
};
