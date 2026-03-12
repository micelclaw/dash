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

import { Lock } from 'lucide-react';

interface ProUpsellPanelProps {
  feature: string;
  description: string;
}

const SESSION_KEY = 'claw:pro-upsell-shown';

function hasShownThisSession(feature: string): boolean {
  try {
    const shown = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
    return !!shown[feature];
  } catch {
    return false;
  }
}

function markShown(feature: string) {
  try {
    const shown = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
    shown[feature] = true;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(shown));
  } catch { /* ignore */ }
}

export function ProUpsellPanel({ feature, description }: ProUpsellPanelProps) {
  if (hasShownThisSession(feature)) return null;
  markShown(feature);

  return (
    <div style={{
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      background: 'var(--surface)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)',
    }}>
      <Lock size={16} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
          {feature}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>
          {description}
        </div>
        <button
          style={{
            padding: '4px 12px',
            background: 'var(--amber)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: '#000',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Upgrade to Pro
        </button>
      </div>
    </div>
  );
}
