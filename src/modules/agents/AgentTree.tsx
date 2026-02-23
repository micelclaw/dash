import { useMemo, useState, useCallback } from 'react';
import { ChevronLeft } from 'lucide-react';
import { AgentTreeNode } from './AgentTreeNode';
import { AgentDetail } from './AgentDetail';
import type { ManagedAgent } from './types';

interface AgentTreeProps {
  agents: ManagedAgent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isMobile?: boolean;
}

interface TreeNode {
  agent: ManagedAgent;
  children: TreeNode[];
  x: number;
  y: number;
}

interface BracketEdge {
  parentX: number;
  parentY: number;
  children: { x: number; y: number; id: string }[];
  color: string;
  parentId: string;
}

const NODE_WIDTH = 260;
const NODE_HEIGHT = 150;
const LEVEL_HEIGHT = 180;
const H_GAP = 30;
const BRACKET_OFFSET = 30;
const CORNER_RADIUS = 8;

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

  function buildChildren(parentId: string, depth: number): TreeNode[] {
    const kids = agents.filter(a => a.parent_agent_id === parentId);
    return kids.map(agent => {
      const node: TreeNode = {
        agent,
        children: [],
        x: 0,
        y: depth * LEVEL_HEIGHT,
      };
      node.children = buildChildren(agent.id, depth + 1);
      return node;
    });
  }

  const ownerNode: TreeNode = {
    agent: OWNER_AGENT,
    children: rootChildren.map(agent => {
      const node: TreeNode = {
        agent,
        children: [],
        x: 0,
        y: LEVEL_HEIGHT,
      };
      node.children = buildChildren(agent.id, 2);
      return node;
    }),
    x: 0,
    y: 0,
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
      parentY: node.y + NODE_HEIGHT,
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

export function AgentTree({ agents, selectedId, onSelect, isMobile }: AgentTreeProps) {
  // Default: all expanded (empty collapsed set)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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

  const childCountMap = useMemo(() => buildChildCountMap(agents), [agents]);

  const { nodes, edges, svgWidth, svgHeight } = useMemo(() => {
    const root = buildTree(agents);
    const totalWidth = computeSubtreeWidth(root, collapsed);
    layoutTree(root, 0, 0, collapsed);

    const allNodes = flattenNodes(root, collapsed);
    const allEdges = collectBracketEdges(root, collapsed);

    const maxX = allNodes.reduce((max, n) => Math.max(max, n.x + NODE_WIDTH), 0);
    const maxY = allNodes.reduce((max, n) => Math.max(max, n.y + NODE_HEIGHT), 0);

    return {
      nodes: allNodes,
      edges: allEdges,
      svgWidth: Math.max(totalWidth, maxX) + 60,
      svgHeight: maxY + 40,
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
        {/* Back button bar */}
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
            fontSize: '0.8125rem',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={16} />
          Back to tree
        </button>
        {/* Fullscreen detail */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <AgentDetail
            agentId={selectedId}
            agents={agents}
            onSelect={onSelect}
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
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: isMobile ? 12 : 20,
        WebkitOverflowScrolling: 'touch' as any,
      }}>
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ display: 'block', margin: '0 auto' }}
        >
          {/* Connection edges (bracket-style with rounded corners) */}
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
                    strokeWidth={1.5}
                    strokeOpacity={0.4}
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
              height={NODE_HEIGHT}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
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

      {/* Detail panel (desktop only) */}
      {!isMobile && showDetail && (
        <div style={{
          width: 400,
          minWidth: 400,
          borderLeft: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          <AgentDetail
            agentId={selectedId}
            agents={agents}
            onSelect={onSelect}
          />
        </div>
      )}
    </div>
  );
}
