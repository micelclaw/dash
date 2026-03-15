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

import { Globe, RefreshCw, Settings2 } from 'lucide-react';
import type { DnsSection } from '../DnsSidebar';

interface DnsWelcomeBannerProps {
  onNavigate: (section: DnsSection) => void;
}

const CARDS = [
  {
    icon: Globe,
    title: 'Tu dirección en internet',
    description: 'Como la dirección de tu casa, pero en internet. Conecta tu nombre de dominio con el servidor donde viven tus servicios.',
  },
  {
    icon: RefreshCw,
    title: 'IP dinámica sin problemas',
    description: 'Si tu IP cambia (como en la mayoría de conexiones domésticas), Micelclaw la actualiza automáticamente para que tus servicios sigan accesibles.',
  },
  {
    icon: Settings2,
    title: 'Gestiona tus dominios propios',
    description: 'Si tienes un dominio como \'miempresa.com\', puedes gestionarlo aquí directamente, sin entrar al panel de tu proveedor.',
  },
];

const ACTIONS: { label: string; section: DnsSection }[] = [
  { label: 'Obtener mi subdominio gratis', section: 'subdomain' },
  { label: 'Configurar IP dinámica', section: 'ddns' },
  { label: 'Conectar mi dominio', section: 'providers' },
];

export function DnsWelcomeBanner({ onNavigate }: DnsWelcomeBannerProps) {
  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid rgba(212, 160, 23, 0.3)',
        background: 'linear-gradient(135deg, rgba(212, 160, 23, 0.06), rgba(212, 160, 23, 0.02))',
        padding: 24,
      }}>
        <h2 style={{
          fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)',
          margin: '0 0 16px', fontFamily: 'var(--font-sans)',
        }}>
          ¿Para qué sirve este módulo?
        </h2>

        {/* Feature cards */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {CARDS.map(card => (
            <div
              key={card.title}
              style={{
                flex: 1,
                padding: 16,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--card)',
              }}
            >
              <card.icon size={24} style={{ color: '#d4a017', marginBottom: 10 }} />
              <div style={{
                fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)',
                marginBottom: 6,
              }}>
                {card.title}
              </div>
              <div style={{
                fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5,
              }}>
                {card.description}
              </div>
            </div>
          ))}
        </div>

        {/* Quick start */}
        <div style={{
          fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-dim)',
          marginBottom: 12,
        }}>
          ¿Por dónde empiezo?
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ACTIONS.map(action => (
            <button
              key={action.section}
              onClick={() => onNavigate(action.section)}
              style={{
                padding: '7px 14px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text)',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                transition: 'border-color var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(212, 160, 23, 0.5)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
