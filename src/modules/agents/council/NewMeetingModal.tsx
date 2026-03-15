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

import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { useMeetings } from './hooks/use-meetings';
import type { ManagedAgent, Meeting } from '../types';

interface NewMeetingModalProps {
  open: boolean;
  agents: ManagedAgent[];
  onClose: () => void;
  onCreated: (meeting: Meeting) => void;
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  padding: '8px 12px',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.875rem',
  fontFamily: 'var(--font-sans)',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: 6,
  display: 'block',
};

export function NewMeetingModal({ open, agents, onClose, onCreated }: NewMeetingModalProps) {
  const { createMeeting } = useMeetings();
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(() => {
    // Francis (first chief) always selected by default
    const chiefs = agents.filter(a => a.is_chief);
    const francis = chiefs.find(a => a.name.toLowerCase() === 'francis');
    return new Set(francis ? [francis.id] : chiefs.length > 0 ? [chiefs[0]!.id] : []);
  });
  const [userParticipates, setUserParticipates] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  const [cancelHover, setCancelHover] = useState(false);
  const [startHover, setStartHover] = useState(false);

  // Find the "Francis" agent (always checked + disabled)
  const francisAgent = useMemo(
    () => agents.find(a => a.name.toLowerCase() === 'francis'),
    [agents]
  );

  const toggleParticipant = (agentId: string) => {
    setSelectedParticipants(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

  const canSubmit = topic.trim().length > 0 && selectedParticipants.size > 0 &&
    (scheduleMode === 'now' || (scheduleDate && scheduleTime));

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    let scheduledAt: string | null = null;
    if (scheduleMode === 'later' && scheduleDate && scheduleTime) {
      scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    }

    const meeting = await createMeeting({
      title: topic.trim(),
      description: description.trim() || undefined,
      participants: Array.from(selectedParticipants),
      user_participates: userParticipates,
      scheduled_at: scheduledAt,
    });

    setSubmitting(false);
    if (meeting) {
      onCreated(meeting);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        zIndex: 'var(--z-modal)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      } as React.CSSProperties}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          maxWidth: 540,
          width: '92vw',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 600,
            color: 'var(--text)',
          }}>
            Schedule Council Meeting
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Topic */}
        <div>
          <label style={labelStyle}>
            Topic <span style={{ color: 'var(--error)' }}>*</span>
          </label>
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="e.g. Q1 Strategy Review"
            style={inputStyle}
          />
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional meeting description..."
            rows={3}
            style={{
              ...inputStyle,
              resize: 'vertical',
              minHeight: 60,
            }}
          />
        </div>

        {/* Participants */}
        <div>
          <label style={labelStyle}>Participants</label>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}>
            {agents.map(agent => {
              const isFrancis = francisAgent && agent.id === francisAgent.id;
              const isChecked = selectedParticipants.has(agent.id);
              return (
                <label
                  key={agent.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: '0.875rem',
                    cursor: isFrancis ? 'default' : 'pointer',
                    color: 'var(--text)',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: isChecked ? 'var(--surface-hover)' : 'transparent',
                    transition: 'var(--transition-fast)',
                    opacity: isFrancis ? 0.8 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isFrancis}
                    onChange={() => !isFrancis && toggleParticipant(agent.id)}
                    style={{ accentColor: 'var(--amber)' }}
                  />
                  <span>{agent.avatar ?? '🤖'}</span>
                  <span style={{ color: agent.color, fontWeight: 500 }}>
                    {agent.display_name}
                  </span>
                  <span style={{
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                  }}>
                    {agent.role}
                  </span>
                  {isFrancis && (
                    <span style={{
                      fontSize: '0.6875rem',
                      color: 'var(--text-muted)',
                      fontStyle: 'italic',
                    }}>
                      (always included)
                    </span>
                  )}
                </label>
              );
            })}

            {/* User (Paco) checkbox */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.875rem',
                cursor: 'pointer',
                color: 'var(--text)',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                background: userParticipates ? 'var(--surface-hover)' : 'transparent',
                transition: 'var(--transition-fast)',
                borderTop: '1px solid var(--border)',
                marginTop: 4,
                paddingTop: 8,
              }}
            >
              <input
                type="checkbox"
                checked={userParticipates}
                onChange={e => setUserParticipates(e.target.checked)}
                style={{ accentColor: 'var(--amber)' }}
              />
              <span>👤</span>
              <span style={{ color: 'var(--amber)', fontWeight: 500 }}>
                Paco (You)
              </span>
              <span style={{
                fontSize: '0.6875rem',
                color: 'var(--text-muted)',
              }}>
                Participate in meeting
              </span>
            </label>
          </div>
        </div>

        {/* Schedule */}
        <div>
          <label style={labelStyle}>Schedule</label>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.875rem',
                cursor: 'pointer',
                color: 'var(--text)',
                padding: '4px 0',
              }}
            >
              <input
                type="radio"
                name="schedule"
                checked={scheduleMode === 'now'}
                onChange={() => setScheduleMode('now')}
                style={{ accentColor: 'var(--amber)' }}
              />
              Start now
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.875rem',
                cursor: 'pointer',
                color: 'var(--text)',
                padding: '4px 0',
              }}
            >
              <input
                type="radio"
                name="schedule"
                checked={scheduleMode === 'later'}
                onChange={() => setScheduleMode('later')}
                style={{ accentColor: 'var(--amber)' }}
              />
              Schedule for:
            </label>
            {scheduleMode === 'later' && (
              <div style={{
                display: 'flex',
                gap: 8,
                marginLeft: 24,
              }}>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                  style={{ ...inputStyle, width: 'auto', flex: 1 }}
                />
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                  style={{ ...inputStyle, width: 'auto', flex: 1 }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 10,
          borderTop: '1px solid var(--border)',
          paddingTop: 16,
        }}>
          <button
            onClick={onClose}
            onMouseEnter={() => setCancelHover(true)}
            onMouseLeave={() => setCancelHover(false)}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: cancelHover ? 'var(--text)' : 'var(--text-dim)',
              padding: '8px 16px',
              fontSize: '0.875rem',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              transition: 'var(--transition-fast)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            onMouseEnter={() => setStartHover(true)}
            onMouseLeave={() => setStartHover(false)}
            style={{
              background: canSubmit && !submitting
                ? (startHover ? 'var(--amber-dim)' : 'var(--amber)')
                : 'var(--amber)',
              color: '#000',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 20px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-sans)',
              transition: 'var(--transition-fast)',
              opacity: canSubmit && !submitting ? 1 : 0.5,
            }}
          >
            {submitting ? 'Starting...' : scheduleMode === 'now' ? 'Start Meeting' : 'Schedule Meeting'}
          </button>
        </div>
      </div>
    </div>
  );
}
