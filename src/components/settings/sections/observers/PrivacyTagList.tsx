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

import { TAG_COLORS, scoreBarColor, type PlatformPrivacy } from './privacy-data';

export function PrivacyTags({ privacy }: { privacy: PlatformPrivacy }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', alignContent: 'center', gap: 4 }}>
      {privacy.tags.map((tag) => {
        const c = TAG_COLORS[tag.type];
        return (
          <span
            key={tag.label}
            style={{
              fontSize: '0.6875rem', lineHeight: 1, padding: '3px 9px', borderRadius: 8,
              background: c.bg, color: c.text, border: `1px solid ${c.border}`,
              fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
            }}
          >
            {tag.label}
          </span>
        );
      })}
    </div>
  );
}

export function PrivacyScore({ privacy }: { privacy: PlatformPrivacy }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Privacy</div>
      <div style={{ width: 60, height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${privacy.score}%`, height: '100%', borderRadius: 2, background: scoreBarColor(privacy.score) }} />
      </div>
      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: scoreBarColor(privacy.score), whiteSpace: 'nowrap' }}>
        {privacy.score}/100
      </span>
    </div>
  );
}
