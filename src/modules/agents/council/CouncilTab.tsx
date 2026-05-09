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

import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMeetings } from './hooks/use-meetings';
import { useWebSocket } from '@/hooks/use-websocket';
import { MeetingArchive } from './MeetingArchive';
import { MeetingDetail } from './MeetingDetail';
import { NewMeetingModal } from './NewMeetingModal';
import type { ManagedAgent, Meeting, ActionItem } from '../types';

interface CouncilTabProps {
  agents: ManagedAgent[];
}

type PendingItemRow = ActionItem & {
  meeting_id: string;
  meeting_title: string;
  meeting_completed_at: string | null;
};

export function CouncilTab({ agents }: CouncilTabProps) {
  const {
    meetings, loading,
    runMeeting, endMeeting,
    archiveMeeting, unarchiveMeeting, resetMeeting, deleteMeeting,
    updateActionItemStatus, fetchPendingItemsForName,
  } = useMeetings();
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [archiveBtnHover, setArchiveBtnHover] = useState(false);
  const [newBtnHover, setNewBtnHover] = useState(false);
  const [pendingUserItems, setPendingUserItems] = useState<PendingItemRow[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Load global pending items assigned to "user" on mount + whenever the
  // meetings list changes (e.g. after a meeting completes or an item is
  // toggled). Cheap query.
  const refreshPending = useCallback(async () => {
    setLoadingPending(true);
    const items = await fetchPendingItemsForName('user');
    setPendingUserItems(items);
    setLoadingPending(false);
  }, [fetchPendingItemsForName]);

  useEffect(() => { void refreshPending(); }, [refreshPending, meetings.length]);

  // Toast on `meeting.completed` with per-agent counts so the user knows
  // how the work is split. Counts come from itemCounts: { atlas: 2, user: 1 }.
  const completedEv = useWebSocket('meeting.completed');
  useEffect(() => {
    if (!completedEv) return;
    const data = completedEv.data as { meeting_id?: string; item_counts?: Record<string, number> } | undefined;
    if (!data?.meeting_id) return;
    const counts = data.item_counts ?? {};
    const m = meetings.find(x => x.id === data.meeting_id);
    const title = m?.title ?? 'Council';
    const parts = Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([name, n]) => `${n} para ${name === 'user' ? 'ti' : name}`);
    if (parts.length === 0) {
      toast.success(`Council "${title}" completado.`);
    } else {
      toast.success(`Council "${title}" completado. ${parts.join(', ')}.`);
    }
    void refreshPending();
  }, [completedEv, meetings, refreshPending]);

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

      {/* Global "My pending items" panel — only when no meeting is selected */}
      {!selectedMeeting && pendingUserItems.length > 0 && (
        <div style={{
          margin: '12px 16px 0',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderLeft: '3px solid var(--amber)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
              My pending items
              <span style={{ marginLeft: 8, fontSize: '0.75rem', fontWeight: 500, color: 'var(--amber)' }}>
                {pendingUserItems.length}
              </span>
            </h3>
            {loadingPending && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {pendingUserItems.slice(0, 5).map(item => (
              <button
                key={`${item.meeting_id}-${item.id}`}
                onClick={() => setSelectedMeetingId(item.meeting_id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-sans)',
                  width: '100%',
                  transition: 'var(--transition-fast)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', minWidth: 14 }}>⏳</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text)', flex: 1, lineHeight: 1.3 }}>
                  {item.title}
                </span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  {item.meeting_title}
                </span>
                <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
              </button>
            ))}
            {pendingUserItems.length > 5 && (
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', padding: '4px 8px' }}>
                +{pendingUserItems.length - 5} more in completed councils.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {selectedMeeting ? (
          <MeetingDetail
            meeting={selectedMeeting}
            agents={agents}
            onBack={() => setSelectedMeetingId(null)}
            onStart={() => runMeeting(selectedMeeting.id)}
            onEnd={() => endMeeting(selectedMeeting.id)}
            onArchive={() => archiveMeeting(selectedMeeting.id)}
            onUnarchive={() => unarchiveMeeting(selectedMeeting.id)}
            onReset={() => resetMeeting(selectedMeeting.id)}
            onCycleItemStatus={(itemId, newStatus) => {
              void updateActionItemStatus(selectedMeeting.id, itemId, newStatus).then(() => refreshPending());
            }}
            onDelete={async () => {
              const ok = await deleteMeeting(selectedMeeting.id);
              if (ok) setSelectedMeetingId(null);
            }}
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
