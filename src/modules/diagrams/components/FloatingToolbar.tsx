import { useEffect, useState, useCallback, useRef } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import {
  Bold, Italic, Copy, Trash2, Palette,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  ArrowLeftRight, ArrowUpDown, Group, Zap, Minus,
} from 'lucide-react';
import { useDiagramsStore } from '@/stores/diagrams.store';
import { COLOR_PALETTE } from '../types';

// ─── FloatingToolbar ────────────────────────────────────

export function FloatingToolbar() {
  const selectedElement = useDiagramsStore((s) => s.selectedElement);
  const nodes = useDiagramsStore((s) => s.nodes);
  const edges = useDiagramsStore((s) => s.edges);
  const editingNodeId = useDiagramsStore((s) => s.editingNodeId);
  const reactFlow = useReactFlow();
  const viewport = useViewport();

  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [showColors, setShowColors] = useState(false);

  const selectedNodes = nodes.filter((n) => n.selected);
  const multiSelect = selectedNodes.length >= 2;

  // Use refs to avoid putting derived arrays in dependency arrays
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  // Compute position above selected node(s)
  const computePosition = useCallback(() => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const selNodes = currentNodes.filter((n) => n.selected);
    const isMulti = selNodes.length >= 2;

    if (editingNodeId) { setPosition(null); return; }

    if (isMulti) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity;
      for (const n of selNodes) {
        const w = n.width ?? n.measured?.width ?? 160;
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + w);
      }
      const screenPos = reactFlow.flowToScreenPosition({ x: (minX + maxX) / 2, y: minY });
      setPosition({ x: screenPos.x, y: screenPos.y - 48 });
      return;
    }

    if (selectedElement?.type === 'node') {
      const node = currentNodes.find((n) => n.id === selectedElement.id);
      if (!node) { setPosition(null); return; }
      const w = node.width ?? node.measured?.width ?? 160;
      const screenPos = reactFlow.flowToScreenPosition({
        x: node.position.x + w / 2,
        y: node.position.y,
      });
      setPosition({ x: screenPos.x, y: screenPos.y - 48 });
      return;
    }

    if (selectedElement?.type === 'edge') {
      const edge = currentEdges.find((e) => e.id === selectedElement.id);
      if (!edge) { setPosition(null); return; }
      const sourceNode = currentNodes.find((n) => n.id === edge.source);
      const targetNode = currentNodes.find((n) => n.id === edge.target);
      if (!sourceNode || !targetNode) { setPosition(null); return; }
      const midX = (sourceNode.position.x + targetNode.position.x) / 2;
      const midY = (sourceNode.position.y + targetNode.position.y) / 2;
      const screenPos = reactFlow.flowToScreenPosition({ x: midX, y: midY });
      setPosition({ x: screenPos.x, y: screenPos.y - 48 });
      return;
    }

    setPosition(null);
  }, [selectedElement, editingNodeId, reactFlow]);

  // Recompute when viewport, selection, or nodes change
  useEffect(() => {
    computePosition();
  }, [computePosition, viewport.x, viewport.y, viewport.zoom, nodes, edges]);

  if (!position) return null;
  if (!selectedElement && !multiSelect) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: Math.max(8, position.y),
        transform: 'translateX(-50%)',
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '3px 4px',
        background: 'rgba(17, 17, 24, 0.95)',
        border: '1px solid var(--border, #333)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        pointerEvents: 'auto',
      }}
    >
      {/* Multi-select toolbar */}
      {multiSelect && <MultiSelectToolbar selectedIds={selectedNodes.map((n) => n.id)} onShowColors={() => setShowColors(!showColors)} />}

      {/* Single node toolbar */}
      {!multiSelect && selectedElement?.type === 'node' && (
        <SingleNodeToolbar id={selectedElement.id} onShowColors={() => setShowColors(!showColors)} />
      )}

      {/* Single edge toolbar */}
      {!multiSelect && selectedElement?.type === 'edge' && (
        <SingleEdgeToolbar id={selectedElement.id} />
      )}

      {/* Color palette dropdown */}
      {showColors && (selectedElement?.type === 'node' || multiSelect) && (
        <ColorDropdown
          nodeIds={multiSelect ? selectedNodes.map((n) => n.id) : selectedElement?.type === 'node' ? [selectedElement.id] : []}
          onClose={() => setShowColors(false)}
        />
      )}
    </div>
  );
}

// ─── Single Node Toolbar ────────────────────────────────

function SingleNodeToolbar({ id, onShowColors }: { id: string; onShowColors: () => void }) {
  const node = useDiagramsStore((s) => s.nodes.find((n) => n.id === id));
  const updateNodeData = useDiagramsStore((s) => s.updateNodeData);
  const duplicateNodes = useDiagramsStore((s) => s.duplicateNodes);
  const removeNode = useDiagramsStore((s) => s.removeNode);

  if (!node) return null;

  const isBold = node.data.fontWeight === 'bold';
  const isItalic = node.data.fontStyle === 'italic';

  return (
    <>
      <FBtn
        title="Bold"
        active={isBold}
        onClick={() => updateNodeData(id, { fontWeight: isBold ? 'normal' : 'bold' })}
      >
        <Bold size={13} />
      </FBtn>
      <FBtn
        title="Italic"
        active={isItalic}
        onClick={() => updateNodeData(id, { fontStyle: isItalic ? 'normal' : 'italic' })}
      >
        <Italic size={13} />
      </FBtn>
      <FDivider />
      <FBtn title="Color" onClick={onShowColors}>
        <Palette size={13} />
      </FBtn>
      <FDivider />
      <FBtn title="Duplicate" onClick={() => duplicateNodes([id])}>
        <Copy size={13} />
      </FBtn>
      <FBtn title="Delete" onClick={() => removeNode(id)} variant="danger">
        <Trash2 size={13} />
      </FBtn>
    </>
  );
}

