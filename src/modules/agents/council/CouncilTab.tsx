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
import { useMeetings } from './hooks/use-meetings';
import { MeetingArchive } from './MeetingArchive';
import { MeetingDetail } from './MeetingDetail';
import { NewMeetingModal } from './NewMeetingModal';
import type { ManagedAgent, Meeting } from '../types';

interface CouncilTabProps {
  agents: ManagedAgent[];
}

export function CouncilTab({ agents }: CouncilTabProps) {
  const { meetings, loading } = useMeetings();
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [archiveBtnHover, setArchiveBtnHover] = useState(false);
  const [newBtnHover, setNewBtnHover] = useState(false);

  const selectedMeeting = selectedMeetingId
    ? meetings.find(m => m.id === selectedMeetingId) ?? null
    : null;

  const handleCreated = (meeting: Meeting) => {
    setShowNewMeeting(false);
    setSelectedMeetingId(meeting.id);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--text-dim)',
        fontSize: '0.875rem',
      }}>
        Loading council meetings...
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
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        flexWrap: 'wrap' as const,
        gap: 8,
      }}>
        {/* Left: Title + subtitle */}
        <div>
          <h2 style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 700,
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span role="img" aria-label="council">🏛️</span>
            Council
          </h2>
          <p style={{
            margin: '4px 0 0',
            fontSize: '0.8125rem',
            color: 'var(--text-dim)',
          }}>
            Board meetings with your chief agents
          </p>
        </div>

        {/* Right: Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {selectedMeeting && (
            <button
              onClick={() => setSelectedMeetingId(null)}
              onMouseEnter={() => setArchiveBtnHover(true)}
              onMouseLeave={() => setArchiveBtnHover(false)}
              style={{
                background: archiveBtnHover ? 'var(--surface-hover)' : 'var(--surface)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 14px',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Meeting Archive
            </button>
          )}
          <button
            onClick={() => setShowNewMeeting(true)}
            onMouseEnter={() => setNewBtnHover(true)}
            onMouseLeave={() => setNewBtnHover(false)}
            style={{
              background: 'var(--amber)',
              color: '#000',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 14px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
              fontFamily: 'var(--font-sans)',
              opacity: newBtnHover ? 0.9 : 1,
            }}
          >
            + New Meeting
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {selectedMeeting ? (
          <MeetingDetail
            meeting={selectedMeeting}
            agents={agents}
            onBack={() => setSelectedMeetingId(null)}
          />
        ) : (
          <MeetingArchive
            meetings={meetings}
            onSelect={setSelectedMeetingId}
          />
        )}
      </div>

      {/* New Meeting Modal */}
      {showNewMeeting && (
        <NewMeetingModal
          open={showNewMeeting}
          agents={agents}
          onClose={() => setShowNewMeeting(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
