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

// ─── Icon Picker (grid buscable de iconos lucide) ───────

import { useState } from 'react';
import { icons } from 'lucide-react';
import { PanelInput, RemoveButton } from './shared';

const COMMON_ICONS = [
  'Database', 'Server', 'Cloud', 'Globe', 'Lock', 'Key', 'User', 'Users',
  'Settings', 'Mail', 'File', 'Folder', 'Code', 'Terminal', 'Monitor',
  'Smartphone', 'Wifi', 'Shield', 'Zap', 'Activity',
];

export function IconPicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (icon: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);

  const filteredIcons = search
    ? Object.keys(icons)
        .filter((name) => name.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 30)
    : COMMON_ICONS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <PanelInput
          type="text"
          value={search || value || ''}
          onChange={(e) => {
            setSearch(e.target.value);
            setExpanded(true);
          }}
          onFocus={() => setExpanded(true)}
          placeholder="Search icons..."
          style={{ flex: 1, fontSize: 10 }}
        />
        {value && (
          <RemoveButton onClick={() => onChange('')} className="text-[11px]" title="Clear icon" />
        )}
      </div>
      {expanded && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 2,
            maxHeight: 120,
            overflowY: 'auto',
          }}
        >
          {filteredIcons.map((name) => {
            const Icon = icons[name as keyof typeof icons];
            if (!Icon) return null;
            return (
              <button
                key={name}
                onClick={() => {
                  onChange(name);
                  setSearch('');
                  setExpanded(false);
                }}
                title={name}
                style={{
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: value === name ? 'var(--amber, #d4a017)' : 'transparent',
                  border: '1px solid var(--border, #333)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  padding: 0,
                  color: value === name ? '#000' : 'var(--text-dim)',
                }}
              >
                <Icon size={14} />
              </button>
            );
          })}
          {filteredIcons.length === 0 && (
            <span style={{ gridColumn: '1 / -1', fontSize: 10, color: 'var(--text-dim)', padding: 4 }}>
              No icons found
            </span>
          )}
        </div>
      )}
    </div>
  );
}
