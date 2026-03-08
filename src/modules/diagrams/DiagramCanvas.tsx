import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  ConnectionMode,
  useReactFlow,
  type OnSelectionChangeParams,
  type Node,
  type Edge,
  type NodeChange,
} from '@xyflow/react';
import { Loader2 } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import { useDiagramsStore } from '@/stores/diagrams.store';
import { nodeTypes } from './shapes';
import { edgeTypes } from './edges';
import { DiagramContextMenu, type ContextMenuState } from './DiagramContextMenu';
import { InlineEditor } from './components/InlineEditor';
import { MarkerDefs } from './edges/markers';
import { HelperLines } from './components/HelperLines';
import { FloatingToolbar } from './components/FloatingToolbar';
import { ZoomSlider } from './components/ZoomSlider';
import { CommandPalette } from './components/CommandPalette';
import { useHelperLines } from './hooks/use-helper-lines';
import { useConnectionValidation } from './hooks/use-connection-validation';
import { useLasso } from './hooks/use-lasso';
import { LassoOverlay } from './components/LassoOverlay';
import { LayerPanel } from './components/LayerPanel';

// Stable function reference to avoid ReactFlow re-renders
function minimapNodeColor(node: Node) {
  const data = node.data as Record<string, unknown> | undefined;
  return (data?.color as string) || 'var(--text-dim, #64748b)';
}

interface DiagramCanvasProps {
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
}

