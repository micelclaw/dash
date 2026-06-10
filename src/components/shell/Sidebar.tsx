/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { PanelLeftClose, PanelLeftOpen, Pin, PinOff } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSidebarStore } from '@/stores/sidebar.store';
import { MODULES } from '@/config/modules';
import { SidebarItem } from './SidebarItem';
import { SidebarGroup } from './SidebarGroup';
import { SortableSidebarItem } from './SortableSidebarItem';
import { ConnectionStatus } from './ConnectionStatus';
import { UserFooter } from './UserFooter';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface SidebarProps {
  onOpenCommandPalette: () => void;
  /** Force expanded mode (used in mobile drawer) */
  forceExpanded?: boolean;
}

const AUTO_COLLAPSE_DELAY = 3000; // 3s before auto-collapse
const HOVER_COLLAPSE_DELAY = 2000; // 2s after mouse leaves before re-collapsing

/** Clave de sección para los módulos sin grupo (top-level). */
const TOP_SECTION = '__top';

/**
 * Aplica el orden guardado del usuario a los ids por defecto del registry:
 * primero los guardados que sigan existiendo (en su orden), después los
 * módulos nuevos del registry (en su orden por defecto). Ids obsoletos en
 * el guardado se descartan.
 */
function applyOrder(defaultIds: string[], saved?: string[]): string[] {
  if (!saved || saved.length === 0) return defaultIds;
  const existing = new Set(defaultIds);
  const ordered = saved.filter((id) => existing.has(id));
  const orderedSet = new Set(ordered);
  return [...ordered, ...defaultIds.filter((id) => !orderedSet.has(id))];
}

// Solo se consideran drop targets de la MISMA sección que el item activo:
// las otras secciones ni se desplazan visualmente ni aceptan el drop
// (mismo patrón que columnAwareCollision en projects/KanbanBoard).
const sectionAwareCollision: CollisionDetection = (args) => {
  const activeSection = args.active.data.current?.section as string | undefined;
  if (!activeSection) return closestCenter(args);
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (c) => c.data.current?.section === activeSection,
    ),
  });
};

