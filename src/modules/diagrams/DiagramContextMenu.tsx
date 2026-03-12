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

import { useEffect, useRef, useState } from 'react';
import {
  Copy, Trash2, ArrowUpToLine, ArrowDownToLine,
  ClipboardPaste, CheckSquare, StickyNote, Grid3X3,
  Zap, Minus, Lock, Unlock, Pencil, ArrowRightLeft,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  ArrowLeftRight, ArrowUpDown, Layers, Ungroup,
  ChevronRight,
} from 'lucide-react';
import { useDiagramsStore } from '@/stores/diagrams.store';
import { COLOR_PALETTE, VALID_NODE_TYPES } from './types';
import type { NodeShapeType } from './types';

export interface ContextMenuState {
  type: 'node' | 'edge' | 'pane';
  position: { x: number; y: number };
  id?: string;
}

interface Props {
  state: ContextMenuState;
  onClose: () => void;
  onAddNode?: (type: NodeShapeType, position: { x: number; y: number }) => void;
}

// ─── Main Context Menu ──────────────────────────────────

export function DiagramContextMenu({ state, onClose, onAddNode }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  const nodes = useDiagramsStore((s) => s.nodes);
  const edges = useDiagramsStore((s) => s.edges);
  const duplicateNodes = useDiagramsStore((s) => s.duplicateNodes);
  const removeNode = useDiagramsStore((s) => s.removeNode);
  const removeEdge = useDiagramsStore((s) => s.removeEdge);
  const bringToFront = useDiagramsStore((s) => s.bringToFront);
  const sendToBack = useDiagramsStore((s) => s.sendToBack);
  const updateNodeData = useDiagramsStore((s) => s.updateNodeData);
  const updateEdgeData = useDiagramsStore((s) => s.updateEdgeData);
  const updateEdgeAnimated = useDiagramsStore((s) => s.updateEdgeAnimated);
  const updateEdgeType = useDiagramsStore((s) => s.updateEdgeType);
  const selectElement = useDiagramsStore((s) => s.selectElement);
  const selectAll = useDiagramsStore((s) => s.selectAll);
  const pasteFromClipboard = useDiagramsStore((s) => s.pasteFromClipboard);
  const clipboard = useDiagramsStore((s) => s.clipboard);
  const settings = useDiagramsStore((s) => s.settings);
  const updateSettings = useDiagramsStore((s) => s.updateSettings);
  const alignNodes = useDiagramsStore((s) => s.alignNodes);
  const distributeNodes = useDiagramsStore((s) => s.distributeNodes);
  const lockNode = useDiagramsStore((s) => s.lockNode);
  const changeShape = useDiagramsStore((s) => s.changeShape);
  const ungroupNodes = useDiagramsStore((s) => s.ungroupNodes);
  const reverseEdge = useDiagramsStore((s) => s.reverseEdge);
  const setEditingNode = useDiagramsStore((s) => s.setEditingNode);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const action = (fn: () => void) => () => { fn(); onClose(); };

  const edge = state.type === 'edge' && state.id
    ? edges.find((e) => e.id === state.id)
    : null;

  const node = state.type === 'node' && state.id
    ? nodes.find((n) => n.id === state.id)
    : null;

  const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);
  if (state.id && state.type === 'node' && !selectedIds.includes(state.id)) {
    selectedIds.push(state.id);
  }
  const hasMultiSelect = selectedIds.length >= 2;
  const isLocked = !!node?.data?.locked;

  return (
    <>
      <div
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
      />
      <div
        ref={menuRef}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          ...menuStyle,
          left: state.position.x,
          top: state.position.y,
        }}
      >
        {/* ─── Node Context Menu ─────────────────── */}
        {state.type === 'node' && state.id && (
          <>
            <MenuItem
              icon={Pencil}
              label="Edit Label"
              shortcut="Enter"
              onClick={action(() => setEditingNode(state.id!))}
            />
            <MenuItem icon={Copy} label="Duplicate" shortcut="Ctrl+D" onClick={action(() => duplicateNodes([state.id!]))} />
            <MenuItem icon={Trash2} label="Delete" shortcut="Del" onClick={action(() => removeNode(state.id!))} variant="danger" />
            <Separator />

            {hasMultiSelect && (
              <>
                <SubMenu icon={AlignStartVertical} label="Align">
                  <MenuItem icon={AlignStartVertical} label="Left" onClick={action(() => alignNodes(selectedIds, 'left'))} />
                  <MenuItem icon={AlignCenterVertical} label="Center" onClick={action(() => alignNodes(selectedIds, 'center'))} />
                  <MenuItem icon={AlignEndVertical} label="Right" onClick={action(() => alignNodes(selectedIds, 'right'))} />
                  <Separator />
                  <MenuItem icon={AlignStartHorizontal} label="Top" onClick={action(() => alignNodes(selectedIds, 'top'))} />
                  <MenuItem icon={AlignCenterHorizontal} label="Middle" onClick={action(() => alignNodes(selectedIds, 'middle'))} />
                  <MenuItem icon={AlignEndHorizontal} label="Bottom" onClick={action(() => alignNodes(selectedIds, 'bottom'))} />
                </SubMenu>

                <SubMenu icon={ArrowLeftRight} label="Distribute">
                  <MenuItem icon={ArrowLeftRight} label="Horizontal" onClick={action(() => distributeNodes(selectedIds, 'horizontal'))} />
                  <MenuItem icon={ArrowUpDown} label="Vertical" onClick={action(() => distributeNodes(selectedIds, 'vertical'))} />
                </SubMenu>
                <Separator />
              </>
            )}

            <SubMenu icon={Layers} label="Order">
              <MenuItem icon={ArrowUpToLine} label="Bring to Front" shortcut="Ctrl+]" onClick={action(() => bringToFront(state.id!))} />
              <MenuItem icon={ArrowDownToLine} label="Send to Back" shortcut="Ctrl+[" onClick={action(() => sendToBack(state.id!))} />
            </SubMenu>

            <SubMenu icon={StickyNote} label="Change Shape">
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {VALID_NODE_TYPES.map((shape) => (
                  <MenuItem
                    key={shape}
                    label={shape}
                    onClick={action(() => changeShape(state.id!, shape))}
                    active={node?.type === shape}
                  />
                ))}
              </div>
            </SubMenu>

            <div style={{ padding: '4px 8px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim, #64748b)', marginBottom: 4 }}>Color</div>
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', maxWidth: 170 }}>
                {COLOR_PALETTE.slice(0, 16).map((c) => (
                  <button
                    key={c}
                    onClick={action(() => updateNodeData(state.id!, { color: c }))}
                    style={{
                      width: 16, height: 16, borderRadius: 3,
                      background: c, border: node?.data.color === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                      cursor: 'pointer', padding: 0,
                    }}
                  />
                ))}
              </div>
            </div>

            <Separator />

            <MenuItem
              icon={isLocked ? Unlock : Lock}
              label={isLocked ? 'Unlock Node' : 'Lock Node'}
              onClick={action(() => lockNode(state.id!, !isLocked))}
            />

            {node?.type === 'group' && (
              <MenuItem
                icon={Ungroup}
                label="Ungroup"
                shortcut="Ctrl+Shift+G"
                onClick={action(() => ungroupNodes(state.id!))}
              />
            )}
          </>
        )}

        {/* ─── Edge Context Menu ─────────────────── */}
        {state.type === 'edge' && state.id && (
          <>
            <MenuItem
              icon={Pencil}
              label="Edit Label"
              onClick={action(() => selectElement('edge', state.id!))}
            />
            <MenuItem icon={Trash2} label="Delete" shortcut="Del" onClick={action(() => removeEdge(state.id!))} variant="danger" />
            <Separator />

            <SubMenu label="Type">
              {[
                { value: 'smoothstep', label: 'Smooth Step' },
                { value: 'step', label: 'Step' },
                { value: 'straight', label: 'Straight' },
                { value: 'default', label: 'Bezier' },
                { value: 'smart', label: 'Smart' },
                { value: 'elbow', label: 'Elbow' },
                { value: 'curved', label: 'Curved' },
              ].map(({ value, label }) => (
                <MenuItem
                  key={value}
                  label={label}
                  onClick={action(() => updateEdgeType(state.id!, value))}
                  active={edge?.type === value}
                />
              ))}
            </SubMenu>

            <MenuItem
              icon={ArrowRightLeft}
              label="Reverse Direction"
              onClick={action(() => reverseEdge(state.id!))}
            />
            <Separator />

            <MenuItem
              icon={Zap}
              label={edge?.animated ? 'Disable Animation' : 'Enable Animation'}
              onClick={action(() => updateEdgeAnimated(state.id!, !edge?.animated))}
            />
            <MenuItem
              icon={Minus}
              label={(edge?.data as Record<string, unknown>)?.dashed ? 'Solid Line' : 'Dashed Line'}
              onClick={action(() => updateEdgeData(state.id!, { dashed: !(edge?.data as Record<string, unknown>)?.dashed }))}
            />
          </>
        )}

        {/* ─── Pane Context Menu ─────────────────── */}
        {state.type === 'pane' && (
          <>
            <SubMenu icon={StickyNote} label="Add Shape">
              {(['rectangle', 'rounded', 'diamond', 'circle', 'cylinder', 'hexagon', 'cloud', 'sticky', 'table', 'card'] as const).map((shape) => (
                <MenuItem
                  key={shape}
                  label={shape.charAt(0).toUpperCase() + shape.slice(1)}
                  onClick={action(() => onAddNode?.(shape, state.position))}
                />
              ))}
            </SubMenu>

            <MenuItem
              icon={ClipboardPaste}
              label="Paste"
              shortcut="Ctrl+V"
              disabled={clipboard.nodes.length === 0}
              onClick={action(pasteFromClipboard)}
            />
            <MenuItem icon={CheckSquare} label="Select All" shortcut="Ctrl+A" onClick={action(selectAll)} />
            <Separator />
            <MenuItem
              icon={Grid3X3}
              label={settings.showGrid ? 'Hide Grid' : 'Show Grid'}
              onClick={action(() => updateSettings({ showGrid: !settings.showGrid }))}
            />
          </>
        )}
      </div>
    </>
  );
}

