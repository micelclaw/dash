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

import { useState } from 'react';
import { Play, Square, Trash2, Archive, ArchiveRestore, Loader2 } from 'lucide-react';
import { MeetingMessage } from './MeetingMessage';
import { ActionItems } from './ActionItems';
import type { Meeting, ManagedAgent } from '../types';

interface MeetingDetailProps {
  meeting: Meeting;
  agents: ManagedAgent[];
  onBack: () => void;
  onStart?: () => Promise<unknown>;
  onEnd?: () => Promise<unknown>;
  onArchive?: () => Promise<unknown>;
  onUnarchive?: () => Promise<unknown>;
  onDelete?: () => Promise<unknown>;
}

type ControlAction = 'start' | 'end' | 'archive' | 'unarchive' | 'delete';

function formatMeetingDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) + ' \u2014 ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function MeetingDetail({
  meeting, agents, onBack,
  onStart, onEnd, onArchive, onUnarchive, onDelete,
}: MeetingDetailProps) {
  const [backHover, setBackHover] = useState(false);
  const [busyAction, setBusyAction] = useState<ControlAction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const runAction = async (kind: ControlAction, fn?: () => Promise<unknown>) => {
    if (!fn) return;
    setBusyAction(kind);
    try { await fn(); } finally { setBusyAction(null); }
  };

  const dateStr = meeting.started_at ?? meeting.scheduled_at ?? meeting.created_at;

  // Build unique participant info from messages + agents list
  const participantMap = new Map<string, { name: string; avatar: string; color: string }>();
  for (const msg of meeting.messages) {
    if (!participantMap.has(msg.agent_id)) {
      participantMap.set(msg.agent_id, {
        name: msg.agent_name,
        avatar: msg.agent_avatar,
        color: msg.agent_color,
      });
    }
  }
  // Also include participants from the agents list if they match meeting.participants
  for (const agentId of meeting.participants) {
    if (!participantMap.has(agentId)) {
      const agent = agents.find(a => a.id === agentId || a.name === agentId);
      if (agent) {
        participantMap.set(agentId, {
          name: agent.display_name,
          avatar: agent.avatar ?? '🤖',
          color: agent.color,
        });
      }
    }
  }
  const participants = Array.from(participantMap.values());

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Scrollable content area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
      }}>
        {/* Back button */}
        <button
          onClick={onBack}
          onMouseEnter={() => setBackHover(true)}
          onMouseLeave={() => setBackHover(false)}
          style={{
            background: 'none',
            border: 'none',
            color: backHover ? 'var(--text)' : 'var(--text-dim)',
            fontSize: '0.8125rem',
            cursor: 'pointer',
            padding: '4px 0',
            marginBottom: 16,
            fontFamily: 'var(--font-sans)',
            transition: 'var(--transition-fast)',
          }}
        >
          &larr; Back to Archive
        </button>

        {/* Meeting header card */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '20px 24px',
          marginBottom: 24,
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 6,
          }}>
            {meeting.title}
          </h2>

          {meeting.description && (
            <p style={{
              margin: '0 0 10px',
              fontSize: '0.875rem',
              color: 'var(--text-dim)',
              lineHeight: 1.5,
            }}>
              {meeting.description}
            </p>
          )}

          <div style={{
            fontSize: '0.8125rem',
            color: 'var(--text-dim)',
            marginBottom: 12,
          }}>
            {formatMeetingDate(dateStr)}
          </div>

          {/* Controls (start/end/archive/delete) */}
          <MeetingControls
            status={meeting.status}
            busy={busyAction}
            onStart={() => runAction('start', onStart)}
            onEnd={() => runAction('end', onEnd)}
            onArchive={() => runAction('archive', onArchive)}
            onUnarchive={() => runAction('unarchive', onUnarchive)}
            onRequestDelete={() => setConfirmDelete(true)}
          />

          {/* Participant chips */}
          {participants.length > 0 && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
            }}>
              {participants.map((p, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: p.color,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-full)',
                    padding: '2px 10px 2px 6px',
                  }}
                >
                  <span>{p.avatar}</span>
                  {p.name}
                </span>
              ))}
              {meeting.user_participates && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'var(--amber)',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-full)',
                    padding: '2px 10px 2px 6px',
                  }}
                >
                  <span>👤</span>
                  You
                </span>
              )}
            </div>
          )}
        </div>

        {/* Messages list */}
        {meeting.messages.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginBottom: 24,
          }}>
            {meeting.messages.map(msg => (
              <MeetingMessage key={msg.id} message={msg} />
            ))}
          </div>
        )}

        {meeting.messages.length === 0 && (
          <div style={{
            padding: 24,
            textAlign: 'center',
            color: 'var(--text-dim)',
            fontSize: '0.875rem',
          }}>
            No messages in this meeting yet.
          </div>
        )}

        {/* Action Items section */}
        {meeting.action_items.length > 0 && (
          <ActionItems items={meeting.action_items} />
        )}
      </div>

      {confirmDelete && (
        <div
          onClick={() => busyAction !== 'delete' && setConfirmDelete(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: 24,
              maxWidth: 420, width: '90vw', fontFamily: 'var(--font-sans)',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
              {meeting.status === 'scheduled' ? `Cancel "${meeting.title}"?` : `Delete "${meeting.title}"?`}
            </h3>
            <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              The meeting will be soft-deleted. Action items and message history are preserved in the database but hidden from the UI.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={busyAction === 'delete'}
                style={{
                  padding: '8px 16px', borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
                  cursor: busyAction === 'delete' ? 'not-allowed' : 'pointer',
                  border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)',
                }}
              >
                Keep
              </button>
              <button
                onClick={async () => {
                  setConfirmDelete(false);
                  await runAction('delete', onDelete);
                }}
                disabled={busyAction === 'delete'}
                style={{
                  padding: '8px 16px', borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
                  cursor: busyAction === 'delete' ? 'not-allowed' : 'pointer',
                  border: 'none', background: 'var(--error)', color: '#fff', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {busyAction === 'delete' && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                {meeting.status === 'scheduled' ? 'Cancel meeting' : 'Delete meeting'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MeetingControls({
  status, busy,
  onStart, onEnd, onArchive, onUnarchive, onRequestDelete,
}: {
  status: Meeting['status'];
  busy: ControlAction | null;
  onStart: () => void;
  onEnd: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onRequestDelete: () => void;
}) {
  const baseBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: '0.8125rem', fontWeight: 500,
    padding: '6px 12px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
    transition: 'var(--transition-fast)',
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 12 }}>
      {status === 'scheduled' && (
        <button
          onClick={onStart}
          disabled={busy !== null}
          style={{
            ...baseBtn,
            background: 'var(--success)', border: '1px solid var(--success)', color: '#fff', fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy === 'start' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={13} fill="currentColor" />}
          Start now
        </button>
      )}
      {status === 'in_progress' && (
        <button
          onClick={onEnd}
          disabled={busy !== null}
          style={{
            ...baseBtn,
            background: 'var(--amber-dim)', border: '1px solid var(--amber)', color: 'var(--amber)', fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy === 'end' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Square size={13} fill="currentColor" />}
          End meeting
        </button>
      )}
      {status === 'completed' && (
        <button
          onClick={onArchive}
          disabled={busy !== null}
          title="Move this meeting to the archived list"
          style={{ ...baseBtn, cursor: busy ? 'wait' : 'pointer' }}
        >
          {busy === 'archive' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Archive size={13} />}
          Archive
        </button>
      )}
      {status === 'archived' && (
        <button
          onClick={onUnarchive}
          disabled={busy !== null}
          title="Restore this meeting to the active list"
          style={{ ...baseBtn, cursor: busy ? 'wait' : 'pointer' }}
        >
          {busy === 'unarchive' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <ArchiveRestore size={13} />}
          Unarchive
        </button>
      )}
      {/* Delete is always available — varies the label only for scheduled */}
      <button
        onClick={onRequestDelete}
        disabled={busy !== null}
        style={{
          ...baseBtn,
          border: '1px solid var(--error)', color: 'var(--error)',
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {busy === 'delete' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />}
        {status === 'scheduled' ? 'Cancel meeting' : 'Delete'}
      </button>
    </div>
  );
}
