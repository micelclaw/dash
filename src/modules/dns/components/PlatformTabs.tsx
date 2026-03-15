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

import { useState } from 'react';

export type Platform = 'windows' | 'macos' | 'linux' | 'ios' | 'android';

interface PlatformTabsProps {
  platforms: Platform[];
  children: (platform: Platform) => React.ReactNode;
}

const platformLabels: Record<Platform, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  ios: 'iOS',
  android: 'Android',
};

export function PlatformTabs({ platforms, children }: PlatformTabsProps) {
  const [active, setActive] = useState<Platform>(platforms[0]);

  return (
    <div>
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid var(--border)',
        marginBottom: 12,
      }}>
        {platforms.map((p) => (
          <button
            key={p}
            onClick={() => setActive(p)}
            style={{
              padding: '8px 14px',
              background: 'none', border: 'none',
              borderBottom: active === p ? '2px solid #d4a017' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '0.75rem', fontWeight: active === p ? 600 : 400,
              color: active === p ? 'var(--text)' : 'var(--text-muted)',
              fontFamily: 'var(--font-sans)',
              transition: 'color 0.15s',
            }}
          >
            {platformLabels[p]}
          </button>
        ))}
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        {children(active)}
      </div>
    </div>
  );
}