// ─── SubMenu (hover to expand) ──────────────────────────

function SubMenu({
  icon: Icon,
  label,
  children,
}: {
  icon?: React.ComponentType<{ size: number }>;
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const onEnter = () => {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  };
  const onLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ position: 'relative' }}
    >
      <button style={itemStyle}>
        {Icon && <Icon size={14} />}
        <span style={{ flex: 1 }}>{label}</span>
        <ChevronRight size={12} style={{ color: 'var(--text-dim, #64748b)' }} />
      </button>
      {open && (
        <div style={{ ...menuStyle, position: 'absolute', left: '100%', top: -4 }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Primitives ─────────────────────────────────────────

function MenuItem({
  icon: Icon, label, shortcut, onClick, variant, disabled, active,
}: {
  icon?: React.ComponentType<{ size: number }>;
  label: string;
  shortcut?: string;
  onClick: () => void;
  variant?: 'danger';
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        ...itemStyle,
        color: disabled
          ? 'var(--text-dim, #475569)'
          : variant === 'danger'
            ? '#ef4444'
            : 'var(--text, #e2e8f0)',
        opacity: disabled ? 0.5 : 1,
        background: active ? 'var(--surface-hover, #2a2a2a)' : 'transparent',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--surface-hover, #2a2a2a)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = active ? 'var(--surface-hover, #2a2a2a)' : 'transparent'; }}
    >
      {Icon && <Icon size={14} />}
      <span style={{ flex: 1 }}>{label}</span>
      {shortcut && <span style={{ fontSize: 10, color: 'var(--text-dim, #64748b)', marginLeft: 12 }}>{shortcut}</span>}
    </button>
  );
}

function Separator() {
  return <div style={{ height: 1, background: 'var(--border, #333)', margin: '3px 0' }} />;
}

// ─── Styles ─────────────────────────────────────────────

const menuStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 9999,
  minWidth: 190,
  background: 'rgba(17, 17, 24, 0.95)',
  border: '1px solid var(--border, #333)',
  borderRadius: 8,
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  padding: '4px 0',
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  height: 30,
  padding: '0 10px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text, #e2e8f0)',
  fontSize: 12,
  fontFamily: 'var(--font-sans, system-ui)',
  textAlign: 'left',
  textTransform: 'capitalize',
};
