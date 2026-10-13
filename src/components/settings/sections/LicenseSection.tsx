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

const TIER_LABEL: Record<string, string> = { free: 'Free', pro: 'Pro', plus: 'Plus' };

export function LicenseSection() {
  const tier = useAuthStore((s) => s.user?.tier ?? 'free');
  const isFree = tier === 'free';

  return (
    <SettingSection title="License">
      <div style={{ padding: '16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isFree ? 16 : 8 }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Current Tier</span>
          <span style={{
            fontSize: '0.8125rem', padding: '2px 10px',
            background: isFree ? 'var(--surface)' : 'rgba(212, 160, 23, 0.15)',
            borderRadius: 'var(--radius-sm)',
            color: isFree ? 'var(--text-dim)' : 'var(--amber)',
            fontFamily: 'var(--font-sans)', fontWeight: isFree ? 500 : 600,
          }}>
            {TIER_LABEL[tier] ?? tier}
          </span>
        </div>
        {isFree ? (
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
        ) : (
          /* El dash NO consulta hoy al servidor de licencias (no hay ruta en Core que
             exponga /v1/licenses/info), así que no hay clave ni fecha de caducidad que
             mostrar: antes se pintaban literales inventados. Decimos la verdad. */
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>
            Managed outside the dashboard. License key and expiry are not available here.
          </div>
        )}
      </div>
    </SettingSection>
  );
}
