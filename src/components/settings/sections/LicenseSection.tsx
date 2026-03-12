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

import { useAuthStore } from '@/stores/auth.store';
import { SettingSection } from '../SettingSection';

export function LicenseSection() {
  const tier = useAuthStore((s) => s.user?.tier ?? 'free');

  return (
    <SettingSection title="License">
      {tier === 'free' ? (
        <div style={{ padding: '16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Current Tier</span>
            <span style={{
              fontSize: '0.8125rem', padding: '2px 10px',
              background: 'var(--surface)', borderRadius: 'var(--radius-sm)',
              color: 'var(--text-dim)', fontFamily: 'var(--font-sans)', fontWeight: 500,
            }}>
              Free
            </span>
          </div>
          <button
            onClick={() => window.open('https://micelclaw.com/pro', '_blank')}
            style={{
              height: 36, padding: '0 20px',
              background: 'var(--amber)', color: '#06060a',
              border: 'none', borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem', fontWeight: 600,
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            Upgrade to Pro →
          </button>
        </div>
      ) : (
        <div style={{ padding: '16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Current Tier</span>
            <span style={{
              fontSize: '0.8125rem', padding: '2px 10px',
              background: 'rgba(212, 160, 23, 0.15)', borderRadius: 'var(--radius-sm)',
              color: 'var(--amber)', fontFamily: 'var(--font-sans)', fontWeight: 600,
            }}>
              Pro
            </span>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)', marginBottom: 4 }}>
            Valid Until: February 2027
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)', marginBottom: 16 }}>
            License Key: CLAW-XXXX-XXXX-XXXX
          </div>
          <button
            style={{
              height: 30, padding: '0 14px',
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
              fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            Deactivate License
          </button>
        </div>
      )}
    </SettingSection>
  );
}
