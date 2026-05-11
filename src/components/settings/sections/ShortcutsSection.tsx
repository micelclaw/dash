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

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { SettingSection } from '../SettingSection';
import { SHORTCUT_GROUPS, renderKeys, type ShortcutGroup } from '@/config/shortcuts';

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent);

const kbdStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 22,
  height: 22,
  padding: '0 6px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  fontSize: '0.6875rem',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text)',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

function filterGroups(groups: ShortcutGroup[], query: string): ShortcutGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((g) => ({
      ...g,
      shortcuts: g.shortcuts.filter(
        (s) =>
          s.description.toLowerCase().includes(q) ||
          s.keys.toLowerCase().includes(q) ||
          g.title.toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.shortcuts.length > 0);
}

export function ShortcutsSection() {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => filterGroups(SHORTCUT_GROUPS, query), [query]);

  return (
    <SettingSection
      title="Keyboard Shortcuts"
      description="Reference of available keyboard shortcuts. Items marked (coming soon) are not yet implemented."
    >
      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search
          size={13}
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
          }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search shortcuts..."
          style={{
            width: '100%',
            padding: '8px 10px 8px 30px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text)',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '24px 0',
            color: 'var(--text-muted)',
            fontSize: '0.8125rem',
          }}
        >
          No shortcuts match «{query}».
        </div>
      ) : (
        filtered.map((group) => (
          <div key={group.title} style={{ padding: '8px 0' }}>
            <div
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8,
                fontFamily: 'var(--font-sans)',
              }}
            >
              {group.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {group.shortcuts.map((s) => {
                const display = renderKeys(s.keys, isMac);
                return (
                  <div
                    key={s.keys + s.description}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 0',
                      opacity: s.planned ? 0.5 : 1,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--text-dim)',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {s.description}
                      {s.planned && (
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginLeft: 6, fontStyle: 'italic' }}>
                          (coming soon)
                        </span>
                      )}
                    </span>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {display.split(' + ').map((k, i) => (
                        <span key={i}>
                          {i > 0 && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.625rem', margin: '0 1px' }}>
                              +
                            </span>
                          )}
                          <kbd style={kbdStyle}>{k.trim()}</kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </SettingSection>
  );
}
