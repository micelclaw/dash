import { create } from 'zustand';
import {
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge as rfAddEdge,
} from '@xyflow/react';
import type {
  DiagramNodeData,
  DiagramEdgeData,
  DiagramFile,
  DiagramSettings,
  DiagramPage,
  DiagramLayer,
  NodeShapeType,
} from '@/modules/diagrams/types';
import { DEFAULT_SETTINGS, SHAPE_DEFAULTS } from '@/modules/diagrams/types';

// ─── Types ──────────────────────────────────────────────

type DiagramNode = Node<DiagramNodeData>;
type DiagramEdge = Edge<DiagramEdgeData>;

interface HistoryEntry {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

interface DiagramsState {
  // Data
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  selectedElement: { type: 'node' | 'edge'; id: string } | null;
  clipboard: { nodes: DiagramNode[]; edges: DiagramEdge[] };

  // Canvas settings
  settings: DiagramSettings;

  // File context
  currentFileId: string | null;
  title: string;
  isDirty: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  aiLoading: boolean;

  // Inline editing
  editingNodeId: string | null;

  // AI prompt history
  aiPromptHistory: string[];

  // Multi-page
  pages: DiagramPage[];
  activePageId: string;

  // Viewport bookmarks (Ctrl+1-9 to save, 1-9 to navigate)
  bookmarks: Record<number, { x: number; y: number; zoom: number }>;

  // Undo/redo
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];

  // ─── Actions ─────────────────────────────────────────

  // React Flow callbacks
  onNodesChange: (changes: NodeChange<DiagramNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<DiagramEdge>[]) => void;
  onConnect: (connection: Connection) => void;

  // Node CRUD
  addNode: (type: NodeShapeType, position: { x: number; y: number }, data?: Partial<DiagramNodeData>) => void;
  removeNode: (id: string) => void;
  updateNodeData: (id: string, data: Partial<DiagramNodeData>) => void;
  updateNodeSize: (id: string, width: number, height: number) => void;

  // Edge CRUD
  removeEdge: (id: string) => void;
  updateEdgeData: (id: string, data: Partial<DiagramEdgeData>, label?: string) => void;
  updateEdgeType: (id: string, edgeType: string) => void;
  updateEdgeAnimated: (id: string, animated: boolean) => void;

  // Selection & multi-select
  selectElement: (type: 'node' | 'edge', id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
  deleteSelected: () => void;
  selectSimilar: (by: 'type' | 'color') => void;

  // Clipboard & duplicate
  duplicateNodes: (ids: string[]) => void;
  copyToClipboard: () => void;
  pasteFromClipboard: () => void;

  // Grouping
  groupNodes: (ids: string[]) => void;

  // Z-order
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;

  // Alignment & distribution
  alignNodes: (ids: string[], axis: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  distributeNodes: (ids: string[], direction: 'horizontal' | 'vertical') => void;

  // Advanced selection
  selectByType: (type: string) => void;
  selectByColor: (color: string) => void;
  selectConnected: (nodeId?: string) => void;
  selectNextNode: () => void;
  selectPrevNode: () => void;

  // Node transforms
  lockNode: (id: string, locked: boolean) => void;
  changeShape: (id: string, newType: NodeShapeType) => void;
  ungroupNodes: (groupId: string) => void;

  // Edge transforms
  reverseEdge: (id: string) => void;

  // Bulk operations
  setNodes: (nodes: DiagramNode[]) => void;

  // Settings
  updateSettings: (patch: Partial<DiagramSettings>) => void;

  // Title & file context
  setTitle: (title: string) => void;
  setSaveStatus: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
  setCurrentFileId: (fileId: string | null) => void;
  setAiLoading: (loading: boolean) => void;

  // Inline editing
  setEditingNode: (id: string | null) => void;

  // AI prompt history
  addToPromptHistory: (prompt: string) => void;

  // Pages
  addPage: (name?: string) => void;
  removePage: (pageId: string) => void;
  renamePage: (pageId: string, name: string) => void;
  switchPage: (pageId: string) => void;
  reorderPages: (pageIds: string[]) => void;
  getActivePageViewport: () => { x: number; y: number; zoom: number };
  setActivePageViewport: (viewport: { x: number; y: number; zoom: number }) => void;

  // Layers
  addLayer: (name?: string) => void;
  removeLayer: (layerId: string) => void;
  updateLayer: (layerId: string, patch: Partial<DiagramLayer>) => void;
  reorderLayers: (layerIds: string[]) => void;
  getActiveLayers: () => DiagramLayer[];

  // Bookmarks
  setBookmark: (slot: number, viewport: { x: number; y: number; zoom: number }) => void;
  getBookmark: (slot: number) => { x: number; y: number; zoom: number } | undefined;

  // Undo/redo
  undo: () => void;
  redo: () => void;

  // Load/reset
  loadDiagram: (diagram: DiagramFile, fileId?: string) => void;
  reset: () => void;

  // Export
  toDiagramFile: () => DiagramFile;
}

// ─── Helpers ────────────────────────────────────────────

let nodeIdCounter = 0;
function nextNodeId(): string {
  return `node-${Date.now()}-${++nodeIdCounter}`;
}

let edgeIdCounter = 0;
function nextEdgeId(): string {
  return `edge-${Date.now()}-${++edgeIdCounter}`;
}

let pageIdCounter = 0;
function nextPageId(): string {
  return `page-${Date.now()}-${++pageIdCounter}`;
}

let layerIdCounter = 0;
function nextLayerId(): string {
  return `layer-${Date.now()}-${++layerIdCounter}`;
}

function createDefaultLayer(): DiagramLayer {
  return {
    id: nextLayerId(),
    name: 'Default',
    visible: true,
    locked: false,
    color: '#3b82f6',
    opacity: 100,
  };
}

function createDefaultPage(name = 'Main', nodes: DiagramNode[] = [], edges: DiagramEdge[]= []): DiagramPage {
  return {
    id: nextPageId(),
    name,
    nodes: nodes.map((n) => ({ id: n.id, type: n.type || 'rectangle', position: n.position, data: { ...n.data }, width: n.width, height: n.height })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type, label: e.label as string | undefined, animated: e.animated, data: e.data ? { ...e.data } : undefined })),
    viewport: { x: 0, y: 0, zoom: 1 },
    layers: [createDefaultLayer()],
  };
}

