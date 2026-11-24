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

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-media-query';
import { handleSpaAnchorClick } from '@/lib/nav';
import { useGatewayStore } from '@/stores/gateway.store';
import { OverviewTab } from './tabs/OverviewTab';
import { ChannelsTab } from './tabs/ChannelsTab';
import { ModelsTab } from './tabs/ModelsTab';
import { SessionsTab } from './tabs/SessionsTab';
import { CronTab } from './tabs/CronTab';
import { DevicesTab } from './tabs/DevicesTab';
import { HeartbeatTab } from './tabs/HeartbeatTab';
import { NativeGatewayManagement } from './tabs/NativeGatewayManagement';
import { ConfigHealthBanner } from './components/ConfigHealthBanner';
import type { GatewayTab } from './types';
import { openOpenclawControlUi } from '@/services/openclaw-control-ui.service';
import { Button } from '@/components/ui/button';

const TABS: { key: GatewayTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'channels', label: 'Channels' },
  { key: 'models', label: 'Models' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'cron', label: 'Cron' },
  { key: 'devices', label: 'Devices' },
  { key: 'heartbeat', label: 'Heartbeat' },
];

const NATIVE_LABELS: Partial<Record<GatewayTab, string>> = { sessions: 'Sesiones', cron: 'Automatizaciones' };
const NATIVE_TABS = TABS.filter((tab) => tab.key !== 'heartbeat').map((tab) => ({
  ...tab, label: NATIVE_LABELS[tab.key] ?? tab.label,
}));

export function Component() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const nativeManagement = import.meta.env.DEV && searchParams.get('native') === '1';
  const tabs = nativeManagement ? NATIVE_TABS : TABS;
  const requestedTab = searchParams.get('tab');
  const requested = nativeManagement && ['heartbeat', 'automations'].includes(requestedTab ?? '') ? 'cron' : requestedTab;
  const initialTab = tabs.find((tab) => tab.key === requested)?.key ?? 'overview';
  const [activeTab, setActiveTab] = useState<GatewayTab>(initialTab);
  const [hoveredTab, setHoveredTab] = useState<GatewayTab | null>(null);
  const [openingControlUi, setOpeningControlUi] = useState(false);
  const controlUiOpening = useRef(false);

  const { fetchSnapshot, statusLoading } = useGatewayStore();
  const personalView = nativeManagement && (initialTab === 'sessions' || initialTab === 'cron');

  // Logs tab moved to Activity Center — preserve old bookmarks.
  useEffect(() => {
    if (searchParams.get('tab') === 'logs') {
      navigate('/activity?tab=gateway', { replace: true });
    }
  }, [searchParams, navigate]);

  // Fetch everything in one request on mount
  useEffect(() => {
    if (!personalView) fetchSnapshot();
  }, [fetchSnapshot, personalView]);

  // Recovery links and browser history may change the query without remounting.
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Sync tab to URL
  const tabQuery = (tab: GatewayTab) => {
    const query = new URLSearchParams();
    if (tab !== 'overview') query.set('tab', tab);
    if (nativeManagement) query.set('native', '1');
    return query;
  };
  const handleTabChange = (tab: GatewayTab) => {
    setActiveTab(tab);
    setSearchParams(tabQuery(tab));
  };
  const handleOpenControlUi = useCallback(async () => {
    if (controlUiOpening.current) return;
    controlUiOpening.current = true;
    setOpeningControlUi(true);
    try { await openOpenclawControlUi(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo abrir la Control UI'); }
    finally {
      controlUiOpening.current = false;
      setOpeningControlUi(false);
    }
  }, []);

  if (!personalView && statusLoading && !useGatewayStore.getState().status) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--text-dim)',
        fontSize: '0.875rem',
      }}>
        Loading gateway...
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '10px 12px' : '12px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        ...(isMobile ? { flexWrap: 'wrap' as const, gap: 8 } : {}),
      }}>
        {/* Tabs (the page-level title is rendered by Shell.tsx — no need
            to duplicate it here) */}
        <div style={{
          display: 'flex',
          gap: isMobile ? 2 : 4,
          ...(isMobile ? {
            width: '100%',
            overflowX: 'auto' as const,
            WebkitOverflowScrolling: 'touch' as const,
          } : {}),
        }}>
          {tabs.map(tab => {
            const isActive = activeTab === tab.key;
            const isHovered = hoveredTab === tab.key;
            const query = tabQuery(tab.key).toString();
            return (
              <a
                key={tab.key}
                href={query ? `/gateway?${query}` : '/gateway'}
                aria-current={isActive ? 'page' : undefined}
                onClick={(e) => handleSpaAnchorClick(e, () => handleTabChange(tab.key))}
                onMouseEnter={() => setHoveredTab(tab.key)}
                onMouseLeave={() => setHoveredTab(null)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                  background: isActive
                    ? 'var(--amber-dim)'
                    : isHovered
                      ? 'var(--surface-hover)'
                      : 'transparent',
                  color: isActive
                    ? 'var(--amber)'
                    : 'var(--text-dim)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: isMobile ? '5px 10px' : '5px 12px',
                  fontSize: isMobile ? '0.75rem' : '0.8125rem',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                  fontFamily: 'var(--font-sans)',
                  whiteSpace: 'nowrap',
                  flex: isMobile ? 1 : undefined,
                  justifyContent: isMobile ? 'center' : undefined,
                }}
              >
                {tab.label}
              </a>
            );
          })}
        </div>

        <Button
          type="button"
          size={isMobile ? 'icon' : 'sm'}
          onClick={() => void handleOpenControlUi()}
          disabled={openingControlUi}
          aria-busy={openingControlUi}
          aria-label="Abrir Control UI"
          title="Abrir la Control UI de OpenClaw con tu identidad personal"
        >
          <ExternalLink size={14} />{!isMobile && 'Abrir Control UI'}
        </Button>
      </div>

      {/* Config-health banner — solo aparece si hay orphans en openclaw.json */}
      {!personalView && <ConfigHealthBanner />}

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'channels' && <ChannelsTab />}
        {activeTab === 'models' && <ModelsTab />}
        {activeTab === 'sessions' && (nativeManagement ? <NativeGatewayManagement key="sessions" surface="sessions" /> : <SessionsTab />)}
        {activeTab === 'cron' && (nativeManagement ? <NativeGatewayManagement key="automations" surface="automations" /> : <CronTab />)}
        {activeTab === 'devices' && <DevicesTab />}
        {!nativeManagement && activeTab === 'heartbeat' && <HeartbeatTab />}
      </div>
    </div>
  );
}
