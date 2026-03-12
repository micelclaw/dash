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

import { LayoutGrid, List } from 'lucide-react';

interface ViewToggleProps {
  view: 'grid' | 'list';
  onChange: (view: 'grid' | 'list') => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div style={{ display: 'flex', gap: 2, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
      <ToggleBtn active={view === 'grid'} onClick={() => onChange('grid')} icon={LayoutGrid} />
      <ToggleBtn active={view === 'list'} onClick={() => onChange('list')} icon={List} />
    </div>
  );
}

function ToggleBtn({ active, onClick, icon: Icon }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ size?: number }> }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        background: active ? 'var(--amber)' : 'transparent',
        color: active ? '#06060a' : 'var(--text-dim)',
        cursor: 'pointer',
        transition: 'background var(--transition-fast)',
      }}
    >
      <Icon size={14} />
    </button>
  );
}
