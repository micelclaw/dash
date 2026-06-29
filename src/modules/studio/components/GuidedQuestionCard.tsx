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

// ─── Studio v3 — conversational scoping question (Guided, §3.2) ─────
//
// One human question at a time. Options are quick-answer chips: picking
// one selects AND advances (conversational, fewer clicks). A discreet
// "Decido luego" lets the system choose a sensible default — the user
// never has to take a decision they don't feel ready for (§3 cross-rule).

import { Check } from 'lucide-react';
import type { ScopingQuestion } from '@/stores/studio.store';

interface Props {
  question: ScopingQuestion;
  /** Currently-selected option (if the user is revisiting via Back). */
  selectedOptionId: string | null;
  /** Pick an option → select + advance. */
  onPick: (optionId: string) => void;
  /** "Decido luego" → the system picks a sensible default + advances. */
  onDefer: () => void;
}

export function GuidedQuestionCard({ question, selectedOptionId, onPick, onDefer }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, color: 'var(--text)', lineHeight: 1.3 }}>
          {question.title}
        </h2>
        {question.description && (
          <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
            {question.description}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {question.options.map((opt) => {
          const selected = selectedOptionId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              data-testid="scoping-option"
              onClick={() => onPick(opt.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 18px', textAlign: 'left',
                background: selected ? 'color-mix(in srgb, var(--amber) 12%, var(--card))' : 'var(--card)',
                border: `1.5px solid ${selected ? 'var(--amber)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                fontFamily: 'var(--font-sans)', color: 'var(--text)', transition: 'all 0.12s',
              }}
              onMouseEnter={(e) => { if (!selected) e.currentTarget.style.borderColor = 'var(--amber)'; }}
              onMouseLeave={(e) => { if (!selected) e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              {opt.icon && <span style={{ fontSize: '1.7rem', flexShrink: 0, lineHeight: 1 }}>{opt.icon}</span>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{opt.label}</span>
                {opt.description && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.45 }}>{opt.description}</span>
                )}
              </div>
              {selected && <Check size={18} style={{ color: 'var(--amber)', flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>

      {/* "Decido luego" — never force a decision the user isn't ready for */}
      <button type="button" onClick={onDefer} style={deferBtn}>
        No estoy seguro/a — decídelo tú por mí
      </button>
    </div>
  );
}

const deferBtn: React.CSSProperties = {
  alignSelf: 'flex-start', marginTop: 2,
  padding: '7px 14px', fontSize: '0.78rem',
  background: 'transparent', color: 'var(--text-dim)',
  border: '1px dashed var(--border)', borderRadius: 'var(--radius-full)',
  cursor: 'pointer', fontFamily: 'var(--font-sans)',
};

export default GuidedQuestionCard;