export function Sidebar({ forceExpanded }: SidebarProps) {
  const storeCollapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);
  const pinned = useSidebarStore((s) => s.pinned);
  const togglePin = useSidebarStore((s) => s.togglePin);
  const hoverExpanded = useSidebarStore((s) => s.hoverExpanded);
  const setHoverExpanded = useSidebarStore((s) => s.setHoverExpanded);
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);
  const navigate = useNavigate();
  const collapsed = forceExpanded ? false : storeCollapsed;

  const autoCollapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverCollapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Auto-collapse after delay when unpinned and expanded
  useEffect(() => {
    if (forceExpanded || pinned || collapsed) return;
    // Don't auto-collapse if hover-expanded (user is interacting)
    if (hoverExpanded) return;

    autoCollapseTimer.current = setTimeout(() => {
      setCollapsed(true);
    }, AUTO_COLLAPSE_DELAY);

    return () => {
      if (autoCollapseTimer.current) clearTimeout(autoCollapseTimer.current);
    };
  }, [forceExpanded, pinned, collapsed, hoverExpanded, setCollapsed]);

  // Hover-expand: mouse enters sidebar area when collapsed + unpinned
  const handleMouseEnter = useCallback(() => {
    if (pinned || forceExpanded) return;
    if (hoverCollapseTimer.current) {
      clearTimeout(hoverCollapseTimer.current);
      hoverCollapseTimer.current = null;
    }
    if (collapsed) {
      setHoverExpanded(true);
    }
  }, [pinned, forceExpanded, collapsed, setHoverExpanded]);

  // Hover-collapse: mouse leaves sidebar, start countdown to re-collapse
  const handleMouseLeave = useCallback(() => {
    if (pinned || forceExpanded || !hoverExpanded) return;
    hoverCollapseTimer.current = setTimeout(() => {
      setHoverExpanded(false);
    }, HOVER_COLLAPSE_DELAY);
  }, [pinned, forceExpanded, hoverExpanded, setHoverExpanded]);

  // Click anywhere outside sidebar → instant collapse (when unpinned + expanded)
  useEffect(() => {
    if (forceExpanded || pinned || collapsed) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current?.contains(e.target as Node)) return;
      // Cancel pending auto-collapse timer and collapse immediately
      if (autoCollapseTimer.current) clearTimeout(autoCollapseTimer.current);
      if (hoverExpanded) {
        setHoverExpanded(false);
      } else {
        setCollapsed(true);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [forceExpanded, pinned, collapsed, hoverExpanded, setCollapsed, setHoverExpanded]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoCollapseTimer.current) clearTimeout(autoCollapseTimer.current);
      if (hoverCollapseTimer.current) clearTimeout(hoverCollapseTimer.current);
    };
  }, []);

  const moduleOrder = useSidebarStore((s) => s.moduleOrder);
  const setSectionOrder = useSidebarStore((s) => s.setSectionOrder);

  const { ungrouped, groups } = useMemo(() => {
    const byId = new Map(MODULES.map((m) => [m.id, m]));
    const orderSection = (mods: typeof MODULES, section: string) =>
      applyOrder(mods.map((m) => m.id), moduleOrder[section]).map((id) => byId.get(id)!);

    const ungrouped = orderSection(MODULES.filter((m) => !m.group), TOP_SECTION);
    const grouped = MODULES.filter((m) => m.group);
    const groupNames = [...new Set(grouped.map((m) => m.group!))];
    const groups = groupNames.map((name) => ({
      name,
      modules: orderSection(grouped.filter((m) => m.group === name), name),
    }));
    return { ungrouped, groups };
  }, [moduleOrder]);

  // ─── Drag & drop: reordenar módulos dentro de su sección ────────
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragStart = useCallback((e: DragStartEvent) => {
    setActiveDragId(e.active.id as string);
  }, []);

  const onDragEnd = useCallback((e: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const activeSection = active.data.current?.section as string | undefined;
    const overSection = over.data.current?.section as string | undefined;
    // Cinturón además del collision filter: nunca cruzar de sección.
    if (!activeSection || activeSection !== overSection) return;

    const list = activeSection === TOP_SECTION
      ? ungrouped
      : groups.find((g) => g.name === activeSection)?.modules ?? [];
    const ids = list.map((m) => m.id);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx < 0 || newIdx < 0) return;
    setSectionOrder(activeSection, arrayMove(ids, oldIdx, newIdx));
  }, [ungrouped, groups, setSectionOrder]);

  const activeDragModule = activeDragId ? MODULES.find((m) => m.id === activeDragId) ?? null : null;

  return (
    <div
      ref={sidebarRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        width: collapsed ? 56 : 240,
        minWidth: collapsed ? 56 : 240,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        transition: 'width var(--transition-slow), min-width var(--transition-slow)',
        overflow: 'hidden',
        // Ensure sidebar is above content when hover-expanded
        ...(hoverExpanded ? { position: 'absolute' as const, zIndex: 50, boxShadow: 'var(--shadow-lg)' } : {}),
      }}
    >
      {/* Logo + toggle + pin */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 48,
          padding: collapsed ? '0 4px' : '0 8px 0 16px',
          justifyContent: collapsed ? 'center' : 'space-between',
          flexShrink: 0,
          gap: 4,
        }}
      >
        <button
          onClick={() => navigate('/chat')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text)',
            fontFamily: 'var(--font-sans)',
            padding: 0,
            minWidth: 0,
          }}
        >
          <img src="/favicon.png" width={20} height={20} alt="" style={{ flexShrink: 0 }} />
          {!collapsed && (
            <span style={{ fontSize: '0.9rem', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
              Micelclaw
            </span>
          )}
        </button>

        {/* Sidebar controls: pin + collapse toggle */}
        {!forceExpanded && !collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            {/* Pin button */}
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={togglePin}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: pinned ? 'var(--amber)' : 'var(--text-muted)',
                    padding: 4,
                    display: 'flex',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'color var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => { if (!pinned) e.currentTarget.style.color = 'var(--text)'; }}
                  onMouseLeave={(e) => { if (!pinned) e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  {pinned ? <Pin size={14} /> : <PinOff size={14} />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {pinned ? 'Unpin sidebar (auto-collapse)' : 'Pin sidebar (stay open)'}
              </TooltipContent>
            </Tooltip>

            {/* Collapse button */}
            <button
              onClick={toggle}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 4,
                display: 'flex',
                borderRadius: 'var(--radius-sm)',
                transition: 'color var(--transition-fast)',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              title="Collapse sidebar (⌘B)"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
        )}

        {/* Collapsed: expand button only */}
        {!forceExpanded && collapsed && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={toggle}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: 4,
                  display: 'flex',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'color var(--transition-fast)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <PanelLeftOpen size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar (⌘B)</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Navigation — los módulos se reordenan por drag & drop DENTRO de su
          sección (collision filter + guard de onDragEnd impiden cruzar).
          Drag deshabilitado en modo rail (collapsed). */}
      <ScrollArea className="flex-1">
        <DndContext
          sensors={dndSensors}
          collisionDetection={sectionAwareCollision}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveDragId(null)}
        >
          <div style={{ padding: collapsed ? '0 4px' : '0 8px' }}>
            {/* Ungrouped items (Chat, Search) */}
            <SortableContext items={ungrouped.map((m) => m.id)} strategy={verticalListSortingStrategy}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {ungrouped.map((mod) => (
                  <SortableSidebarItem
                    key={mod.id}
                    module={mod}
                    section={TOP_SECTION}
                    collapsed={collapsed}
                    disabled={collapsed}
                    onNavigate={() => setMobileOpen(false)}
                  />
                ))}
              </div>
            </SortableContext>

            {/* Grouped items */}
            {groups.map((group) => (
              <SortableContext key={group.name} items={group.modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                <SidebarGroup label={group.name} collapsed={collapsed}>
                  {group.modules.map((mod) => (
                    <SortableSidebarItem
                      key={mod.id}
                      module={mod}
                      section={group.name}
                      collapsed={collapsed}
                      disabled={collapsed}
                      onNavigate={() => setMobileOpen(false)}
                    />
                  ))}
                </SidebarGroup>
              </SortableContext>
            ))}
          </div>

          {/* Preview flotante del item arrastrado */}
          <DragOverlay>
            {activeDragModule ? (
              <div style={{
                background: 'var(--surface-hover)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--border-hover)',
              }}>
                <SidebarItem module={activeDragModule} collapsed={false} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </ScrollArea>

      {/* Footer */}
      <div
        style={{
          flexShrink: 0,
          padding: collapsed ? '8px 4px' : '8px',
          borderTop: '1px solid var(--border)',
        }}
      >
        <ConnectionStatus collapsed={collapsed} />
        <UserFooter collapsed={collapsed} />
      </div>
    </div>
  );
}
