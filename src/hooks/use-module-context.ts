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

import { useMemo } from 'react';
import { useLocation } from 'react-router';
import { MODULES } from '@/config/modules';
import { useDiagramsStore } from '@/stores/diagrams.store';
import { useProjectsStore } from '@/stores/projects.store';
import { useOfficeStore } from '@/stores/office.store';
import { useTerminalStore } from '@/stores/terminal.store';

interface ModuleContext {
  moduleId: string | null;
  modulePath: string | null;
  activeItem: { id: string; type: string; title: string } | null;
  editorContext: Record<string, unknown> | null;
}

/** Walk edges from root nodes to build a readable summary, max ~200 chars */
function generateDiagramSummary(
  nodes: { id: string; data: { label?: string }; type?: string }[],
  edges: { source: string; target: string }[],
): string {
  if (nodes.length === 0) return '';

  const targetIds = new Set(edges.map((e) => e.target));
  const roots = nodes.filter((n) => !targetIds.has(n.id));
  if (roots.length === 0) roots.push(nodes[0]!);

  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.source) ?? [];
    list.push(e.target);
    adj.set(e.source, list);
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const parts: string[] = [];

  function walk(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const node = nodeMap.get(id);
    const label = node?.data?.label || '?';
    parts.push(label);
    const children = adj.get(id) ?? [];
    for (const child of children) {
      walk(child);
    }
  }

  for (const root of roots) {
    walk(root.id);
    if (parts.join(' → ').length > 200) break;
  }

  const summary = parts.join(' → ');
  return summary.length > 200 ? summary.slice(0, 197) + '...' : summary;
}

export function useModuleContext(): ModuleContext {
  const location = useLocation();
  const diagramNodes = useDiagramsStore((s) => s.nodes);
  const diagramEdges = useDiagramsStore((s) => s.edges);
  const selectedElement = useDiagramsStore((s) => s.selectedElement);
  const diagramTitle = useDiagramsStore((s) => s.title);
  const projectsColumns = useProjectsStore((s) => s.columns);
  const projectsCards = useProjectsStore((s) => s.cards);
  const projectsColumnCardIds = useProjectsStore((s) => s.columnCardIds);
  const projectsBoardColumnIds = useProjectsStore((s) => s.boardColumnIds);
  const projectsActiveBoardId = useProjectsStore((s) => s.activeBoardId);
  const projectsActiveBoardTitle = useProjectsStore((s) => s.activeBoardTitle);
  const projectsSelectedCardId = useProjectsStore((s) => s.selectedCardId);
  const officeSession = useOfficeStore((s) => s.currentSession);
  const officeFullscreen = useOfficeStore((s) => s.fullscreen);
  const terminalTabs = useTerminalStore((s) => s.tabs);
  const terminalActiveTabId = useTerminalStore((s) => s.activeTabId);

  return useMemo(() => {
    const path = location.pathname;
    const mod = MODULES.find((m) => m.path && path.startsWith(m.path));

    let editorContext: Record<string, unknown> | null = null;
    let activeItem: { id: string; type: string; title: string } | null = null;

    // Inject projects context when on a board route
    if (mod?.id === 'projects' && projectsActiveBoardId && path.match(/\/projects\/.+/)) {
      const colIds = projectsBoardColumnIds[projectsActiveBoardId] ?? [];
      const orderedCols = colIds.map(id => projectsColumns[id]).filter(Boolean).sort((a, b) => a.position - b.position);
      const colSummary = orderedCols
        .map((c) => `${c.title}: ${(projectsColumnCardIds[c.id] ?? []).length} cards`)
        .join(', ');

      let selectedCard: Record<string, unknown> | null = null;
      if (projectsSelectedCardId) {
        const card = projectsCards[projectsSelectedCardId];
        if (card) {
          const col = projectsColumns[card.column_id];
          selectedCard = { id: card.id, title: card.title, column: col?.title, priority: card.priority, due_date: card.due_date };
        }
      }

      editorContext = {
        board: { id: projectsActiveBoardId, title: projectsActiveBoardTitle },
        columns: colSummary,
        selected_card: selectedCard,
        summary: `Board '${projectsActiveBoardTitle}': ${colSummary}`,
      };
      activeItem = { id: projectsActiveBoardId, type: 'kanban-board', title: projectsActiveBoardTitle || 'Board' };
    }

    // Inject diagram context when on a diagram editor route
    if (mod?.id === 'diagrams' && path.match(/\/diagrams\/.+/)) {
      let selectedNode: Record<string, unknown> | null = null;
      if (selectedElement?.type === 'node') {
        const node = diagramNodes.find((n) => n.id === selectedElement.id);
        if (node) {
          selectedNode = {
            id: node.id,
            label: node.data?.label ?? '',
            type: node.type ?? 'rectangle',
          };
        }
      }

      editorContext = {
        title: diagramTitle,
        node_count: diagramNodes.length,
        edge_count: diagramEdges.length,
        selected_node: selectedNode,
        diagram_summary: generateDiagramSummary(
          diagramNodes.map((n) => ({ id: n.id, data: { label: (n.data as Record<string, unknown>)?.label as string }, type: n.type })),
          diagramEdges.map((e) => ({ source: e.source, target: e.target })),
        ),
      };
    }

    // Inject office context when editing a document
    if (mod?.id === 'office') {
      const fileIdMatch = location.pathname.match(/\/office\/edit\/(.+)/);
      const isEditing = !!fileIdMatch?.[1];
      const docTypeMap: Record<string, string> = { word: 'document', cell: 'spreadsheet', slide: 'presentation' };

      editorContext = {
        service: 'office',
        fileId: fileIdMatch?.[1] ?? null,
        documentType: officeSession?.documentType ? docTypeMap[officeSession.documentType] ?? officeSession.documentType : null,
        isEditing,
        fullscreen: officeFullscreen,
        note: isEditing
          ? `User is editing a ${docTypeMap[officeSession?.documentType ?? ''] ?? 'document'} in ONLYOFFICE. Use office:insertText, office:insertTable, office:replaceText to manipulate the document. Use POST /office/execute for raw Office JS API code.`
          : 'User has the Office module open. Can create/edit documents, manipulate PDFs, and generate documents.',
      };

      if (isEditing && fileIdMatch?.[1]) {
        activeItem = { id: fileIdMatch[1], type: 'office-document', title: officeSession?.documentType ?? 'document' };
      }
    }

    // Inject terminal context
    if (mod?.id === 'terminal') {
      const activeTab = terminalTabs.find((t) => t.id === terminalActiveTabId);
      editorContext = {
        service: 'terminal',
        session_count: terminalTabs.length,
        active_session: activeTab ? { type: activeTab.type, label: activeTab.label } : null,
        note: 'User has the terminal open with an active shell session. Commands can be sent via the terminal WebSocket. SSH connections and saved snippets are available.',
      };
    }

    return {
      moduleId: mod?.id ?? null,
      modulePath: mod?.path ?? null,
      activeItem,
      editorContext,
    };
  }, [location.pathname, diagramNodes, diagramEdges, selectedElement, diagramTitle, projectsColumns, projectsCards, projectsColumnCardIds, projectsBoardColumnIds, projectsActiveBoardId, projectsActiveBoardTitle, projectsSelectedCardId, officeSession, officeFullscreen, terminalTabs, terminalActiveTabId]);
}
