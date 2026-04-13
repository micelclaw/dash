/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { PanelLeftClose, PanelLeftOpen, Pin, PinOff } from 'lucide-react';
import { useSidebarStore } from '@/stores/sidebar.store';
import { MODULES } from '@/config/modules';
import { SidebarItem } from './SidebarItem';
import { SidebarGroup } from './SidebarGroup';
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

  const { ungrouped, groups } = useMemo(() => {
    const ungrouped = MODULES.filter((m) => !m.group);
    const grouped = MODULES.filter((m) => m.group);
    const groupNames = [...new Set(grouped.map((m) => m.group!))];
    const groups = groupNames.map((name) => ({
      name,
      modules: grouped.filter((m) => m.group === name),
    }));
    return { ungrouped, groups };
  }, []);

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

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <div style={{ padding: collapsed ? '0 4px' : '0 8px' }}>
          {/* Ungrouped items (Chat, Search) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {ungrouped.map((mod) => (
              <SidebarItem
                key={mod.id}
                module={mod}
                collapsed={collapsed}
                onNavigate={() => setMobileOpen(false)}
              />
            ))}
          </div>

          {/* Grouped items */}
          {groups.map((group) => (
            <SidebarGroup key={group.name} label={group.name} collapsed={collapsed}>
              {group.modules.map((mod) => (
                <SidebarItem
                  key={mod.id}
                  module={mod}
                  collapsed={collapsed}
                  onNavigate={() => setMobileOpen(false)}
                />
              ))}
            </SidebarGroup>
          ))}
        </div>
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
