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

// ─── Studio scoping wizard — single question card ───────────────────
// Renders one ScopingQuestion as a vertical list of selectable option
// cards. Click an option → onSelect fires with the option id.

import type { ScopingQuestion } from '@/stores/studio.store';

interface Props {
  question: ScopingQuestion;
  selectedOptionId: string | null;
  onSelect: (optionId: string) => void;
}

export function QuestionCard({ question, selectedOptionId, onSelect }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{
          fontSize: '1.125rem', fontWeight: 600, margin: 0, color: 'var(--text)',
        }}>
          {question.title}
        </h2>
        {question.description && (
          <p style={{
            margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--text-dim)',
            lineHeight: 1.5,
          }}>
            {question.description}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {question.options.map((opt) => {
          const selected = selectedOptionId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '14px 16px', textAlign: 'left',
                background: selected ? 'var(--card-hover)' : 'var(--card)',
                border: `1px solid ${selected ? 'var(--amber)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                color: 'var(--text)',
                transition: 'all 0.15s',
                outline: selected ? '2px solid var(--amber)' : 'none',
                outlineOffset: selected ? -1 : 0,
              }}
            >
              {opt.icon && (
                <span style={{ fontSize: '1.5rem', flexShrink: 0, lineHeight: 1 }}>
                  {opt.icon}
                </span>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                  {opt.label}
                </span>
                <span style={{
                  fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5,
                }}>
                  {opt.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
