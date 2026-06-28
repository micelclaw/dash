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

// Lente Personal — contenedor de sub-pestañas (P1-P6) + acción "Nuevo movimiento".

import { useEffect, useState } from 'react';
import { LayoutDashboard, ArrowLeftRight, Wallet, Tag, PiggyBank, Plus, Loader2 } from 'lucide-react';
import { Tabs } from '@/components/shared/Tabs';
import { useFinancePersonalStore, type FinanceTransaction } from '@/stores/finance-personal.store';
import { useFinanceLiveRefresh } from '../use-finance-live-refresh';
import { ResumenTab } from './ResumenTab';
import { MovimientosTab } from './MovimientosTab';
import { CuentasTab } from './CuentasTab';
import { CategoriasTab } from './CategoriasTab';
import { PresupuestosTab } from './PresupuestosTab';
import { NuevoMovimientoDialog } from './NuevoMovimientoDialog';
import { PersonalNavProvider } from './navigation';
import { MovimientoDetalle } from './MovimientoDetalle';

const SECTIONS = [
  { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
  { id: 'movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { id: 'cuentas', label: 'Cuentas', icon: Wallet },
  { id: 'categorias', label: 'Categorías', icon: Tag },
  { id: 'presupuestos', label: 'Presupuestos', icon: PiggyBank },
];

export function PersonalLens() {
  const { refreshAll, loading, setSelectedAccount } = useFinancePersonalStore();
  const [section, setSection] = useState('resumen');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailTx, setDetailTx] = useState<FinanceTransaction | null>(null);

  useEffect(() => { void refreshAll(); }, [refreshAll]);
  // Auto-refresco en vivo (WS change.finance.* + foco de pestaña), igual que Facturación.
  useFinanceLiveRefresh(refreshAll);

  // Navegación intra-lente: abrir una cuenta = ir a Cuentas con esa seleccionada;
  // abrir un movimiento = mostrar su detalle en un diálogo.
  const openAccount = (accountId: string) => { setSelectedAccount(accountId); setSection('cuentas'); };
  const openMovement = (tx: FinanceTransaction) => setDetailTx(tx);

  return (
    <PersonalNavProvider value={{ openAccount, openMovement }}>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="fin-personal-subtabs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
        <Tabs tabs={SECTIONS} activeTab={section} onChange={setSection} variant="underline" />
        <button onClick={() => setDialogOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--amber)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#0a0a0a', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          <Plus size={15} /> Nuevo movimiento
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', top: 10, right: 16, color: 'var(--text-muted)' }}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /></div>
        )}
        {section === 'resumen' && <ResumenTab />}
        {section === 'movimientos' && <MovimientosTab />}
        {section === 'cuentas' && <CuentasTab />}
        {section === 'categorias' && <CategoriasTab />}
        {section === 'presupuestos' && <PresupuestosTab />}
      </div>

      <NuevoMovimientoDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <MovimientoDetalle tx={detailTx} onClose={() => setDetailTx(null)} />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        /* Sub-pestañas con peso visual SECUNDARIO frente al selector de lente del
           header: más pequeñas, con menos padding y atenuadas. !important porque la
           primitiva Tabs aplica estilos inline (no editamos la primitiva). */
        .fin-personal-subtabs > div > a,
        .fin-personal-subtabs > div > button {
          font-size: 0.75rem !important;
          padding-top: 7px !important;
          padding-bottom: 7px !important;
          padding-left: 11px !important;
          padding-right: 11px !important;
        }
        .fin-personal-subtabs > div > a svg,
        .fin-personal-subtabs > div > button svg {
          width: 14px !important;
          height: 14px !important;
        }
      `}</style>
    </div>
    </PersonalNavProvider>
  );
}
