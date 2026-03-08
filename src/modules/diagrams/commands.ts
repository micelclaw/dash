/**
 * Centralized command registry for the diagram editor.
 * Used by the CommandPalette (Ctrl+K) and context menus.
 */
import type { NodeShapeType } from './types';
import { VALID_NODE_TYPES } from './types';

export interface DiagramCommand {
  id: string;
  label: string;
  category: 'shape' | 'action' | 'layout' | 'export' | 'navigation' | 'settings';
  shortcut?: string;
  icon?: string;
  /** If provided, only show when condition is met */
  when?: 'node-selected' | 'edge-selected' | 'any-selected' | 'always';
  action: (ctx: CommandContext) => void;
}

export interface CommandContext {
  addNode: (type: NodeShapeType, position: { x: number; y: number }) => void;
  deleteSelected: () => void;
  selectAll: () => void;
  undo: () => void;
  redo: () => void;
  duplicateNodes: (ids: string[]) => void;
  fitView: () => void;
  zoomTo: (level: number) => void;
  exportPng: () => void;
  exportSvg: () => void;
  exportJson: () => void;
  autoLayout: (direction: string) => void;
  save: () => void;
  toggleGrid: () => void;
  toggleMinimap: () => void;
  toggleSnapToGrid: () => void;
  focusNode: (nodeId: string) => void;
}

// ─── Shape Commands (auto-generated from VALID_NODE_TYPES) ───

const SHAPE_LABELS: Partial<Record<NodeShapeType, string>> = {
  rectangle: 'Rectangle',
  rounded: 'Rounded Rectangle',
  diamond: 'Diamond',
  circle: 'Circle',
  cylinder: 'Cylinder',
  parallelogram: 'Parallelogram',
  hexagon: 'Hexagon',
  cloud: 'Cloud',
  document: 'Document',
  group: 'Group',
  sticky: 'Sticky Note',
  image: 'Image',
  table: 'Table / ERD',
  card: 'Card',
  badge: 'Badge',
  banner: 'Banner',
  triangle: 'Triangle',
  trapezoid: 'Trapezoid',
  pentagon: 'Pentagon',
  queue: 'Queue',
  stack: 'Stack',
  database3d: 'Database 3D',
  actor: 'Actor / Person',
  note: 'Note',
  separator: 'Separator',
  server: 'Server',
  desktop: 'Desktop',
  mobile: 'Mobile',
  router: 'Router',
  firewall: 'Firewall',
  markdown: 'Markdown',
  codeblock: 'Code Block',
  link: 'Link / URL',
  list: 'Checklist',
  embed: 'Embed',
};

const shapeCommands: DiagramCommand[] = VALID_NODE_TYPES
  .filter((t) => t !== 'group')
  .map((type) => ({
    id: `add-${type}`,
    label: `Add ${SHAPE_LABELS[type] || type}`,
    category: 'shape' as const,
    when: 'always' as const,
    action: (ctx) => ctx.addNode(type, { x: 200 + Math.random() * 100, y: 200 + Math.random() * 100 }),
  }));

// ─── Action Commands ─────────────────────────────────────

const actionCommands: DiagramCommand[] = [
  { id: 'undo', label: 'Undo', category: 'action', shortcut: 'Ctrl+Z', when: 'always', action: (ctx) => ctx.undo() },
  { id: 'redo', label: 'Redo', category: 'action', shortcut: 'Ctrl+Shift+Z', when: 'always', action: (ctx) => ctx.redo() },
  { id: 'delete', label: 'Delete Selected', category: 'action', shortcut: 'Delete', when: 'any-selected', action: (ctx) => ctx.deleteSelected() },
  { id: 'select-all', label: 'Select All', category: 'action', shortcut: 'Ctrl+A', when: 'always', action: (ctx) => ctx.selectAll() },
  { id: 'save', label: 'Save Diagram', category: 'action', shortcut: 'Ctrl+S', when: 'always', action: (ctx) => ctx.save() },
];

// ─── Layout Commands ─────────────────────────────────────

const layoutCommands: DiagramCommand[] = [
  { id: 'layout-tb', label: 'Layout: Top to Bottom', category: 'layout', when: 'always', action: (ctx) => ctx.autoLayout('TB') },
  { id: 'layout-lr', label: 'Layout: Left to Right', category: 'layout', when: 'always', action: (ctx) => ctx.autoLayout('LR') },
  { id: 'layout-bt', label: 'Layout: Bottom to Top', category: 'layout', when: 'always', action: (ctx) => ctx.autoLayout('BT') },
  { id: 'layout-rl', label: 'Layout: Right to Left', category: 'layout', when: 'always', action: (ctx) => ctx.autoLayout('RL') },
];

// ─── Export Commands ─────────────────────────────────────

const exportCommands: DiagramCommand[] = [
  { id: 'export-png', label: 'Export as PNG', category: 'export', when: 'always', action: (ctx) => ctx.exportPng() },
  { id: 'export-svg', label: 'Export as SVG', category: 'export', when: 'always', action: (ctx) => ctx.exportSvg() },
  { id: 'export-json', label: 'Export as JSON', category: 'export', when: 'always', action: (ctx) => ctx.exportJson() },
];

// ─── Navigation Commands ─────────────────────────────────

const navigationCommands: DiagramCommand[] = [
  { id: 'fit-view', label: 'Fit View', category: 'navigation', shortcut: 'Ctrl+0', when: 'always', action: (ctx) => ctx.fitView() },
  { id: 'zoom-100', label: 'Zoom to 100%', category: 'navigation', shortcut: 'Ctrl+1', when: 'always', action: (ctx) => ctx.zoomTo(1) },
  { id: 'zoom-50', label: 'Zoom to 50%', category: 'navigation', when: 'always', action: (ctx) => ctx.zoomTo(0.5) },
  { id: 'zoom-200', label: 'Zoom to 200%', category: 'navigation', when: 'always', action: (ctx) => ctx.zoomTo(2) },
];

// ─── Settings Commands ───────────────────────────────────

const settingsCommands: DiagramCommand[] = [
  { id: 'toggle-grid', label: 'Toggle Grid', category: 'settings', when: 'always', action: (ctx) => ctx.toggleGrid() },
  { id: 'toggle-minimap', label: 'Toggle Minimap', category: 'settings', when: 'always', action: (ctx) => ctx.toggleMinimap() },
  { id: 'toggle-snap', label: 'Toggle Snap to Grid', category: 'settings', when: 'always', action: (ctx) => ctx.toggleSnapToGrid() },
];

// ─── All Commands ────────────────────────────────────────

export const ALL_COMMANDS: DiagramCommand[] = [
  ...actionCommands,
  ...navigationCommands,
  ...layoutCommands,
  ...exportCommands,
  ...settingsCommands,
  ...shapeCommands,
];

export const CATEGORY_LABELS: Record<DiagramCommand['category'], string> = {
  action: 'Actions',
  navigation: 'Navigation',
  layout: 'Layout',
  export: 'Export',
  settings: 'Settings',
  shape: 'Add Shape',
};
