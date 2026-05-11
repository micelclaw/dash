/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import { useGatewayStore } from '@/stores/gateway.store';
import { api } from '@/services/api';

interface CronJobEditorProps {
  onClose: () => void;
  onCreated: () => void;
}

interface AgentSummary {
  id: string;
  name: string;
  display_name: string;
}

export function CronJobEditor({ onClose, onCreated }: CronJobEditorProps) {
  const channels = useGatewayStore(s => s.channels);
  const fetchChannels = useGatewayStore(s => s.fetchChannels);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [name, setName] = useState('');
  const [scheduleType, setScheduleType] = useState<'at' | 'every' | 'cron'>('every');
  const [schedule, setSchedule] = useState('1h');
  const [actionType, setActionType] = useState<'system-event' | 'message'>('system-event');
  const [payload, setPayload] = useState('');
  const [target, setTarget] = useState('');
  const [channel, setChannel] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (channels.length === 0) fetchChannels();
    api.get<{ data: AgentSummary[] }>('/managed-agents')
      .then(r => setAgents(r.data ?? []))
      .catch(() => { /* silent — agents lookup is hint-only */ });
  }, [channels.length, fetchChannels]);

  const knownChannels = useMemo(() => channels.map(c => c.type), [channels]);
  const channelKnown = !channel || knownChannels.includes(channel);
  const targetIsAgent = target && agents.some(a => a.name === target || a.id === target || a.display_name === target);

  const handleSubmit = async () => {
    if (!name || !schedule || !payload) {
      toast.error('Name, schedule, and payload are required');
      return;
    }

    setLoading(true);
    try {
      await gwService.addCronJob({
        name,
        schedule,
        schedule_type: scheduleType,
        action: actionType,
        payload,
        target: target || undefined,
        channel: channel || undefined,
      });
      toast.success(`Cron job "${name}" created`);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 12px',
    fontSize: '0.875rem',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    width: '100%',
  } as const;

  const labelStyle = {
    fontSize: '0.75rem',
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-sans)',
  } as const;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: 480,
          padding: 24,
          margin: 16,
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <h2 style={{
            fontSize: '1rem', fontWeight: 600, color: 'var(--text)',
            margin: 0, fontFamily: 'var(--font-sans)',
          }}>
            Add Cron Job
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)', padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-daily-job" style={inputStyle} />
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '0 0 120px' }}>
              <span style={labelStyle}>Schedule Type</span>
              <select
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value as 'at' | 'every' | 'cron')}
                style={{ ...inputStyle, fontFamily: 'var(--font-sans)' }}
              >
                <option value="every">Every</option>
                <option value="at">At</option>
                <option value="cron">Cron</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <span style={labelStyle}>
                {scheduleType === 'every' ? 'Interval (e.g. 1h, 30m)' : scheduleType === 'at' ? 'Time (e.g. 09:00)' : 'Cron Expression'}
              </span>
              <input
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder={scheduleType === 'every' ? '1h' : scheduleType === 'at' ? '09:00' : '0 9 * * 1'}
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
              />
            </label>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>Action Type</span>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value as 'system-event' | 'message')}
              style={{ ...inputStyle, fontFamily: 'var(--font-sans)' }}
            >
              <option value="system-event">System Event</option>
              <option value="message">Message</option>
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>
              {actionType === 'system-event' ? 'Event Text' : 'Message'}
            </span>
            <textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              placeholder={actionType === 'system-event' ? 'Check disk space and report' : 'Hello, daily reminder!'}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </label>

          {actionType === 'message' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <span style={labelStyle}>Target (optional)</span>
                <input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="Agent name or contact/group ID"
                  list="cron-target-suggestions"
                  style={inputStyle}
                />
                <datalist id="cron-target-suggestions">
                  {agents.map(a => (
                    <option key={a.id} value={a.name}>{a.display_name}</option>
                  ))}
                </datalist>
                {target && !targetIsAgent && (
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    Free-form ID — make sure it matches a real contact or group.
                  </span>
                )}
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <span style={labelStyle}>Channel (optional)</span>
                <select
                  value={channelKnown ? channel : '__custom__'}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') return;
                    setChannel(e.target.value);
                  }}
                  style={{ ...inputStyle, fontFamily: 'var(--font-sans)' }}
                >
                  <option value="">(none)</option>
                  {channels.map(c => (
                    <option key={c.type} value={c.type}>
                      {c.type}{c.status !== 'connected' ? ` (${c.status})` : ''}
                    </option>
                  ))}
                  {!channelKnown && <option value="__custom__">{channel} (not configured)</option>}
                </select>
                {!channelKnown && channel && (
                  <span style={{ fontSize: '0.6875rem', color: '#f97316' }}>
                    Channel "{channel}" is not configured.
                  </span>
                )}
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          marginTop: 20,
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: 'var(--text-dim)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 16px',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              background: 'var(--amber)',
              color: '#000',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 16px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              fontFamily: 'var(--font-sans)',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Creating...' : 'Create Job'}
          </button>
        </div>
      </div>
    </div>
  );
}
