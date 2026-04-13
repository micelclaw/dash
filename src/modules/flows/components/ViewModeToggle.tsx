/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { LayoutGrid, List, PanelTop } from 'lucide-react';
import { useFlowsStore } from '@/stores/flows.store';

const modes = [
  { value: 'grid' as const, icon: LayoutGrid, label: 'Grid' },
  { value: 'list' as const, icon: List, label: 'List' },
  { value: 'banner' as const, icon: PanelTop, label: 'Banner' },
];

export function ViewModeToggle() {
  const viewMode = useFlowsStore((s) => s.viewMode);
  const setViewMode = useFlowsStore((s) => s.setViewMode);

  return (
    <div style={{ display: 'flex', gap: 2, background: 'var(--surface)', borderRadius: 6, padding: 2 }}>
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => setViewMode(m.value)}
          title={m.label}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 4, border: 'none', cursor: 'pointer',
            background: viewMode === m.value ? 'var(--mod-flows-dim)' : 'transparent',
            color: viewMode === m.value ? 'var(--mod-flows)' : 'var(--text-muted)',
          }}
        >
          <m.icon size={14} />
        </button>
      ))}
    </div>
  );
}
