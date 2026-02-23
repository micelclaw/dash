import { useMemo } from 'react';
import { AgentTreeNode } from './AgentTreeNode';
import { AgentDetail } from './AgentDetail';
import type { ManagedAgent } from './types';

interface AgentTreeProps {
  agents: ManagedAgent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface TreeNode {
  agent: ManagedAgent;
  children: TreeNode[];
  x: number;
  y: number;
}

const LEVEL_HEIGHT = 140;
const NODE_WIDTH = 180;
const NODE_HEIGHT = 90;
const H_GAP = 20;

const OWNER_AGENT: ManagedAgent = {
  id: 'owner',
  name: 'paco',
  display_name: 'Paco',
  role: 'Owner',
  avatar: '👤',
  model: '',
  parent_agent_id: null,
  skills: [],
  workspace_path: '',
  status: 'active',
  last_active_at: null,
  sessions_today: 0,
  tokens_today: 0,
  created_at: '',
};

function buildTree(agents: ManagedAgent[]): TreeNode {
  const rootChildren = agents.filter(a => a.parent_agent_id === null);
  const ownerNode: TreeNode = {
    agent: OWNER_AGENT,
    children: [],
    x: 0,
    y: 0,
  };

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

  // Root agents (no parent) are children of the owner
  ownerNode.children = rootChildren.map(agent => {
    const node: TreeNode = {
      agent,
      children: [],
      x: 0,
      y: LEVEL_HEIGHT,
    };
    node.children = buildChildren(agent.id, 2);
    return node;
  });

  return ownerNode;
}

function computeSubtreeWidth(node: TreeNode): number {
  if (node.children.length === 0) return NODE_WIDTH;
  const childrenWidth = node.children.reduce(
    (sum, child) => sum + computeSubtreeWidth(child),
    0,
  );
  return Math.max(NODE_WIDTH, childrenWidth + H_GAP * (node.children.length - 1));
}

function layoutTree(node: TreeNode, left: number, depth: number): void {
  const subtreeWidth = computeSubtreeWidth(node);
  node.x = left + subtreeWidth / 2 - NODE_WIDTH / 2;
  node.y = depth * LEVEL_HEIGHT;

  let childLeft = left;
  for (const child of node.children) {
    const childWidth = computeSubtreeWidth(child);
    layoutTree(child, childLeft, depth + 1);
    childLeft += childWidth + H_GAP;
  }
}

function flattenNodes(node: TreeNode): TreeNode[] {
  return [node, ...node.children.flatMap(flattenNodes)];
}

interface Edge {
  parentX: number;
  parentY: number;
  childX: number;
  childY: number;
}

function collectEdges(node: TreeNode): Edge[] {
  const edges: Edge[] = [];
  for (const child of node.children) {
    edges.push({
      parentX: node.x + NODE_WIDTH / 2,
      parentY: node.y + NODE_HEIGHT,
      childX: child.x + NODE_WIDTH / 2,
      childY: child.y,
    });
    edges.push(...collectEdges(child));
  }
  return edges;
}

export function AgentTree({ agents, selectedId, onSelect }: AgentTreeProps) {
  const { nodes, edges, svgWidth, svgHeight } = useMemo(() => {
    const root = buildTree(agents);
    const totalWidth = computeSubtreeWidth(root);
    layoutTree(root, 0, 0);

    const allNodes = flattenNodes(root);
    const allEdges = collectEdges(root);

    const maxDepth = allNodes.reduce((max, n) => Math.max(max, n.y), 0);

    return {
      nodes: allNodes,
      edges: allEdges,
      svgWidth: totalWidth + 40,
      svgHeight: maxDepth + NODE_HEIGHT + 40,
    };
  }, [agents]);

  const showDetail = selectedId && selectedId !== 'owner';

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
        padding: 20,
      }}>
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ display: 'block', margin: '0 auto' }}
        >
          {/* Connection lines */}
          {edges.map((edge, i) => {
            const startX = edge.parentX;
            const startY = edge.parentY;
            const endX = edge.childX;
            const endY = edge.childY;
            const midY = (startY + endY) / 2;
            return (
              <path
                key={i}
                d={`M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`}
                fill="none"
                stroke="var(--border)"
                strokeWidth={2}
              />
            );
          })}

          {/* Nodes */}
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
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AgentTreeNode
                  agent={node.agent}
                  selected={selectedId === node.agent.id}
                  onClick={() => onSelect(node.agent.id)}
                  isOwner={node.agent.id === 'owner'}
                />
              </div>
            </foreignObject>
          ))}
        </svg>
      </div>

      {/* Detail panel */}
      {showDetail && (
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
