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

import { useMemo, useState, useCallback, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';
import { AgentTreeNode } from './AgentTreeNode';
import { AgentDetail } from './AgentDetail';
import type { ManagedAgent } from './types';

interface AgentTreeProps {
  agents: ManagedAgent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isMobile?: boolean;
  onAgentChanged?: () => void;
  onBrowseFiles?: (agentId: string) => void;
}

interface TreeNode {
  agent: ManagedAgent;
  children: TreeNode[];
  x: number;
  y: number;
  height: number;
}

interface BracketEdge {
  parentX: number;
  parentY: number;
  children: { x: number; y: number; id: string }[];
  color: string;
  parentId: string;
}

const NODE_WIDTH = 360;
const LEVEL_HEIGHT = 320;
const H_GAP = 56;
const BRACKET_OFFSET = 36;
const CORNER_RADIUS = 10;

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.6;
const ZOOM_STEP = 0.08;

function computeCardHeight(agent: ManagedAgent, childCount: number, isOwner: boolean): number {
  if (isOwner) return 90;
  let h = 40;   // padding (20 + 20)
  h += 32;      // header row
  h += 14;      // gap
  h += 22;      // role description
  h += 14;      // gap
  const skillRows = Math.max(1, Math.ceil(Math.min(agent.skills.length, 6) / 3));
  h += skillRows * 32; // skill tag rows
  h += 14;      // gap
  h += 30;      // footer (status + model badges)
  if (childCount > 0) {
    h += 14;    // gap + marginTop
    h += 34;    // toggle (paddingTop + borderTop + content)
  }
  return h;
}

const OWNER_AGENT: ManagedAgent = {
  id: 'owner',
  name: 'paco',
  display_name: 'Paco',
  role: 'Owner',
  avatar: '👤',
  model: '',
  color: '#d4a017',
  is_chief: true,
  parent_agent_id: null,
  skills: [],
  workspace_path: '',
  status: 'active',
  last_active_at: null,
  sessions_today: 0,
  tokens_today: 0,
  created_at: '',
};

// ─── Tree building ────────────────────────────────────────────────

function buildTree(agents: ManagedAgent[]): TreeNode {
  const rootChildren = agents.filter(a => a.parent_agent_id === null);
  const childCounts = new Map<string, number>();
  for (const a of agents) {
    if (a.parent_agent_id) {
      childCounts.set(a.parent_agent_id, (childCounts.get(a.parent_agent_id) || 0) + 1);
    }
  }

  function buildChildren(parentId: string, depth: number): TreeNode[] {
    const kids = agents.filter(a => a.parent_agent_id === parentId);
    return kids.map(agent => {
      const cc = childCounts.get(agent.id) || 0;
      const node: TreeNode = {
        agent,
        children: [],
        x: 0,
        y: depth * LEVEL_HEIGHT,
        height: computeCardHeight(agent, cc, false),
      };
      node.children = buildChildren(agent.id, depth + 1);
      return node;
    });
  }

  const ownerChildCount = rootChildren.length;
  const ownerNode: TreeNode = {
    agent: OWNER_AGENT,
    children: rootChildren.map(agent => {
      const cc = childCounts.get(agent.id) || 0;
      const node: TreeNode = {
        agent,
        children: [],
        x: 0,
        y: LEVEL_HEIGHT,
        height: computeCardHeight(agent, cc, false),
      };
      node.children = buildChildren(agent.id, 2);
      return node;
    }),
    x: 0,
    y: 0,
    height: computeCardHeight(OWNER_AGENT, ownerChildCount, true),
  };

  return ownerNode;
}

// ─── Layout helpers ───────────────────────────────────────────────

function computeSubtreeWidth(node: TreeNode, collapsed: Set<string>): number {
  if (node.children.length === 0 || collapsed.has(node.agent.id)) return NODE_WIDTH;

  const childrenWidth = node.children.reduce(
    (sum, child) => sum + computeSubtreeWidth(child, collapsed),
    0,
  );
  const gapsWidth = H_GAP * (node.children.length - 1);
  return Math.max(NODE_WIDTH, childrenWidth + gapsWidth);
}

function layoutTree(node: TreeNode, left: number, depth: number, collapsed: Set<string>): void {
  const subtreeWidth = computeSubtreeWidth(node, collapsed);
  node.x = left + subtreeWidth / 2 - NODE_WIDTH / 2;
  node.y = depth * LEVEL_HEIGHT;

  if (node.children.length === 0 || collapsed.has(node.agent.id)) return;

  const childrenTotalWidth = node.children.reduce(
    (sum, child) => sum + computeSubtreeWidth(child, collapsed),
    0,
  ) + H_GAP * (node.children.length - 1);

  let childLeft = left + (subtreeWidth - childrenTotalWidth) / 2;

  for (const child of node.children) {
    const childWidth = computeSubtreeWidth(child, collapsed);
    layoutTree(child, childLeft, depth + 1, collapsed);
    childLeft += childWidth + H_GAP;
  }
}

function flattenNodes(node: TreeNode, collapsed: Set<string>): TreeNode[] {
  const result: TreeNode[] = [node];
  if (!collapsed.has(node.agent.id)) {
    for (const child of node.children) {
      result.push(...flattenNodes(child, collapsed));
    }
  }
  return result;
}

// ─── Edge collection (bracket-style) ─────────────────────────────

function collectBracketEdges(node: TreeNode, collapsed: Set<string>): BracketEdge[] {
  const edges: BracketEdge[] = [];
  if (node.children.length > 0 && !collapsed.has(node.agent.id)) {
    edges.push({
      parentX: node.x + NODE_WIDTH / 2,
      parentY: node.y + node.height,
      children: node.children.map(c => ({
        x: c.x + NODE_WIDTH / 2,
        y: c.y,
        id: c.agent.id,
      })),
      color: node.agent.color || 'var(--border)',
      parentId: node.agent.id,
    });
    for (const child of node.children) {
      edges.push(...collectBracketEdges(child, collapsed));
    }
  }
  return edges;
}

function renderBracketPaths(edge: BracketEdge): string[] {
  const { parentX, parentY, children } = edge;
  const bracketY = parentY + BRACKET_OFFSET;
  const r = CORNER_RADIUS;

  return children.map(child => {
    const dx = child.x - parentX;
    if (Math.abs(dx) < 1) {
      return `M ${parentX} ${parentY} L ${parentX} ${child.y}`;
    }
    const dir = dx > 0 ? 1 : -1;
    const absDx = Math.abs(dx);
    const clampedR = Math.min(r, absDx, Math.abs(child.y - bracketY));
    return [
      `M ${parentX} ${parentY}`,
      `L ${parentX} ${bracketY - clampedR}`,
      `Q ${parentX} ${bracketY}, ${parentX + dir * clampedR} ${bracketY}`,
      `L ${child.x - dir * clampedR} ${bracketY}`,
      `Q ${child.x} ${bracketY}, ${child.x} ${bracketY + clampedR}`,
      `L ${child.x} ${child.y}`,
    ].join(' ');
  });
}

// ─── Child count helper ──────────────────────────────────────────

function buildChildCountMap(agents: ManagedAgent[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const agent of agents) {
    if (agent.parent_agent_id) {
      map.set(agent.parent_agent_id, (map.get(agent.parent_agent_id) || 0) + 1);
    }
  }
  return map;
}

// ─── Main component ───────────────────────────────────────────────

export function AgentTree({ agents, selectedId, onSelect, isMobile, onAgentChanged, onBrowseFiles }: AgentTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(0.85);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleExpand = useCallback((agentId: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) return; // Don't interfere with browser zoom
    e.preventDefault();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;

    setZoom(prev => {
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta));

      // Cursor position in content coordinates (unscaled)
      const cursorX = (e.clientX - rect.left + container.scrollLeft) / prev;
      const cursorY = (e.clientY - rect.top + container.scrollTop) / prev;

      // Adjust scroll so cursor stays in the same viewport position
      requestAnimationFrame(() => {
        container.scrollLeft = cursorX * newZoom - (e.clientX - rect.left);
        container.scrollTop = cursorY * newZoom - (e.clientY - rect.top);
      });

      return newZoom;
    });
  }, []);

  const childCountMap = useMemo(() => buildChildCountMap(agents), [agents]);

  const { nodes, edges, svgWidth, svgHeight } = useMemo(() => {
    const root = buildTree(agents);
    const totalWidth = computeSubtreeWidth(root, collapsed);
    layoutTree(root, 0, 0, collapsed);

    const allNodes = flattenNodes(root, collapsed);
    const allEdges = collectBracketEdges(root, collapsed);

    const maxX = allNodes.reduce((max, n) => Math.max(max, n.x + NODE_WIDTH), 0);
    const maxY = allNodes.reduce((max, n) => Math.max(max, n.y + n.height), 0);

    return {
      nodes: allNodes,
      edges: allEdges,
      svgWidth: Math.max(totalWidth, maxX) + 80,
      svgHeight: maxY + 60,
    };
  }, [agents, collapsed]);

  const showDetail = selectedId && selectedId !== 'owner';

  // Mobile: fullscreen detail view with back button
  if (isMobile && showDetail) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}>
        <button
          onClick={() => onSelect('')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 12px',
            background: 'none',
            border: 'none',
            borderBottom: '1px solid var(--border)',
            color: 'var(--text-dim)',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={16} />
          Back to tree
        </button>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <AgentDetail
            agentId={selectedId}
            agents={agents}
            onSelect={onSelect}
            onAgentChanged={onAgentChanged}
            onBrowseFiles={onBrowseFiles}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Tree area */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: isMobile ? 16 : 32,
          position: 'relative',
        }}
      >
        {/* Zoom indicator */}
        <div style={{
          position: 'sticky',
          top: 0,
          left: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
          pointerEvents: 'none',
        }}>
          <span style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '3px 8px',
            pointerEvents: 'auto',
            userSelect: 'none',
          }}>
            {Math.round(zoom * 100)}%
          </span>
        </div>

        <div style={{
          transform: `scale(${zoom})`,
          transformOrigin: '0 0',
        }}>
          <svg
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ display: 'block', margin: '0 auto' }}
          >
            {/* Connection edges */}
            {edges.map(edge => {
              const paths = renderBracketPaths(edge);
              return (
                <g key={`bracket-${edge.parentId}`}>
                  {paths.map((d, i) => (
                    <path
                      key={`${edge.parentId}-${edge.children[i]?.id ?? i}`}
                      d={d}
                      fill="none"
                      stroke={edge.color || 'var(--border)'}
                      strokeWidth={2}
                      strokeOpacity={0.35}
                    />
                  ))}
                </g>
              );
            })}

            {/* Agent nodes */}
            {nodes.map(node => (
              <foreignObject
                key={node.agent.id}
                x={node.x}
                y={node.y}
                width={NODE_WIDTH}
                height={node.height + 12}
              >
                <div
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    paddingTop: 4,
                  }}
                >
                  <AgentTreeNode
                    agent={node.agent}
                    selected={selectedId === node.agent.id}
                    onClick={() => onSelect(node.agent.id)}
                    isOwner={node.agent.id === 'owner'}
                    childCount={childCountMap.get(node.agent.id) || 0}
                    expanded={!collapsed.has(node.agent.id)}
                    onToggleExpand={() => toggleExpand(node.agent.id)}
                  />
                </div>
              </foreignObject>
            ))}
          </svg>
        </div>
      </div>

      {/* Detail panel (desktop only) */}
      {!isMobile && showDetail && (
        <div style={{
          width: 420,
          minWidth: 420,
          borderLeft: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          <AgentDetail
            agentId={selectedId}
            agents={agents}
            onSelect={onSelect}
            onAgentChanged={onAgentChanged}
            onBrowseFiles={onBrowseFiles}
          />
        </div>
      )}
    </div>
  );
}
