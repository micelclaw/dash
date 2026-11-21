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
import { useI18n } from '@/i18n';
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

const PANE_SHAPE_LABEL_KEYS: Record<string, string> = {
  rectangle: 'sketches.contextMenu.pane.rectangle',
  rounded: 'sketches.contextMenu.pane.rounded',
  diamond: 'sketches.contextMenu.pane.diamond',
  circle: 'sketches.contextMenu.pane.circle',
  cylinder: 'sketches.contextMenu.pane.cylinder',
  hexagon: 'sketches.contextMenu.pane.hexagon',
  cloud: 'sketches.contextMenu.pane.cloud',
  sticky: 'sketches.contextMenu.pane.sticky',
  table: 'sketches.contextMenu.pane.table',
  card: 'sketches.contextMenu.pane.card',
};

const NODE_SHAPE_LABEL_KEYS: Record<NodeShapeType, string> = {
  rectangle: 'sketches.contextMenu.node.shape.rectangle',
  rounded: 'sketches.contextMenu.node.shape.rounded',
  diamond: 'sketches.contextMenu.node.shape.diamond',
  circle: 'sketches.contextMenu.node.shape.circle',
  cylinder: 'sketches.contextMenu.node.shape.cylinder',
  parallelogram: 'sketches.contextMenu.node.shape.parallelogram',
  hexagon: 'sketches.contextMenu.node.shape.hexagon',
  cloud: 'sketches.contextMenu.node.shape.cloud',
  document: 'sketches.contextMenu.node.shape.document',
  group: 'sketches.contextMenu.node.shape.group',
  sticky: 'sketches.contextMenu.node.shape.sticky',
  image: 'sketches.contextMenu.node.shape.image',
  table: 'sketches.contextMenu.node.shape.table',
  card: 'sketches.contextMenu.node.shape.card',
  badge: 'sketches.contextMenu.node.shape.badge',
  banner: 'sketches.contextMenu.node.shape.banner',
  triangle: 'sketches.contextMenu.node.shape.triangle',
  trapezoid: 'sketches.contextMenu.node.shape.trapezoid',
  pentagon: 'sketches.contextMenu.node.shape.pentagon',
  queue: 'sketches.contextMenu.node.shape.queue',
  stack: 'sketches.contextMenu.node.shape.stack',
  database3d: 'sketches.contextMenu.node.shape.database3d',
  actor: 'sketches.contextMenu.node.shape.actor',
  note: 'sketches.contextMenu.node.shape.note',
  separator: 'sketches.contextMenu.node.shape.separator',
  server: 'sketches.contextMenu.node.shape.server',
  desktop: 'sketches.contextMenu.node.shape.desktop',
  mobile: 'sketches.contextMenu.node.shape.mobile',
  router: 'sketches.contextMenu.node.shape.router',
  firewall: 'sketches.contextMenu.node.shape.firewall',
  markdown: 'sketches.contextMenu.node.shape.markdown',
  codeblock: 'sketches.contextMenu.node.shape.codeblock',
  link: 'sketches.contextMenu.node.shape.link',
  list: 'sketches.contextMenu.node.shape.list',
  embed: 'sketches.contextMenu.node.shape.embed',
};

// ─── Main Context Menu ──────────────────────────────────

