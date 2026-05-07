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

// ─── NotFoundSection ────────────────────────────────────────────────
//
// Rendered when the URL points at a section ID that doesn't exist
// (typo, removed-then-bookmarked, etc.). Replaces the silent fallback
// `default: return <GeneralSection />` which would render the wrong
// section without any warning — confusing for the user.
//
// Suggests up to 3 closest matches via Levenshtein distance against
// the registered section IDs, so a typo like `/settings/notiifcations`
// still gets the user where they wanted to go in two clicks.

import { useNavigate } from 'react-router';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

export interface NotFoundSectionProps {
  /** The section ID that didn't match anything in the registry. */
  requestedId: string;
  /** Full list of valid section IDs to suggest from. */
  knownIds: readonly string[];
}

/**
 * Lightweight Levenshtein distance — small enough for a few dozen
 * IDs at click-time. Bails early if either string is empty.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Two-row DP — we only need the previous row.
  let prev: number[] = new Array(b.length + 1).fill(0).map((_, i) => i);
  let curr: number[] = new Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (curr[j - 1] ?? 0) + 1,        // insertion
        (prev[j] ?? 0) + 1,            // deletion
        (prev[j - 1] ?? 0) + cost,     // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length] ?? 0;
}

function findSuggestions(query: string, candidates: readonly string[], limit = 3): string[] {
  const scored = candidates
    .map((id) => ({ id, distance: levenshtein(query.toLowerCase(), id.toLowerCase()) }))
    // Threshold: half the query length, minimum 2. Past that, the
    // suggestion is too far off to be useful and likely a coincidence.
    .filter((s) => s.distance <= Math.max(2, Math.floor(query.length / 2)))
    .sort((a, b) => a.distance - b.distance);
  return scored.slice(0, limit).map((s) => s.id);
}

export function NotFoundSection({ requestedId, knownIds }: NotFoundSectionProps) {
  const navigate = useNavigate();
  const suggestions = findSuggestions(requestedId, knownIds);

  return (
    <div style={{
      maxWidth: 560,
      padding: '32px 0',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '16px 18px',
        background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)',
        borderRadius: 'var(--radius-md)',
      }}>
        <AlertTriangle size={18} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <h2 style={{
            margin: 0,
            fontSize: '0.9375rem',
            fontWeight: 600,
            color: 'var(--text)',
          }}>
            Settings section not found
          </h2>
          <p style={{
            margin: '4px 0 0',
            fontSize: '0.8125rem',
            color: 'var(--text-dim)',
            lineHeight: 1.5,
          }}>
            <code style={{
              padding: '1px 6px',
              background: 'var(--surface)',
              borderRadius: 4,
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--text)',
            }}>
              /settings/{requestedId}
            </code>{' '}
            doesn't match any known section. It may have been renamed, removed, or the URL has a typo.
          </p>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 8,
          }}>
            Did you mean…
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {suggestions.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => navigate(`/settings/${id}`, { replace: true })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)',
                  fontSize: '0.8125rem',
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <code style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.75rem',
                  color: 'var(--amber)',
                }}>
                  /settings/{id}
                </code>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button
          type="button"
          onClick={() => navigate('/settings', { replace: true })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-dim)',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={14} />
          Back to Settings home
        </button>
      </div>
    </div>
  );
}