function diagramFileToFlow(diagram: DiagramFile): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const nodes: DiagramNode[] = diagram.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { ...n.data },
    width: n.width,
    height: n.height,
    style: {
      width: n.width,
      height: n.height,
    },
  }));

  const edges: DiagramEdge[] = diagram.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.type || 'smoothstep',
    label: e.label,
    animated: e.animated,
    data: { ...e.data },
  }));

  return { nodes, edges };
}

const MAX_UNDO = 50;
const UNDO_THROTTLE_MS = 100;

// ─── Store ──────────────────────────────────────────────

export const useDiagramsStore = create<DiagramsState>()((set, get) => {
  let lastUndoPush = 0;

  function pushUndo() {
    const now = Date.now();
    if (now - lastUndoPush < UNDO_THROTTLE_MS) return;
    lastUndoPush = now;

    const { nodes, edges, undoStack } = get();
    const entry: HistoryEntry = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };
    const newStack = [...undoStack, entry];
    if (newStack.length > MAX_UNDO) newStack.shift();
    set({ undoStack: newStack, redoStack: [] });
  }

  return {
    nodes: [],
    edges: [],
    selectedElement: null,
    clipboard: { nodes: [], edges: [] },
    settings: { ...DEFAULT_SETTINGS },
    currentFileId: null,
    title: 'Untitled Diagram',
    isDirty: false,
    saveStatus: 'idle',
    aiLoading: false,
    editingNodeId: null,
    aiPromptHistory: [],
    pages: [],
    activePageId: '',
    bookmarks: {},
    undoStack: [],
    redoStack: [],

    // ─── React Flow callbacks ─────────────────────────

    onNodesChange: (changes: NodeChange<DiagramNode>[]) => {
      const hasPosition = changes.some((c) => c.type === 'position' && c.dragging === false);
      const hasDimensions = changes.some((c) => c.type === 'dimensions' && c.resizing === false);
      if (hasPosition || hasDimensions) pushUndo();
      set({
        nodes: applyNodeChanges<DiagramNode>(changes, get().nodes),
        isDirty: true,
      });
    },

    onEdgesChange: (changes: EdgeChange<DiagramEdge>[]) => {
      const hasRemove = changes.some((c) => c.type === 'remove');
      if (hasRemove) pushUndo();
      set({
        edges: applyEdgeChanges<DiagramEdge>(changes, get().edges),
        isDirty: true,
      });
    },

    onConnect: (connection) => {
      pushUndo();
      const newEdge: DiagramEdge = {
        ...connection,
        id: nextEdgeId(),
        type: get().settings.defaultEdgeType,
        data: {},
      } as DiagramEdge;
      set({
        edges: rfAddEdge(newEdge, get().edges),
        isDirty: true,
      });
    },

    // ─── Node CRUD ────────────────────────────────────

    addNode: (type, position, data) => {
      pushUndo();
      const defaults = SHAPE_DEFAULTS[type];
      const node: DiagramNode = {
        id: nextNodeId(),
        type,
        position,
        data: {
          label: type.charAt(0).toUpperCase() + type.slice(1),
          color: defaults.color,
          ...data,
        },
        width: defaults.width,
        height: defaults.height,
        style: {
          width: defaults.width,
          height: defaults.height,
        },
      };
      set({
        nodes: [...get().nodes, node],
        isDirty: true,
      });
    },

    removeNode: (id) => {
      pushUndo();
      set({
        nodes: get().nodes.filter((n) => n.id !== id),
        edges: get().edges.filter((e) => e.source !== id && e.target !== id),
        selectedElement: get().selectedElement?.id === id ? null : get().selectedElement,
        isDirty: true,
      });
    },

    updateNodeData: (id, data) => {
      pushUndo();
      set({
        nodes: get().nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
        ),
        isDirty: true,
      });
    },

    updateNodeSize: (id, width, height) => {
      pushUndo();
      set({
        nodes: get().nodes.map((n) =>
          n.id === id ? { ...n, width, height, style: { ...n.style, width, height } } : n,
        ),
        isDirty: true,
      });
    },

    // ─── Edge CRUD ────────────────────────────────────

    removeEdge: (id) => {
      pushUndo();
      set({
        edges: get().edges.filter((e) => e.id !== id),
        selectedElement: get().selectedElement?.id === id ? null : get().selectedElement,
        isDirty: true,
      });
    },

    updateEdgeData: (id, data, label) => {
      pushUndo();
      set({
        edges: get().edges.map((e) =>
          e.id === id
            ? { ...e, data: { ...e.data, ...data }, ...(label !== undefined ? { label } : {}) }
            : e,
        ),
        isDirty: true,
      });
    },

    updateEdgeType: (id, edgeType) => {
      pushUndo();
      set({
        edges: get().edges.map((e) =>
          e.id === id ? { ...e, type: edgeType, data: { ...e.data, pathType: edgeType } } : e,
        ),
        isDirty: true,
      });
    },

    updateEdgeAnimated: (id, animated) => {
      pushUndo();
      set({
        edges: get().edges.map((e) =>
          e.id === id ? { ...e, animated } : e,
        ),
        isDirty: true,
      });
    },

    // ─── Selection ────────────────────────────────────

    selectElement: (type, id) => {
      set({ selectedElement: { type, id } });
    },

    clearSelection: () => {
      set({ selectedElement: null });
    },

    selectAll: () => {
      const changes: NodeChange<DiagramNode>[] = get().nodes.map((n) => ({
        type: 'select' as const,
        id: n.id,
        selected: true,
      }));
      set({ nodes: applyNodeChanges<DiagramNode>(changes, get().nodes) });
    },

    deleteSelected: () => {
      const { nodes, edges, selectedElement } = get();
      const selectedNodeIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
      const selectedEdgeIds = new Set(edges.filter((e) => e.selected).map((e) => e.id));

      // Also include the single-selected element from our store
      if (selectedElement?.type === 'node') selectedNodeIds.add(selectedElement.id);
      if (selectedElement?.type === 'edge') selectedEdgeIds.add(selectedElement.id);

      if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return;

      pushUndo();
      set({
        nodes: nodes.filter((n) => !selectedNodeIds.has(n.id)),
        edges: edges.filter(
          (e) => !selectedEdgeIds.has(e.id) && !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target),
        ),
        selectedElement: null,
        isDirty: true,
      });
    },

    selectSimilar: (by) => {
      const { nodes, selectedElement } = get();
      if (!selectedElement || selectedElement.type !== 'node') return;
      const refNode = nodes.find((n) => n.id === selectedElement.id);
      if (!refNode) return;

      const matchFn = by === 'type'
        ? (n: DiagramNode) => n.type === refNode.type
        : (n: DiagramNode) => n.data.color === refNode.data.color;

      const changes: NodeChange<DiagramNode>[] = nodes.map((n) => ({
        type: 'select' as const,
        id: n.id,
        selected: matchFn(n),
      }));
      set({ nodes: applyNodeChanges<DiagramNode>(changes, nodes) });
    },

    // ─── Clipboard & Duplicate ──────────────────────

    duplicateNodes: (ids) => {
      const { nodes, edges } = get();
      const idSet = new Set(ids);
      const idMap = new Map<string, string>();

      const cloned = nodes
        .filter((n) => idSet.has(n.id))
        .map((n) => {
          const newId = nextNodeId();
          idMap.set(n.id, newId);
          return {
            ...n,
            id: newId,
            position: { x: n.position.x + 20, y: n.position.y + 20 },
            data: { ...n.data },
            selected: false,
          };
        });

      // Duplicate edges between cloned nodes
      const clonedEdges = edges
        .filter((e) => idSet.has(e.source) && idSet.has(e.target))
        .map((e) => ({
          ...e,
          id: nextEdgeId(),
          source: idMap.get(e.source) || e.source,
          target: idMap.get(e.target) || e.target,
          data: e.data ? { ...e.data } : {},
          selected: false,
        }));

      if (cloned.length === 0) return;
      pushUndo();
      set({
        nodes: [...nodes, ...cloned],
        edges: [...edges, ...clonedEdges],
        isDirty: true,
      });
    },

    copyToClipboard: () => {
      const { nodes, edges } = get();
      const selectedNodes = nodes.filter((n) => n.selected);
      if (selectedNodes.length === 0) return;

      const selectedIds = new Set(selectedNodes.map((n) => n.id));
      const interEdges = edges.filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target));

      set({
        clipboard: {
          nodes: JSON.parse(JSON.stringify(selectedNodes)),
          edges: JSON.parse(JSON.stringify(interEdges)),
        },
      });
    },

    pasteFromClipboard: () => {
      const { clipboard, nodes, edges } = get();
      if (clipboard.nodes.length === 0) return;

      const idMap = new Map<string, string>();
      const pasted = clipboard.nodes.map((n) => {
        const newId = nextNodeId();
        idMap.set(n.id, newId);
        return {
          ...n,
          id: newId,
          position: { x: n.position.x + 30, y: n.position.y + 30 },
          data: { ...n.data },
          selected: false,
        };
      });

      const pastedEdges = clipboard.edges.map((e) => ({
        ...e,
        id: nextEdgeId(),
        source: idMap.get(e.source) || e.source,
        target: idMap.get(e.target) || e.target,
        data: e.data ? { ...e.data } : {},
        selected: false,
      }));

      pushUndo();
      set({
        nodes: [...nodes, ...pasted],
        edges: [...edges, ...pastedEdges],
        isDirty: true,
      });
    },

    // ─── Grouping ───────────────────────────────────

    groupNodes: (ids) => {
      const { nodes } = get();
      const idSet = new Set(ids);
      const targets = nodes.filter((n) => idSet.has(n.id));
      if (targets.length < 2) return;

      // Compute bounding box with padding
      const PAD = 30;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of targets) {
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + (n.width ?? 160));
        maxY = Math.max(maxY, n.position.y + (n.height ?? 70));
      }

      pushUndo();

      const groupId = nextNodeId();
      const groupNode: DiagramNode = {
        id: groupId,
        type: 'group',
        position: { x: minX - PAD, y: minY - PAD },
        data: {
          label: 'Group',
          color: SHAPE_DEFAULTS.group.color,
        },
        width: maxX - minX + PAD * 2,
        height: maxY - minY + PAD * 2,
        style: {
          width: maxX - minX + PAD * 2,
          height: maxY - minY + PAD * 2,
        },
      };

      // Reparent children: make positions relative to group
      const updatedNodes = nodes.map((n) => {
        if (!idSet.has(n.id)) return n;
        return {
          ...n,
          parentId: groupId,
          position: {
            x: n.position.x - (minX - PAD),
            y: n.position.y - (minY - PAD),
          },
        };
      });

      set({
        nodes: [groupNode, ...updatedNodes],
        isDirty: true,
      });
    },

    // ─── Z-order ────────────────────────────────────

    bringToFront: (id) => {
      const { nodes } = get();
      const idx = nodes.findIndex((n) => n.id === id);
      if (idx < 0 || idx === nodes.length - 1) return;
      pushUndo();
      const node = nodes[idx]!;
      const rest = [...nodes.slice(0, idx), ...nodes.slice(idx + 1)];
      set({ nodes: [...rest, node] });
    },

    sendToBack: (id) => {
      const { nodes } = get();
      const idx = nodes.findIndex((n) => n.id === id);
      if (idx <= 0) return;
      pushUndo();
      const node = nodes[idx]!;
      const rest = [...nodes.slice(0, idx), ...nodes.slice(idx + 1)];
      set({ nodes: [node, ...rest] });
    },

    // ─── Alignment & Distribution ───────────────────

    alignNodes: (ids, axis) => {
      const { nodes } = get();
      const targets = nodes.filter((n) => ids.includes(n.id));
      if (targets.length < 2) return;

      pushUndo();

      // Compute bounds for each target
      const bounds = targets.map((n) => {
        const w = n.width ?? n.measured?.width ?? 160;
        const h = n.height ?? n.measured?.height ?? 70;
        return { id: n.id, x: n.position.x, y: n.position.y, w, h };
      });

      let ref: number;
      const updated = new Map<string, { x: number; y: number }>();

      switch (axis) {
        case 'left':
          ref = Math.min(...bounds.map((b) => b.x));
          bounds.forEach((b) => updated.set(b.id, { x: ref, y: b.y }));
          break;
        case 'center':
          ref = bounds.reduce((s, b) => s + b.x + b.w / 2, 0) / bounds.length;
          bounds.forEach((b) => updated.set(b.id, { x: ref - b.w / 2, y: b.y }));
          break;
        case 'right':
          ref = Math.max(...bounds.map((b) => b.x + b.w));
          bounds.forEach((b) => updated.set(b.id, { x: ref - b.w, y: b.y }));
          break;
        case 'top':
          ref = Math.min(...bounds.map((b) => b.y));
          bounds.forEach((b) => updated.set(b.id, { x: b.x, y: ref }));
          break;
        case 'middle':
          ref = bounds.reduce((s, b) => s + b.y + b.h / 2, 0) / bounds.length;
          bounds.forEach((b) => updated.set(b.id, { x: b.x, y: ref - b.h / 2 }));
          break;
        case 'bottom':
          ref = Math.max(...bounds.map((b) => b.y + b.h));
          bounds.forEach((b) => updated.set(b.id, { x: b.x, y: ref - b.h }));
          break;
      }

      set({
        nodes: nodes.map((n) => {
          const pos = updated.get(n.id);
          return pos ? { ...n, position: pos } : n;
        }),
        isDirty: true,
      });
    },

    distributeNodes: (ids, direction) => {
      const { nodes } = get();
      const targets = nodes.filter((n) => ids.includes(n.id));
      if (targets.length < 3) return;

      pushUndo();

      const bounds = targets.map((n) => {
        const w = n.width ?? n.measured?.width ?? 160;
        const h = n.height ?? n.measured?.height ?? 70;
        return { id: n.id, x: n.position.x, y: n.position.y, w, h };
      });

      const updated = new Map<string, { x: number; y: number }>();

      if (direction === 'horizontal') {
        bounds.sort((a, b) => a.x - b.x);
        const first = bounds[0]!;
        const last = bounds[bounds.length - 1]!;
        const totalSpace = (last.x + last.w) - first.x;
        const totalWidth = bounds.reduce((s, b) => s + b.w, 0);
        const gap = (totalSpace - totalWidth) / (bounds.length - 1);
        let cx = first.x;
        bounds.forEach((b) => {
          updated.set(b.id, { x: cx, y: b.y });
          cx += b.w + gap;
        });
      } else {
        bounds.sort((a, b) => a.y - b.y);
        const first = bounds[0]!;
        const last = bounds[bounds.length - 1]!;
        const totalSpace = (last.y + last.h) - first.y;
        const totalHeight = bounds.reduce((s, b) => s + b.h, 0);
        const gap = (totalSpace - totalHeight) / (bounds.length - 1);
        let cy = first.y;
        bounds.forEach((b) => {
          updated.set(b.id, { x: b.x, y: cy });
          cy += b.h + gap;
        });
      }

      set({
        nodes: nodes.map((n) => {
          const pos = updated.get(n.id);
          return pos ? { ...n, position: pos } : n;
        }),
        isDirty: true,
      });
    },

    // ─── Advanced Selection ─────────────────────────

    selectByType: (type) => {
      const changes: NodeChange<DiagramNode>[] = get().nodes.map((n) => ({
        type: 'select' as const,
        id: n.id,
        selected: n.type === type,
      }));
      set({ nodes: applyNodeChanges<DiagramNode>(changes, get().nodes) });
    },

    selectByColor: (color) => {
      const changes: NodeChange<DiagramNode>[] = get().nodes.map((n) => ({
        type: 'select' as const,
        id: n.id,
        selected: n.data.color === color,
      }));
      set({ nodes: applyNodeChanges<DiagramNode>(changes, get().nodes) });
    },

    selectConnected: (nodeId?) => {
      const { nodes, edges, selectedElement } = get();
      // Determine starting nodes: explicit nodeId, or currently selected nodes
      const startIds = new Set<string>();
      if (nodeId) {
        startIds.add(nodeId);
      } else {
        for (const n of nodes) {
          if (n.selected) startIds.add(n.id);
        }
        if (selectedElement?.type === 'node') startIds.add(selectedElement.id);
      }
      if (startIds.size === 0) return;

      // BFS traversal
      const visited = new Set<string>(startIds);
      const queue = [...startIds];
      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const e of edges) {
          if (e.source === current && !visited.has(e.target)) {
            visited.add(e.target);
            queue.push(e.target);
          }
          if (e.target === current && !visited.has(e.source)) {
            visited.add(e.source);
            queue.push(e.source);
          }
        }
      }
      const changes: NodeChange<DiagramNode>[] = nodes.map((n) => ({
        type: 'select' as const,
        id: n.id,
        selected: visited.has(n.id),
      }));
      set({ nodes: applyNodeChanges<DiagramNode>(changes, nodes) });
    },

    selectNextNode: () => {
      const { nodes, selectedElement } = get();
      if (nodes.length === 0) return;
      const currentIdx = selectedElement?.type === 'node'
        ? nodes.findIndex((n) => n.id === selectedElement.id)
        : -1;
      const nextIdx = (currentIdx + 1) % nodes.length;
      const nextNode = nodes[nextIdx]!;
      // Deselect all, select next
      const changes: NodeChange<DiagramNode>[] = nodes.map((n) => ({
        type: 'select' as const,
        id: n.id,
        selected: n.id === nextNode.id,
      }));
      set({
        nodes: applyNodeChanges<DiagramNode>(changes, nodes),
        selectedElement: { type: 'node', id: nextNode.id },
      });
    },

    selectPrevNode: () => {
      const { nodes, selectedElement } = get();
      if (nodes.length === 0) return;
      const currentIdx = selectedElement?.type === 'node'
        ? nodes.findIndex((n) => n.id === selectedElement.id)
        : 0;
      const prevIdx = (currentIdx - 1 + nodes.length) % nodes.length;
      const prevNode = nodes[prevIdx]!;
      const changes: NodeChange<DiagramNode>[] = nodes.map((n) => ({
        type: 'select' as const,
        id: n.id,
        selected: n.id === prevNode.id,
      }));
      set({
        nodes: applyNodeChanges<DiagramNode>(changes, nodes),
        selectedElement: { type: 'node', id: prevNode.id },
      });
    },

    // ─── Node Transforms ────────────────────────────

    lockNode: (id, locked) => {
      set({
        nodes: get().nodes.map((n) =>
          n.id === id ? { ...n, draggable: !locked, data: { ...n.data, locked } } : n,
        ),
      });
    },

    changeShape: (id, newType) => {
      pushUndo();
      const defaults = SHAPE_DEFAULTS[newType];
      set({
        nodes: get().nodes.map((n) =>
          n.id === id
            ? {
                ...n,
                type: newType,
                data: { ...n.data, color: n.data.color || defaults.color },
              }
            : n,
        ),
        isDirty: true,
      });
    },

    ungroupNodes: (groupId) => {
      const { nodes } = get();
      const group = nodes.find((n) => n.id === groupId);
      if (!group || group.type !== 'group') return;

      pushUndo();

      // Reparent children back to canvas coordinates
      const updated = nodes
        .filter((n) => n.id !== groupId)
        .map((n) => {
          if ((n as any).parentId === groupId) {
            return {
              ...n,
              parentId: undefined,
              position: {
                x: n.position.x + group.position.x,
                y: n.position.y + group.position.y,
              },
            };
          }
          return n;
        });

      set({ nodes: updated, isDirty: true });
    },

    // ─── Edge Transforms ────────────────────────────

    reverseEdge: (id) => {
      pushUndo();
      set({
        edges: get().edges.map((e) =>
          e.id === id ? { ...e, source: e.target, target: e.source } : e,
        ),
        isDirty: true,
      });
    },

    // ─── Bulk operations ────────────────────────────

    setNodes: (newNodes) => {
      pushUndo();
      set({ nodes: newNodes, isDirty: true });
    },

    // ─── Settings ─────────────────────────────────────

    updateSettings: (patch) => {
      set({ settings: { ...get().settings, ...patch } });
    },

    setTitle: (title) => {
      set({ title, isDirty: true });
    },

    setSaveStatus: (status) => {
      set({ saveStatus: status });
    },

    setCurrentFileId: (fileId) => {
      set({ currentFileId: fileId });
    },

    setAiLoading: (loading) => {
      set({ aiLoading: loading });
    },

    setEditingNode: (id) => {
      set({ editingNodeId: id });
    },

    addToPromptHistory: (prompt) => {
      const { aiPromptHistory } = get();
      // Deduplicate: remove if already exists, then add to front
      const filtered = aiPromptHistory.filter((p) => p !== prompt);
      const updated = [prompt, ...filtered].slice(0, 20);
      set({ aiPromptHistory: updated });
    },

    // ─── Pages ─────────────────────────────────────────

    addPage: (name) => {
      const page = createDefaultPage(name || `Page ${get().pages.length + 1}`);
      // Save current page state before switching
      const { pages, activePageId, nodes, edges } = get();
      const updatedPages = pages.map((p) =>
        p.id === activePageId
          ? { ...p, nodes: nodes.map((n) => ({ id: n.id, type: n.type || 'rectangle', position: n.position, data: { ...n.data }, width: n.width, height: n.height })), edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type, label: e.label as string | undefined, animated: e.animated, data: e.data ? { ...e.data } : undefined })) }
          : p,
      );
      set({
        pages: [...updatedPages, page],
        activePageId: page.id,
        nodes: [],
        edges: [],
        undoStack: [],
        redoStack: [],
        selectedElement: null,
        editingNodeId: null,
        isDirty: true,
      });
    },

    removePage: (pageId) => {
      const { pages, activePageId } = get();
      if (pages.length <= 1) return; // Can't remove last page
      const filtered = pages.filter((p) => p.id !== pageId);
      if (activePageId === pageId) {
        // Switch to first remaining page
        const next = filtered[0]!;
        const { nodes, edges } = diagramFileToFlow({ nodes: next.nodes, edges: next.edges, version: '', title: '', description: '', viewport: next.viewport, settings: get().settings });
        set({
          pages: filtered,
          activePageId: next.id,
          nodes,
          edges,
          undoStack: [],
          redoStack: [],
          selectedElement: null,
          editingNodeId: null,
          isDirty: true,
        });
      } else {
        set({ pages: filtered, isDirty: true });
      }
    },

    renamePage: (pageId, name) => {
      set({
        pages: get().pages.map((p) =>
          p.id === pageId ? { ...p, name } : p,
        ),
        isDirty: true,
      });
    },

    switchPage: (pageId) => {
      const { pages, activePageId, nodes, edges } = get();
      if (pageId === activePageId) return;
      const target = pages.find((p) => p.id === pageId);
      if (!target) return;

      // Save current page state
      const updatedPages = pages.map((p) =>
        p.id === activePageId
          ? { ...p, nodes: nodes.map((n) => ({ id: n.id, type: n.type || 'rectangle', position: n.position, data: { ...n.data }, width: n.width, height: n.height })), edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type, label: e.label as string | undefined, animated: e.animated, data: e.data ? { ...e.data } : undefined })) }
          : p,
      );

      // Load target page
      const { nodes: newNodes, edges: newEdges } = diagramFileToFlow({ nodes: target.nodes, edges: target.edges, version: '', title: '', description: '', viewport: target.viewport, settings: get().settings });
      set({
        pages: updatedPages,
        activePageId: pageId,
        nodes: newNodes,
        edges: newEdges,
        undoStack: [],
        redoStack: [],
        selectedElement: null,
        editingNodeId: null,
      });
    },

    reorderPages: (pageIds) => {
      const { pages } = get();
      const pageMap = new Map(pages.map((p) => [p.id, p]));
      const reordered = pageIds.map((id) => pageMap.get(id)!).filter(Boolean);
      set({ pages: reordered });
    },

    getActivePageViewport: () => {
      const { pages, activePageId } = get();
      const page = pages.find((p) => p.id === activePageId);
      return page?.viewport ?? { x: 0, y: 0, zoom: 1 };
    },

    setActivePageViewport: (viewport) => {
      set({
        pages: get().pages.map((p) =>
          p.id === get().activePageId ? { ...p, viewport } : p,
        ),
      });
    },

    // ─── Layers ────────────────────────────────────────

    addLayer: (name) => {
      const layer: DiagramLayer = {
        id: nextLayerId(),
        name: name || `Layer ${get().getActiveLayers().length + 1}`,
        visible: true,
        locked: false,
        color: '#3b82f6',
        opacity: 100,
      };
      set({
        pages: get().pages.map((p) =>
          p.id === get().activePageId
            ? { ...p, layers: [...p.layers, layer] }
            : p,
        ),
        isDirty: true,
      });
    },

    removeLayer: (layerId) => {
      const layers = get().getActiveLayers();
      if (layers.length <= 1) return; // Keep at least one layer
      set({
        pages: get().pages.map((p) =>
          p.id === get().activePageId
            ? { ...p, layers: p.layers.filter((l) => l.id !== layerId) }
            : p,
        ),
        // Move orphaned nodes to first remaining layer
        nodes: get().nodes.map((n) =>
          n.data.layerId === layerId
            ? { ...n, data: { ...n.data, layerId: layers.find((l) => l.id !== layerId)?.id } }
            : n,
        ),
        isDirty: true,
      });
    },

    updateLayer: (layerId, patch) => {
      set({
        pages: get().pages.map((p) =>
          p.id === get().activePageId
            ? { ...p, layers: p.layers.map((l) => l.id === layerId ? { ...l, ...patch } : l) }
            : p,
        ),
        isDirty: true,
      });
    },

    reorderLayers: (layerIds) => {
      const { pages, activePageId } = get();
      set({
        pages: pages.map((p) => {
          if (p.id !== activePageId) return p;
          const layerMap = new Map(p.layers.map((l) => [l.id, l]));
          return { ...p, layers: layerIds.map((id) => layerMap.get(id)!).filter(Boolean) };
        }),
      });
    },

    getActiveLayers: () => {
      const { pages, activePageId } = get();
      const page = pages.find((p) => p.id === activePageId);
      return page?.layers ?? [];
    },

    // ─── Bookmarks ────────────────────────────────────

    setBookmark: (slot, viewport) => {
      set({ bookmarks: { ...get().bookmarks, [slot]: viewport } });
    },

    getBookmark: (slot) => {
      return get().bookmarks[slot];
    },

    // ─── Undo/Redo ───────────────────────────────────

    undo: () => {
      const { undoStack, nodes, edges } = get();
      if (undoStack.length === 0) return;
      const prev = undoStack[undoStack.length - 1] as HistoryEntry;
      const currentEntry: HistoryEntry = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
      };
      set({
        nodes: prev.nodes,
        edges: prev.edges,
        undoStack: undoStack.slice(0, -1),
        redoStack: [...get().redoStack, currentEntry],
        isDirty: true,
      });
    },

    redo: () => {
      const { redoStack, nodes, edges } = get();
      if (redoStack.length === 0) return;
      const next = redoStack[redoStack.length - 1] as HistoryEntry;
      const currentEntry: HistoryEntry = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
      };
      set({
        nodes: next.nodes,
        edges: next.edges,
        redoStack: redoStack.slice(0, -1),
        undoStack: [...get().undoStack, currentEntry],
        isDirty: true,
      });
    },

    // ─── Load/Reset ──────────────────────────────────

    loadDiagram: (diagram, fileId) => {
      let pages: DiagramPage[];
      let activePageId: string;

      if (diagram.pages && diagram.pages.length > 0) {
        // v2 format — use pages directly
        pages = diagram.pages;
        activePageId = pages[0]!.id;
      } else {
        // v1 format — migrate: wrap existing nodes/edges into a single "Main" page
        const page = createDefaultPage('Main');
        page.nodes = diagram.nodes;
        page.edges = diagram.edges;
        page.viewport = diagram.viewport;
        pages = [page];
        activePageId = page.id;
      }

      const activePage = pages.find((p) => p.id === activePageId)!;
      const { nodes, edges } = diagramFileToFlow({
        ...diagram,
        nodes: activePage.nodes,
        edges: activePage.edges,
      });

      set({
        nodes,
        edges,
        pages,
        activePageId,
        settings: { ...DEFAULT_SETTINGS, ...diagram.settings },
        currentFileId: fileId ?? null,
        title: diagram.title || 'Untitled Diagram',
        isDirty: false,
        saveStatus: 'idle',
        undoStack: [],
        redoStack: [],
        selectedElement: null,
        editingNodeId: null,
      });
    },

    reset: () => {
      const defaultPage = createDefaultPage('Main');
      set({
        nodes: [],
        edges: [],
        pages: [defaultPage],
        activePageId: defaultPage.id,
        selectedElement: null,
        clipboard: { nodes: [], edges: [] },
        settings: { ...DEFAULT_SETTINGS },
        currentFileId: null,
        title: 'Untitled Diagram',
        isDirty: false,
        saveStatus: 'idle',
        undoStack: [],
        redoStack: [],
        editingNodeId: null,
      });
    },

    toDiagramFile: (): DiagramFile => {
      const { nodes, edges, settings, title, pages, activePageId } = get();

      // Snapshot current page's nodes/edges into pages array
      const currentNodes = nodes.map((n) => ({
        id: n.id,
        type: n.type || 'rectangle',
        position: n.position,
        data: { ...n.data },
        width: n.width,
        height: n.height,
      }));
      const currentEdges = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type,
        label: e.label as string | undefined,
        animated: e.animated,
        data: e.data ? { ...e.data } : undefined,
      }));

      const updatedPages = pages.map((p) =>
        p.id === activePageId
          ? { ...p, nodes: currentNodes, edges: currentEdges }
          : p,
      );

      // Use active page data as top-level for v1 backwards compatibility
      return {
        version: '2.0.0',
        title,
        description: '',
        viewport: updatedPages.find((p) => p.id === activePageId)?.viewport ?? { x: 0, y: 0, zoom: 1 },
        nodes: currentNodes,
        edges: currentEdges,
        pages: updatedPages,
        settings,
      };
    },
  };
});
