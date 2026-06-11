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

// ─── Diagram data model (mirrors core/diagrams.types.ts) ─────

export interface DiagramNodeData extends Record<string, unknown> {
  label: string;
  description?: string;
  icon?: string;
  color?: string;
  textColor?: string;
  bgColor?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  textAlign?: 'left' | 'center' | 'right';
  borderWidth?: number;
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  borderRadius?: number;
  opacity?: number;
  locked?: boolean;
  style?: Record<string, unknown>;
  rows?: Array<{ key: string; value: string; type?: string }>;         // TableNode
  properties?: Array<{ key: string; value: string }>;                  // CardNode
  markdown?: string;                                                    // MarkdownNode
  code?: string;                                                        // CodeBlockNode
  language?: string;                                                    // CodeBlockNode
  url?: string;                                                         // LinkNode / EmbedNode
  listItems?: Array<{ text: string; status: 'unchecked' | 'checked' | 'in-progress' }>; // ListNode
  embedType?: 'image' | 'emoji' | 'color';                             // EmbedNode
  embedUrl?: string;                                                    // EmbedNode
  layerId?: string;                                                      // Layer assignment
  pulse?: boolean;                                                        // Pulse animation
}

export interface DiagramNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: DiagramNodeData;
  width?: number;
  height?: number;
}

export type EdgeMarkerType = 'arrow' | 'arrowClosed' | 'diamond' | 'circle' | 'none';

export interface DiagramEdgeData extends Record<string, unknown> {
  color?: string;
  strokeWidth?: number;
  dashed?: boolean;
  labelBgColor?: string;
  pathType?: 'smoothstep' | 'step' | 'straight' | 'default' | 'smart' | 'elbow';
  markerStart?: EdgeMarkerType;
  markerEnd?: EdgeMarkerType;
  dataFlow?: boolean;                                                    // Particle animation
  glow?: boolean;                                                         // Glow animation
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
  animated?: boolean;
  data?: DiagramEdgeData;
}

export interface DiagramSettings {
  snapToGrid: boolean;
  snapToGuides: boolean;
  gridSize: number;
  showMinimap: boolean;
  showGrid: boolean;
  defaultEdgeType: string;
  connectionMode: string;
  autoSave: boolean;
}

export interface DiagramLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color: string;
  opacity: number;
}

export interface DiagramPage {
  id: string;
  name: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  viewport: { x: number; y: number; zoom: number };
  layers: DiagramLayer[];
}

export interface DiagramFile {
  version: string;
  title: string;
  description: string;
  viewport: { x: number; y: number; zoom: number };
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  pages?: DiagramPage[];
  settings: DiagramSettings;
}

export const DEFAULT_SETTINGS: DiagramSettings = {
  snapToGrid: true,
  snapToGuides: true,
  gridSize: 20,
  showMinimap: true,
  showGrid: true,
  defaultEdgeType: 'smoothstep',
  connectionMode: 'loose',
  autoSave: true,
};

export const VALID_NODE_TYPES = [
  'rectangle', 'rounded', 'diamond', 'circle', 'cylinder',
  'parallelogram', 'hexagon', 'cloud', 'document', 'group',
  'sticky', 'image', 'table', 'card', 'badge', 'banner',
  'triangle', 'trapezoid', 'pentagon',
  'queue', 'stack', 'database3d',
  'actor', 'note', 'separator',
  'server', 'desktop', 'mobile', 'router', 'firewall',
  'markdown', 'codeblock', 'link', 'list', 'embed',
] as const;

export type NodeShapeType = (typeof VALID_NODE_TYPES)[number];

export const SHAPE_DEFAULTS: Record<NodeShapeType, { width: number; height: number; color: string }> = {
  rectangle:     { width: 160, height: 70,  color: '#3b82f6' },
  rounded:       { width: 160, height: 60,  color: '#3b82f6' },
  diamond:       { width: 140, height: 100, color: '#f59e0b' },
  circle:        { width: 80,  height: 80,  color: '#22c55e' },
  cylinder:      { width: 140, height: 80,  color: '#3b82f6' },
  parallelogram: { width: 160, height: 70,  color: '#f59e0b' },
  hexagon:       { width: 140, height: 70,  color: '#8b5cf6' },
  cloud:         { width: 150, height: 90,  color: '#8b5cf6' },
  document:      { width: 160, height: 80,  color: '#22c55e' },
  group:         { width: 300, height: 200, color: '#6b7280' },
  sticky:        { width: 160, height: 120, color: '#eab308' },
  image:         { width: 160, height: 120, color: '#ec4899' },
  table:         { width: 200, height: 140, color: '#3b82f6' },
  card:          { width: 200, height: 140, color: '#22c55e' },
  badge:         { width: 140, height: 36,  color: '#06b6d4' },
  banner:        { width: 320, height: 50,  color: '#d4a017' },
  triangle:      { width: 100, height: 90,  color: '#f59e0b' },
  trapezoid:     { width: 140, height: 80,  color: '#f59e0b' },
  pentagon:      { width: 100, height: 100, color: '#8b5cf6' },
  queue:         { width: 180, height: 70,  color: '#06b6d4' },
  stack:         { width: 140, height: 100, color: '#06b6d4' },
  database3d:    { width: 100, height: 120, color: '#3b82f6' },
  actor:         { width: 60,  height: 100, color: '#8b5cf6' },
  note:          { width: 160, height: 120, color: '#eab308' },
  separator:     { width: 300, height: 20,  color: '#6b7280' },
  server:        { width: 100, height: 120, color: '#3b82f6' },
  desktop:       { width: 120, height: 100, color: '#6b7280' },
  mobile:        { width: 60,  height: 100, color: '#6b7280' },
  router:        { width: 120, height: 70,  color: '#22c55e' },
  firewall:      { width: 100, height: 100, color: '#ef4444' },
  markdown:      { width: 200, height: 140, color: '#8b5cf6' },
  codeblock:     { width: 240, height: 160, color: '#6b7280' },
  link:          { width: 200, height: 50,  color: '#3b82f6' },
  list:          { width: 200, height: 140, color: '#22c55e' },
  embed:         { width: 200, height: 160, color: '#ec4899' },
};

export const COLOR_PALETTE = [
  '#3b82f6', '#60a5fa', '#2563eb',  // blues
  '#22c55e', '#4ade80', '#16a34a',  // greens
  '#f59e0b', '#fbbf24', '#d97706',  // ambers
  '#ef4444', '#f87171', '#dc2626',  // reds
  '#8b5cf6', '#a78bfa', '#7c3aed',  // purples
  '#ec4899', '#f472b6', '#db2777',  // pinks
  '#06b6d4', '#22d3ee', '#0891b2',  // cyans
  '#6b7280', '#9ca3af', '#374151',  // grays
];
