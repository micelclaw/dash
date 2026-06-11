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

import { memo, useState } from 'react';
import { Handle, Position, NodeResizer, useNodeId } from '@xyflow/react';
import { ImageIcon } from 'lucide-react';
import { useDiagramsStore } from '@/stores/diagrams.store';
import type { NodeProps } from '@xyflow/react';
import type { DiagramNodeData } from '../types';

function EmbedShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  const color = data.color || '#ec4899';
  const embedType = data.embedType || 'image';
  const embedUrl = data.embedUrl || data.url || '';
  const label = data.label || 'Embed';
  const nodeId = useNodeId();
  const editingNodeId = useDiagramsStore((s) => s.editingNodeId);
  const isEditing = nodeId != null && editingNodeId === nodeId;
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const showHandles = hovered || selected;

  const renderContent = () => {
    if (embedType === 'color') {
      const swatch = embedUrl || color;
      return (
        <div style={{
          width: '100%',
          height: '100%',
          background: swatch,
          borderRadius: 4,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          padding: 6,
        }}>
          <span style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#fff',
            background: 'rgba(0,0,0,0.5)',
            padding: '2px 6px',
            borderRadius: 3,
          }}>
            {swatch}
          </span>
        </div>
      );
    }

    if (embedType === 'emoji') {
      const emoji = embedUrl || '📊';
      return (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: Math.min(60, (data.fontSize || 12) * 4),
        }}>
          {emoji}
        </div>
      );
    }

    // Image
    if (embedUrl && !imgError) {
      return (
        <img
          src={embedUrl}
          alt={label}
          onError={() => setImgError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 4,
          }}
        />
      );
    }

    // Placeholder
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        color: 'var(--text-dim, #64748b)',
      }}>
        <ImageIcon size={24} />
        <span style={{ fontSize: 10, fontFamily: 'var(--font-sans)' }}>
          {imgError ? 'Failed to load' : 'No image URL'}
        </span>
      </div>
    );
  };

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
        minWidth={60}
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
          visibility: isEditing ? 'hidden' : 'visible',
        }}
      >
        {renderContent()}
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

export const EmbedShape = memo(EmbedShapeInner);
