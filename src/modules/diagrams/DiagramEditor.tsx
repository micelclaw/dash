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

import { useEffect, useCallback, useState } from 'react';
import { useParams } from 'react-router';
import { ReactFlowProvider } from '@xyflow/react';
import { Plus, Minimize2, Undo2, Redo2, Sparkles, Save, MoreVertical } from 'lucide-react';
import { useDiagramsStore } from '@/stores/diagrams.store';
import { useIsMobile } from '@/hooks/use-media-query';
import { DiagramToolbar } from './DiagramToolbar';
import { DiagramCanvas } from './DiagramCanvas';
import { ShapePalette } from './ShapePalette';
import { PropertiesPanel } from './PropertiesPanel';
import { MobilePropertiesSheet } from './components/MobilePropertiesSheet';
import { useDragToCanvas } from './hooks/use-drag-to-canvas';
import { useDiagramFile } from './hooks/use-diagram-file';
import { useDiagramWs } from './hooks/use-diagram-ws';
import { TabBar } from './components/TabBar';
import { ShortcutsModal } from './components/ShortcutsModal';
import './diagrams.css';

function DiagramEditorInner() {
  const { fileId } = useParams<{ fileId?: string }>();
  const isMobile = useIsMobile();
  const undo = useDiagramsStore((s) => s.undo);
  const redo = useDiagramsStore((s) => s.redo);
  const deleteSelected = useDiagramsStore((s) => s.deleteSelected);
  const selectAll = useDiagramsStore((s) => s.selectAll);
  const duplicateNodes = useDiagramsStore((s) => s.duplicateNodes);
  const groupNodes = useDiagramsStore((s) => s.groupNodes);
  const ungroupNodes = useDiagramsStore((s) => s.ungroupNodes);
  const bringToFront = useDiagramsStore((s) => s.bringToFront);
  const sendToBack = useDiagramsStore((s) => s.sendToBack);
  const setEditingNode = useDiagramsStore((s) => s.setEditingNode);
  const copyToClipboard = useDiagramsStore((s) => s.copyToClipboard);
  const pasteFromClipboard = useDiagramsStore((s) => s.pasteFromClipboard);
  const clearSelection = useDiagramsStore((s) => s.clearSelection);
  const addNode = useDiagramsStore((s) => s.addNode);
  const loadDiagram = useDiagramsStore((s) => s.loadDiagram);
  const { onDrop, onDragOver } = useDragToCanvas();
  const { saveDiagram, saveStatus } = useDiagramFile(fileId);
  const [showMobilePalette, setShowMobilePalette] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // WebSocket listener for AI-driven diagram events
  useDiagramWs();

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip all shortcuts when inline editing is active
      if (useDiagramsStore.getState().editingNodeId) return;

      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        // Allow Escape even in inputs
        if (e.key !== 'Escape') return;
      }

      const mod = e.metaKey || e.ctrlKey;

      // Ctrl+S — save
      if (mod && e.key === 's') {
        e.preventDefault();
        saveDiagram();
        return;
      }

      // Ctrl+Z / Ctrl+Shift+Z — undo/redo
      if (mod && e.key === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }

      // Delete / Backspace — delete selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
        return;
      }

      // Ctrl+A — select all
      if (mod && e.key === 'a') {
        e.preventDefault();
        selectAll();
        return;
      }

      // Ctrl+D — duplicate selected
      if (mod && e.key === 'd') {
        e.preventDefault();
        const { nodes, selectedElement } = useDiagramsStore.getState();
        const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);
        if (selectedIds.length === 0 && selectedElement?.type === 'node') {
          selectedIds.push(selectedElement.id);
        }
        if (selectedIds.length > 0) duplicateNodes(selectedIds);
        return;
      }

      // Ctrl+G — group, Ctrl+Shift+G — ungroup
      if (mod && e.key === 'g') {
        e.preventDefault();
        const { nodes, selectedElement } = useDiagramsStore.getState();
        if (e.shiftKey) {
          // Ungroup: if a group node is selected
          const groupId = selectedElement?.type === 'node' ? selectedElement.id : null;
          if (groupId) {
            const groupNode = nodes.find((n) => n.id === groupId);
            if (groupNode?.type === 'group') ungroupNodes(groupId);
          }
        } else {
          const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);
          if (selectedIds.length === 0 && selectedElement?.type === 'node') {
            selectedIds.push(selectedElement.id);
          }
          if (selectedIds.length > 1) groupNodes(selectedIds);
        }
        return;
      }

      // Ctrl+] — bring to front, Ctrl+[ — send to back
      if (mod && (e.key === ']' || e.key === '[')) {
        e.preventDefault();
        const { selectedElement } = useDiagramsStore.getState();
        if (selectedElement?.type === 'node') {
          e.key === ']' ? bringToFront(selectedElement.id) : sendToBack(selectedElement.id);
        }
        return;
      }

      // Enter — edit selected node label
      if (e.key === 'Enter' && !mod) {
        const { selectedElement } = useDiagramsStore.getState();
        if (selectedElement?.type === 'node') {
          e.preventDefault();
          setEditingNode(selectedElement.id);
        }
        return;
      }

      // Ctrl+C — copy
      if (mod && e.key === 'c') {
        e.preventDefault();
        copyToClipboard();
        return;
      }

      // Ctrl+V — paste
      if (mod && e.key === 'v') {
        e.preventDefault();
        pasteFromClipboard();
        return;
      }

      // Tab / Shift+Tab — cycle through nodes
      if (e.key === 'Tab') {
        e.preventDefault();
        const { nodes, selectedElement } = useDiagramsStore.getState();
        if (nodes.length === 0) return;
        const currentId = selectedElement?.type === 'node' ? selectedElement.id : null;
        const currentIdx = currentId ? nodes.findIndex((n) => n.id === currentId) : -1;
        let nextIdx: number;
        if (e.shiftKey) {
          nextIdx = currentIdx <= 0 ? nodes.length - 1 : currentIdx - 1;
        } else {
          nextIdx = currentIdx < 0 || currentIdx >= nodes.length - 1 ? 0 : currentIdx + 1;
        }
        const nextNode = nodes[nextIdx];
        if (nextNode) {
          const store = useDiagramsStore.getState();
          // Clear all selections, then select the target node
          const changes: import('@xyflow/react').NodeChange[] = nodes.map((n) => ({
            type: 'select' as const,
            id: n.id,
            selected: n.id === nextNode.id,
          }));
          store.onNodesChange(changes);
          store.selectElement('node', nextNode.id);
        }
        return;
      }

      // F11 — toggle presentation mode
      if (e.key === 'F11') {
        e.preventDefault();
        setPresentationMode((v) => !v);
        return;
      }

      // ? — show shortcuts modal
      if (e.key === '?' && !mod) {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }

      // Escape — exit presentation mode or clear selection
      if (e.key === 'Escape') {
        if (presentationMode) {
          setPresentationMode(false);
          return;
        }
        clearSelection();
        return;
      }
    },
    [undo, redo, deleteSelected, selectAll, duplicateNodes, groupNodes, ungroupNodes, bringToFront, sendToBack, setEditingNode, copyToClipboard, pasteFromClipboard, clearSelection, saveDiagram, presentationMode],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // File drop handler (JSON/drawio/mermaid files)
  const handleFileDrop = useCallback(
    async (e: React.DragEvent) => {
      // Only handle file drops, not shape palette drops
      if (e.dataTransfer.types.includes('application/diagram-shape')) return;

      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !['json', 'diagram', 'drawio', 'xml', 'mmd', 'mermaid'].includes(ext)) return;

      e.preventDefault();
      e.stopPropagation();

      try {
        const text = await file.text();
        if (ext === 'drawio' || ext === 'xml') {
          const { parseDrawio } = await import('./import/drawio-parser');
          const diagram = parseDrawio(text);
          diagram.title = file.name.replace(/\.[^.]+$/, '');
          loadDiagram(diagram);
        } else if (ext === 'mmd' || ext === 'mermaid') {
          const { parseMermaid } = await import('./import/mermaid-parser');
          const diagram = parseMermaid(text);
          diagram.title = file.name.replace(/\.[^.]+$/, '');
          loadDiagram(diagram);
        } else {
          const diagram = JSON.parse(text);
          loadDiagram(diagram);
        }
      } catch {
        // Invalid file
      }
    },
    [loadDiagram],
  );

  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        ...(presentationMode ? { position: 'fixed', inset: 0, zIndex: 50, background: 'var(--background, #111)' } : {}),
      }}
      onDrop={handleFileDrop}
      onDragOver={handleFileDragOver}
    >
      {!presentationMode && (
        <DiagramToolbar onSave={saveDiagram} saveStatus={saveStatus} isMobile={isMobile} />
      )}
      {!presentationMode && !isMobile && <TabBar />}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        {!presentationMode && !isMobile && <ShapePalette />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <DiagramCanvas onDrop={onDrop} onDragOver={onDragOver} />
        </div>
        {!presentationMode && !isMobile && <PropertiesPanel />}

        {/* Presentation mode exit hint */}
        {presentationMode && (
          <button
            onClick={() => setPresentationMode(false)}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid var(--border, #333)',
              borderRadius: 6,
              color: 'var(--text-dim, #94a3b8)',
              padding: '4px 10px',
              fontSize: 11,
              cursor: 'pointer',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'var(--font-sans, system-ui)',
              opacity: 0.6,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '0.6'; }}
          >
            <Minimize2 size={14} />
            ESC to exit
          </button>
        )}

        {/* Mobile: bottom toolbar + properties sheet + shape picker */}
        {isMobile && !presentationMode && (
          <>
            {/* Mobile bottom toolbar */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 48,
                background: 'var(--surface, #1a1a1a)',
                borderTop: '1px solid var(--border, #333)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-around',
                zIndex: 12,
                padding: '0 8px',
              }}
            >
              <button onClick={undo} style={mobileBtnStyle} aria-label="Undo">
                <Undo2 size={20} />
              </button>
              <button onClick={redo} style={mobileBtnStyle} aria-label="Redo">
                <Redo2 size={20} />
              </button>
              <button
                onClick={() => setShowMobilePalette((v) => !v)}
                style={{
                  ...mobileBtnStyle,
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'var(--amber, #d4a017)',
                  color: '#000',
                  marginTop: -16,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                }}
                aria-label="Add Shape"
              >
                <Plus size={22} />
              </button>
              <button onClick={saveDiagram} style={mobileBtnStyle} aria-label="Save">
                <Save size={20} />
              </button>
              <button style={mobileBtnStyle} aria-label="More">
                <MoreVertical size={20} />
              </button>
            </div>

            {/* Mobile shape palette overlay */}
            {showMobilePalette && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 56,
                  left: 8,
                  right: 8,
                  background: 'var(--surface, #1a1a1a)',
                  border: '1px solid var(--border, #333)',
                  borderRadius: 12,
                  padding: 12,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: 6,
                  zIndex: 13,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                  maxHeight: '40vh',
                  overflowY: 'auto',
                }}
              >
                {(['rectangle', 'rounded', 'diamond', 'circle', 'cylinder',
                  'hexagon', 'cloud', 'sticky', 'table', 'card',
                  'triangle', 'server', 'database3d', 'actor', 'note'] as const).map((shape) => (
                  <button
                    key={shape}
                    onClick={() => {
                      addNode(shape, { x: 200, y: 200 });
                      setShowMobilePalette(false);
                    }}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 6,
                      border: '1px solid var(--border, #333)',
                      background: 'transparent',
                      color: 'var(--text, #e2e8f0)',
                      cursor: 'pointer',
                      fontSize: 9,
                      fontFamily: 'var(--font-sans)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      touchAction: 'manipulation',
                    }}
                  >
                    {shape.slice(0, 5)}
                  </button>
                ))}
              </div>
            )}

            {/* Mobile properties bottom sheet */}
            <MobilePropertiesSheet />
          </>
        )}
      </div>
      <ShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}

const mobileBtnStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  color: 'var(--text-dim, #94a3b8)',
  cursor: 'pointer',
  padding: 0,
  touchAction: 'manipulation',
  borderRadius: 8,
};

export function Component() {
  return (
    <ReactFlowProvider>
      <DiagramEditorInner />
    </ReactFlowProvider>
  );
}