export function DiagramCanvas({ onDrop, onDragOver }: DiagramCanvasProps) {
  const nodes = useDiagramsStore((s) => s.nodes);
  const aiLoading = useDiagramsStore((s) => s.aiLoading);
  const edges = useDiagramsStore((s) => s.edges);
  const settings = useDiagramsStore((s) => s.settings);
  const onNodesChange = useDiagramsStore((s) => s.onNodesChange);
  const onEdgesChange = useDiagramsStore((s) => s.onEdgesChange);
  const onConnect = useDiagramsStore((s) => s.onConnect);
  const selectElement = useDiagramsStore((s) => s.selectElement);
  const clearSelection = useDiagramsStore((s) => s.clearSelection);
  const addNode = useDiagramsStore((s) => s.addNode);
  const setEditingNode = useDiagramsStore((s) => s.setEditingNode);
  const reactFlow = useReactFlow();

  // Connection validation
  const { isValidConnection } = useConnectionValidation(edges);

  // Helper lines for alignment guides
  const { helperLines, applyHelperLines } = useHelperLines(nodes, settings.snapToGuides);

  // Use refs to keep callbacks STABLE — ReactFlow stores callbacks in its internal
  // Zustand store, so changing the callback reference can trigger re-measurements
  // which fire onNodesChange again, creating an infinite loop.
  const applyHelperLinesRef = useRef(applyHelperLines);
  applyHelperLinesRef.current = applyHelperLines;
  const isValidConnectionRef = useRef(isValidConnection);
  isValidConnectionRef.current = isValidConnection;

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      const processed = applyHelperLinesRef.current(changes);
      (onNodesChange as (changes: NodeChange<Node>[]) => void)(processed);
    },
    [onNodesChange],
  );

  const stableIsValidConnection = useCallback(
    (...args: Parameters<typeof isValidConnection>) => isValidConnectionRef.current(...args),
    [],
  );

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const handleSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: OnSelectionChangeParams) => {
      const firstNode = selNodes[0];
      const firstEdge = selEdges[0];
      if (firstNode) {
        selectElement('node', firstNode.id);
      } else if (firstEdge) {
        selectElement('edge', firstEdge.id);
      } else {
        clearSelection();
      }
    },
    [selectElement, clearSelection],
  );

  // Context menu handlers
  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setContextMenu({ type: 'node', position: { x: e.clientX, y: e.clientY }, id: node.id });
  }, []);

  const onEdgeContextMenu = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.preventDefault();
    setContextMenu({ type: 'edge', position: { x: e.clientX, y: e.clientY }, id: edge.id });
  }, []);

  const onPaneContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ type: 'pane', position: { x: e.clientX, y: e.clientY } });
  }, []);

  // Double-click node → inline text editing
  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    selectElement('node', node.id);
    setEditingNode(node.id);
  }, [selectElement, setEditingNode]);

  // Viewport bookmarks + Command Palette
  useEffect(() => {
    const handleBookmarkKey = (e: KeyboardEvent) => {
      // Ctrl+K — Command Palette (always works)
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
        return;
      }

      if (useDiagramsStore.getState().editingNodeId) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // Ctrl+0 — fit view
      if (mod && e.key === '0') {
        e.preventDefault();
        reactFlow.fitView({ duration: 300, padding: 0.1 });
        return;
      }

      // Ctrl+1 — zoom to 100%
      if (mod && e.key === '1') {
        e.preventDefault();
        reactFlow.zoomTo(1, { duration: 200 });
        return;
      }

      // Ctrl+2-9 — save viewport bookmark
      if (mod && e.key >= '2' && e.key <= '9') {
        e.preventDefault();
        const slot = parseInt(e.key);
        const vp = reactFlow.getViewport();
        useDiagramsStore.getState().setBookmark(slot, vp);
        return;
      }

      // 2-9 without modifier — navigate to bookmark (only when no node selected)
      if (!mod && !e.shiftKey && !e.altKey && e.key >= '2' && e.key <= '9') {
        const { selectedElement } = useDiagramsStore.getState();
        if (selectedElement) return; // Don't intercept when something is selected
        const slot = parseInt(e.key);
        const bookmark = useDiagramsStore.getState().getBookmark(slot);
        if (bookmark) {
          e.preventDefault();
          reactFlow.setViewport(bookmark, { duration: 300 });
        }
      }
    };

    window.addEventListener('keydown', handleBookmarkKey);
    return () => window.removeEventListener('keydown', handleBookmarkKey);
  }, [reactFlow]);

  // Lasso (freeform) selection — Shift+drag on pane
  const screenToFlow = useCallback(
    (pos: { x: number; y: number }) => reactFlow.screenToFlowPosition(pos),
    [reactFlow],
  );
  const handleLassoSelect = useCallback(
    (nodeIds: string[]) => {
      const changes: NodeChange<Node>[] = nodeIds.map((id) => ({
        type: 'select' as const,
        id,
        selected: true,
      }));
      (onNodesChange as (changes: NodeChange<Node>[]) => void)(changes);
    },
    [onNodesChange],
  );
  const { lasso, startLasso, updateLasso, endLasso, cancelLasso } = useLasso(
    nodes,
    handleLassoSelect,
    screenToFlow,
  );
  const lassoRef = useRef({ startLasso, updateLasso, endLasso, cancelLasso });
  lassoRef.current = { startLasso, updateLasso, endLasso, cancelLasso };
  const lassoDrawingRef = useRef(false);

  // Pane mouse handlers for lasso
  const onPaneMouseDown = useCallback((e: React.MouseEvent) => {
    if (!e.shiftKey || e.button !== 0) return;
    // Only start lasso on the pane background, not on nodes/edges/controls
    const target = e.target as HTMLElement;
    if (target.closest('.react-flow__node') || target.closest('.react-flow__edge') || target.closest('.react-flow__controls')) return;
    lassoDrawingRef.current = true;
    lassoRef.current.startLasso(e.clientX, e.clientY);
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (lassoDrawingRef.current) {
        lassoRef.current.updateLasso(e.clientX, e.clientY);
      }
    };
    const onMouseUp = () => {
      if (lassoDrawingRef.current) {
        lassoDrawingRef.current = false;
        lassoRef.current.endLasso();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lassoDrawingRef.current) {
        lassoDrawingRef.current = false;
        lassoRef.current.cancelLasso();
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Add node from context menu (converts screen position to flow position)
  const handleAddNodeFromMenu = useCallback(
    (type: Parameters<typeof addNode>[0], screenPos: { x: number; y: number }) => {
      const pos = reactFlow.screenToFlowPosition(screenPos);
      addNode(type, pos);
    },
    [reactFlow, addNode],
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }} onMouseDown={onPaneMouseDown}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange as never}
        onEdgesChange={onEdgesChange as never}
        onConnect={onConnect}
        onSelectionChange={handleSelectionChange}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onNodeDoubleClick={onNodeDoubleClick}
        snapToGrid={settings.snapToGrid}
        snapGrid={[settings.gridSize, settings.gridSize]}
        defaultEdgeOptions={{ type: settings.defaultEdgeType }}
        isValidConnection={stableIsValidConnection}
        connectionMode={ConnectionMode.Loose}
        connectionLineStyle={{ stroke: 'var(--amber, #d4a017)', strokeWidth: 2, strokeDasharray: '6 3' }}
        fitView
        proOptions={{ hideAttribution: true }}
        style={{ background: 'var(--background, #111)' }}
      >
        {settings.showGrid && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={settings.gridSize}
            size={1}
            color="var(--text-dim, #333)"
          />
        )}
        {settings.showMinimap && (
          <MiniMap
            style={{
              background: 'var(--surface, #1a1a1a)',
              borderRadius: 8,
              border: '1px solid var(--border, #333)',
            }}
            maskColor="rgba(0,0,0,0.6)"
            nodeColor={minimapNodeColor}
            pannable
            zoomable
          />
        )}
      </ReactFlow>

      <LassoOverlay lasso={lasso} />
      <HelperLines lines={helperLines} />
      <MarkerDefs />
      <InlineEditor />
      <FloatingToolbar />
      <ZoomSlider />
      <LayerPanel />
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSave={() => {/* save handled by toolbar */}}
        onAutoLayout={() => {/* layout handled by toolbar */}}
        onExportPng={async () => {
          const el = document.querySelector('.react-flow') as HTMLElement | null;
          if (!el) return;
          const { toPng } = await import('html-to-image');
          const dataUrl = await toPng(el, { backgroundColor: '#111' });
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = 'diagram.png';
          a.click();
        }}
        onExportSvg={async () => {
          const el = document.querySelector('.react-flow') as HTMLElement | null;
          if (!el) return;
          const { toSvg } = await import('html-to-image');
          const dataUrl = await toSvg(el, { backgroundColor: '#111' });
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = 'diagram.svg';
          a.click();
        }}
        onExportJson={() => {
          const diagram = useDiagramsStore.getState().toDiagramFile();
          const blob = new Blob([JSON.stringify(diagram, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${diagram.title || 'diagram'}.json`;
          a.click();
          URL.revokeObjectURL(a.href);
        }}
      />

      {contextMenu && (
        <DiagramContextMenu
          state={contextMenu}
          onClose={() => setContextMenu(null)}
          onAddNode={handleAddNodeFromMenu}
        />
      )}

      {aiLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            zIndex: 20,
            pointerEvents: 'none',
          }}
        >
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--amber, #d4a017)' }} />
          <span style={{ fontSize: 13, color: 'var(--text, #e2e8f0)', fontFamily: 'var(--font-sans)' }}>
            Generating diagram...
          </span>
        </div>
      )}
    </div>
  );
}
