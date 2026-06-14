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

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
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
import { ConfigHealthBanner } from './components/ConfigHealthBanner';
import type { GatewayTab } from './types';

const TABS: { key: GatewayTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'channels', label: 'Channels' },
  { key: 'models', label: 'Models' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'cron', label: 'Cron' },
  { key: 'devices', label: 'Devices' },
  { key: 'heartbeat', label: 'Heartbeat' },
];

export function Component() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const initialTab = (searchParams.get('tab') as GatewayTab) || 'overview';
  const [activeTab, setActiveTab] = useState<GatewayTab>(initialTab);
  const [hoveredTab, setHoveredTab] = useState<GatewayTab | null>(null);

  const { fetchSnapshot, statusLoading } = useGatewayStore();

  // Logs tab moved to Activity Center — preserve old bookmarks.
  useEffect(() => {
    if (searchParams.get('tab') === 'logs') {
      navigate('/activity?tab=gateway', { replace: true });
    }
  }, [searchParams, navigate]);

  // Fetch everything in one request on mount
  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  // Sync tab to URL
  const handleTabChange = (tab: GatewayTab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'overview' ? {} : { tab });
  };

  if (statusLoading && !useGatewayStore.getState().status) {
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
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            const isHovered = hoveredTab === tab.key;
            return (
              <a
                key={tab.key}
                href={tab.key === 'overview' ? '/gateway' : `/gateway?tab=${tab.key}`}
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

        {/* Right spacer for alignment */}
        {!isMobile && <div style={{ width: 80 }} />}
      </div>

      {/* Config-health banner — solo aparece si hay orphans en openclaw.json */}
      <ConfigHealthBanner />

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'channels' && <ChannelsTab />}
        {activeTab === 'models' && <ModelsTab />}
        {activeTab === 'sessions' && <SessionsTab />}
        {activeTab === 'cron' && <CronTab />}
        {activeTab === 'devices' && <DevicesTab />}
        {activeTab === 'heartbeat' && <HeartbeatTab />}
      </div>
    </div>
  );
}
