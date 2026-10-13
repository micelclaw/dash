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

import { useState } from 'react';
import { ChevronRight, Trash2, Loader2, ExternalLink, Download, ArrowRightLeft } from 'lucide-react';
import { ProviderBrandIcon } from '@/config/provider-icons';
import { PROVIDER_COLORS } from './constants';
import type { ProviderEntry } from './types';
import type { InstallableCatalogProvider } from '../../types';

// Panel web propio de OmniRoute (el gateway self-hosted local). Solo su tarjeta lleva
// el enlace: un usuario normal no sabría llegar a él (127.0.0.1:20128) de otra forma.
const OMNIROUTE_DASHBOARD_URL = 'http://127.0.0.1:20128/home';

export function ProviderCard({ entry, subtitle, onClick, onDelete, deleting, onMigrate, migrating }: {
  entry: ProviderEntry;
  subtitle?: string;
  onClick: () => void;
  onDelete?: (e: React.MouseEvent) => void;
  deleting?: boolean;
  onMigrate?: (e: React.MouseEvent) => void;
  migrating?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    // Card clicable como <div role="button">, NO <button>: contiene un <button> de
    // borrar (onDelete, providers custom) y un <button> dentro de otro <button> es
    // HTML inválido → React validateDOMNesting / hydration error. onKeyDown replica
    // la activación por teclado; el delete ya hace e.stopPropagation (ModelsTab).
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: '16px 14px',
        background: hovered ? 'var(--surface-hover)' : 'var(--card)',
        border: `1px solid ${entry.hasAuth ? entry.color + '30' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'var(--transition-fast)',
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
        minHeight: 90,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 'var(--radius-sm)',
          background: `${entry.color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <ProviderBrandIcon providerId={entry.provider} label={entry.label} size={24} style={{ color: entry.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
            {entry.label}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 1 }}>
            {subtitle ?? `${entry.modelCount} model${entry.modelCount !== 1 ? 's' : ''} · ${entry.legacyConfigured ? 'Legacy CLI config' : entry.hasAuth ? 'Configured' : 'Not configured'}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {entry.hasAuth ? (
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0,
            }} />
          ) : (
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: 'var(--text-muted)', opacity: 0.5, flexShrink: 0,
            }} />
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={deleting}
              style={{
                background: 'transparent', border: 'none', cursor: deleting ? 'wait' : 'pointer',
                color: 'var(--text-muted)', padding: 2, display: 'flex', opacity: deleting ? 0.5 : 1,
              }}
              title="Remove provider"
            >
              {deleting ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
            </button>
          )}
          <ChevronRight size={14} style={{ color: 'var(--text-dim)', opacity: 0.5 }} />
        </div>
      </div>

      {/* Solo OmniRoute: enlace a su panel web propio (pestaña nueva). stopPropagation
          para no disparar la navegación a modelos de la tarjeta. */}
      {entry.provider === 'omniroute' && (
        <a
          href={OMNIROUTE_DASHBOARD_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Abrir el panel de OmniRoute en una pestaña nueva"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
            fontSize: '0.6875rem', color: entry.color, textDecoration: 'none',
            padding: '4px 8px', border: `1px solid ${entry.color}40`,
            borderRadius: 'var(--radius-sm)', marginTop: 2, fontFamily: 'var(--font-sans)',
          }}
        >
          <ExternalLink size={11} /> Abrir OmniRoute
        </a>
      )}
      {entry.legacyConfigured && onMigrate && (
        <button
          onClick={onMigrate}
          disabled={migrating}
          title={`Move model refs to ${entry.migrationTarget ?? 'the canonical provider'} and preserve the CLI runtime`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
            fontSize: '0.6875rem', color: 'var(--amber)', padding: '4px 8px',
            border: '1px solid color-mix(in srgb, var(--amber) 40%, transparent)',
            borderRadius: 'var(--radius-sm)', background: 'transparent',
            cursor: migrating ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          {migrating ? <Loader2 size={11} className="spin" /> : <ArrowRightLeft size={11} />}
          {migrating ? 'Migrating…' : `Migrate to ${entry.migrationTarget ?? 'canonical provider'}`}
        </button>
      )}
    </div>
  );
}

export function AvailableProviderCard({ provider, installing, onInstall }: {
  provider: InstallableCatalogProvider;
  installing: boolean;
  onInstall: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = PROVIDER_COLORS[provider.id] ?? 'var(--text-dim)';
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 8, minHeight: 104,
        padding: '16px 14px', background: hovered ? 'var(--surface-hover)' : 'var(--card)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ProviderBrandIcon providerId={provider.id} label={provider.label} size={24} style={{ color }} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>{provider.label}</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>Official OpenClaw plugin</div>
        </div>
      </div>
      {provider.description && (
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', lineHeight: 1.35, flex: 1 }}>{provider.description}</div>
      )}
      <button
        onClick={onInstall}
        disabled={installing}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          alignSelf: 'flex-start', padding: '5px 10px', borderRadius: 'var(--radius-sm)',
          border: `1px solid ${color}50`, background: `${color}12`, color,
          cursor: installing ? 'wait' : 'pointer', fontSize: '0.75rem', fontWeight: 500,
        }}
      >
        {installing ? <Loader2 size={12} className="spin" /> : <Download size={12} />}
        {installing ? 'Installing…' : 'Install'}
      </button>
    </div>
  );
}

export function AddProviderTypeCard({ label, description, onClick, provider }: {
  label: string;
  description: string;
  onClick: () => void;
  provider: string;
}) {
  const [hovered, setHovered] = useState(false);
  const color = PROVIDER_COLORS[provider?.toLowerCase()] ?? 'var(--text-dim)';
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: '16px 14px',
        background: hovered ? 'var(--surface-hover)' : 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'var(--transition-fast)',
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
        minHeight: 90,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 'var(--radius-sm)',
          background: `${color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <ProviderBrandIcon providerId={provider} label={label} size={24} style={{ color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
            {label}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 1, lineHeight: 1.3 }}>
            {description}
          </div>
        </div>
        <ChevronRight size={14} style={{ color: 'var(--text-dim)', opacity: 0.5 }} />
      </div>
    </button>
  );
}
