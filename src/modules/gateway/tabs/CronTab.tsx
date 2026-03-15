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
  Plus, Play, Trash2, RefreshCw, Clock, Power,
} from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-media-query';
import { useGatewayStore } from '@/stores/gateway.store';
import * as gwService from '@/services/gateway.service';
import { StatusPill } from '../components/StatusPill';
import { CronJobEditor } from '../components/CronJobEditor';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { CronJob } from '../types';

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function CronTab() {
  const isMobile = useIsMobile();
  const { cronJobs, cronLoading, cronError, fetchCronJobs } = useGatewayStore();
  const [showEditor, setShowEditor] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [refreshHover, setRefreshHover] = useState(false);

  useEffect(() => {
    fetchCronJobs();
  }, [fetchCronJobs]);

  const handleToggle = async (job: CronJob) => {
    const key = `toggle-${job.id}`;
    setActionLoading(key);
    try {
      await gwService.toggleCronJob(job.id, !job.enabled);
      toast.success(`Job "${job.name}" ${job.enabled ? 'disabled' : 'enabled'}`);
      fetchCronJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Toggle failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRun = async (job: CronJob) => {
    const key = `run-${job.id}`;
    setActionLoading(key);
    try {
      await gwService.runCronJob(job.id);
      toast.success(`Job "${job.name}" executed`);
      fetchCronJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (job: CronJob) => {
    if (!confirm(`Delete cron job "${job.name}"?`)) return;
    setActionLoading(`delete-${job.id}`);
    try {
      await gwService.deleteCronJob(job.id);
      toast.success(`Job "${job.name}" deleted`);
      fetchCronJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setActionLoading(null);
    }
  };

  if (cronLoading && cronJobs.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-dim)', fontSize: '0.875rem',
      }}>
        Loading cron jobs...
      </div>
    );
  }

  if (cronError) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--error)', fontSize: '0.875rem',
      }}>
        {cronError}
      </div>
    );
  }

  return (
    <ScrollArea style={{ height: '100%' }}>
      <div style={{ padding: isMobile ? 12 : 20, maxWidth: 1100 }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <span style={{
            fontSize: '0.8125rem', color: 'var(--text-dim)',
            fontFamily: 'var(--font-sans)',
          }}>
            {cronJobs.length} job{cronJobs.length !== 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => fetchCronJobs()}
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
                display: 'flex', alignItems: 'center',
              }}
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => setShowEditor(true)}
              style={{
                background: 'var(--amber)',
                color: '#000',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 14px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Plus size={14} />
              Add Job
            </button>
          </div>
        </div>

        {cronJobs.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: 60, gap: 12,
          }}>
            <Clock size={40} style={{ color: 'var(--text-dim)', opacity: 0.4 }} />
            <span style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>
              No cron jobs configured
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cronJobs.map((job) => {
              const isHovered = hoveredRow === job.id;

              return (
                <div
                  key={job.id}
                  onMouseEnter={() => setHoveredRow(job.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 14px',
                    background: isHovered ? 'var(--surface-hover)' : 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    transition: 'var(--transition-fast)',
                    opacity: job.enabled ? 1 : 0.6,
                    flexWrap: isMobile ? 'wrap' : undefined,
                  }}
                >
                  {/* Enable toggle */}
                  <button
                    onClick={() => handleToggle(job)}
                    disabled={actionLoading === `toggle-${job.id}`}
                    title={job.enabled ? 'Disable' : 'Enable'}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 'var(--radius-sm)',
                      background: job.enabled ? '#10b98120' : 'var(--surface)',
                      border: `1px solid ${job.enabled ? '#10b98140' : 'var(--border)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'var(--transition-fast)',
                    }}
                  >
                    <Power size={13} style={{ color: job.enabled ? '#10b981' : 'var(--text-dim)' }} />
                  </button>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{
                        fontSize: '0.875rem', fontWeight: 500,
                        color: 'var(--text)', fontFamily: 'var(--font-sans)',
                      }}>
                        {job.name}
                      </span>
                      <span style={{
                        fontSize: '0.6875rem',
                        color: 'var(--text-dim)',
                        fontFamily: 'var(--font-mono)',
                        background: 'var(--surface)',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-sm)',
                      }}>
                        {job.schedule}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '0.75rem', color: 'var(--text-dim)',
                      fontFamily: 'var(--font-sans)', marginTop: 2,
                    }}>
                      {job.action_type === 'system_event' ? 'System Event' : 'Message'}
                      {' \u00b7 '}
                      Last: {timeAgo(job.last_run_at)}
                      {job.next_run_at && ` \u00b7 Next: ${new Date(job.next_run_at).toLocaleTimeString()}`}
                      {` \u00b7 ${job.run_count} runs`}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{
                    display: 'flex', gap: 4,
                    ...(isMobile ? { width: '100%', justifyContent: 'flex-end', marginTop: 4 } : {}),
                  }}>
                    <CronSmallButton
                      icon={Play}
                      label="Run"
                      onClick={() => handleRun(job)}
                      loading={actionLoading === `run-${job.id}`}
                    />
                    <CronSmallButton
                      icon={Trash2}
                      label="Delete"
                      onClick={() => handleDelete(job)}
                      loading={actionLoading === `delete-${job.id}`}
                      danger
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showEditor && (
        <CronJobEditor
          onClose={() => setShowEditor(false)}
          onCreated={() => {
            fetchCronJobs();
            setShowEditor(false);
          }}
        />
      )}
    </ScrollArea>
  );
}

function CronSmallButton({ icon: Icon, label, onClick, loading, danger }: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
  loading?: boolean;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const color = danger ? 'var(--error)' : 'var(--text-dim)';

  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={label}
      style={{
        background: hovered ? (danger ? '#f43f5e15' : 'var(--surface-hover)') : 'transparent',
        color,
        border: '1px solid transparent',
        borderRadius: 'var(--radius-sm)',
        padding: '4px 8px',
        fontSize: '0.75rem',
        cursor: loading ? 'wait' : 'pointer',
        transition: 'var(--transition-fast)',
        fontFamily: 'var(--font-sans)',
        display: 'flex', alignItems: 'center', gap: 4,
        opacity: loading ? 0.5 : 1,
      }}
    >
      <Icon size={12} />
      {!loading ? label : '...'}
    </button>
  );
}
