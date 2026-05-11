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

// ─── QuestionCardsPanel — interactive question loop ────────────────
//
// Renders the LLM's pending_questions array as cards with radio
// (closed-option) or textarea (free-text) inputs. The user fills them
// in and clicks "Regenerar con respuestas" to submit. Used by all three
// doc-generation phases (concept / frontend / foundation).

import { useState } from 'react';
import { MessageCircleQuestion, RefreshCw, Loader2, MessageSquare } from 'lucide-react';
import type { StudioPendingQuestion } from '@/stores/studio.store';

// Reserved id matching the FREE_COMMENT_ID constant in
// `core/src/studio/llm/structured-output.ts`. The free-text comment
// box at the bottom of the panel always uses this id, regardless of
// whether the model emitted any structured questions on this turn.
const FREE_COMMENT_ID = '_user_comment';

interface Props {
  questions: StudioPendingQuestion[];
  /** Free-form text the model wrote outside the structured blocks on
   *  the previous turn. Rendered as a "Studio Builder says:" message
   *  above the question cards so the user can see quick replies that
   *  the model emitted alongside (or instead of) a doc rewrite. */
  preamble?: string | null;
  busy: boolean;
  onSubmit: (answers: Record<string, string>) => void;
}

export function QuestionCardsPanel({ questions, preamble, busy, onSubmit }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // The panel ALWAYS renders, even when there are no structured
  // questions, because the free-comment box gives the user a way to
  // refine the document at any point in the conversation.

  const answeredCount = questions.filter((q) => answers[q.id]?.trim()).length;
  const hasFreeComment = (answers[FREE_COMMENT_ID] ?? '').trim().length > 0;
  const canSubmit = answeredCount > 0 || hasFreeComment;

  function handleSubmit() {
    const trimmed: Record<string, string> = {};
    for (const [k, v] of Object.entries(answers)) {
      if (v.trim()) trimmed[k] = v.trim();
    }
    onSubmit(trimmed);
  }

  return (
    <div style={{
      padding: 16,
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        paddingBottom: 8, borderBottom: '1px solid var(--border)',
      }}>
        <MessageCircleQuestion size={16} style={{ color: 'var(--amber)' }} />
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0, color: 'var(--text)' }}>
          {questions.length > 0 ? 'Pending questions' : 'Iterate on the document'}
        </h3>
        {questions.length > 0 && (
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            {answeredCount}/{questions.length} answered
          </span>
        )}
      </div>

      {preamble && preamble.trim().length > 0 && (
        <div style={{
          display: 'flex', gap: 8,
          padding: '10px 12px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderLeft: '2px solid var(--amber)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.75rem',
          color: 'var(--text)',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
        }}>
          <MessageSquare size={12} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 3 }} />
          <div>
            <div style={{
              fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em',
              color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4,
            }}>
              Studio Builder says
            </div>
            {preamble.trim()}
          </div>
        </div>
      )}

      {questions.map((q, idx) => (
        <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{
            fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)',
            lineHeight: 1.5,
          }}>
            <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>{idx + 1}.</span>
            {q.question}
          </label>
          {q.rationale && (
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
              {q.rationale}
            </div>
          )}

          {q.options && q.options.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {q.options.map((opt) => {
                // For multi-select questions the answer is stored as a
                // comma-joined string of picks, so we can keep the
                // Record<string, string> contract end-to-end. Single-
                // select questions stay as before (one option string).
                const isSelected = q.multi
                  ? splitMulti(answers[q.id]).includes(opt)
                  : answers[q.id] === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setAnswers((a) => {
                        if (!q.multi) return { ...a, [q.id]: opt };
                        const current = splitMulti(a[q.id]);
                        const next = current.includes(opt)
                          ? current.filter((x) => x !== opt)
                          : [...current, opt];
                        return { ...a, [q.id]: next.join(', ') };
                      });
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', textAlign: 'left',
                      background: isSelected ? 'var(--card-hover)' : 'transparent',
                      border: `1px solid ${isSelected ? 'var(--amber)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text)', fontSize: '0.75rem',
                      cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {q.multi ? (
                      // Square checkbox for multi-select
                      <span style={{
                        width: 12, height: 12, borderRadius: 2,
                        border: `1.5px solid ${isSelected ? 'var(--amber)' : 'var(--border)'}`,
                        background: isSelected ? 'var(--amber)' : 'transparent',
                        flexShrink: 0, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        color: '#000', fontSize: 9, fontWeight: 700,
                      }}>{isSelected ? '✓' : ''}</span>
                    ) : (
                      // Round radio for single-select
                      <span style={{
                        width: 12, height: 12, borderRadius: '50%',
                        border: `1.5px solid ${isSelected ? 'var(--amber)' : 'var(--border)'}`,
                        background: isSelected ? 'var(--amber)' : 'transparent',
                        flexShrink: 0,
                      }} />
                    )}
                    {opt}
                  </button>
                );
              })}
              {q.multi && (
                <span style={{
                  fontSize: '0.625rem', color: 'var(--text-muted)',
                  fontStyle: 'italic', marginTop: 2,
                }}>
                  You can pick several.
                </span>
              )}
            </div>
          ) : (
            <textarea
              value={answers[q.id] ?? ''}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              placeholder="Type your answer…"
              rows={2}
              style={{
                padding: 8, fontSize: '0.75rem', background: 'var(--surface)',
                color: 'var(--text)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', resize: 'vertical',
                fontFamily: 'var(--font-sans)',
              }}
            />
          )}
        </div>
      ))}

      {/* Free-text comment box — always visible. The user can refine
          the document at any point in the conversation by writing here.
          Submitted alongside (or instead of) per-question answers. */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        paddingTop: questions.length > 0 ? 8 : 0,
        borderTop: questions.length > 0 ? '1px dashed var(--border)' : 'none',
      }}>
        <label style={{
          fontSize: '0.75rem', fontWeight: 500, color: 'var(--text)',
        }}>
          {questions.length > 0
            ? 'Anything else to add or clarify? (optional)'
            : 'Want to request a change or clarify something? (optional)'}
        </label>
        <textarea
          value={answers[FREE_COMMENT_ID] ?? ''}
          onChange={(e) => setAnswers((a) => ({ ...a, [FREE_COMMENT_ID]: e.target.value }))}
          placeholder={
            questions.length > 0
              ? 'Extra details, corrections, context…'
              : 'For example: "change the title to X" or "add a section about Y"…'
          }
          rows={3}
          style={{
            padding: 8, fontSize: '0.75rem', background: 'var(--surface)',
            color: 'var(--text)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', resize: 'vertical',
            fontFamily: 'var(--font-sans)',
          }}
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={busy || !canSubmit}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '8px 14px',
          background: !canSubmit ? 'var(--surface)' : 'var(--amber)',
          color: !canSubmit ? 'var(--text-dim)' : '#000',
          border: 'none', borderRadius: 'var(--radius-md)',
          fontSize: '0.75rem', fontWeight: 600,
          cursor: busy ? 'wait' : (!canSubmit ? 'not-allowed' : 'pointer'),
          fontFamily: 'var(--font-sans)', marginTop: 4,
        }}
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        Send to chat
      </button>
    </div>
  );
}

// Multi-select picks live in the same Record<string, string> map as
// every other answer — joined by ", " — so the wire format and the
// downstream `renderAnswersBlock` helper need no changes. This is the
// only place that has to know about that encoding.
function splitMulti(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}
