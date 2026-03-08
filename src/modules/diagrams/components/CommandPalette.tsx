import { useState, useCallback, useEffect, useRef } from 'react';
import { Command } from 'cmdk';
import { useReactFlow } from '@xyflow/react';
import { Search, Hash, ChevronRight } from 'lucide-react';
import { useDiagramsStore } from '@/stores/diagrams.store';
import { ALL_COMMANDS, CATEGORY_LABELS, type CommandContext, type DiagramCommand } from '../commands';
import type { NodeShapeType } from '../types';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  onAutoLayout: (direction: string) => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onExportJson: () => void;
}

export function CommandPalette({
  open,
  onClose,
  onSave,
  onAutoLayout,
  onExportPng,
  onExportSvg,
  onExportJson,
}: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const reactFlow = useReactFlow();
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset search when opening
  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build command context
  const buildContext = useCallback((): CommandContext => {
    const store = useDiagramsStore.getState();
    return {
      addNode: (type: NodeShapeType, position) => store.addNode(type, position),
      deleteSelected: () => store.deleteSelected(),
      selectAll: () => store.selectAll(),
      undo: () => store.undo(),
      redo: () => store.redo(),
      duplicateNodes: (ids) => store.duplicateNodes(ids),
      fitView: () => reactFlow.fitView({ duration: 300, padding: 0.1 }),
      zoomTo: (level) => reactFlow.zoomTo(level, { duration: 200 }),
      exportPng: onExportPng,
      exportSvg: onExportSvg,
      exportJson: onExportJson,
      autoLayout: onAutoLayout,
      save: onSave,
      toggleGrid: () => store.updateSettings({ showGrid: !store.settings.showGrid }),
      toggleMinimap: () => store.updateSettings({ showMinimap: !store.settings.showMinimap }),
      toggleSnapToGrid: () => store.updateSettings({ snapToGrid: !store.settings.snapToGrid }),
      focusNode: (nodeId) => {
        const node = store.nodes.find((n) => n.id === nodeId);
        if (node) {
          reactFlow.setCenter(
            node.position.x + (node.width || 80) / 2,
            node.position.y + (node.height || 35) / 2,
            { duration: 300, zoom: 1.5 },
          );
          store.selectElement('node', nodeId);
        }
      },
    };
  }, [reactFlow, onSave, onAutoLayout, onExportPng, onExportSvg, onExportJson]);

  const handleSelect = useCallback(
    (cmd: DiagramCommand) => {
      const ctx = buildContext();
      cmd.action(ctx);
      onClose();
    },
    [buildContext, onClose],
  );

  // Node search mode: # prefix searches nodes by label
  const isNodeSearch = search.startsWith('#');
  const nodeSearchTerm = isNodeSearch ? search.slice(1).toLowerCase() : '';
  const nodes = useDiagramsStore((s) => s.nodes);
  const matchingNodes = isNodeSearch
    ? nodes.filter((n) => {
        const label = (n.data.label || '').toLowerCase();
        return label.includes(nodeSearchTerm);
      })
    : [];

  // Group commands by category
  const categories = new Map<string, DiagramCommand[]>();
  for (const cmd of ALL_COMMANDS) {
    const cat = cmd.category;
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(cmd);
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Command
        label="Diagram Command Palette"
        style={{
          width: 480,
          maxHeight: 400,
          background: 'var(--surface, #1a1a1a)',
          border: '1px solid var(--border, #333)',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
          fontFamily: 'var(--font-sans, system-ui)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            borderBottom: '1px solid var(--border, #333)',
          }}
        >
          <Search size={16} style={{ color: 'var(--text-dim, #64748b)', flexShrink: 0 }} />
          <Command.Input
            ref={inputRef}
            value={search}
            onValueChange={setSearch}
            placeholder="Type a command, or # to search nodes..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text, #e2e8f0)',
              fontSize: 14,
              fontFamily: 'var(--font-sans, system-ui)',
            }}
          />
          <kbd style={kbdStyle}>ESC</kbd>
        </div>

        <Command.List
          style={{
            maxHeight: 320,
            overflowY: 'auto',
            padding: 6,
          }}
        >
          <Command.Empty style={{ padding: 16, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
            No results found
          </Command.Empty>

          {/* Node search results */}
          {isNodeSearch && matchingNodes.length > 0 && (
            <Command.Group
              heading="Nodes"
              style={{ padding: 0 }}
            >
              <div style={groupHeadingStyle}>
                <Hash size={12} />
                Nodes ({matchingNodes.length})
              </div>
              {matchingNodes.slice(0, 20).map((node) => (
                <Command.Item
                  key={node.id}
                  value={`node-${node.data.label}-${node.id}`}
                  onSelect={() => {
                    const ctx = buildContext();
                    ctx.focusNode(node.id);
                    onClose();
                  }}
                  style={itemStyle}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: node.data.color || '#3b82f6',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, fontSize: 13 }}>{node.data.label || node.id}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>
                    {node.type}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Regular command categories */}
          {!isNodeSearch &&
            Array.from(categories.entries()).map(([cat, cmds]) => (
              <Command.Group key={cat} heading={CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat}>
                <div style={groupHeadingStyle}>
                  <ChevronRight size={12} />
                  {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat}
                </div>
                {cmds.map((cmd) => (
                  <Command.Item
                    key={cmd.id}
                    value={cmd.label}
                    onSelect={() => handleSelect(cmd)}
                    style={itemStyle}
                  >
                    <span style={{ flex: 1, fontSize: 13 }}>{cmd.label}</span>
                    {cmd.shortcut && <kbd style={kbdStyle}>{cmd.shortcut}</kbd>}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
        </Command.List>
      </Command>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'var(--text, #e2e8f0)',
  fontSize: 13,
  fontFamily: 'var(--font-sans, system-ui)',
  transition: 'background 0.1s',
};

const groupHeadingStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 10px 2px',
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--text-dim, #64748b)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const kbdStyle: React.CSSProperties = {
  fontSize: 10,
  padding: '1px 5px',
  background: 'var(--background, #111)',
  border: '1px solid var(--border, #333)',
  borderRadius: 3,
  color: 'var(--text-dim, #94a3b8)',
  fontFamily: 'var(--font-mono, monospace)',
  lineHeight: 1.4,
};
