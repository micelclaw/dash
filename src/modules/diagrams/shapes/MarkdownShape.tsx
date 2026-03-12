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
import { useDiagramsStore } from '@/stores/diagrams.store';
import type { NodeProps } from '@xyflow/react';
import type { DiagramNodeData } from '../types';

/** Simple regex-based markdown renderer */
function renderMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    // Headers
    const h3 = line.match(/^###\s+(.*)/);
    if (h3) return <div key={i} style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{parseInline(h3[1])}</div>;
    const h2 = line.match(/^##\s+(.*)/);
    if (h2) return <div key={i} style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{parseInline(h2[1])}</div>;
    const h1 = line.match(/^#\s+(.*)/);
    if (h1) return <div key={i} style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{parseInline(h1[1])}</div>;

    // Unordered list
    const ul = line.match(/^[-*]\s+(.*)/);
    if (ul) return <div key={i} style={{ paddingLeft: 12 }}>• {parseInline(ul[1])}</div>;

    // Ordered list
    const ol = line.match(/^(\d+)\.\s+(.*)/);
    if (ol) return <div key={i} style={{ paddingLeft: 12 }}>{ol[1]}. {parseInline(ol[2])}</div>;

    // Empty line
    if (!line.trim()) return <div key={i} style={{ height: 6 }} />;

    return <div key={i}>{parseInline(line)}</div>;
  });
}

function parseInline(text: string): React.ReactNode {
  // Bold + italic
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Code
    const code = remaining.match(/^`([^`]+)`/);
    if (code) {
      parts.push(
        <code key={key++} style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 4px', borderRadius: 3, fontFamily: 'monospace', fontSize: '0.9em' }}>
          {code[1]}
        </code>
      );
      remaining = remaining.slice(code[0].length);
      continue;
    }

    // Bold
    const bold = remaining.match(/^\*\*(.+?)\*\*/);
    if (bold) {
      parts.push(<strong key={key++}>{bold[1]}</strong>);
      remaining = remaining.slice(bold[0].length);
      continue;
    }

    // Italic
    const italic = remaining.match(/^\*(.+?)\*/);
    if (italic) {
      parts.push(<em key={key++}>{italic[1]}</em>);
      remaining = remaining.slice(italic[0].length);
      continue;
    }

    // Plain character
    const nextSpecial = remaining.search(/[`*]/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return <>{parts}</>;
}

function MarkdownShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  const color = data.color || '#8b5cf6';
  const md = data.markdown || data.label || 'Markdown';
  const nodeId = useNodeId();
  const editingNodeId = useDiagramsStore((s) => s.editingNodeId);
  const isEditing = nodeId != null && editingNodeId === nodeId;
  const [hovered, setHovered] = useState(false);
  const showHandles = hovered || selected;

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
        minWidth={100}
        minHeight={60}
      />

      {/* Background */}
      <div
        style={{
          width: '100%',
          height: '100%',
          background: data.bgColor || `${color}15`,
          border: `1.5px solid ${color}`,
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {/* Header bar */}
        <div style={{
          height: 22,
          background: `${color}30`,
          borderBottom: `1px solid ${color}40`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          gap: 4,
        }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: data.textColor || '#e2e8f0', fontFamily: 'var(--font-sans)' }}>
            Markdown
          </span>
        </div>

        {/* Content */}
        <div
          style={{
            padding: 8,
            fontSize: data.fontSize || 11,
            color: data.textColor || '#e2e8f0',
            fontFamily: 'var(--font-sans, system-ui)',
            lineHeight: 1.4,
            overflowY: 'auto',
            height: 'calc(100% - 22px)',
            visibility: isEditing ? 'hidden' : 'visible',
          }}
        >
          {renderMarkdown(md)}
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

export const MarkdownShape = memo(MarkdownShapeInner);
