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

import { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useDiagramsStore } from '@/stores/diagrams.store';
import { PropertiesPanel } from '../PropertiesPanel';

type SheetState = 'collapsed' | 'half' | 'full';

export function MobilePropertiesSheet() {
  const [state, setState] = useState<SheetState>('collapsed');
  const selectedElement = useDiagramsStore((s) => s.selectedElement);
  const prevSelectedId = useRef<string | undefined>(undefined);

  // Auto-expand when something gets selected
  useEffect(() => {
    if (selectedElement && selectedElement.id !== prevSelectedId.current) {
      setState((s) => (s === 'collapsed' ? 'half' : s));
    }
    prevSelectedId.current = selectedElement?.id;
  }, [selectedElement]);

  const toggle = () => {
    setState((s) => {
      if (s === 'collapsed') return 'half';
      if (s === 'half') return 'full';
      return 'collapsed';
    });
  };

  const heights: Record<SheetState, string> = {
    collapsed: '40px',
    half: '45vh',
    full: '80vh',
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 48,
        left: 0,
        right: 0,
        height: heights[state],
        background: 'var(--surface, #1a1a1a)',
        borderTop: '1px solid var(--border, #333)',
        borderRadius: '12px 12px 0 0',
        zIndex: 15,
        transition: 'height 0.25s ease-out',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: state !== 'collapsed' ? '0 -4px 16px rgba(0,0,0,0.4)' : undefined,
      }}
    >
      {/* Drag handle bar */}
      <div
        onClick={toggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '8px 16px',
          cursor: 'pointer',
          flexShrink: 0,
          minHeight: 40,
          touchAction: 'manipulation',
        }}
      >
        <div
          style={{
            width: 32,
            height: 4,
            borderRadius: 2,
            background: 'var(--border, #444)',
          }}
        />
        <span style={{
          fontSize: 11,
          color: 'var(--text-dim, #94a3b8)',
          fontFamily: 'var(--font-sans, system-ui)',
          flex: 1,
          textAlign: 'left',
        }}>
          {selectedElement
            ? `${selectedElement.type === 'node' ? 'Node' : 'Edge'} Properties`
            : 'Canvas Settings'}
        </span>
        {state !== 'collapsed' ? (
          <button onClick={(e) => { e.stopPropagation(); setState('collapsed'); }} style={iconBtnStyle}>
            <ChevronDown size={16} />
          </button>
        ) : (
          <button onClick={(e) => { e.stopPropagation(); setState('half'); }} style={iconBtnStyle}>
            <ChevronUp size={16} />
          </button>
        )}
      </div>

      {/* Content */}
      {state !== 'collapsed' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <PropertiesPanel embedded />
        </div>
      )}
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-dim, #94a3b8)',
  cursor: 'pointer',
  padding: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  touchAction: 'manipulation',
};
