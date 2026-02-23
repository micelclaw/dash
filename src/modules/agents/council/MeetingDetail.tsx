import { useState } from 'react';
import { MeetingMessage } from './MeetingMessage';
import { ActionItems } from './ActionItems';
import type { Meeting, ManagedAgent } from '../types';

interface MeetingDetailProps {
  meeting: Meeting;
  agents: ManagedAgent[];
  onBack: () => void;
}

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

export function MeetingDetail({ meeting, agents, onBack }: MeetingDetailProps) {
  const [backHover, setBackHover] = useState(false);

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
    </div>
  );
}