// ─── Multi-Select Toolbar ───────────────────────────────

function MultiSelectToolbar({ selectedIds, onShowColors }: { selectedIds: string[]; onShowColors: () => void }) {
  const alignNodes = useDiagramsStore((s) => s.alignNodes);
  const distributeNodes = useDiagramsStore((s) => s.distributeNodes);
  const groupNodes = useDiagramsStore((s) => s.groupNodes);
  const deleteSelected = useDiagramsStore((s) => s.deleteSelected);

  return (
    <>
      <FBtn title="Align Left" onClick={() => alignNodes(selectedIds, 'left')}>
        <AlignStartVertical size={13} />
      </FBtn>
      <FBtn title="Align Center" onClick={() => alignNodes(selectedIds, 'center')}>
        <AlignCenterVertical size={13} />
      </FBtn>
      <FBtn title="Align Right" onClick={() => alignNodes(selectedIds, 'right')}>
        <AlignEndVertical size={13} />
      </FBtn>
      <FDivider />
      <FBtn title="Distribute Horizontal" onClick={() => distributeNodes(selectedIds, 'horizontal')}>
        <ArrowLeftRight size={13} />
      </FBtn>
      <FBtn title="Distribute Vertical" onClick={() => distributeNodes(selectedIds, 'vertical')}>
        <ArrowUpDown size={13} />
      </FBtn>
      <FDivider />
      <FBtn title="Group" onClick={() => groupNodes(selectedIds)}>
        <Group size={13} />
      </FBtn>
      <FBtn title="Color" onClick={onShowColors}>
        <Palette size={13} />
      </FBtn>
      <FDivider />
      <FBtn title="Delete All" onClick={deleteSelected} variant="danger">
        <Trash2 size={13} />
      </FBtn>
    </>
  );
}

// ─── Single Edge Toolbar ────────────────────────────────

function SingleEdgeToolbar({ id }: { id: string }) {
  const edge = useDiagramsStore((s) => s.edges.find((e) => e.id === id));
  const updateEdgeAnimated = useDiagramsStore((s) => s.updateEdgeAnimated);
  const updateEdgeData = useDiagramsStore((s) => s.updateEdgeData);
  const removeEdge = useDiagramsStore((s) => s.removeEdge);

  if (!edge) return null;

  const edgeData = (edge.data || {}) as Record<string, unknown>;

  return (
    <>
      <FBtn
        title={edge.animated ? 'Disable Animation' : 'Enable Animation'}
        active={!!edge.animated}
        onClick={() => updateEdgeAnimated(id, !edge.animated)}
      >
        <Zap size={13} />
      </FBtn>
      <FBtn
        title={edgeData.dashed ? 'Solid Line' : 'Dashed Line'}
        active={!!edgeData.dashed}
        onClick={() => updateEdgeData(id, { dashed: !edgeData.dashed })}
      >
        <Minus size={13} />
      </FBtn>
      <FDivider />
      <FBtn title="Delete" onClick={() => removeEdge(id)} variant="danger">
        <Trash2 size={13} />
      </FBtn>
    </>
  );
}

// ─── Color Dropdown ─────────────────────────────────────

function ColorDropdown({ nodeIds, onClose }: { nodeIds: string[]; onClose: () => void }) {
  const updateNodeData = useDiagramsStore((s) => s.updateNodeData);

  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginTop: 4,
        padding: 6,
        background: 'rgba(17, 17, 24, 0.95)',
        border: '1px solid var(--border, #333)',
        borderRadius: 6,
        display: 'flex',
        gap: 2,
        flexWrap: 'wrap',
        maxWidth: 160,
      }}
    >
      {COLOR_PALETTE.slice(0, 16).map((c) => (
        <button
          key={c}
          onClick={() => {
            nodeIds.forEach((id) => updateNodeData(id, { color: c }));
            onClose();
          }}
          style={{
            width: 16,
            height: 16,
            borderRadius: 3,
            background: c,
            border: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer',
            padding: 0,
          }}
        />
      ))}
    </div>
  );
}

// ─── Primitives ─────────────────────────────────────────

function FBtn({
  children,
  onClick,
  title,
  active,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
  variant?: 'danger';
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        borderRadius: 4,
        border: 'none',
        background: active ? 'var(--amber, #d4a017)' : 'transparent',
        color: active ? '#000' : variant === 'danger' ? '#ef4444' : 'var(--text, #e2e8f0)',
        cursor: 'pointer',
        padding: 0,
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--surface-hover, #2a2a2a)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

function FDivider() {
  return <div style={{ width: 1, height: 18, background: 'var(--border, #333)', margin: '0 1px', flexShrink: 0 }} />;
}
