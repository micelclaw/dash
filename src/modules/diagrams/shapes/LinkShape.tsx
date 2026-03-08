import { memo, useState } from 'react';
import { Handle, Position, NodeResizer, useNodeId } from '@xyflow/react';
import { ExternalLink, Globe } from 'lucide-react';
import { useDiagramsStore } from '@/stores/diagrams.store';
import type { NodeProps } from '@xyflow/react';
import type { DiagramNodeData } from '../types';

function parseDomain(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function faviconUrl(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
  } catch {
    return '';
  }
}

function LinkShapeInner({ data: _d, selected }: NodeProps) {
  const data = _d as unknown as DiagramNodeData;
  const color = data.color || '#3b82f6';
  const url = data.url || 'https://example.com';
  const label = data.label || parseDomain(url);
  const domain = parseDomain(url);
  const nodeId = useNodeId();
  const editingNodeId = useDiagramsStore((s) => s.editingNodeId);
  const isEditing = nodeId != null && editingNodeId === nodeId;
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const showHandles = hovered || selected;
  const favicon = faviconUrl(url);

  const handleClick = () => {
    if (url && !isEditing) {
      window.open(url.startsWith('http') ? url : `https://${url}`, '_blank', 'noopener');
    }
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
        borderRadius: 8,
        opacity: data.opacity != null ? data.opacity / 100 : 1,
      }}
    >
      <NodeResizer
        color="var(--amber, #d4a017)"
        isVisible={!!selected}
        minWidth={120}
        minHeight={36}
      />

      <div
        onClick={handleClick}
        style={{
          width: '100%',
          height: '100%',
          background: data.bgColor || `${color}15`,
          border: `1.5px solid ${color}`,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          cursor: 'pointer',
          transition: 'background 0.15s',
          visibility: isEditing ? 'hidden' : 'visible',
        }}
      >
        {/* Favicon */}
        {favicon && !imgError ? (
          <img
            src={favicon}
            alt=""
            width={16}
            height={16}
            style={{ borderRadius: 2, flexShrink: 0 }}
            onError={() => setImgError(true)}
          />
        ) : (
          <Globe size={16} style={{ color, flexShrink: 0 }} />
        )}

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <div style={{
            fontSize: data.fontSize || 12,
            fontWeight: 600,
            color: data.textColor || '#e2e8f0',
            fontFamily: 'var(--font-sans)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {label}
          </div>
          {label !== domain && (
            <div style={{
              fontSize: 9,
              color: 'var(--text-dim, #64748b)',
              fontFamily: 'var(--font-sans)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {domain}
            </div>
          )}
        </div>

        <ExternalLink size={12} style={{ color: 'var(--text-dim, #64748b)', flexShrink: 0 }} />
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

export const LinkShape = memo(LinkShapeInner);
