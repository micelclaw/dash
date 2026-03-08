import { memo, useState, type ReactNode } from 'react';
import { Handle, Position, NodeResizer, useNodeId } from '@xyflow/react';
import { icons } from 'lucide-react';
import { useDiagramsStore } from '@/stores/diagrams.store';
import '../diagrams.css';

interface BaseShapeProps {
  data: Record<string, unknown>;
  selected?: boolean;
  children: ReactNode;
  keepAspectRatio?: boolean;
  minWidth?: number;
  minHeight?: number;
}

function BaseShapeInner({ data, selected, children, keepAspectRatio, minWidth = 40, minHeight = 30 }: BaseShapeProps) {
  const label = data.label as string | undefined;
  const description = data.description as string | undefined;
  const icon = data.icon as string | undefined;
  const fontSize = data.fontSize as number | undefined;
  const textColor = data.textColor as string | undefined;
  const fontWeight = data.fontWeight as string | undefined;
  const fontStyle = data.fontStyle as string | undefined;
  const textDecoration = data.textDecoration as string | undefined;
  const textAlign = data.textAlign as string | undefined;
  const opacity = data.opacity as number | undefined;
  const pulse = data.pulse as boolean | undefined;

  const nodeId = useNodeId();
  const editingNodeId = useDiagramsStore((s) => s.editingNodeId);
  const isEditing = nodeId != null && editingNodeId === nodeId;
  const [hovered, setHovered] = useState(false);

  const IconComponent = icon ? icons[icon as keyof typeof icons] : null;
  const showHandles = hovered || selected;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={pulse ? 'diagram-node-pulse' : undefined}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        outline: selected ? '2px solid var(--amber, #d4a017)' : 'none',
        outlineOffset: 2,
        borderRadius: 4,
        opacity: opacity != null ? opacity / 100 : 1,
      }}
    >
      {/* Resize handles */}
      <NodeResizer
        color="var(--amber, #d4a017)"
        isVisible={!!selected}
        minWidth={minWidth}
        minHeight={minHeight}
        keepAspectRatio={keepAspectRatio}
        handleStyle={resizerHandleStyle}
        lineStyle={resizerLineStyle}
      />

      {/* Shape SVG / content */}
      {children}

      {/* Label overlay — hidden during inline editing */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          padding: 8,
          overflow: 'hidden',
          gap: 2,
          visibility: isEditing ? 'hidden' : 'visible',
        }}
      >
        {IconComponent && (
          <IconComponent
            size={fontSize ? fontSize + 4 : 16}
            style={{ color: textColor || '#e2e8f0', flexShrink: 0 }}
          />
        )}
        <span
          style={{
            fontSize: fontSize || 12,
            fontWeight: fontWeight === 'bold' ? 700 : 600,
            fontStyle: fontStyle === 'italic' ? 'italic' : 'normal',
            textDecoration: textDecoration === 'underline' ? 'underline' : 'none',
            color: textColor || '#e2e8f0',
            textAlign: (textAlign as any) || 'center',
            lineHeight: 1.2,
            fontFamily: 'var(--font-sans, system-ui)',
            wordBreak: 'break-word',
          }}
        >
          {label}
        </span>
        {description && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-dim, #94a3b8)',
              textAlign: (textAlign as any) || 'center',
              lineHeight: 1.2,
              fontFamily: 'var(--font-sans, system-ui)',
            }}
          >
            {description}
          </span>
        )}
      </div>

      {/* Connection handles — hidden by default, visible on hover/select */}
      <Handle type="target" position={Position.Top} style={showHandles ? handleVisibleStyle : handleHiddenStyle} />
      <Handle type="source" position={Position.Bottom} style={showHandles ? handleVisibleStyle : handleHiddenStyle} />
      <Handle type="target" position={Position.Left} id="left" style={showHandles ? handleVisibleStyle : handleHiddenStyle} />
      <Handle type="source" position={Position.Right} id="right" style={showHandles ? handleVisibleStyle : handleHiddenStyle} />
    </div>
  );
}

const resizerHandleStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 2,
  background: 'var(--amber, #d4a017)',
  border: '1px solid var(--surface, #1e1e1e)',
};

const resizerLineStyle: React.CSSProperties = {
  borderColor: 'var(--amber, #d4a017)',
  borderWidth: 1,
  opacity: 0.5,
};

const handleVisibleStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  background: 'var(--text-dim, #64748b)',
  border: '2px solid var(--surface, #1e1e1e)',
  opacity: 1,
  transition: 'opacity 0.15s, background 0.15s',
};

const handleHiddenStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  background: 'var(--text-dim, #64748b)',
  border: '2px solid var(--surface, #1e1e1e)',
  opacity: 0,
  transition: 'opacity 0.15s',
};

export const BaseShape = memo(BaseShapeInner);
