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

// ─── Finance Launcher ────────────────────────────────────────────────
// Módulo Finance con dos LENTES nativas: "Personal" (F1: cuentas,
// movimientos, resumen) y "Invoicing" (clientes, facturas, pagos). El
// selector de lente es un control segmentado prominente (pills); cada lente
// renderiza sus propias sub-pestañas (underline) debajo. Las apps embebidas
// (Firefly III / SolidInvoice / Crypto) viven en el sidebar, no aquí.

import { useSearchParams } from 'react-router';
import { Wallet, Loader2, User, Receipt, Scale } from 'lucide-react';
import { useFinanceStore } from '@/stores/finance.store';
import { PersonalLens } from './personal/PersonalLens';
import { FacturacionLens } from './facturacion/FacturacionLens';
import { ContabilidadLens } from './contabilidad/ContabilidadLens';
import { ProfileSelector } from '@/components/profiles/ProfileSelector';
import { useProfileStore } from '@/stores/profile.store';
import { FinancePeriodProvider } from './period';

type LensId = 'personal' | 'facturacion' | 'contabilidad';

const LENSES: { id: LensId; label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }[] = [
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'facturacion', label: 'Invoicing', icon: Receipt },
  { id: 'contabilidad', label: 'Accounting', icon: Scale },
];

export function Component() {
  const [params, setParams] = useSearchParams();
  const { loading } = useFinanceStore();
  // Perfil ERP activo: al cambiarlo, se remonta el contenido (key) → re-fetch por perfil.
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const rawTab = params.get('tab');
  const lens: LensId = rawTab === 'facturacion' ? 'facturacion' : rawTab === 'contabilidad' ? 'contabilidad' : 'personal';
  const setLens = (id: LensId) => setParams((p) => { p.set('tab', id); return p; }, { replace: true });

  return (
    <FinancePeriodProvider>
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div className="fin-launcher-header" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Wallet size={20} style={{ color: 'var(--mod-finance)' }} />
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Finance</h1>
          {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />}
        </div>

        {/* Selector de PERFIL ERP (multi-perfil) — re-scopea Finanzas + Inventario */}
        <ProfileSelector />

        {/* Selector de LENTE — control segmentado prominente (pills) */}
        <div
          role="tablist"
          aria-label="Lente financiera"
          className="fin-lens-tabs"
          style={{
            display: 'inline-flex',
            gap: 4,
            marginLeft: 6,
            padding: 4,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg, 12px)',
          }}
        >
          {LENSES.map((l) => {
            const isActive = l.id === lens;
            const Icon = l.icon;
            return (
              <button
                key={l.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setLens(l.id)}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '7px 16px',
                  border: 'none',
                  borderRadius: 'var(--radius-md, 8px)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  fontWeight: 600,
                  background: isActive ? 'var(--mod-finance)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.18)' : 'none',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
              >
                <Icon size={16} />
                {l.label}
              </button>
            );
          })}
        </div>
      </div>

      <div key={activeProfileId ?? 'none'} style={{ flex: 1, overflow: 'auto' }}>
        {lens === 'personal' && <PersonalLens />}
        {lens === 'facturacion' && <FacturacionLens />}
        {lens === 'contabilidad' && <ContabilidadLens />}
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        /* Móvil (<768px): la cabecera se apila y el selector de lente pasa a fila
           propia con scroll horizontal en vez de desbordar la página. Escritorio
           intacto (solo dentro del media query). */
        @media (max-width: 767px) {
          .fin-launcher-header {
            padding: 12px 12px !important;
            flex-wrap: wrap;
            gap: 10px !important;
            row-gap: 10px;
          }
          .fin-lens-tabs {
            margin-left: 0 !important;
            flex: 1 1 100%;
            min-width: 0;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          .fin-lens-tabs > button { flex-shrink: 0; white-space: nowrap; }
        }
      `}</style>
    </div>
    </FinancePeriodProvider>
  );
}
