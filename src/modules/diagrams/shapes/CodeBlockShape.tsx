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
import { Copy, Check } from 'lucide-react';
import { useDiagramsStore } from '@/stores/diagrams.store';
import type { NodeProps } from '@xyflow/react';
import type { DiagramNodeData } from '../types';

const LANGUAGES = ['javascript', 'typescript', 'python', 'go', 'rust', 'sql', 'json', 'yaml', 'bash', 'html', 'css'] as const;

/** Basic syntax coloring via regex */
function colorize(code: string, lang?: string): React.ReactNode[] {
  return code.split('\n').map((line, i) => {
    let colored = line
      // Strings
      .replace(/(["'`])(?:(?!\1).)*?\1/g, '<s>$&</s>')
      // Comments (// or #)
      .replace(/(\/\/.*)$/g, '<c>$1</c>')
      .replace(/(#.*)$/g, '<c>$1</c>')
      // Numbers
      .replace(/\b(\d+\.?\d*)\b/g, '<n>$1</n>')
      // Keywords
      .replace(/\b(const|let|var|function|return|if|else|for|while|import|export|from|class|def|fn|pub|async|await|type|interface)\b/g, '<k>$1</k>');

    // Parse tags into spans
    const parts: React.ReactNode[] = [];
    let rest = colored;
    let key = 0;

    while (rest.length > 0) {
      const tagMatch = rest.match(/^<([scnk])>(.*?)<\/\1>/);
      if (tagMatch) {
        const tag = tagMatch[1];
        const content = tagMatch[2];
        const color = tag === 's' ? '#a5d6ff' : tag === 'c' ? '#6a737d' : tag === 'n' ? '#79c0ff' : '#ff7b72';
        parts.push(<span key={key++} style={{ color }}>{content}</span>);
        rest = rest.slice(tagMatch[0].length);
        continue;
      }

      const nextTag = rest.indexOf('<');
      if (nextTag === -1) {
        parts.push(rest);
        break;
      } else if (nextTag === 0) {
        parts.push(rest[0]);
        rest = rest.slice(1);
      } else {
        parts.push(rest.slice(0, nextTag));
        rest = rest.slice(nextTag);
      }
    }

    return <div key={i} style={{ minHeight: '1.4em' }}>{parts.length > 0 ? parts : ' '}</div>;
  });
}

function CodeBlockShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  const code = data.code || data.label || '// code here';
  const language = data.language || 'javascript';
  const nodeId = useNodeId();
  const editingNodeId = useDiagramsStore((s) => s.editingNodeId);
  const updateNodeData = useDiagramsStore((s) => s.updateNodeData);
  const isEditing = nodeId != null && editingNodeId === nodeId;
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const showHandles = hovered || selected;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [code]);

  const handleLanguageChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    if (nodeId) updateNodeData(nodeId, { language: e.target.value });
  }, [nodeId, updateNodeData]);

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
          background: '#0d1117',
          border: '1.5px solid #30363d',
          borderRadius: 6,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          height: 26,
          background: '#161b22',
          borderBottom: '1px solid #30363d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px',
          flexShrink: 0,
        }}>
          <select
            value={language}
            onChange={handleLanguageChange}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 10,
              color: '#8b949e',
              background: 'transparent',
              border: 'none',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l} style={{ background: '#161b22' }}>{l}</option>
            ))}
          </select>

          <button
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10,
              color: copied ? '#3fb950' : '#8b949e',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: 3,
            }}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
          </button>
        </div>

        {/* Code content */}
        <div
          style={{
            flex: 1,
            padding: '6px 10px',
            fontSize: data.fontSize || 11,
            fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", monospace',
            color: '#c9d1d9',
            overflowY: 'auto',
            lineHeight: 1.4,
            whiteSpace: 'pre',
            tabSize: 2,
            visibility: isEditing ? 'hidden' : 'visible',
          }}
        >
          {colorize(code, language)}
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

export const CodeBlockShape = memo(CodeBlockShapeInner);
