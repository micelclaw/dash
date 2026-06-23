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
// Vista de entrada del módulo Finance (/finance): rejilla con las apps de la
// suite (Firefly III + SolidInvoice) y su estado. Clicar una tarjeta abre su
// embed (/finance/firefly | /finance/solidinvoice). Patrón hermano del
// OfficeLauncher / CryptoPage.

import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Wallet, Receipt, Bitcoin, Loader2 } from 'lucide-react';
import { useFinanceStore, type FinanceAppName } from '@/stores/finance.store';

interface AppCard {
  name: FinanceAppName | 'crypto';
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  path: string;
}

const CARDS: AppCard[] = [
  { name: 'firefly', label: 'Firefly III', description: 'Finanzas personales — presupuestos, gastos y cuentas.', icon: Wallet, color: '#22c55e', path: '/finance/firefly' },
  { name: 'solidinvoice', label: 'SolidInvoice', description: 'Facturación — clientes, presupuestos y pagos.', icon: Receipt, color: '#7c3aed', path: '/finance/solidinvoice' },
  { name: 'crypto', label: 'Crypto Stack', description: 'Bitcoin, Lightning, Monero y más.', icon: Bitcoin, color: '#f7931a', path: '/crypto' },
];

export function Component() {
  const navigate = useNavigate();
  const { status, loading, fetchStatus } = useFinanceStore();

  useEffect(() => { void fetchStatus(); }, [fetchStatus]);

  const appState = (name: FinanceAppName | 'crypto') => {
    if (name === 'crypto') return null;
    return status?.apps.find((a) => a.name === name) ?? null;
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: 24, background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Wallet size={20} style={{ color: 'var(--mod-finance)' }} />
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Finance</h1>
        {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 24 }}>
        Suite financiera self-hosted. Cada app corre como servicio gestionado y se embebe en el dash.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {CARDS.map((card) => {
          const st = appState(card.name);
          const running = st?.running ?? false;
          const installed = st?.installed ?? false;
          const Icon = card.icon;
          const statusLabel = card.name === 'crypto'
            ? 'Stack'
            : running ? 'En marcha' : installed ? 'Detenida' : 'Sin instalar';
          const statusColor = card.name === 'crypto'
            ? 'var(--text-muted)'
            : running ? 'var(--green, #22c55e)' : installed ? 'var(--amber)' : 'var(--text-muted)';
          return (
            <button
              key={card.name}
              onClick={() => navigate(card.path)}
              aria-label={`Abrir ${card.label}`}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = card.color; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              style={{
                textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg, 12px)', padding: 18, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 10, transition: 'border-color 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', background: `${card.color}1a`,
                }}>
                  <Icon size={20} style={{ color: card.color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{card.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: statusColor }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
                    {statusLabel}
                    {st?.ram_mb != null && <span style={{ color: 'var(--text-muted)' }}>· {st.ram_mb} MB</span>}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{card.description}</p>
            </button>
          );
        })}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
