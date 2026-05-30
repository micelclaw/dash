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

// G8: Compaction checkpoints drawer. Opens from the History button in
// the chat toolbar; lists OpenClaw `sessions.compaction.list` entries
// for the active conversation. Each checkpoint exposes:
//   - Branch: creates a NEW conversation forked from that point
//   - Restore: rewrites the current session to the checkpoint state
//              (destructive — requires inline confirm)

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { X, GitBranch, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import type { Checkpoint } from '@/services/gateway.service';
import { describeError } from '@/lib/api-errors';
import { useChatStore } from '@/stores/chat.store';

interface CheckpointsPanelProps {
  conversationId: string;
  conversationTitle?: string;
  onClose: () => void;
}

export function CheckpointsPanel({ conversationId, conversationTitle, onClose }: CheckpointsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [confirmingRestoreId, setConfirmingRestoreId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const navigate = useNavigate();
  const streaming = useChatStore((s) => !!s.streamingMessage);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await gwService.listConversationCheckpoints(conversationId);
      setCheckpoints(list);
    } catch (err) {
      toast.error(describeError(err, 'Failed to load checkpoints'));
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleBranch = async (cp: Checkpoint) => {
    setBusyId(cp.id);
    try {
      const result = await gwService.branchFromCheckpoint(conversationId, cp.id);
      toast.success('Branched to new conversation');
      navigate(`/chat?conversation=${result.new_conversation_id}`);
      onClose();
    } catch (err) {
      toast.error(describeError(err, 'Branch failed'));
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (cp: Checkpoint) => {
    setBusyId(cp.id);
    try {
      await gwService.restoreToCheckpoint(conversationId, cp.id);
      toast.success('Conversation restored to checkpoint');
      // Reload messages of the active conv from server
      const { loadMessages } = useChatStore.getState();
      if (typeof loadMessages === 'function') {
        await loadMessages(conversationId);
      }
      onClose();
    } catch (err) {
      toast.error(describeError(err, 'Restore failed'));
    } finally {
      setBusyId(null);
      setConfirmingRestoreId(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, right: 0, bottom: 0,
        width: 420,
        maxWidth: '90vw',
        background: 'var(--card)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.3)',
        zIndex: 1000,
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <h2 style={{
            margin: 0, fontSize: '0.9375rem', fontWeight: 600,
            color: 'var(--text)', fontFamily: 'var(--font-display)',
          }}>
            Restore points
          </h2>
          {conversationTitle && (
            <p style={{
              margin: '2px 0 0 0', fontSize: '0.75rem',
              color: 'var(--text-dim)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              maxWidth: 360,
            }}>
              {conversationTitle}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: 6, borderRadius: 'var(--radius-sm)',
            color: 'var(--text-dim)',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-dim)' }} />
          </div>
        )}

        {!loading && checkpoints.length === 0 && (
          <div style={{
            padding: '24px 16px',
            textAlign: 'center',
            color: 'var(--text-dim)',
            fontSize: '0.8125rem',
            lineHeight: 1.6,
          }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: 500 }}>No checkpoints yet</p>
            <p style={{ margin: 0, fontSize: '0.75rem' }}>
              Compaction triggers automatically when the context fills up.
              Force one with <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>/compact</code>.
            </p>
          </div>
        )}

        {!loading && checkpoints.map((cp) => {
          const confirming = confirmingRestoreId === cp.id;
          const busy = busyId === cp.id;
          const tsLabel = cp.ts ? new Date(cp.ts).toLocaleString() : '?';
          const before = cp.tokens_before != null ? fmtTokens(cp.tokens_before) : '?';
          const after = cp.tokens_after != null ? fmtTokens(cp.tokens_after) : '?';
          return (
            <div
              key={cp.id}
              style={{
                padding: 12,
                marginBottom: 10,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.75rem',
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 6, gap: 8,
              }}>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
                  {cp.id.slice(0, 8)}
                </code>
                <span style={{
                  fontSize: '0.6875rem', padding: '1px 6px',
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text-dim)',
                }}>
                  {cp.trigger ?? 'auto'}
                </span>
              </div>
              <div style={{ color: 'var(--text)', marginBottom: 4 }}>{tsLabel}</div>
              <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', marginBottom: 8 }}>
                {before} → {after} tokens
                {cp.model && <span style={{ marginLeft: 8 }}>· {cp.model}</span>}
              </div>
              {cp.summary_excerpt && (
                <p style={{
                  margin: '0 0 10px 0',
                  fontSize: '0.6875rem',
                  color: 'var(--text-dim)',
                  fontStyle: 'italic',
                  lineHeight: 1.4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}>
                  "{cp.summary_excerpt.slice(0, 140)}"
                </p>
              )}

              {!confirming && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleBranch(cp)}
                    disabled={busy}
                    style={actionButtonStyle('var(--amber)', 'var(--amber-dim)')}
                  >
                    {busy ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <GitBranch size={12} />}
                    Branch
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingRestoreId(cp.id)}
                    disabled={busy || streaming}
                    title={streaming ? 'Stop the current stream first' : undefined}
                    style={actionButtonStyle('var(--red)', '#7f1d1d33')}
                  >
                    <RotateCcw size={12} />
                    Restore
                  </button>
                </div>
              )}

              {confirming && (
                <div style={{
                  padding: 8,
                  background: '#7f1d1d22',
                  border: '1px solid #7f1d1d55',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.6875rem', color: 'var(--text)' }}>
                    This rewrites the session and discards everything after this checkpoint. Not undoable.
                  </p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setConfirmingRestoreId(null)}
                      style={actionButtonStyle('var(--text-dim)', 'transparent')}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestore(cp)}
                      disabled={busy}
                      style={actionButtonStyle('var(--red)', '#7f1d1d55')}
                    >
                      {busy && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                      Confirm restore
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function actionButtonStyle(color: string, bg: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '4px 10px',
    fontSize: '0.6875rem',
    background: bg,
    color,
    border: bg === 'transparent' ? '1px solid var(--border)' : '1px solid transparent',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
  };
}

function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
