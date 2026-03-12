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

import { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeResizer, useNodeId } from '@xyflow/react';
import { useDiagramsStore } from '@/stores/diagrams.store';
import type { NodeProps } from '@xyflow/react';
import type { DiagramNodeData } from '../types';

type ItemStatus = 'unchecked' | 'checked' | 'in-progress';

const STATUS_CYCLE: ItemStatus[] = ['unchecked', 'checked', 'in-progress'];

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === 'checked') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14">
        <rect x="1" y="1" width="12" height="12" rx="2" fill="#22c55e" fillOpacity={0.2} stroke="#22c55e" strokeWidth="1.5" />
        <polyline points="4,7 6,9.5 10,4.5" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'in-progress') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14">
        <rect x="1" y="1" width="12" height="12" rx="2" fill="#f59e0b" fillOpacity={0.2} stroke="#f59e0b" strokeWidth="1.5" />
        <line x1="4" y1="7" x2="10" y2="7" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <rect x="1" y="1" width="12" height="12" rx="2" fill="transparent" stroke="#64748b" strokeWidth="1.5" />
    </svg>
  );
}

function ListShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  const color = data.color || '#22c55e';
  const label = data.label || 'Checklist';
  const items = data.listItems || [
    { text: 'Item 1', status: 'unchecked' as const },
    { text: 'Item 2', status: 'unchecked' as const },
    { text: 'Item 3', status: 'unchecked' as const },
  ];
  const nodeId = useNodeId();
  const editingNodeId = useDiagramsStore((s) => s.editingNodeId);
  const updateNodeData = useDiagramsStore((s) => s.updateNodeData);
  const isEditing = nodeId != null && editingNodeId === nodeId;
  const [hovered, setHovered] = useState(false);
  const showHandles = hovered || selected;

  const toggleItem = useCallback((index: number) => {
    if (!nodeId) return;
    const newItems = [...items];
    const current = newItems[index].status;
    const nextIdx = (STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length;
    newItems[index] = { ...newItems[index], status: STATUS_CYCLE[nextIdx] };
    updateNodeData(nodeId, { listItems: newItems });
  }, [nodeId, items, updateNodeData]);

  const checkedCount = items.filter((it) => it.status === 'checked').length;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        outline: selected ? '2px solid var(--amber, #d4a017)' : 'none',
        outlineOffset: 2,
        borderRadius: 6,
        opacity: data.opacity != null ? data.opacity / 100 : 1,
      }}
    >
      <NodeResizer
        color="var(--amber, #d4a017)"
        isVisible={!!selected}
        minWidth={120}
        minHeight={60}
      />

      <div
        style={{
          width: '100%',
          height: '100%',
          background: data.bgColor || `${color}10`,
          border: `1.5px solid ${color}`,
          borderRadius: 6,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          height: 26,
          background: `${color}20`,
          borderBottom: `1px solid ${color}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: data.textColor || '#e2e8f0', fontFamily: 'var(--font-sans)' }}>
            {label}
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-dim, #64748b)', fontFamily: 'var(--font-sans)' }}>
            {checkedCount}/{items.length}
          </span>
        </div>

        {/* Items */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 0',
            visibility: isEditing ? 'hidden' : 'visible',
          }}
        >
          {items.map((item, i) => (
            <div
              key={i}
              onClick={(e) => { e.stopPropagation(); toggleItem(i); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 8px',
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ flexShrink: 0 }}>
                <StatusIcon status={item.status} />
              </div>
              <span style={{
                fontSize: data.fontSize || 11,
                color: data.textColor || '#e2e8f0',
                fontFamily: 'var(--font-sans)',
                textDecoration: item.status === 'checked' ? 'line-through' : 'none',
                opacity: item.status === 'checked' ? 0.5 : 1,
                lineHeight: 1.3,
              }}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Handle type="target" position={Position.Top} style={showHandles ? hvs : hhs} />
      <Handle type="source" position={Position.Bottom} style={showHandles ? hvs : hhs} />
      <Handle type="target" position={Position.Left} id="left" style={showHandles ? hvs : hhs} />
      <Handle type="source" position={Position.Right} id="right" style={showHandles ? hvs : hhs} />
    </div>
  );
}

const hvs: React.CSSProperties = { width: 8, height: 8, background: 'var(--text-dim, #64748b)', border: '2px solid var(--surface, #1e1e1e)', opacity: 1, transition: 'opacity 0.15s' };
const hhs: React.CSSProperties = { ...hvs, opacity: 0 };

export const ListShape = memo(ListShapeInner);
