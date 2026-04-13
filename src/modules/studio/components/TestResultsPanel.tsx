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

// ─── TestResultsPanel — compact pass/fail summary ──────────────────
//
// Renders inside a session card to show vitest-equivalent results
// (we use Node 20+'s built-in test runner under the hood). Failed
// tests expand to show the captured error.

import { useState } from 'react';
import { Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import type { StudioTestResults } from '@/stores/studio.store';

interface Props {
  results: StudioTestResults;
}

export function TestResultsPanel({ results }: Props) {
  const [expanded, setExpanded] = useState(false);
  const allGreen = results.failed === 0 && results.total > 0;
  const noTests = results.total === 0;

  return (
    <div style={{
      marginTop: 8, padding: '6px 8px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: `2px solid ${noTests ? 'var(--text-muted)' : (allGreen ? '#22c55e' : 'var(--danger)')}`,
      borderRadius: 'var(--radius-sm)',
      fontSize: '0.6875rem',
    }}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none', padding: 0,
          color: 'var(--text)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
          fontSize: '0.6875rem',
        }}
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {noTests ? (
          <span style={{ color: 'var(--text-muted)' }}>Sin tests</span>
        ) : (
          <>
            <span style={{ color: '#22c55e' }}>
              <Check size={10} style={{ display: 'inline' }} /> {results.passed}
            </span>
            <span style={{ color: results.failed > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
              <X size={10} style={{ display: 'inline' }} /> {results.failed}
            </span>
            <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {results.duration_ms}ms
            </span>
          </>
        )}
      </button>

      {expanded && results.tests.length > 0 && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
          {results.tests.map((t, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                {t.status === 'passed' ? (
                  <Check size={10} style={{ color: '#22c55e', flexShrink: 0, marginTop: 2 }} />
                ) : (
                  <X size={10} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
                )}
                <span style={{
                  color: t.status === 'passed' ? 'var(--text-dim)' : 'var(--text)',
                  fontSize: '0.625rem', lineHeight: 1.4,
                }}>
                  {t.name}
                </span>
              </div>
              {t.status === 'failed' && t.error && (
                <pre style={{
                  margin: '2px 0 4px 14px', padding: 4,
                  background: 'color-mix(in srgb, var(--danger) 8%, var(--card))',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.5625rem', color: 'var(--text)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  fontFamily: 'var(--font-mono)', maxHeight: 120, overflow: 'auto',
                }}>
                  {t.error}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

      {expanded && results.stderr && (
        <pre style={{
          margin: '6px 0 0', padding: 4,
          background: 'var(--card)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.5625rem', color: 'var(--text-dim)',
          whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto',
          fontFamily: 'var(--font-mono)',
        }}>
          {results.stderr}
        </pre>
      )}
    </div>
  );
}
