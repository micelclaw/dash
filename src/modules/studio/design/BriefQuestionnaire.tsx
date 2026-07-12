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

// ─── Design brief questionnaire (Claude-Design-style) ────────────────
//
// Pure presentational component: ALL questions render at once on a
// single scrollable page (no step wizard). Every answer is optional —
// an unanswered question means "decide for me". The parent owns the
// answers record and the submit button.

import type { DesignBriefQuestion } from './design.service';

interface BriefQuestionnaireProps {
  questions: DesignBriefQuestion[];
  answers: Record<string, string>;
  onChange: (answers: Record<string, string>) => void;
  disabled?: boolean;
}

export function BriefQuestionnaire({ questions, answers, onChange, disabled }: BriefQuestionnaireProps) {
  const pickSingle = (id: string, option: string) => {
    if (answers[id] === option) {
      // Clicking the active chip deselects it → "decide for me".
      const next = { ...answers };
      delete next[id];
      onChange(next);
    } else {
      onChange({ ...answers, [id]: option });
    }
  };

  const toggleMulti = (id: string, option: string) => {
    const current = splitMulti(answers[id]);
    const picks = current.includes(option)
      ? current.filter((x) => x !== option)
      : [...current, option];
    if (picks.length === 0) {
      const next = { ...answers };
      delete next[id];
      onChange(next);
    } else {
      onChange({ ...answers, [id]: picks.join(', ') });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: 'var(--font-sans)' }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        Every question is optional — skip anything and I'll decide.
      </span>

      {questions.map((q) => (
        <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
            {q.question}
          </span>
          {q.rationale && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.4 }}>
              {q.rationale}
            </span>
          )}
          {(q.options ?? []).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(q.options ?? []).map((opt, oi) => {
                const active = q.multi
                  ? splitMulti(answers[q.id]).includes(opt)
                  : answers[q.id] === opt;
                return (
                  <button
                    key={`${q.id}:${oi}:${opt}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => (q.multi ? toggleMulti(q.id, opt) : pickSingle(q.id, opt))}
                    style={{
                      ...chip(active),
                      ...(q.multi ? { display: 'inline-flex', alignItems: 'center', gap: 7 } : {}),
                      ...(disabled ? { opacity: 0.55, cursor: 'default' } : {}),
                    }}
                  >
                    {q.multi && (
                      // Square checkbox marks multi-select chips apart
                      // from the single-pick pills.
                      <span style={{
                        width: 11, height: 11, borderRadius: 2,
                        border: `1.5px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
                        background: active ? 'var(--amber)' : 'transparent',
                        flexShrink: 0, display: 'inline-flex',
                        alignItems: 'center', justifyContent: 'center',
                        color: '#000', fontSize: 8, fontWeight: 700, lineHeight: 1,
                      }}>{active ? '✓' : ''}</span>
                    )}
                    {opt}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const chip = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px', fontSize: '0.75rem', fontWeight: active ? 700 : 500,
  background: active ? 'color-mix(in srgb, var(--amber) 12%, transparent)' : 'var(--card)',
  color: active ? 'var(--text)' : 'var(--text-dim)',
  border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
  borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--font-sans)',
});

// Multi-select picks live in the same Record<string, string> map as
// single answers — joined by ", " — so the wire format downstream needs
// no changes. This is the only place that knows about that encoding.
function splitMulti(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}
