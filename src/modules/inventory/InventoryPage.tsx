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

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { LayoutDashboard, Boxes, MapPin, ArrowRightLeft, HandHeart, Wrench, BarChart3 } from 'lucide-react';
import { Tabs } from '@/components/shared/Tabs';
import { useInventoryStore } from '@/stores/inventory.store';
import { useWebSocketStore } from '@/stores/websocket.store';
import { PanelTab } from './tabs/PanelTab';
import { CatalogTab } from './tabs/CatalogTab';
import { LocationsTab } from './tabs/LocationsTab';
import { StockTab } from './tabs/StockTab';
import { LendingTab } from './tabs/LendingTab';
import { MaintenanceTab } from './tabs/MaintenanceTab';
import { ReportsTab } from './tabs/ReportsTab';
import { ScanFab } from './components/ScanFab';
import { ItemDrawer } from './components/ItemDrawer';

type InventoryTab = 'panel' | 'catalog' | 'locations' | 'stock' | 'lending' | 'maintenance' | 'reports';

export function Component() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Deep-link a ubicación (QR de bin/estante): fuerza la tab Locations y pasa el id.
  const locationParam = searchParams.get('location_id');
  const activeTab = locationParam ? 'locations' : ((searchParams.get('tab') as InventoryTab) || 'panel');

  const { items, moves, alerts, fetchItems, fetchLocations, fetchAlerts, fetchMeta, fetchProposals, selectedItemId, selectItem } = useInventoryStore();

  useEffect(() => {
    fetchMeta();
    fetchItems();
    fetchLocations();
    fetchAlerts();
    fetchProposals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep-link ?id=<item> → abre la ficha del artículo (lo usan los chips del chat
  // y los enlaces "Repuso en inventario" desde Facturación). El drawer carga el
  // item por id aunque aún no esté en el store. Limpia el param al cerrar.
  const idParam = searchParams.get('id');
  useEffect(() => {
    if (idParam && idParam !== selectedItemId) selectItem(idParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam]);
  useEffect(() => {
    if (!selectedItemId && idParam) {
      setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete('id'); return n; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemId]);

  // Sync bidireccional en vivo: si el estado de un item cambia desde el board
  // kanban (inventory.item.updated, emitido por kanban-sync) o lo muta un
  // agente (change.inventory.*, slot 5 de los crud-hooks), refrescamos la
  // vista sin esperar a un F5.
  const wsClient = useWebSocketStore((s) => s.client);
  useEffect(() => {
    if (!wsClient) return;
    const refresh = () => {
      fetchItems();
      fetchAlerts();
    };
    const offUpdated = wsClient.on('inventory.item.updated', refresh);
    const offChanges = wsClient.on('change.inventory.*', refresh);
    return () => {
      offUpdated();
      offChanges();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsClient]);

  // Revelado progresivo dirigido por datos: la tab Stock solo aparece cuando
  // existe algo que la justifique (items con stock contado o movimientos).
  const showStock = useMemo(
    () => items.some(i => i.track_stock) || moves.length > 0 || (alerts?.low_stock.length ?? 0) > 0,
    [items, moves, alerts],
  );

  const tabs = useMemo(() => [
    { id: 'panel', label: 'Overview', icon: LayoutDashboard },
    { id: 'catalog', label: 'Catalog', icon: Boxes },
    { id: 'locations', label: 'Locations', icon: MapPin },
    ...(showStock ? [{ id: 'stock', label: 'Stock', icon: ArrowRightLeft }] : []),
    { id: 'lending', label: 'Lending', icon: HandHeart, badge: alerts?.active_loans.length || undefined },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench, badge: alerts?.upcoming_maintenance.length || undefined },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ], [showStock, alerts]);

  const setTab = (id: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', id);
      return next;
    }, { replace: true });
  };

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px 0', borderBottom: '1px solid var(--border)' }}>
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setTab} variant="underline" />
      </div>
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          {activeTab === 'panel' && <PanelTab onNavigate={setTab} />}
          {activeTab === 'catalog' && <CatalogTab />}
          {activeTab === 'locations' && (
            <LocationsTab
              deepLinkLocationId={locationParam}
              onLocationConsumed={() => setSearchParams(prev => {
                const n = new URLSearchParams(prev);
                n.delete('location_id');
                n.set('tab', 'locations');
                return n;
              }, { replace: true })}
            />
          )}
          {activeTab === 'stock' && showStock && <StockTab />}
          {activeTab === 'lending' && <LendingTab />}
          {activeTab === 'maintenance' && <MaintenanceTab />}
          {activeTab === 'reports' && <ReportsTab />}
        </div>
        {selectedItemId && <ItemDrawer itemId={selectedItemId} />}
      </div>
      {/* A5: escáner global con intención (localizar/recuento/mover/check-in-out) */}
      <ScanFab />
    </div>
  );
}
