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

import { useEffect, useState } from 'react';
import {
  Radio, RotateCw, Play, Square,
  Cable, MessageSquare, Bot,
  Stethoscope, ShieldCheck, ExternalLink,
  RefreshCw, DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-media-query';
import { useGatewayStore } from '@/stores/gateway.store';
import { StatusPill } from '../components/StatusPill';
import { MetricCard } from '../components/MetricCard';
import { HealthCheckList } from '../components/HealthCheckList';
import { ScrollArea } from '@/components/ui/scroll-area';

export function OverviewTab() {
  const isMobile = useIsMobile();
  const {
    status, health, usage,
    fetchStatus, fetchUsage,
    gatewayStart, gatewayStop, gatewayRestart,
  } = useGatewayStore();

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [refreshHover, setRefreshHover] = useState(false);

  // Poll status every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatus();
    }, 15_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Fetch usage on mount
  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    setActionLoading(action);
    try {
      if (action === 'start') await gatewayStart();
      else if (action === 'stop') await gatewayStop();
      else await gatewayRestart();

      toast.success(`Gateway ${action === 'restart' ? 'restarted' : action === 'start' ? 'started' : 'stopped'}`);
      // Wait a moment then refresh status
      setTimeout(() => fetchStatus(), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} gateway`);
    } finally {
      setActionLoading(null);
    }
  };

  const isRunning = status?.running ?? false;
  const runtimeLoading = status?.running === undefined;

  return (
    <ScrollArea style={{ height: '100%' }}>
      <div style={{
        padding: isMobile ? 12 : 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        maxWidth: 1100,
      }}>
        {/* ─── Status Hero ─────────────────────────────────── */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: isMobile ? 16 : 20,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            {/* Left: status info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--radius-md)',
                background: isRunning ? '#10b98115' : '#6b728015',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Radio size={24} style={{ color: isRunning ? '#10b981' : '#6b7280' }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    color: 'var(--text)',
                    fontFamily: 'var(--font-sans)',
                  }}>
                    OpenClaw Gateway
                  </span>
                  <StatusPill status={runtimeLoading ? 'loading' : isRunning ? 'running' : 'stopped'} size="md" />
                </div>
                <div style={{
                  display: 'flex',
                  gap: isMobile ? 10 : 20,
                  flexWrap: 'wrap',
                  fontSize: '0.75rem',
                  color: 'var(--text-dim)',
                  fontFamily: 'var(--font-sans)',
                }}>
                  {status?.version && <span>v{status.version}</span>}
                  {status?.service_status && <span>{status.service_status}</span>}
                  {status?.port && <span>Port: {status.port}</span>}
                  {status?.bind && <span>Bind: {status.bind}</span>}
                </div>
              </div>
            </div>

            {/* Right: action buttons */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => fetchStatus()}
                onMouseEnter={() => setRefreshHover(true)}
                onMouseLeave={() => setRefreshHover(false)}
                style={{
                  background: refreshHover ? 'var(--surface-hover)' : 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 8px',
                  cursor: 'pointer',
                  color: 'var(--text-dim)',
                  transition: 'var(--transition-fast)',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Refresh"
              >
                <RefreshCw size={14} />
              </button>

              {isRunning ? (
                <>
                  <ActionButton
                    icon={RotateCw}
                    label="Restart"
                    onClick={() => handleAction('restart')}
                    loading={actionLoading === 'restart'}
                    color="var(--warning)"
                  />
                  <ActionButton
                    icon={Square}
                    label="Stop"
                    onClick={() => handleAction('stop')}
                    loading={actionLoading === 'stop'}
                    color="var(--error)"
                  />
                </>
              ) : (
                <ActionButton
                  icon={Play}
                  label="Start"
                  onClick={() => handleAction('start')}
                  loading={actionLoading === 'start'}
                  color="var(--success)"
                />
              )}
            </div>
          </div>
        </div>

        {/* ─── Metrics Grid ────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile
            ? '1fr'
            : 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}>
          <MetricCard
            icon={Cable}
            label="Channels"
            value={status?.channels_connected ?? 0}
            subtitle="connected"
            accentColor="#06b6d4"
          />
          <MetricCard
            icon={MessageSquare}
            label="Sessions"
            value={status?.sessions_active ?? 0}
            subtitle="active"
            accentColor="#8b5cf6"
          />
          <MetricCard
            icon={Bot}
            label="Default Model"
            value={status?.default_model ?? 'N/A'}
            subtitle={`${status?.models_configured ?? 0} configured`}
            accentColor="#f59e0b"
          />
          <MetricCard
            icon={DollarSign}
            label="Usage Today"
            value={usage?.total_tokens != null
              ? `${(usage.total_tokens / 1000).toFixed(1)}k`
              : '—'}
            subtitle={usage?.total_cost_usd != null
              ? `$${usage.total_cost_usd.toFixed(4)}`
              : undefined}
            accentColor="#10b981"
          />
        </div>

        {/* ─── Health Checks ───────────────────────────────── */}
        {health && health.checks.length > 0 && (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
            }}>
              <Stethoscope size={16} style={{ color: 'var(--text-dim)' }} />
              <span style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--text)',
                fontFamily: 'var(--font-sans)',
              }}>
                Health Checks
              </span>
              <StatusPill status={health.status} size="sm" />
            </div>
            <HealthCheckList checks={health.checks} />
          </div>
        )}

        {/* ─── Quick Actions ───────────────────────────────── */}
        <div>
          <span style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--text)',
            fontFamily: 'var(--font-sans)',
            display: 'block',
            marginBottom: 10,
          }}>
            Quick Actions
          </span>
          <div style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            <QuickAction icon={Stethoscope} label="Run Doctor" />
            <QuickAction icon={ShieldCheck} label="Security Audit" />
            <QuickAction icon={ExternalLink} label="Open Dashboard" />
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function ActionButton({ icon: Icon, label, onClick, loading, color }: {
  icon: typeof Play;
  label: string;
  onClick: () => void;
  loading: boolean;
  color: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: hovered ? `${color}20` : 'transparent',
        color,
        border: `1px solid ${color}40`,
        borderRadius: 'var(--radius-sm)',
        padding: '6px 12px',
        fontSize: '0.8125rem',
        fontWeight: 500,
        cursor: loading ? 'wait' : 'pointer',
        transition: 'var(--transition-fast)',
        fontFamily: 'var(--font-sans)',
        opacity: loading ? 0.6 : 1,
      }}
    >
      <Icon size={14} />
      {loading ? `${label}...` : label}
    </button>
  );
}

function QuickAction({ icon: Icon, label }: { icon: typeof Play; label: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => toast.info(`${label} — coming soon`)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: hovered ? 'var(--surface-hover)' : 'var(--surface)',
        color: 'var(--text-dim)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 14px',
        fontSize: '0.8125rem',
        cursor: 'pointer',
        transition: 'var(--transition-fast)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