export function DiagramContextMenu({ state, onClose, onAddNode }: Props) {
  const { t } = useI18n();
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
              label={t('sketches.contextMenu.node.editLabel')}
              shortcut="Enter"
              onClick={action(() => setEditingNode(state.id!))}
            />
            <MenuItem icon={Copy} label={t('sketches.contextMenu.node.duplicate')} shortcut="Ctrl+D" onClick={action(() => duplicateNodes([state.id!]))} />
            <MenuItem icon={Trash2} label={t('sketches.contextMenu.node.delete')} shortcut="Del" onClick={action(() => removeNode(state.id!))} variant="danger" />
            <Separator />

            {hasMultiSelect && (
              <>
                <SubMenu icon={AlignStartVertical} label={t('sketches.contextMenu.node.align')}>
                  <MenuItem icon={AlignStartVertical} label={t('sketches.contextMenu.node.left')} onClick={action(() => alignNodes(selectedIds, 'left'))} />
                  <MenuItem icon={AlignCenterVertical} label={t('sketches.contextMenu.node.center')} onClick={action(() => alignNodes(selectedIds, 'center'))} />
                  <MenuItem icon={AlignEndVertical} label={t('sketches.contextMenu.node.right')} onClick={action(() => alignNodes(selectedIds, 'right'))} />
                  <Separator />
                  <MenuItem icon={AlignStartHorizontal} label={t('sketches.contextMenu.node.top')} onClick={action(() => alignNodes(selectedIds, 'top'))} />
                  <MenuItem icon={AlignCenterHorizontal} label={t('sketches.contextMenu.node.middle')} onClick={action(() => alignNodes(selectedIds, 'middle'))} />
                  <MenuItem icon={AlignEndHorizontal} label={t('sketches.contextMenu.node.bottom')} onClick={action(() => alignNodes(selectedIds, 'bottom'))} />
                </SubMenu>

                <SubMenu icon={ArrowLeftRight} label={t('sketches.contextMenu.node.distribute')}>
                  <MenuItem icon={ArrowLeftRight} label={t('sketches.contextMenu.node.horizontal')} onClick={action(() => distributeNodes(selectedIds, 'horizontal'))} />
                  <MenuItem icon={ArrowUpDown} label={t('sketches.contextMenu.node.vertical')} onClick={action(() => distributeNodes(selectedIds, 'vertical'))} />
                </SubMenu>
                <Separator />
              </>
            )}

            <SubMenu icon={Layers} label={t('sketches.contextMenu.node.order')}>
              <MenuItem icon={ArrowUpToLine} label={t('sketches.contextMenu.node.bringToFront')} shortcut="Ctrl+]" onClick={action(() => bringToFront(state.id!))} />
              <MenuItem icon={ArrowDownToLine} label={t('sketches.contextMenu.node.sendToBack')} shortcut="Ctrl+[" onClick={action(() => sendToBack(state.id!))} />
            </SubMenu>

            <SubMenu icon={StickyNote} label={t('sketches.contextMenu.node.changeShape')}>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {VALID_NODE_TYPES.map((shape) => (
                  <MenuItem
                    key={shape}
                    label={t(NODE_SHAPE_LABEL_KEYS[shape])}
                    onClick={action(() => changeShape(state.id!, shape))}
                    active={node?.type === shape}
                  />
                ))}
              </div>
            </SubMenu>

            <div style={{ padding: '4px 8px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim, #64748b)', marginBottom: 4 }}>{t('sketches.contextMenu.node.color')}</div>
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', maxWidth: 170 }}>
                {COLOR_PALETTE.slice(0, 16).map((c) => (
                  <button
                    key={c}
                    title={t('sketches.contextMenu.node.setColor', { color: c })}
                    aria-label={t('sketches.contextMenu.node.setColor', { color: c })}
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
              label={t(isLocked ? 'sketches.contextMenu.node.unlock' : 'sketches.contextMenu.node.lock')}
              onClick={action(() => lockNode(state.id!, !isLocked))}
            />

            {node?.type === 'group' && (
              <MenuItem
                icon={Ungroup}
                label={t('sketches.contextMenu.node.ungroup')}
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
              label={t('sketches.contextMenu.connection.editLabel')}
              onClick={action(() => selectElement('edge', state.id!))}
            />
            <MenuItem icon={Trash2} label={t('sketches.contextMenu.connection.delete')} shortcut="Del" onClick={action(() => removeEdge(state.id!))} variant="danger" />
            <Separator />

            <SubMenu label={t('sketches.contextMenu.connection.type')}>
              {[
                { value: 'smoothstep', key: 'sketches.contextMenu.connection.smoothStep' },
                { value: 'step', key: 'sketches.contextMenu.connection.step' },
                { value: 'straight', key: 'sketches.contextMenu.connection.straight' },
                { value: 'default', key: 'sketches.contextMenu.connection.bezier' },
                { value: 'smart', key: 'sketches.contextMenu.connection.smart' },
                { value: 'elbow', key: 'sketches.contextMenu.connection.elbow' },
                { value: 'curved', key: 'sketches.contextMenu.connection.curved' },
              ].map(({ value, key }) => (
                <MenuItem
                  key={value}
                  label={t(key)}
                  onClick={action(() => updateEdgeType(state.id!, value))}
                  active={edge?.type === value}
                />
              ))}
            </SubMenu>

            <MenuItem
              icon={ArrowRightLeft}
              label={t('sketches.contextMenu.connection.reverseDirection')}
              onClick={action(() => reverseEdge(state.id!))}
            />
            <Separator />

            <MenuItem
              icon={Zap}
              label={t(edge?.animated ? 'sketches.contextMenu.connection.disableAnimation' : 'sketches.contextMenu.connection.enableAnimation')}
              onClick={action(() => updateEdgeAnimated(state.id!, !edge?.animated))}
            />
            <MenuItem
              icon={Minus}
              label={t((edge?.data as Record<string, unknown>)?.dashed ? 'sketches.contextMenu.connection.solidLine' : 'sketches.contextMenu.connection.dashedLine')}
              onClick={action(() => updateEdgeData(state.id!, { dashed: !(edge?.data as Record<string, unknown>)?.dashed }))}
            />
          </>
        )}

        {/* ─── Pane Context Menu ─────────────────── */}
        {state.type === 'pane' && (
          <>
            <SubMenu icon={StickyNote} label={t('sketches.contextMenu.pane.addShape')}>
              {(['rectangle', 'rounded', 'diamond', 'circle', 'cylinder', 'hexagon', 'cloud', 'sticky', 'table', 'card'] as const).map((shape) => (
                <MenuItem
                  key={shape}
                  label={t(PANE_SHAPE_LABEL_KEYS[shape]!)}
                  onClick={action(() => onAddNode?.(shape, state.position))}
                />
              ))}
            </SubMenu>

            <MenuItem
              icon={ClipboardPaste}
              label={t('sketches.contextMenu.pane.paste')}
              shortcut="Ctrl+V"
              disabled={clipboard.nodes.length === 0}
              onClick={action(pasteFromClipboard)}
            />
            <MenuItem icon={CheckSquare} label={t('sketches.contextMenu.pane.selectAll')} shortcut="Ctrl+A" onClick={action(selectAll)} />
            <Separator />
            <MenuItem
              icon={Grid3X3}
              label={t(settings.showGrid ? 'sketches.contextMenu.pane.hideGrid' : 'sketches.contextMenu.pane.showGrid')}
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
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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
  background: 'var(--glass-95)',
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
